import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useData } from '@/context/DataContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  deleteTutorialVideo,
  fetchTutoriaisVideos,
  insertTutorialVideo,
  updateTutorialVideo,
} from '@/lib/tutoriaisVideos';
import type { TutorialVideo } from '@/types';
import { TutorialVideoPlayer } from '@/modules/ajuda/TutorialVideoPlayer';
import { labelModuloTutorial, TUTORIAIS_MODULO_OPCOES } from '@/modules/ajuda/tutoriaisModulos';
import { parseVideoEmbedInput, youtubeThumbnailUrl } from '@/utils/videoEmbed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Pencil, Trash2, PlayCircle, Video, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const TUTORIAIS_STALE_MS = 3 * 60 * 1000;

const emptyForm: Omit<TutorialVideo, 'id' | 'createdAt' | 'updatedAt'> = {
  empresaId: null,
  titulo: '',
  descricao: '',
  videoUrl: '',
  videoProvedor: 'youtube',
  moduloRelacionado: '',
  ordem: 0,
  publicado: true,
  duracaoMinutos: null,
};

function thumbnailFor(video: TutorialVideo): string | null {
  const parsed = parseVideoEmbedInput(video.videoUrl, video.videoProvedor);
  if (parsed?.provedor === 'youtube' && parsed.videoId) {
    return youtubeThumbnailUrl(parsed.videoId);
  }
  return null;
}

