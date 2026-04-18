import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { AniversariosParabensBlock } from '@/modules/comunicacao-interna/AniversariosParabensBlock';
import { AniversariosMeusParabensPanel } from '@/modules/comunicacao-interna/AniversariosMeusParabensPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/utils/formatters';
import { CalendarDays, Cake, MapPin } from 'lucide-react';
import { Calendar as UiCalendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { normalizePublicMediaUrl } from '@/utils/publicMediaUrl';
import { getSupabaseFunctionsInvokeErrorMessage } from '@/utils/supabaseFunctionsInvokeError';

type BirthdayPerson = {
  id: number;
  name: string;
  birth_date: string; // YYYY-MM-DD
  company_id: number;
  avatar?: string | null;
};

type BirthdaysApiResponse = {
  month_birthdays: BirthdayPerson[];
  today_birthdays: BirthdayPerson[];
  /** Quando presente (edge function actualizada), lista completa para filtrar por mês no cliente. */
  all_birthdays?: BirthdayPerson[];
};

function looksLikeUrl(s?: string | null): boolean {
  if (!s) return false;
  return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/');
}

/** URL da foto: prioridade `colaboradores.fotoPerfilUrl`, depois `avatar` da API só se for URL. */
function birthdayProfilePhotoUrl(p: BirthdayPerson, colaboradores: { id: number; fotoPerfilUrl?: string | null }[]): string | null {
  const c = colaboradores.find(x => x.id === p.id);
  const foto = c?.fotoPerfilUrl?.trim();
  if (foto) return foto;
  const a = typeof p.avatar === 'string' ? p.avatar.trim() : '';
  if (a && looksLikeUrl(a)) return a;
  return null;
}

function birthdayPhotoSrc(
  p: BirthdayPerson,
  colaboradores: { id: number; fotoPerfilUrl?: string | null }[],
): string | undefined {
  const u = birthdayProfilePhotoUrl(p, colaboradores);
  return u ? normalizePublicMediaUrl(u) ?? u : undefined;
}

/** Mês (0–11) e dia a partir de YYYY-MM-DD (calendário do próprio campo). */
function birthMonthAndDayFromIso(iso: string): { month: number; day: number } {
  const part = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(part);
  if (!m) return { month: 0, day: 0 };
  return { month: Number(m[2]) - 1, day: Number(m[3]) };
}

/** Fuso alinhado à política RLS na BD (aniversário “de hoje”). */
const TZ_ANIVERSARIO = 'Africa/Luanda';

function getTodayMonthDayLuanda(): { month: number; day: number } {
  const now = new Date();
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ_ANIVERSARIO,
    month: 'numeric',
    day: 'numeric',
  });
  const parts = f.formatToParts(now);
  let month = 1;
  let day = 1;
  for (const p of parts) {
    if (p.type === 'month') month = Number(p.value);
    if (p.type === 'day') day = Number(p.value);
  }
  return { month: month - 1, day };
}

function isBirthdayTodayLuanda(birthDateIso: string): boolean {
  const { month, day } = birthMonthAndDayFromIso(birthDateIso);
  const t = getTodayMonthDayLuanda();
  return month === t.month && day === t.day;
}

/** Colaboradores vindos do Supabase (snake_case). */
type ColaboradorRow = {
  id: number;
  nome: string;
  data_nascimento: string;
  empresa_id: number;
  status?: string;
  foto_perfil_url?: string | null;
};

