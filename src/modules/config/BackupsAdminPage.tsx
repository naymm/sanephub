import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, HardDriveDownload, Loader2, Play, RefreshCw, ShieldAlert } from 'lucide-react';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/lib/utils';

type BackupSettings = {
  id: number;
  retention_days: number;
  cron_expression: string;
  google_drive_upload: boolean;
  backup_database_enabled: boolean;
  backup_storage_enabled: boolean;
  backup_configs_enabled: boolean;
  notify_on_failure: boolean;
  docker_project_dir: string | null;
  extra_config_paths: string[] | null;
  updated_at: string | null;
};

type BackupRun = {
  id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: string;
  trigger_source: string;
  phase: string | null;
  total_bytes: number | null;
  duration_ms: number | null;
  error_message: string | null;
  log_summary: string | null;
  health_ok: boolean | null;
  artifact_database_path: string | null;
  artifact_storage_path: string | null;
  artifact_configs_path: string | null;
};

function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let x = n;
  let i = -1;
  do {
    x /= 1024;
    i++;
  } while (x >= 1024 && i < u.length - 1);
  return `${x.toFixed(1)} ${u[i]}`;
}

function statusBadge(status: string) {
  switch (status) {
    case 'success':
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Sucesso</Badge>;
    case 'partial':
      return <Badge variant="secondary">Parcial</Badge>;
    case 'running':
      return <Badge variant="default">Em execução</Badge>;
    case 'queued':
      return <Badge variant="outline">Pendente na fila</Badge>;
    case 'failed':
      return <Badge variant="destructive">Erro</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function BackupsAdminPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [runs, setRuns] = useState<BackupRun[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyRun, setBusyRun] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const [formCron, setFormCron] = useState('0 2 * * *');
  const [formRetention, setFormRetention] = useState('30');
  const [formDrive, setFormDrive] = useState(false);
  const [formNotify, setFormNotify] = useState(true);
  const [formDb, setFormDb] = useState(true);
  const [formSt, setFormSt] = useState(true);
  const [formCf, setFormCf] = useState(true);
  const [formDockerDir, setFormDockerDir] = useState('');
  const [formExtraPaths, setFormExtraPaths] = useState('');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: s, error: se } = await supabase.from('erp_backup_settings').select('*').maybeSingle();
      if (se) throw se;

      const { data: r, error: re } = await supabase
        .from('erp_backup_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80);
      if (re) throw re;

      if (s) {
        setSettings(s as BackupSettings);
        setFormCron(s.cron_expression ?? '0 2 * * *');
        setFormRetention(String(s.retention_days ?? 30));
        setFormDrive(!!s.google_drive_upload);
        setFormNotify(s.notify_on_failure ?? true);
        setFormDb(s.backup_database_enabled ?? true);
        setFormSt(s.backup_storage_enabled ?? true);
        setFormCf(s.backup_configs_enabled ?? true);
        setFormDockerDir(s.docker_project_dir?.trim() ?? '');
        setFormExtraPaths((s.extra_config_paths ?? []).join('\n'));
      }
      setRuns((r ?? []) as BackupRun[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar backups');
      setSettings(null);
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const pend = runs.some(r => ['queued', 'running'].includes(r.status));
    if (!pend) return undefined;
    const id = window.setInterval(() => void load(), 4500);
    return () => clearInterval(id);
  }, [load, runs]);

  /** Sem este processo no servidor, pedidos manuais ficam em «queued» indefinidamente. */
  const QUEUE_STALE_MS = 90_000;

  const hasRunning = useMemo(() => runs.some(r => r.status === 'running'), [runs]);
  const hasQueued = useMemo(() => runs.some(r => r.status === 'queued'), [runs]);

  const oldestQueuedAgeMs = useMemo(() => {
    const q = runs.filter(r => r.status === 'queued');
    if (!q.length) return null;
    const oldest = Math.min(...q.map(r => new Date(r.created_at).getTime()));
    return Date.now() - oldest;
  }, [runs]);

  const queueLooksStuck = hasQueued && !hasRunning && oldestQueuedAgeMs != null && oldestQueuedAgeMs > QUEUE_STALE_MS;

  const lastRun = useMemo(() => runs[0], [runs]);

  const handleSaveSettings = async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    const rd = Math.max(1, Number(formRetention));
    const paths = formExtraPaths
      .split(/[\n,]+/)
      .map(v => v.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const { error } = await supabase.rpc('erp_admin_backup_settings_patch', {
        p_retention_days: Number.isFinite(rd) ? rd : 30,
        p_cron_expression: formCron,
        p_google_drive_upload: formDrive,
        p_backup_database_enabled: formDb,
        p_backup_storage_enabled: formSt,
        p_backup_configs_enabled: formCf,
        p_notify_on_failure: formNotify,
        p_docker_project_dir: formDockerDir.trim() ? formDockerDir.trim() : null,
        p_extra_config_paths: paths.length ? paths : null,
      });
      if (error) throw error;
      toast.success('Definições de backup guardadas.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const requestManual = async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    setBusyRun(true);
    try {
      const { error } = await supabase.rpc('erp_admin_request_backup');
      if (error) throw error;

      const sseBase = (import.meta.env.VITE_SSE_URL as string | undefined)?.replace(/\/$/, '');
      const triggerGateway =
        import.meta.env.VITE_BACKUP_TRIGGER_VIA_GATEWAY === 'true' ||
        import.meta.env.VITE_BACKUP_TRIGGER_VIA_GATEWAY === '1';

      if (triggerGateway && sseBase) {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) {
          toast.warning('Pedido na fila; não há token de sessão para o gateway executar o processador.');
        } else {
          const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
          const sseTok = import.meta.env.VITE_SSE_TOKEN as string | undefined;
          if (sseTok) headers['X-SSE-Token'] = sseTok;
          try {
            const res = await fetch(`${sseBase}/backups/process-queue`, { method: 'POST', headers });
            const body = (await res.json().catch(() => null)) as {
              ok?: boolean;
              error?: string;
              stderr?: string;
              exitCode?: number;
            } | null;
            if (!res.ok) {
              toast.error(
                body?.error ??
                  `O gateway respondeu HTTP ${res.status}. O pedido ficou na fila — veja logs do sse-gateway ou use cron.`,
              );
            } else if (body && body.ok === false) {
              const hint = (body.stderr ?? '').trim().slice(0, 280);
              toast.error(
                hint
                  ? `O script terminou com erro (código ${String(body.exitCode)}): ${hint}`
                  : `O script terminou com código ${String(body.exitCode ?? '?')}. Verifique .env.backup e logs no servidor.`,
              );
            } else {
              toast.success('Pedido na fila e processador executado no servidor.');
            }
          } catch (e) {
            toast.warning(
              `Pedido na fila, mas o gateway não respondeu (${e instanceof Error ? e.message : 'rede/CORS'}). ` +
                'Confirme `npm run sse:gateway` no host dos backups e CORS, ou agende cron.',
            );
          }
        }
      } else {
        toast.success(
          'Pedido na fila. Para executar já: cron `process-backup-queue.sh`, ou defina `VITE_BACKUP_TRIGGER_VIA_GATEWAY=true` com o sse-gateway no mesmo servidor.',
        );
      }

      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível pedir o backup.');
    } finally {
      setBusyRun(false);
    }
  };

  if (user?.perfil !== 'Admin') {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Backups</h1>
        <p className="text-muted-foreground text-sm">Acesso reservado ao Administrador.</p>
      </div>
    );
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6 max-w-3xl">
        <h1 className="page-header">Backups enterprise</h1>
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Supabase não configurado</AlertTitle>
          <AlertDescription>Configure o cliente Supabase neste ambiente para utilizar esta área.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl pb-14">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="page-header flex items-center gap-2">
            <HardDriveDownload className="h-7 w-7 text-primary shrink-0" />
            Backups enterprise
          </h1>
          <p className="text-muted-foreground text-sm max-w-prose">
            Orquestração no servidor Docker (PostgreSQL + storage + configs) com opcional{' '}
            <span className="font-medium text-foreground">rclone</span>. O ERP não hospeda artefactos — apenas comando e estado.
          </p>
        </div>
        <Button onClick={() => void load()} variant="outline" size="sm" className="shrink-0 gap-2" disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 shrink-0', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      <Alert variant="default" className="border-primary/40 bg-muted/30">
        <AlertTitle>Credenciais e chaves ficam apenas no servidor</AlertTitle>
        <AlertDescription>
          Defina{' '}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">scripts/backups/.env.backup</code> conforme{' '}
          <code>.env.example</code>. Google Drive só via <code className="text-xs">rclone config</code> no host (nunca no browser).
        </AlertDescription>
      </Alert>

      {queueLooksStuck ? (
        <Alert className="border-amber-500/45 bg-amber-50/90 text-foreground dark:bg-amber-950/35 dark:border-amber-500/40">
          <Clock className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <AlertTitle className="text-amber-950 dark:text-amber-100">Fila manual sem processador</AlertTitle>
          <AlertDescription className="text-amber-950/90 dark:text-amber-100/90">
            O pedido está na base como «pendente», mas{' '}
            <strong>nada no servidor está a executar</strong> <code className="text-xs">process-backup-queue.sh</code>.{' '}
            Corra esse script no mesmo host onde definiu <code className="text-xs">BACKUP_DATABASE_URL</code> e{' '}
            <code className="text-xs">BACKUP_LOCAL_ROOT</code>, ou agende-o no cron (ex.: cada minuto). Alternativa:{' '}
            <code className="text-xs">VITE_BACKUP_TRIGGER_VIA_GATEWAY=true</code> com o <code className="text-xs">sse-gateway</code> a correr nesse
            mesmo host. Sem isso, o estado não muda. Ver separador <strong>Operações</strong>.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Última corrida</CardTitle>
            <CardDescription>Estado vindo da base PostgreSQL quando os scripts atualizarem a corrida.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && !lastRun ? (
              <Skeleton className="h-24 w-full" />
            ) : lastRun ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  {statusBadge(lastRun.status)}
                  {lastRun.health_ok === false && (
                    <Badge variant="destructive" className="font-normal">
                      Health check falhou
                    </Badge>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Criado</dt>
                  <dd>{formatDate(lastRun.created_at)}</dd>
                  <dt className="text-muted-foreground">Duração</dt>
                  <dd>{lastRun.duration_ms != null ? `${Math.round(lastRun.duration_ms / 100) / 10}s` : '—'}</dd>
                  <dt className="text-muted-foreground">Tamanho Σ</dt>
                  <dd>{formatBytes(lastRun.total_bytes)}</dd>
                  <dt className="text-muted-foreground">Gatilho</dt>
                  <dd className="capitalize">{lastRun.trigger_source}</dd>
                </dl>
                {lastRun.log_summary ? (
                  <p className="text-xs text-muted-foreground border rounded-md bg-muted/20 p-2 line-clamp-4">{lastRun.log_summary}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem histórico. Corra o primeiro backup no servidor ou peça corrida manual.</p>
            )}
            {hasRunning ? (
              <div className="space-y-2">
                <p className="text-xs font-medium flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Backup em execução no servidor…
                </p>
                <div
                  role="progressbar"
                  aria-label="Backup em curso"
                  className="h-1 w-full rounded-full bg-primary/15 overflow-hidden"
                >
                  <div className="h-full w-2/5 rounded-full bg-primary/55 motion-safe:animate-pulse" />
                </div>
              </div>
            ) : hasQueued ? (
              <div className="rounded-md border border-dashed border-muted-foreground/35 bg-muted/25 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 shrink-0" /> Na fila — à espera do processador
                </p>
                <p>
                  O ERP já gravou o pedido. No servidor, execute <code className="text-[11px] bg-background/80 px-1 rounded">./process-backup-queue.sh</code> (com{' '}
                  <code className="text-[11px] bg-background/80 px-1 rounded">.env.backup</code> carregado) ou configure cron para o
                  correr periodicamente.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Executar backup</CardTitle>
            <CardDescription>
              Coloca o pedido na base (fila). <strong>Só avança</strong> quando o servidor executar{' '}
              <code className="text-[11px]">process-backup-queue.sh</code> — sem isso fica «Pendente» para sempre.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full gap-2 sm:w-auto bg-primary text-primary-foreground"
              onClick={() => void requestManual()}
              disabled={busyRun || loading}
            >
              {busyRun ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Executar backup agora
            </Button>
            <Separator />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cron recomendado: <span className="font-mono">0 2 * * * /…/backup.sh --cron</span> e{' '}
              <span className="font-mono">* * * * * …/process-backup-queue.sh</span>.
            </p>
            <Button variant="outline" size="sm" onClick={() => setRestoreOpen(true)}>
              Ler procedimento de restauro…
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="hist" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="hist">Histórico</TabsTrigger>
          <TabsTrigger value="config">Políticas</TabsTrigger>
          <TabsTrigger value="ops">Operações</TabsTrigger>
        </TabsList>
        <TabsContent value="hist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Corridas recentes</CardTitle>
              <CardDescription>Até {runs.length || '—'} linhas ordenadas pela data mais recente.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Fases / sumário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                        {loading ? 'A carregar…' : 'Sem dados (aplique a migração ou execute cron no servidor).'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs.map(run => (
                      <TableRow key={run.id}>
                        <TableCell className="whitespace-nowrap">{statusBadge(run.status)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(run.created_at)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{formatBytes(run.total_bytes)}</TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {run.duration_ms != null ? `${Math.round(run.duration_ms / 100) / 10}s` : '—'}
                        </TableCell>
                        <TableCell className="text-xs max-w-[280px]">
                          <div className="text-muted-foreground">{run.phase ?? '—'}</div>
                          {run.error_message ? (
                            <div className="text-destructive mt-1 line-clamp-2">{run.error_message}</div>
                          ) : (
                            <div className="line-clamp-2">{run.log_summary ?? '—'}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Políticas e tipos guardados na base</CardTitle>
              <CardDescription>Os valores guiam os scripts sempre que lerem `erp_backup_settings` via `BACKUP_DATABASE_URL`.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {!settings && loading ? (
                Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
              ) : settings ? (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Retenção (dias)</Label>
                      <Input type="number" min={1} value={formRetention} onChange={e => setFormRetention(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Linha modelo cron agendamento</Label>
                      <Input value={formCron} onChange={e => setFormCron(e.target.value)} placeholder="0 2 * * *" />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2 min-w-[240px]">
                      <Label className="cursor-pointer">PostgreSQL (.sql.gz)</Label>
                      <Switch checked={formDb} onCheckedChange={setFormDb} />
                    </div>
                    <div className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2 min-w-[240px]">
                      <Label className="cursor-pointer">Storage (tar.gz)</Label>
                      <Switch checked={formSt} onCheckedChange={setFormSt} />
                    </div>
                    <div className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2 min-w-[240px]">
                      <Label className="cursor-pointer">Configs Docker/nginx</Label>
                      <Switch checked={formCf} onCheckedChange={setFormCf} />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2 min-w-[240px]">
                      <Label className="cursor-pointer">Upload Google Drive (rclone)</Label>
                      <Switch checked={formDrive} onCheckedChange={setFormDrive} />
                    </div>
                    <div className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2 min-w-[240px]">
                      <Label className="cursor-pointer">Alertar erro (painel apenas)</Label>
                      <Switch checked={formNotify} onCheckedChange={setFormNotify} />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Directório do stack Docker Compose (opcional)</Label>
                    <Input value={formDockerDir} onChange={e => setFormDockerDir(e.target.value)} placeholder="/opt/supabase/stack" />
                  </div>
                  <div className="space-y-2">
                    <Label>Ficheiros extra (uno por linha, guardados em array)</Label>
                    <Textarea rows={4} value={formExtraPaths} onChange={e => setFormExtraPaths(e.target.value)} />
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-col gap-1">
                    <span>Actualizado servidor: {settings.updated_at ? formatDate(settings.updated_at) : '—'}</span>
                  </div>
                  <Button onClick={() => void handleSaveSettings()} disabled={saving} className="w-full sm:w-auto gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Guardar políticas
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Não foi possível ler `erp_backup_settings`. Migre primeiro a base (<code className="text-xs">erp_backup_*</code>).
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ops" className="space-y-4">
          <Alert>
            <AlertTitle>Ficheiros e transferências</AlertTitle>
            <AlertDescription>
              O download não transita pelo SPA. Liste no servidor dentro de{' '}
              <code>$BACKUP_LOCAL_ROOT/run-*</code> ou aceda pela pasta configurada via rclone remotamente para{' '}
              <code>ERP_BACKUPS</code>.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Disparo imediato a partir do ERP (opcional)</CardTitle>
              <CardDescription>
                O botão «Executar backup agora» só grava na base; por defeito precisa de cron. Para o mesmo clique também correr{' '}
                <code className="text-[11px]">process-backup-queue.sh</code> no servidor:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  No servidor com Docker/Supabase e <code className="text-xs">scripts/backups/.env.backup</code>, mantenha{' '}
                  <code className="text-xs">npm run sse:gateway</code> (ou systemd) a correr.
                </li>
                <li>
                  No build do frontend: <code className="text-xs">VITE_SSE_URL</code> apontando para esse gateway (público ou via proxy) e{' '}
                  <code className="text-xs">VITE_BACKUP_TRIGGER_VIA_GATEWAY=true</code>.
                </li>
                <li>
                  Se usar <code className="text-xs">SSE_GATEWAY_SECRET</code>, defina também <code className="text-xs">VITE_SSE_TOKEN</code> (o POST envia{' '}
                  <code className="text-xs">X-SSE-Token</code>).
                </li>
              </ol>
              <p className="text-xs pt-1">
                O gateway valida o JWT do utilizador e exige perfil <strong>Admin</strong> antes de executar o script.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cron / systemd modelo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm font-mono bg-muted/30 rounded-lg p-3 overflow-x-auto">
              <pre className="whitespace-pre">{`# Substitua /opt/sanephub pelo caminho real do projeto no servidor.
0 2 * * * /opt/sanephub/scripts/backups/backup.sh --cron\\
  >> /var/log/erp-backup-cron.log 2>&1

* * * * * /opt/sanephub/scripts/backups/process-backup-queue.sh\\
  >> /var/log/erp-backup-queue.log 2>&1`}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Restauração supervisorada</DialogTitle>
            <DialogDescription>
              Nunca executamos restore ao clicar aqui — consulte a documentação e valide sempre em staging.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <p>
              Procure por <strong>docs/BACKUPS_RESTORE.md</strong> neste repositório e revise os caminhos reais Docker / volumes antes de sobrescrever
              dados.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