export default function TutoriaisPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentEmpresaId } = useTenant();
  const { empresas } = useData();
  const isAdmin = user?.perfil === 'Admin';

  const [search, setSearch] = useState('');
  const [filtroModulo, setFiltroModulo] = useState<string>('todos');
  const [playerVideo, setPlayerVideo] = useState<TutorialVideo | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TutorialVideo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const tutoriaisQuery = useQuery({
    queryKey: ['tutoriais-videos', isAdmin] as const,
    enabled: isSupabaseConfigured() && !!supabase,
    staleTime: TUTORIAIS_STALE_MS,
    refetchOnWindowFocus: false,
    queryFn: () => fetchTutoriaisVideos(supabase!, { includeUnpublished: isAdmin }),
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['tutoriais-videos'] });
  }, [queryClient]);

  const videos = tutoriaisQuery.data ?? [];
  const loading = tutoriaisQuery.isFetching && tutoriaisQuery.data === undefined;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return videos.filter(v => {
      if (filtroModulo !== 'todos') {
        const m = (v.moduloRelacionado ?? '').trim() || '';
        if (filtroModulo === 'geral') {
          if (m !== '') return false;
        } else if (m !== filtroModulo) return false;
      }
      if (!q) return true;
      return (
        v.titulo.toLowerCase().includes(q) ||
        (v.descricao ?? '').toLowerCase().includes(q) ||
        labelModuloTutorial(v.moduloRelacionado).toLowerCase().includes(q)
      );
    });
  }, [videos, search, filtroModulo]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      empresaId: typeof currentEmpresaId === 'number' ? currentEmpresaId : null,
    });
    setFormOpen(true);
  };

  const openEdit = (v: TutorialVideo) => {
    setEditing(v);
    setForm({
      empresaId: v.empresaId ?? null,
      titulo: v.titulo,
      descricao: v.descricao ?? '',
      videoUrl: v.videoUrl,
      videoProvedor: v.videoProvedor,
      moduloRelacionado: v.moduloRelacionado ?? '',
      ordem: v.ordem ?? 0,
      publicado: v.publicado,
      duracaoMinutos: v.duracaoMinutos ?? null,
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!supabase || !isSupabaseConfigured()) return;
    if (!form.titulo.trim()) {
      toast.error('Indique o título do tutorial.');
      return;
    }
    if (!form.videoUrl.trim()) {
      toast.error('Indique o URL do vídeo (YouTube, Vimeo ou MP4).');
      return;
    }
    const payload = {
      ...form,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim(),
      moduloRelacionado: (form.moduloRelacionado ?? '').trim() || null,
      empresaId: form.empresaId ?? null,
      duracaoMinutos:
        form.duracaoMinutos != null && Number.isFinite(Number(form.duracaoMinutos))
          ? Number(form.duracaoMinutos)
          : null,
      ordem: Number(form.ordem) || 0,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateTutorialVideo(supabase, editing.id, payload);
        toast.success('Tutorial actualizado.');
      } else {
        await insertTutorialVideo(supabase, payload);
        toast.success('Tutorial publicado.');
      }
      setFormOpen(false);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v: TutorialVideo) => {
    if (!supabase || !window.confirm(`Remover o tutorial «${v.titulo}»?`)) return;
    try {
      await deleteTutorialVideo(supabase, v.id);
      if (playerVideo?.id === v.id) setPlayerVideo(null);
      toast.success('Tutorial removido.');
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover.');
    }
  };

  const empresasActivas = useMemo(
    () => [...empresas].filter(e => e.activo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt')),
    [empresas],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Como utilizar a aplicação</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Biblioteca de vídeos tutoriais por módulo. Abra um vídeo para ver o passo a passo no ecrã.
          </p>
        </div>
        {isAdmin ? (
          <Button type="button" onClick={openCreate} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Novo tutorial
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar título ou descrição…"
            className="pl-9"
          />
        </div>
        <Select value={filtroModulo} onValueChange={setFiltroModulo}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os módulos</SelectItem>
            <SelectItem value="geral">Geral / Introdução</SelectItem>
            {TUTORIAIS_MODULO_OPCOES.filter(o => o.value).map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8">A carregar tutoriais…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <Video className="mx-auto h-10 w-10 text-muted-foreground/70" />
          <p className="mt-3 text-sm font-medium">Nenhum tutorial encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isAdmin
              ? 'Crie o primeiro vídeo com «Novo tutorial» (YouTube ou Vimeo).'
              : 'Os tutoriais serão disponibilizados pela administração.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(v => {
            const thumb = thumbnailFor(v);
            return (
              <article
                key={v.id}
                className={cn(
                  'group flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition hover:border-primary/30 hover:shadow-md',
                  !v.publicado && isAdmin && 'border-amber-500/40',
                )}
              >
                <button
                  type="button"
                  className="relative aspect-video w-full overflow-hidden bg-muted"
                  onClick={() => setPlayerVideo(v)}
                >
                  {thumb ? (
                    <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <PlayCircle className="h-12 w-12 text-muted-foreground/60" />
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                    <PlayCircle className="h-14 w-14 text-white drop-shadow" />
                  </span>
                </button>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-medium">
                      {labelModuloTutorial(v.moduloRelacionado)}
                    </Badge>
                    {!v.publicado && isAdmin ? (
                      <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-700">
                        Rascunho
                      </Badge>
                    ) : null}
                    {v.duracaoMinutos != null && v.duracaoMinutos > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {v.duracaoMinutos} min
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-left text-sm font-semibold leading-snug line-clamp-2">{v.titulo}</h2>
                  {v.descricao ? (
                    <p className="text-left text-xs text-muted-foreground line-clamp-2">{v.descricao}</p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button type="button" size="sm" variant="default" className="flex-1" onClick={() => setPlayerVideo(v)}>
                      <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                      Ver vídeo
                    </Button>
                    {isAdmin ? (
                      <>
                        <Button type="button" size="icon" variant="outline" onClick={() => openEdit(v)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="icon" variant="outline" onClick={() => void remove(v)} aria-label="Remover">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={playerVideo != null} onOpenChange={open => !open && setPlayerVideo(null)}>
        <DialogContent className="max-w-4xl gap-4 p-0 sm:p-0 overflow-hidden">
          {playerVideo ? (
            <>
              <DialogHeader className="px-4 pt-4 sm:px-6">
                <DialogTitle>{playerVideo.titulo}</DialogTitle>
                <DialogDescription>
                  {labelModuloTutorial(playerVideo.moduloRelacionado)}
                  {playerVideo.descricao ? ` — ${playerVideo.descricao}` : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                <TutorialVideoPlayer video={playerVideo} />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {isAdmin ? (
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar tutorial' : 'Novo tutorial'}</DialogTitle>
              <DialogDescription>
                Cole o link do YouTube ou Vimeo. Para MP4, use um URL público (ex.: Supabase Storage).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>URL do vídeo</Label>
                <Input
                  value={form.videoUrl}
                  onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              </div>
              <div className="space-y-2">
                <Label>Módulo</Label>
                <Select
                  value={(form.moduloRelacionado ?? '') || '__geral__'}
                  onValueChange={v =>
                    setForm(f => ({ ...f, moduloRelacionado: v === '__geral__' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__geral__">Geral / Introdução</SelectItem>
                    {TUTORIAIS_MODULO_OPCOES.filter(o => o.value).map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Empresa (opcional)</Label>
                <Select
                  value={form.empresaId == null ? '__todas__' : String(form.empresaId)}
                  onValueChange={v =>
                    setForm(f => ({
                      ...f,
                      empresaId: v === '__todas__' ? null : Number(v),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__todas__">Todas as empresas</SelectItem>
                    {empresasActivas.map(e => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Ordem (maior = primeiro)</Label>
                  <Input
                    type="number"
                    value={form.ordem}
                    onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duração (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.duracaoMinutos ?? ''}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        duracaoMinutos: e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.publicado}
                  onCheckedChange={c => setForm(f => ({ ...f, publicado: c === true }))}
                />
                Publicado (visível para utilizadores)
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? 'A guardar…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
