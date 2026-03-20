import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import type { Evento } from '@/types';
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
import { Search, Plus, Pencil, Trash2, Eye, CalendarDays, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const NOTIF_TARGET_PROFILES = ['Admin', 'PCA', 'Planeamento', 'Director', 'RH', 'Financeiro', 'Contabilidade', 'Secretaria', 'Juridico'];

const emptyForm: Omit<Evento, 'id' | 'empresaId'> = {
  titulo: '',
  descricao: '',
  local: '',
  dataInicio: new Date().toISOString(),
  imagemUrl: null,
  isInterno: true,
  alertaAntesHoras: 24,
  alertaEm: null,
};

export default function EventosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.perfil === 'Admin';

  const { currentEmpresaId } = useTenant();
  const empresaIdForMutation = typeof currentEmpresaId === 'number' ? currentEmpresaId : null;

  const { eventos, addEvento, updateEvento, deleteEvento } = useData();
  const { addNotification } = useNotifications();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Evento | null>(null);

  const [form, setForm] = useState<Omit<Evento, 'id' | 'empresaId'>>(emptyForm);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...eventos]
      .filter(e => {
        if (!q) return true;
        return e.titulo.toLowerCase().includes(q) || e.local.toLowerCase().includes(q) || (e.descricao ?? '').toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime());
  }, [eventos, search]);

  const openCreate = () => {
    if (!isAdmin) return;
    if (!empresaIdForMutation) {
      toast.error('Para criar eventos, selecione uma empresa (não use “consolidado”).');
      return;
    }
    setEditing(null);
    setForm({ ...emptyForm, dataInicio: new Date().toISOString() });
    setDialogOpen(true);
  };

  const openEdit = (e: Evento) => {
    if (!isAdmin) return;
    setEditing(e);
    setForm({
      titulo: e.titulo,
      descricao: e.descricao ?? '',
      local: e.local,
      imagemUrl: e.imagemUrl ?? null,
      isInterno: e.isInterno,
      alertaAntesHoras: e.alertaAntesHoras ?? 24,
      alertaEm: e.alertaEm ?? null,
      dataInicio: e.dataInicio,
    });
    setDialogOpen(true);
  };

  const uploadImagem = async (file: File) => {
    if (!isSupabaseConfigured() || !supabase) {
      toast.error('Upload de imagem requer Supabase configurado.');
      return;
    }
    try {
      const ext = file.name.split('.').pop() || 'png';
      const baseId = editing?.id ?? Date.now();
      const companyPart = String(empresaIdForMutation ?? editing?.empresaId ?? '0');
      const path = `comunicacao/${companyPart}/eventos/ev-${baseId}-${Date.now()}.${ext}`;
      const bucket = 'eventos';
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
    const local = form.local.trim();
    if (!titulo || !local) {
      toast.error('Título e localização são obrigatórios.');
      return;
    }

    const dt = new Date(form.dataInicio);
    if (Number.isNaN(dt.getTime())) {
      toast.error('Data/hora inválida.');
      return;
    }

    const alertaAntesHoras = form.alertaAntesHoras ?? null;
    const alertaEm = alertaAntesHoras != null
      ? new Date(dt.getTime() - alertaAntesHoras * 3600000).toISOString()
      : null;

    const payload: Partial<Evento> = {
      titulo,
      descricao: (form.descricao ?? '').trim(),
      local,
      imagemUrl: form.imagemUrl ?? null,
      isInterno: form.isInterno,
      dataInicio: dt.toISOString(),
      alertaAntesHoras,
      alertaEm,
    };

    try {
      if (editing) {
        await updateEvento(editing.id, payload);
        toast.success('Evento actualizado.');
      } else {
        const created = await addEvento({
          empresaId: empresaIdForMutation!,
          ...(payload as any),
        });

        addNotification({
          tipo: 'info',
          titulo: 'Novo evento criado',
          mensagem: `Foi criado um novo evento: ${created.titulo}`,
          moduloOrigem: 'comunicacao-interna',
          destinatarioPerfil: NOTIF_TARGET_PROFILES,
          link: `/comunicacao-interna/eventos/${created.id}`,
        });

        toast.success('Evento criado.');
      }

      setDialogOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar evento.');
    }
  };

  const remove = async (e: Evento) => {
    if (!isAdmin) return;
    if (!window.confirm(`Remover evento "${e.titulo}"?`)) return;
    try {
      await deleteEvento(e.id);
      toast.success('Evento removido.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover evento.');
    }
  };

  // Util: strings de date/time compatíveis com input tipo="date"/"time"
  const dataISO = form.dataInicio ? new Date(form.dataInicio).toISOString() : new Date().toISOString();
  const datePart = dataISO.slice(0, 10);
  const timePart = dataISO.slice(11, 16);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Eventos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de eventos corporativos com imagem e alerta.</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Novo evento
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar eventos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(e => (
          <div key={e.id} className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            {e.imagemUrl && (
              <div className="h-36 bg-muted/30 overflow-hidden">
                <img src={e.imagemUrl} alt={e.titulo} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-sm truncate">{e.titulo}</h3>
                <span className={cn('text-[11px] px-2 py-0.5 rounded-full border', e.isInterno ? 'border-primary/40 text-primary' : 'border-border/60 text-muted-foreground')}>
                  {e.isInterno ? 'Interno' : 'Externo'}
                </span>
              </div>

              <p className="text-xs text-muted-foreground line-clamp-3">{e.descricao}</p>

              <div className="text-xs text-muted-foreground">
                {new Date(e.dataInicio).toLocaleString('pt-PT')} • {e.local}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/comunicacao-interna/eventos/${e.id}`)} title="Ver">
                  <Eye className="h-4 w-4" />
                </Button>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(e)} title="Apagar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-sm text-muted-foreground py-10 border border-border/80 rounded-xl bg-card text-center">
            Sem eventos para este contexto.
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar evento' : 'Novo evento'}</DialogTitle>
            <DialogDescription>Defina data/hora, localização, tipo interno/externo e imagem.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>

            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao ?? ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={4} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={datePart}
                  onChange={ev => {
                    const d = ev.target.value;
                    const combined = new Date(`${d}T${timePart}`);
                    setForm(f => ({ ...f, dataInicio: combined.toISOString() }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={timePart}
                  onChange={ev => {
                    const t = ev.target.value;
                    const combined = new Date(`${datePart}T${t}`);
                    setForm(f => ({ ...f, dataInicio: combined.toISOString() }));
                  }}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Local</Label>
              <Input value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} />
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
                <div className="text-xs text-muted-foreground">
                  Dimensao recomendada: <span className="font-medium">1200x675</span> (formato 16:9). PNG/JPG; max. ~5MB.
                </div>
                {form.imagemUrl && (
                  <div className="rounded-xl border overflow-hidden">
                    <img src={form.imagemUrl} alt="Pré-visualização" className="w-full h-32 object-cover" />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.isInterno}
                    onCheckedChange={v => setForm(f => ({ ...f, isInterno: Boolean(v) }))}
                    id="isInterno"
                  />
                  <Label htmlFor="isInterno" className="cursor-pointer">Evento interno</Label>
                </div>

                <div className="space-y-2">
                  <Label>Notificar antes (horas)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.alertaAntesHoras ?? 24}
                    onChange={e => setForm(f => ({ ...f, alertaAntesHoras: e.target.value === '' ? null : Number(e.target.value) }))}
                  />
                  <div className="text-xs text-muted-foreground">
                    Guarda `alerta_em` na base e usamos para disparos (quando o sistema de scheduler estiver ligado).
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void save()} className="bg-primary text-primary-foreground">
              {editing ? 'Guardar alterações' : 'Criar evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