export default function AniversariosPage() {
  const { user } = useAuth();
  const { colaboradores } = useData();
  const { currentEmpresaId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [people, setPeople] = useState<BirthdayPerson[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const companyId = useMemo(() => {
    if (currentEmpresaId === 'consolidado') return null;
    return currentEmpresaId;
  }, [currentEmpresaId]);

  const loadViaEdgeFunction = useCallback(async (): Promise<BirthdayPerson[]> => {
    if (!isSupabaseConfigured() || !supabase) return [];
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Sessão não encontrada. Faça login novamente.');

    const { data: invokeData, error } = await supabase.functions.invoke('birthdays', {
      body: {
        company_id: companyId,
        nowISO: new Date().toISOString(),
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error) throw error;
    const parsed = invokeData as BirthdaysApiResponse;
    if (parsed.all_birthdays && parsed.all_birthdays.length > 0) {
      return parsed.all_birthdays;
    }
    const month = parsed?.month_birthdays ?? [];
    const today = parsed?.today_birthdays ?? [];
    const byId = new Map<number, BirthdayPerson>();
    for (const p of month) byId.set(p.id, p);
    for (const p of today) byId.set(p.id, p);
    return Array.from(byId.values());
  }, [companyId]);

  /** Carrega colaboradores com data de nascimento a partir da base de dados. */
  const loadFromDatabase = useCallback(async (): Promise<BirthdayPerson[]> => {
    if (!isSupabaseConfigured() || !supabase) return [];

    let q = supabase
      .from('colaboradores')
      .select('id, nome, data_nascimento, empresa_id, status, foto_perfil_url')
      .not('data_nascimento', 'is', null)
      .eq('status', 'Activo')
      .order('nome', { ascending: true });

    if (companyId != null) {
      q = q.eq('empresa_id', companyId);
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    const list = (rows ?? []) as ColaboradorRow[];
    const ids = list.map(r => r.id);
    const avatarById = new Map<number, string | null>();

    if (ids.length > 0) {
      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('colaborador_id, avatar')
        .in('colaborador_id', ids);
      if (!pErr && profs) {
        for (const pr of profs as { colaborador_id: number; avatar: string | null }[]) {
          avatarById.set(pr.colaborador_id, pr.avatar ?? null);
        }
      }
    }

    return list.map(c => {
      const foto = (c.foto_perfil_url ?? '').trim();
      const letter = avatarById.get(c.id);
      const letterAsUrl = letter && looksLikeUrl(letter) ? letter : null;
      return {
        id: c.id,
        name: c.nome,
        birth_date: c.data_nascimento,
        company_id: c.empresa_id,
        avatar: foto || letterAsUrl || null,
      };
    });
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isSupabaseConfigured() || !supabase) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        let list: BirthdayPerson[] = [];
        try {
          list = await loadFromDatabase();
        } catch (dbErr) {
          // RLS ou permissões: recorre à edge function (service role no servidor)
          console.warn('[AniversariosPage] consulta directa falhou, a usar edge function', dbErr);
          list = await loadViaEdgeFunction();
        }
        if (!cancelled) setPeople(list);
      } catch (e) {
        const msg = await getSupabaseFunctionsInvokeErrorMessage(
          e,
          'Não foi possível carregar os aniversários. Confirme no Supabase que a função «birthdays» está publicada.',
        );
        if (!cancelled) setErrorMsg(msg);
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadFromDatabase, loadViaEdgeFunction]);

  const todayBirthdays = useMemo(() => {
    return people.filter(p => isBirthdayTodayLuanda(p.birth_date));
  }, [people]);

  const todayIds = useMemo(() => new Set(todayBirthdays.map(t => t.id)), [todayBirthdays]);

  const imBirthdayToday =
    user?.colaboradorId != null && todayIds.has(user.colaboradorId);

  /** Aniversariantes cujo aniversário cai no mês visível no calendário. */
  const birthdaysInVisibleMonth = useMemo(() => {
    const vm = calendarMonth.getMonth();
    return people.filter(p => birthMonthAndDayFromIso(p.birth_date).month === vm);
  }, [people, calendarMonth]);

  const monthFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return birthdaysInVisibleMonth;
    return birthdaysInVisibleMonth.filter(p => p.name.toLowerCase().includes(q));
  }, [birthdaysInVisibleMonth, search]);

  const sortedForList = useMemo(() => {
    return [...monthFiltered].sort(
      (a, b) => birthMonthAndDayFromIso(a.birth_date).day - birthMonthAndDayFromIso(b.birth_date).day,
    );
  }, [monthFiltered]);

  /** Dias do mês visível que têm aniversário (para realçar no calendário). */
  const birthdayCalendarDates = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const dates: Date[] = [];
    for (let day = 1; day <= last; day++) {
      const has = birthdaysInVisibleMonth.some(p => {
        const { month: bm, day: bd } = birthMonthAndDayFromIso(p.birth_date);
        return bm === m && bd === day;
      });
      if (has) dates.push(new Date(y, m, day));
    }
    return dates;
  }, [calendarMonth, birthdaysInVisibleMonth]);

  const mainContent = (
    <>
      {loading && <p className="text-sm text-muted-foreground">A carregar colaboradores...</p>}
      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

      {todayBirthdays.length > 0 && (
        <div className="bg-card border border-border/80 rounded-xl p-5">
          <div className="font-semibold mb-3">Aniversariante(s) de hoje</div>
          <p className="text-xs text-muted-foreground mb-4">
            Parabéns só podem ser enviados <span className="font-medium">neste dia</span> (referência:{' '}
            {TZ_ANIVERSARIO.replace('_', ' ')}). Se hoje é o teu aniversário, abre a aba &quot;Os meus parabéns&quot; para ver todas as mensagens.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            {todayBirthdays.map(p => {
              const imgSrc = birthdayPhotoSrc(p, colaboradores);
              return (
              <div
                key={p.id}
                className="flex min-w-[min(100%,280px)] flex-1 flex-col gap-2 rounded-xl border border-border/60 bg-background/30 px-3 py-3 sm:max-w-md"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-1 ring-border/50">
                    {imgSrc ? <AvatarImage src={imgSrc} alt="" /> : null}
                    <AvatarFallback>
                      {(p.name || '?')
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map(w => w[0]?.toUpperCase())
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(p.birth_date)}</div>
                  </div>
                </div>
                <AniversariosParabensBlock
                  destinatario={{ id: p.id, name: p.name, company_id: p.company_id }}
                  isRecipientMe={user?.colaboradorId === p.id}
                  isBirthdayToday
                />
              </div>
            );
            })}
          </div>
        </div>
      )}

      <div className="bg-card border border-border/80 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Aniversariantes do mês</h2>
            <p className="text-sm text-muted-foreground mt-1 capitalize">
              {format(calendarMonth, 'MMMM yyyy', { locale: pt })}
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>
            Total: {sortedForList.length}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_1fr] gap-6 items-start">
          <div className="overflow-hidden rounded-xl border border-border/80 mx-auto w-full max-w-[340px]">
            <UiCalendar
              month={calendarMonth}
              onMonthChange={d => d && setCalendarMonth(d)}
              locale={pt}
              modifiers={{
                aniversarios: birthdayCalendarDates,
              }}
              modifiersClassNames={{
                aniversarios: 'bg-amber-100/90 dark:bg-amber-950/50 text-amber-900 dark:text-amber-100 font-semibold',
              }}
            />
            <p className="text-[11px] text-muted-foreground px-3 pb-3 text-center">
              Dias em destaque têm aniversário. Navegue no mês para ver a lista ao lado.
            </p>
          </div>

          <div className="min-h-[200px]">
            {sortedForList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">
                Nenhum aniversariante neste mês{search.trim() ? ' com o filtro actual.' : '.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedForList.map(p => {
                  const day = birthMonthAndDayFromIso(p.birth_date).day;
                  const isHoje = todayIds.has(p.id);
                  const imgSrc = birthdayPhotoSrc(p, colaboradores);
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        'flex flex-col gap-2 rounded-xl border border-border/60 bg-background/30',
                        'hover:bg-muted/40 transition-colors overflow-hidden',
                      )}
                    >
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                          <span className="text-[10px] font-medium uppercase leading-none opacity-80">
                            {format(calendarMonth, 'MMM', { locale: pt })}
                          </span>
                          <span className="text-lg font-bold leading-tight">{day}</span>
                        </div>
                        <Avatar className="h-10 w-10 ring-1 ring-border/50">
                          {imgSrc ? <AvatarImage src={imgSrc} alt="" /> : null}
                          <AvatarFallback>
                            {(p.name || '?')
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map(w => w[0]?.toUpperCase())
                              .join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate" title={p.name}>
                            {p.name}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0 opacity-60" />
                            Nascimento: {formatDate(p.birth_date)}
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-border/50 px-3 pb-3 pt-0">
                        <AniversariosParabensBlock
                          destinatario={{ id: p.id, name: p.name, company_id: p.company_id }}
                          isRecipientMe={user?.colaboradorId === p.id}
                          isBirthdayToday={isHoje}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Cake className="h-5 w-5 text-primary" />
            Aniversários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dados dos colaboradores na base de dados (<span className="font-medium">data de nascimento</span>). Use o
            calendário para mudar o mês e ver os aniversariantes.
          </p>
        </div>
        <div className="relative max-w-xs w-full sm:w-auto">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {imBirthdayToday && user?.colaboradorId != null ? (
        <Tabs defaultValue="geral" className="w-full space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="geral">Aniversários</TabsTrigger>
            <TabsTrigger value="meus">Os meus parabéns</TabsTrigger>
          </TabsList>
          <TabsContent value="geral" className="space-y-6 mt-0">
            {mainContent}
          </TabsContent>
          <TabsContent value="meus" className="mt-0">
            <AniversariosMeusParabensPanel destinatarioColaboradorId={user.colaboradorId} />
          </TabsContent>
        </Tabs>
      ) : (
        mainContent
      )}
    </div>
  );
}
