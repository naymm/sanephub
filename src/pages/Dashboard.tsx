import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useNotifications } from '@/context/NotificationContext';
import { KpiCard } from '@/components/shared/KpiCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getCurrentDatePT, formatKz, formatDate, diasRestantes, getGreeting } from '@/utils/formatters';
import { UsersRound, ShieldCheck, TrendingUp, Receipt, Search, Calendar as LucideCalendar, Download, Star, Heart, MessageCircle, MapPin, Clock, Cake } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as UiCalendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DayContent, type DayContentProps } from 'react-day-picker';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Evento } from '@/types';
import { hasModuleAccess } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { normalizePublicMediaUrl } from '@/utils/publicMediaUrl';
import { getSupabaseFunctionsInvokeErrorMessage } from '@/utils/supabaseFunctionsInvokeError';

type BirthdayPerson = {
  id: number;
  name: string;
  birth_date: string;
  company_id: number;
  avatar?: string | null;
};

/** Mês/dia do aniversário no calendário local (alinhado com o que o utilizador considera «hoje»). */
function isBirthdayAnniversaryToday(birthDateIso: string): boolean {
  const part = String(birthDateIso).slice(0, 10);
  const m = part.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const now = new Date();
  return month === now.getMonth() + 1 && day === now.getDate();
}

function filterBirthdaysInLocalMonth(all: BirthdayPerson[], ref: Date): BirthdayPerson[] {
  const mm = ref.getMonth() + 1;
  return all.filter(p => {
    const part = String(p.birth_date).slice(0, 10);
    const m = part.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return false;
    return Number(m[2]) === mm;
  });
}

const COLORS = ['#d4a926', '#a57e26', '#d4a926', '#10B981', '#F59E0B', '#64748B', '#8B5CF6'];

