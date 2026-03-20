import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTenant } from '@/context/TenantContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/utils/formatters';
import { CalendarDays, Cake } from 'lucide-react';

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
};

async function getEdgeFunctionErrorMessage(e: unknown): Promise<string> {
  let msg = e instanceof Error ? e.message : 'Erro ao carregar aniversários';
  const ctx = (e as any)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error && typeof body.error === 'string') msg = body.error;
    } catch {
      // ignore parse failures
    }
  }
  return msg;
}

function looksLikeUrl(s?: string | null): boolean {
  if (!s) return false;
  return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/');
}

export default function AniversariosPage() {
  const { currentEmpresaId } = useTenant();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BirthdaysApiResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const companyId = useMemo(() => {
    if (currentEmpresaId === 'consolidado') return null;
    return currentEmpresaId;
  }, [currentEmpresaId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isSupabaseConfigured() || !supabase) return;
      setLoading(true);
      setErrorMsg(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) throw new Error('Sessão não encontrada. Faça login novamente.');

        const { data: invokeData, error } = await supabase.functions.invoke('birthdays', {
          body: {
            company_id: companyId,
            nowISO: new Date().toISOString(),
          },
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        } as any);
        if (error) throw error;
        const parsed = invokeData as BirthdaysApiResponse;
        if (!cancelled) setData(parsed);
      } catch (e) {
        // Tenta extrair a mensagem real retornada pela Edge Function (body: { error: ... }).
        const msg = await getEdgeFunctionErrorMessage(e);
        // eslint-disable-next-line no-console
        console.error('[AniversariosPage] birthdays invoke failed', e);
        if (!cancelled) setErrorMsg(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const monthBirthdays = data?.month_birthdays ?? [];
  const todayBirthdays = data?.today_birthdays ?? [];

  const monthFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return monthBirthdays;
    return monthBirthdays.filter(p => p.name.toLowerCase().includes(q));
  }, [monthBirthdays, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Cake className="h-5 w-5 text-primary" />
            Aniversários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Lista mensal e destaque do aniversariante do dia.</p>
        </div>
        <div className="relative max-w-xs">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

      {todayBirthdays.length > 0 && (
        <div className="bg-card border border-border/80 rounded-xl p-5">
          <div className="font-semibold mb-3">Aniversariante(s) do dia</div>
          <div className="flex flex-wrap gap-4">
            {todayBirthdays.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/30 px-3 py-2">
                <Avatar className="h-10 w-10 ring-1 ring-border/50">
                  {looksLikeUrl(p.avatar) ? <AvatarImage src={p.avatar} /> : null}
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
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border/80 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="font-semibold">Aniversários do mês</div>
          <Button variant="outline" disabled>
            Total: {monthFiltered.length}
          </Button>
        </div>

        {monthFiltered.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-4">Nenhum aniversariante para este contexto.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthFiltered.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/30 px-3 py-2">
                <Avatar className="h-10 w-10 ring-1 ring-border/50">
                  {looksLikeUrl(p.avatar) ? <AvatarImage src={p.avatar} /> : null}
                  <AvatarFallback>
                    {(p.name || '?')
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map(w => w[0]?.toUpperCase())
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" title={p.name}>{p.name}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(p.birth_date)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

