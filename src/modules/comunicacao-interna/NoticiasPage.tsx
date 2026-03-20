import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import type { Noticia } from '@/types';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/context/TenantContext';
import { useNotifications } from '@/context/NotificationContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { Search, Plus, Pencil, Trash2, Eye, Star, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

const NOTIF_TARGET_PROFILES = ['Admin', 'PCA', 'Planeamento', 'Director', 'RH', 'Financeiro', 'Contabilidade', 'Secretaria', 'Juridico'];

const todayISO = () => new Date().toISOString();

const emptyForm: Omit<Noticia, 'id' | 'empresaId'> = {
  titulo: '',
  conteudo: '',
  imagemUrl: null,
  featured: false,
  publicado: false,
  publicadoEm: null,
};

export default function NoticiasPage() {
  const navigate = useNavigate();
  const { currentEmpresaId } = useTenant();
  const empresaIdForMutation = typeof currentEmpresaId === 'number' ? currentEmpresaId : null;
  const { user } = useAuth();
  const isAdmin = user?.perfil === 'Admin';

  const { noticias, addNoticia, updateNoticia, deleteNoticia } = useData();
  const { addNotification } = useNotifications();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Noticia | null>(null);

  const [form, setForm] = useState<Omit<Noticia, 'id' | 'empresaId'>>(emptyForm);

  const sorted = useMemo(() => {
    return [...noticias]
      .sort((a, b) => {
        const da = a.publicadoEm ?? '';
        const db = b.publicadoEm ?? '';
        if (da === db) return 0;
        return da < db ? 1 : -1;
      })
      .filter(n => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return n.titulo.toLowerCase().includes(q) || n.conteudo.toLowerCase().includes(q);
      })
      .filter(n => (isAdmin ? true : n.publicado));
  }, [noticias, search, isAdmin]);

  const openCreate = () => {
    if (!isAdmin) {
      toast.error('Apenas Admin pode criar notícias.');
      return;
    }
    if (!empresaIdForMutation) {
      toast.error('Para criar notícias, selecione uma empresa (não use “consolidado”).');
      return;
    }
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (n: Noticia) => {
    if (!isAdmin) return;
    setEditing(n);
    setForm({
      titulo: n.titulo,
      conteudo: n.conteudo,
      imagemUrl: n.imagemUrl ?? null,
      featured: n.featured,
      publicado: n.publicado,
      publicadoEm: n.publicadoEm ?? null,
    });
    setDialogOpen(true);
  };

  const uploadImagem = async (file: File) => {
    if (!isSupabaseConfigured() || !supabase) {
      toast.error('Upload de imagem requer Supabase configurado.');
      return;
    }
    if (!empresaIdForMutation && editing == null) {
      toast.error('Selecione uma empresa para associar a imagem.');
      return;
    }
    try {
      const ext = file.name.split('.').pop() || 'png';
      const baseId = editing?.id ?? Date.now();
      const companyPart = String(empresaIdForMutation ?? editing?.empresaId ?? '0');
      const path = `comunicacao/${companyPart}/noticias/not-${baseId}-${Date.now()}.${ext}`;
      const bucket = 'noticias';
      const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error || !data?.path) throw new Error(error?.message || 'Erro ao fazer upload');
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path);
      setForm(f => ({ ...f, imagemUrl: pub.publicUrl }));
      toast.success('Imagem carregada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível carregar a imagem.');
    }
  };

  const save = async () => {
    if (!isAdmin) return;
    if (!empresaIdForMutation && editing == null) {
      toast.error('Selecione uma empresa para criar.');
      return;
    }
    const titulo = form.titulo.trim();
    const conteudo = form.conteudo.trim();
    if (!titulo || !conteudo) {
      toast.error('Título e conteúdo são obrigatórios.');
      return;
    }

    const isPublishNow = form.publicado && !editing?.publicado;
    const isUnpublish = !form.publicado && !!editing?.publicado;

    try {
      if (editing) {
        const updated = await updateNoticia(editing.id, {
          titulo,
          conteudo,
          imagemUrl: form.imagemUrl ?? null,
          featured: form.featured,
          publicado: form.publicado,
          publicadoEm: form.publicado ? (form.publicadoEm ?? todayISO()) : null,
        });

        if (form.featured) {
          const companyId = editing.empresaId;
          const others = noticias.filter(n => n.empresaId === companyId && n.featured && n.id !== updated.id);
          if (others.length) {
            await Promise.all(others.map(o => updateNoticia(o.id, { featured: false })));
          }
        }

        if (isPublishNow) {
          addNotification({
            tipo: 'sucesso',
            titulo: 'Nova notícia publicada',
            mensagem: `Foi publicada a notícia: ${updated.titulo}`,
            moduloOrigem: 'comunicacao-interna',
            destinatarioPerfil: NOTIF_TARGET_PROFILES,
            link: `/comunicacao-interna/noticias/${updated.id}`,
          });
        } else if (isUnpublish) {
          addNotification({
            tipo: 'info',
            titulo: 'Notícia despublicada',
            mensagem: `A notícia "${updated.titulo}" foi despublicada.`,
            moduloOrigem: 'comunicacao-interna',
            destinatarioPerfil: NOTIF_TARGET_PROFILES,
            link: `/comunicacao-interna/noticias/${updated.id}`,
          });
        }

        setDialogOpen(false);
        setEditing(null);
      } else {
        const created = await addNoticia({
          empresaId: empresaIdForMutation!,
          titulo,
          conteudo,
          imagemUrl: form.imagemUrl ?? null,
          featured: form.featured,
          publicado: form.publicado,
          publicadoEm: form.publicado ? (todayISO() as string) : null,
        });

        if (form.featured) {
          const companyId = empresaIdForMutation!;
          const others = noticias.filter(n => n.empresaId === companyId && n.featured && n.id !== created.id);
          if (others.length) {
            await Promise.all(others.map(o => updateNoticia(o.id, { featured: false })));
          }
        }

        if (created.publicado) {
          addNotification({
            tipo: 'sucesso',
            titulo: 'Nova notícia publicada',
            mensagem: `Foi publicada a notícia: ${created.titulo}`,
            moduloOrigem: 'comunicacao-interna',
            destinatarioPerfil: NOTIF_TARGET_PROFILES,
            link: `/comunicacao-interna/noticias/${created.id}`,
          });
        }

        setDialogOpen(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar notícia.');
    }
  };

  const remove = async (n: Noticia) => {
    if (!isAdmin) return;
    if (!window.confirm(`Remover notícia "${n.titulo}"?`)) return;
    try {
      await deleteNoticia(n.id);
      toast.success('Notícia removida.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover notícia.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Notícias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Publicações internas com imagens, destaque e publicação.</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Nova notícia
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar notícias..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map(n => (
          <div
            key={n.id}
            className={cn(
              'rounded-xl border border-border/80 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
              n.featured ? 'ring-2 ring-primary/40' : '',
            )}
          >
            {n.imagemUrl && (
              <div className="h-36 bg-muted/30 overflow-hidden">
                <img src={n.imagemUrl} alt={n.titulo} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-sm line-clamp-2" title={n.titulo}>{n.titulo}</h3>
                {n.featured && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    <Star className="h-3 w-3" /> Destaque
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground line-clamp-3" title={n.conteudo}>{n.conteudo}</p>

              <div className="flex items-center justify-between pt-2">
                <span className={cn('text-[11px] px-2 py-0.5 rounded-full border', n.publicado ? 'border-primary/40 text-primary' : 'border-border/60 text-muted-foreground')}>
                  {n.publicado ? 'Publicado' : 'Rascunho'}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/comunicacao-interna/noticias/${n.id}`)} title="Ver">
                    <Eye className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(n)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(n)} title="Apagar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="col-span-full text-sm text-muted-foreground py-10 border border-border/80 rounded-xl bg-card text-center">
            Sem notícias para este contexto.
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar notícia' : 'Nova notícia'}</DialogTitle>
            <DialogDescription>Crie/actualize a notícia. Pode carregar imagem e definir destaque.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div className="grid gap-2">
              <Label>Conteúdo</Label>
              <Textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} rows={6} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Imagem (upload)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImagem(file);
                  }}
                />
                {form.imagemUrl && (
                  <img src={form.imagemUrl} alt="Pré-visualização" className="w-full h-32 object-cover rounded-xl border" />
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="featured"
                    checked={form.featured}
                    onCheckedChange={v => setForm(f => ({ ...f, featured: Boolean(v) }))}
                  />
                  <Label htmlFor="featured" className="cursor-pointer">Destaque</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="publicado"
                    checked={form.publicado}
                    onCheckedChange={v => setForm(f => ({ ...f, publicado: Boolean(v) }))}
                  />
                  <Label htmlFor="publicado" className="cursor-pointer">Publicado</Label>
                </div>
                <div className="text-xs text-muted-foreground">
                  Ao publicar, a notícia fica visível no Dashboard e integra notificações.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void save()} className="bg-primary text-primary-foreground">
              {editing ? 'Guardar alterações' : 'Publicar / Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