export default function Dashboard() {
  const { user } = useAuth();
  const { colaboradores, requisicoes, contratos, reunioes, processos, prazos, centrosCusto, pagamentos, documentosOficiais, noticias, eventos } = useData();
  const { currentEmpresaId } = useTenant();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [docQuery, setDocQuery] = useState('');
  const [likesCountByNewsId, setLikesCountByNewsId] = useState<Record<number, number>>({});
  const [commentsCountByNewsId, setCommentsCountByNewsId] = useState<Record<number, number>>({});
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [birthdaysToday, setBirthdaysToday] = useState<BirthdayPerson[]>([]);
  const [birthdaysMonth, setBirthdaysMonth] = useState<BirthdayPerson[]>([]);
  const [birthdaysLoading, setBirthdaysLoading] = useState(false);
  const [birthdaysError, setBirthdaysError] = useState<string | null>(null);

  const looksLikeUrl = (s?: string | null) => !!s && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/'));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isSupabaseConfigured() || !supabase) return;
      setBirthdaysLoading(true);
      setBirthdaysError(null);
      try {
        const company_id = currentEmpresaId === 'consolidado' ? null : currentEmpresaId;
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) throw new Error('Sessão não encontrada. Faça login novamente.');

        const { data: invokeData, error } = await supabase.functions.invoke('birthdays', {
          body: { company_id, nowISO: new Date().toISOString() },
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        } as any);
        if (error) {
          const msg = await getSupabaseFunctionsInvokeErrorMessage(
            error,
            'Não foi possível carregar os aniversários. Confirme no Supabase que a função «birthdays» está publicada e que os segredos estão definidos.',
          );
          if (!cancelled) setBirthdaysError(msg);
          return;
        }
        const parsed = invokeData as {
          today_birthdays?: BirthdayPerson[];
          month_birthdays?: BirthdayPerson[];
          all_birthdays?: BirthdayPerson[];
        };
        if (!cancelled) {
          const all = parsed.all_birthdays;
          if (Array.isArray(all)) {
            const todayLocal = all.filter(p => isBirthdayAnniversaryToday(p.birth_date));
            setBirthdaysToday(todayLocal);
            setBirthdaysMonth(filterBirthdaysInLocalMonth(all, new Date()));
          } else {
            setBirthdaysToday(parsed.today_birthdays ?? []);
            setBirthdaysMonth(parsed.month_birthdays ?? []);
          }
        }
      } catch (e) {
        if (!cancelled) setBirthdaysError(e instanceof Error ? e.message : 'Erro ao carregar aniversários');
      } finally {
        if (!cancelled) setBirthdaysLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [currentEmpresaId]);

  useEffect(() => {
    if (!birthdaysToday.length) return;
    try {
      const key = `birthday_notified_${new Date().toISOString().slice(0, 10)}`;
      const already = localStorage.getItem(key);
      if (already) return;
      localStorage.setItem(key, '1');
      addNotification({
        tipo: 'sucesso',
        titulo: 'Aniversário(s) do dia',
        mensagem: `Parabéns a ${birthdaysToday.map(b => b.name.split(' ')[0]).join(', ')}!`,
        moduloOrigem: 'comunicacao-interna',
        destinatarioPerfil: ['Admin', 'PCA', 'Planeamento', 'Director', 'RH', 'Financeiro', 'Contabilidade', 'Secretaria', 'Juridico'],
        link: '/comunicacao-interna/aniversarios',
      });
    } catch {
      // ignore
    }
  }, [birthdaysToday, addNotification]);

  useEffect(() => {
    const now = Date.now();
    const todayKey = new Date().toISOString().slice(0, 10);
    const candidates = eventos.filter(e => {
      if (!e.alertaEm) return false;
      const t = new Date(e.alertaEm).getTime();
      // Janela de 60 min após o alerta
      return t <= now && t >= now - 60 * 60 * 1000;
    });
    if (candidates.length === 0) return;

    for (const e of candidates) {
      const key = `event_alert_notified_${e.id}_${todayKey}`;
      try {
        const already = localStorage.getItem(key);
        if (already) continue;
        localStorage.setItem(key, '1');
        addNotification({
          tipo: 'info',
          titulo: 'Lembrete de evento',
          mensagem: `O evento "${e.titulo}" está prestes a acontecer.`,
          moduloOrigem: 'comunicacao-interna',
          destinatarioPerfil: ['Admin', 'PCA', 'Planeamento', 'Director', 'RH', 'Financeiro', 'Contabilidade', 'Secretaria', 'Juridico'],
          link: `/comunicacao-interna/eventos/${e.id}`,
        });
      } catch {
        // ignore
      }
    }
  }, [eventos, addNotification]);

  const activeClients = colaboradores.filter(c => c.status === 'Activo').length;

  const receita = pagamentos
    .filter(p => p.status !== 'Devolvido')
    .reduce((s, p) => s + p.valor, 0);

  const despesas = requisicoes
    .filter(r => r.status === 'Pago')
    .reduce((s, r) => s + r.valor, 0);

  const retencao = contratos.filter(c => {
    if (c.status === 'Expirado' || c.status === 'Rescindido') return false;
    const d = diasRestantes(c.dataFim);
    return d > 90;
  }).length;

  // Mantemos métricas originais para listas/alertas e gráficos
  const pendingReqs = requisicoes.filter(r => r.status === 'Pendente' || r.status === 'Em Análise');
  const pendingReqValue = pendingReqs.reduce((s, r) => s + r.valor, 0);
  const expiringContracts = contratos.filter(c => {
    const d = diasRestantes(c.dataFim);
    return d >= 0 && d <= 90 && c.status !== 'Expirado' && c.status !== 'Rescindido';
  }).length;
  const scheduledMeetings = reunioes.filter(r => r.status === 'Agendada').length;
  const activeCases = processos.filter(p => p.status === 'Em curso').length;
  const criticalDeadlines = prazos.filter(p => p.status === 'Vencido' || (p.prioridade === 'Crítica' && p.status !== 'Concluído')).length;

  /** Eventos agrupados por dia (YYYY-MM-DD) para tooltips e lista. */
  const eventsByDay = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of eventos) {
      const dt = new Date(e.dataInicio);
      if (Number.isNaN(dt.getTime())) continue;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const list = m.get(key) ?? [];
      list.push(e);
      m.set(key, list);
    }
    for (const [, list] of m) {
      list.sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime());
    }
    return m;
  }, [eventos]);

  const eventCalendarDates = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const start = new Date(year, month, 1).getTime();
    const end = new Date(year, month + 1, 0, 23, 59, 59).getTime();
    const dates: Date[] = [];
    for (const e of eventos) {
      const t = new Date(e.dataInicio).getTime();
      if (t < start || t > end) continue;
      const d = new Date(e.dataInicio);
      dates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    const unique = new Map<number, Date>();
    for (const d of dates) unique.set(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), d);
    return Array.from(unique.values());
  }, [eventos, calendarMonth]);

  const viewingCurrentMonthYear =
    calendarMonth.getFullYear() === new Date().getFullYear() && calendarMonth.getMonth() === new Date().getMonth();

  const birthdayCalendarDates = useMemo(() => {
    if (!viewingCurrentMonthYear) return [];
    const year = calendarMonth.getFullYear();
    return birthdaysMonth.map(p => {
      const bd = new Date(p.birth_date);
      const m = bd.getUTCMonth();
      const day = bd.getUTCDate();
      return new Date(year, m, day);
    });
  }, [birthdaysMonth, calendarMonth, viewingCurrentMonthYear]);

  /** Eventos do mês visível no calendário (lista à direita). */
  const eventsInCalendarMonth = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const start = new Date(y, m, 1).getTime();
    const end = new Date(y, m + 1, 0, 23, 59, 59).getTime();
    return [...eventos]
      .filter(e => {
        const t = new Date(e.dataInicio).getTime();
        return t >= start && t <= end;
      })
      .sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime());
  }, [eventos, calendarMonth]);

  const renderDayContentWithEventTooltips = useMemo(() => {
    return function DashboardDayContent(props: DayContentProps) {
      const y = props.date.getFullYear();
      const mo = String(props.date.getMonth() + 1).padStart(2, '0');
      const da = String(props.date.getDate()).padStart(2, '0');
      const key = `${y}-${mo}-${da}`;
      const dayEvents = eventsByDay.get(key) ?? [];
      if (dayEvents.length === 0) {
        return <DayContent {...props} />;
      }
      return (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span className="relative inline-flex h-full w-full items-center justify-center">
              <DayContent {...props} />
              <span
                className="pointer-events-none absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#a57e26] ring-2 ring-background"
                aria-hidden
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="max-w-[min(280px,calc(100vw-2rem))] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {dayEvents.length === 1 ? 'Evento' : `${dayEvents.length} eventos`}
            </p>
            <ul className="space-y-2">
              {dayEvents.map(ev => (
                <li key={ev.id} className="text-xs border-t border-border/60 pt-2 first:border-0 first:pt-0">
                  <p className="font-semibold text-foreground leading-snug">{ev.titulo}</p>
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    {new Date(ev.dataInicio).toLocaleString('pt-PT', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {ev.local ? (
                    <p className="text-muted-foreground mt-0.5 flex items-start gap-1">
                      <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{ev.local}</span>
                    </p>
                  ) : null}
                  <span
                    className={cn(
                      'inline-block mt-1 text-[10px] px-1.5 py-0 rounded border',
                      ev.isInterno ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground',
                    )}
                  >
                    {ev.isInterno ? 'Interno' : 'Externo'}
                  </span>
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      );
    };
  }, [eventsByDay]);

  const docsFiltered = documentosOficiais
    .filter(d => {
      const q = docQuery.trim().toLowerCase();
      if (!q) return true;
      return d.titulo.toLowerCase().includes(q) || d.tipo.toLowerCase().includes(q);
    })
    .slice()
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 6);

  // Feed de "Notícias & Atualizações" (cards consistentes com a imagem de referência)
  const publishedNews = noticias
    .filter(n => n.publicado)
    .sort((a, b) => new Date(b.publicadoEm ?? '').getTime() - new Date(a.publicadoEm ?? '').getTime());

  const featuredNews = publishedNews.find(n => n.featured) ?? null;
  const orderedNews = featuredNews
    ? [featuredNews, ...publishedNews.filter(n => n.id !== featuredNews.id)]
    : publishedNews;

  const newsCardIds = orderedNews.slice(0, 3).map(n => n.id);
  const newsCardIdsKey = newsCardIds.join(',');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isSupabaseConfigured() || !supabase) return;
      if (!newsCardIds.length) {
        setLikesCountByNewsId({});
        setCommentsCountByNewsId({});
        return;
      }

      try {
        const [likesResults, commentsResults] = await Promise.all([
          Promise.all(
            newsCardIds.map(async id => {
              const { count, error } = await supabase
                .from('noticias_gostos')
                .select('id', { count: 'exact', head: true })
                .eq('noticia_id', id);
              if (error) throw error;
              return { id, count: Number(count ?? 0) };
            }),
          ),
          Promise.all(
            newsCardIds.map(async id => {
              const { count, error } = await supabase
                .from('noticias_comentarios')
                .select('id', { count: 'exact', head: true })
                .eq('noticia_id', id);
              if (error) throw error;
              return { id, count: Number(count ?? 0) };
            }),
          ),
        ]);

        if (cancelled) return;
        setLikesCountByNewsId(Object.fromEntries(likesResults.map(r => [r.id, r.count])));
        setCommentsCountByNewsId(Object.fromEntries(commentsResults.map(r => [r.id, r.count])));
      } catch {
        // Silencioso: no dashboard é apenas informação extra.
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [newsCardIdsKey]);

  const formatDateTimePT = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  type NewsCard = {
    key: string;
    id: number;
    title: string;
    meta: string;
    excerpt: string;
    hasMore: boolean;
    imageUrl?: string | null;
    featured?: boolean;
    readMorePath: string;
  };

  const newsCards: NewsCard[] = orderedNews.slice(0, 3).map(n => {
    const content = (n.conteudo ?? '').trim();
    const excerpt = content.slice(0, 220);
    const hasMore = content.length > 220;

    return {
    key: `news-${n.id}`,
    id: n.id,
    title: n.titulo,
    meta: `${n.featured ? 'Destaque' : 'Notícias'} • ${formatDateTimePT(n.publicadoEm)}`.trim(),
    excerpt,
    hasMore,
    imageUrl: n.imagemUrl ?? null,
    featured: n.featured,
    readMorePath: `/comunicacao-interna/noticias/${n.id}`,
    };
  });

  if (!user) return null;

  const canComunicacao = hasModuleAccess(user, 'comunicacao-interna');
  const canCapitalHumano = hasModuleAccess(user, 'capital-humano');
  const canFinancas = hasModuleAccess(user, 'financas');
  const canContabilidade = hasModuleAccess(user, 'contabilidade');
  const canSecretaria = hasModuleAccess(user, 'secretaria');
  const canJuridico = hasModuleAccess(user, 'juridico');

  const quickLinks = [
    { label: 'Requisições', path: '/financas/requisicoes', module: 'financas' },
    { label: 'Declarações', path: '/capital-humano/declaracoes', module: 'capital-humano' },
    { label: 'Pagamentos', path: '/contabilidade/pagamentos', module: 'contabilidade' },
    { label: 'Reuniões', path: '/secretaria/reunioes', module: 'secretaria' },
    { label: 'Contratos', path: '/juridico/contratos', module: 'juridico' },
  ].filter(l => hasModuleAccess(user, l.module));

  const kpiFlags = [canContabilidade, canFinancas, canCapitalHumano, canJuridico];
  const kpiCount = kpiFlags.filter(Boolean).length;

  const hasNewsColumn = canComunicacao;
  const rightHasCalendarOrBirthdays = canComunicacao;
  const hasRightColumn = quickLinks.length > 0 || rightHasCalendarOrBirthdays;
  const hasMainGrid = hasNewsColumn || hasRightColumn;

  return (
    <div className="space-y-8">
      {/* Hero — intranet moderna */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border/80"
        style={{ background: 'linear-gradient(to right, #d4a926, #a57e26)' }}
      >
        <div className="absolute inset-0 opacity-[0.15] bg-[radial-gradient(circle_at_top,_transparent_0,_rgba(255,255,255,0.9)_45%,_transparent_60%)]" />
        <div className="relative p-6 sm:p-8">
          <h1 className="text-white text-xl lg:text-2xl font-semibold tracking-tight">
            Olá, {user.nome.split(' ')[0]}
          </h1>
          <p className="text-white/90 text-sm mt-1">
            Resumo e atalhos dos módulos a que tem acesso
          </p>
          <p className="text-white/80 text-xs mt-2 capitalize">{getCurrentDatePT()}</p>
        </div>
      </div>

      {/* Destaque: aniversariantes (módulo Comunicação interna) */}
      {canComunicacao && birthdaysLoading ? (
        <div className="rounded-2xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          A carregar aniversariantes…
        </div>
      ) : canComunicacao && birthdaysToday.length > 0 ? (
        <div
          className="rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 to-amber-100/80 dark:from-amber-950/50 dark:to-amber-900/30 dark:border-amber-800/60 px-4 py-4 sm:px-6"
          role="region"
          aria-label="Aniversariantes do dia"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100">
                <Cake className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Aniversariantes de hoje</p>
                <p className="text-xs text-muted-foreground">
                  {birthdaysToday.length === 1 ? '1 pessoa' : `${birthdaysToday.length} pessoas`} · Parabéns!
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 min-w-0 flex-1">
              {birthdaysToday.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate('/comunicacao-interna/aniversarios')}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/60 bg-background/70 dark:border-amber-700/50 px-2.5 py-1.5 text-left hover:bg-background transition-colors"
                >
                  <Avatar className="h-8 w-8 ring-1 ring-border/50">
                    {looksLikeUrl(p.avatar) ? (
                      <AvatarImage src={normalizePublicMediaUrl(p.avatar) ?? p.avatar ?? undefined} />
                    ) : null}
                    <AvatarFallback className="text-xs">
                      {(p.name || '?')
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map(w => w[0]?.toUpperCase())
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate max-w-[140px]">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : canComunicacao && birthdaysError ? (
        <div
          className="rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/25 dark:text-amber-50"
          role="status"
        >
          <p className="font-medium">Aniversários</p>
          <p className="mt-1 text-[13px] leading-snug opacity-90">{birthdaysError}</p>
        </div>
      ) : null}

      {/* KPIs por módulo: contabilidade / finanças / capital humano / jurídico */}
      {kpiCount > 0 ? (
        <div
          className={cn(
            'grid gap-4 grid-cols-1',
            kpiCount >= 2 && 'sm:grid-cols-2',
            kpiCount >= 3 && 'lg:grid-cols-3',
            kpiCount >= 4 && 'lg:grid-cols-4',
          )}
        >
          {canContabilidade ? (
            <KpiCard
              title="Receita"
              value={formatKz(receita)}
              icon={<TrendingUp className="h-5 w-5" />}
              description="Pagamentos recebidos"
            />
          ) : null}
          {canFinancas ? (
            <KpiCard
              title="Despesas"
              value={formatKz(despesas)}
              icon={<Receipt className="h-5 w-5" />}
              description="Requisições pagas"
            />
          ) : null}
          {canCapitalHumano ? (
            <KpiCard
              title="Clientes"
              value={activeClients}
              icon={<UsersRound className="h-5 w-5" />}
              description="Colaboradores ativos"
            />
          ) : null}
          {canJuridico ? (
            <KpiCard
              title="Retenção"
              value={retencao}
              icon={<ShieldCheck className="h-5 w-5" />}
              description="Contratos com mais de 90 dias"
              className={retencao <= 0 ? 'border-destructive/30' : ''}
            />
          ) : null}
        </div>
      ) : null}

      {/* Conteúdo principal: notícias (comunicação) + atalhos / calendário / aniversários */}
      {hasMainGrid ? (
      <div
        className={cn(
          'grid grid-cols-1 gap-6',
          hasNewsColumn && hasRightColumn && 'xl:grid-cols-2',
        )}
      >
        {/* Esquerda: Feed de notícias */}
        {hasNewsColumn ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Notícias & Atualizações</h2>
            </div>
            <Button variant="outline" onClick={() => navigate('/comunicacao-interna/noticias')}>
              Ver mais
            </Button>
          </div>

          <div className="space-y-3">
            {newsCards.map(n => (
              <div
                key={n.key}
                className="bg-card rounded-xl border border-border/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 ring-1 ring-border/50">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {'C'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Comunicação Interna</p>
                      <p className="text-xs text-muted-foreground mt-1">{n.meta}</p>
                    </div>
                  </div>

                  <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {n.featured ? <Star className="h-4 w-4 text-[#a57e26]" /> : null}
                  </div>
                </div>

                <p className="text-base font-semibold text-foreground mt-3">{n.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {n.excerpt}
                  {n.hasMore ? '...' : ''}
                </p>

                <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
                  {n.imageUrl ? (
                    <img
                      src={normalizePublicMediaUrl(n.imageUrl) ?? n.imageUrl}
                      alt={n.title}
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="h-44 w-full bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                      Sem imagem
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-destructive" />
                      <span>{likesCountByNewsId[n.id] ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      <span>{commentsCountByNewsId[n.id] ?? 0}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(n.readMorePath)}
                    className="text-sm font-medium text-[#a57e26] hover:underline"
                    type="button"
                  >
                    Leia mais
                  </button>
                </div>
              </div>
            ))}
            {newsCards.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground bg-card rounded-xl border border-border/80">
                Sem notícias para mostrar.
              </div>
            )}
          </div>
        </section>
        ) : null}

        {/* Direita: Atalhos + Calendário + Eventos */}
        {hasRightColumn ? (
        <section className="space-y-4">
          {quickLinks.length > 0 ? (
          <div className="bg-card rounded-xl border border-border/80 p-5">
            <h2 className="text-base font-semibold text-foreground">Links rápidos</h2>
            <p className="text-sm text-muted-foreground mt-1">Atalhos para acções frequentes.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {quickLinks.map(l => (
                <button
                  key={l.path}
                  onClick={() => navigate(l.path)}
                  className="group flex items-center gap-2 rounded-xl border border-border/80 px-3 py-2 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Download className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{l.label}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          ) : null}

          {rightHasCalendarOrBirthdays ? (
          <div className="bg-card rounded-xl border border-border/80 p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <LucideCalendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">Calendário</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Passe o rato sobre os dias com ponto dourado para ver os eventos. À direita, a lista do mês seleccionado.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigate('/comunicacao-interna/eventos')}>
                Ver todos os eventos
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] gap-4 items-start">
              <TooltipProvider delayDuration={250}>
                <div className="overflow-hidden rounded-xl border border-border/80">
                  <UiCalendar
                    month={calendarMonth}
                    onMonthChange={m => m && setCalendarMonth(m)}
                    locale={pt}
                    modifiers={{
                      eventos: eventCalendarDates,
                      aniversarios: birthdayCalendarDates,
                    }}
                    modifiersClassNames={{
                      eventos: 'bg-primary/10 text-primary font-medium relative',
                      aniversarios: 'bg-amber-100/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100',
                    }}
                    components={{
                      DayContent: renderDayContentWithEventTooltips,
                    }}
                  />
                </div>
              </TooltipProvider>

              <div className="rounded-xl border border-border/80 bg-muted/20 flex flex-col min-h-[260px] max-h-[360px] lg:max-h-[420px]">
                <div className="px-3 py-2.5 border-b border-border/80 bg-card/80 rounded-t-xl">
                  <h3 className="text-sm font-semibold text-foreground capitalize">
                    Eventos em {format(calendarMonth, 'MMMM yyyy', { locale: pt })}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {eventsInCalendarMonth.length === 0
                      ? 'Nenhum evento neste mês.'
                      : `${eventsInCalendarMonth.length} evento(s) agendado(s)`}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                  {eventsInCalendarMonth.map(ev => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => navigate(`/comunicacao-interna/eventos/${ev.id}`)}
                      className="w-full text-left rounded-lg border border-border/60 bg-card px-3 py-2.5 hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <p className="text-sm font-medium text-foreground line-clamp-2">{ev.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        {new Date(ev.dataInicio).toLocaleString('pt-PT', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {ev.local ? (
                        <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{ev.local}</span>
                        </p>
                      ) : null}
                      <span
                        className={cn(
                          'inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded-md border',
                          ev.isInterno ? 'border-primary/40 text-primary bg-primary/5' : 'border-border text-muted-foreground',
                        )}
                      >
                        {ev.isInterno ? 'Interno' : 'Externo'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          ) : null}

          {rightHasCalendarOrBirthdays ? (
          <div className="bg-card rounded-xl border border-border/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Aniversariantes do dia</h2>
                <p className="text-sm text-muted-foreground mt-1">Destaque com foto de perfil.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/comunicacao-interna/aniversarios')}>
                Ver
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              {birthdaysLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : birthdaysToday.length > 0 ? (
                birthdaysToday.map(p => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/30 px-3 py-2">
                    <Avatar className="h-10 w-10 ring-1 ring-border/50">
                      {looksLikeUrl(p.avatar) ? (
                        <AvatarImage src={normalizePublicMediaUrl(p.avatar) ?? p.avatar ?? undefined} />
                      ) : null}
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
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(p.birth_date)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sem aniversariantes hoje.</p>
              )}
            </div>
          </div>
          ) : null}

        </section>
        ) : null}
      </div>
      ) : null}

      {/* Documentos oficiais (Secretaria) */}
      {canSecretaria ? (
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Repositório de Documentos</h2>
            <p className="text-sm text-muted-foreground mt-1">Documentos e despachos mais recentes.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                value={docQuery}
                onChange={e => setDocQuery(e.target.value)}
                placeholder="Buscar por título..."
                className="w-[260px]"
              />
            </div>
            <Button variant="outline" onClick={() => navigate('/secretaria/documentos')}>
              Ver todos
            </Button>
          </div>
        </div>

        <div className="table-container overflow-x-auto">
          {docsFiltered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum documento encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/80">
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Documento</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {docsFiltered.map(d => (
                  <tr
                    key={d.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-5">{d.tipo}</td>
                    <td className="py-3 px-5">
                      <div className="font-medium">{d.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{d.numero}</div>
                    </td>
                    <td className="py-3 px-5 text-muted-foreground">{formatDate(d.data)}</td>
                    <td className="py-3 px-5">
                      <StatusBadge status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      ) : null}
    </div>
  );
}
