import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useData } from '@/context/DataContext';
import { useCiEmpresaId } from '@/modules/controlo-interno/useCiEmpresaId';
import { mapCiNc, mapCiPlano } from '@/modules/controlo-interno/ciMappers';
import { CI_ESTADOS_PLANO } from '@/modules/controlo-interno/constants';
import type { CiPlanoEstado } from '@/types/controloInterno';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/utils/formatters';

export default function PlanoAccaoPage() {
  const empresaId = useCiEmpresaId();
  const { colaboradoresTodos } = useData();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ncId, setNcId] = useState<number | null>(null);
  const [form, setForm] = useState({
    accaoCorrectiva: '',
    responsavelColaboradorId: null as number | null,
    prazo: '',
    estado: 'Pendente' as CiPlanoEstado,
    comentarios: '',
  });

  const { data: ncs = [] } = useQuery({
    queryKey: ['ci', 'nc', 'select', empresaId],
    enabled: empresaId != null,
    queryFn: async () => {
      if (!supabase || empresaId == null) return [];
      const { data } = await supabase.from('ci_nao_conformidades').select('id, codigo, titulo').eq('empresa_id', empresaId);
      return (data ?? []).map(r => mapCiNc({ ...r, empresa_id: empresaId } as Record<string, unknown>));
    },
  });

  const { data: planos = [] } = useQuery({
    queryKey: ['ci', 'planos', empresaId],
    enabled: empresaId != null,
    queryFn: async () => {
      if (!supabase || empresaId == null) return [];
      const { data: ncList } = await supabase.from('ci_nao_conformidades').select('id').eq('empresa_id', empresaId);
      const ids = (ncList ?? []).map(n => n.id);
      if (!ids.length) return [];
      const { data } = await supabase.from('ci_planos_accao').select('*').in('nao_conformidade_id', ids);
      return (data ?? []).map(r => mapCiPlano(r as Record<string, unknown>));
    },
  });

  const ncLabel = (id: number) => ncs.find(n => n.id === id);

  const save = async () => {
    if (!supabase || ncId == null || !form.accaoCorrectiva.trim()) return;
    const { error } = await supabase.from('ci_planos_accao').insert({
      nao_conformidade_id: ncId,
      accao_correctiva: form.accaoCorrectiva.trim(),
      responsavel_colaborador_id: form.responsavelColaboradorId,
      prazo: form.prazo || null,
      estado: form.estado,
      comentarios: form.comentarios,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Plano de acção criado.');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['ci'] });
    }
  };

  const colabs = colaboradoresTodos.filter(c => empresaId == null || c.empresaId === empresaId);

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">{planos.length} plano(s)</p>
        <Button onClick={() => setOpen(true)} disabled={!ncs.length}><Plus className="h-4 w-4 mr-2" /> Novo plano</Button>
      </div>
      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">NC</th>
              <th className="text-left py-2 px-3">Acção</th>
              <th className="text-left py-2 px-3">Prazo</th>
              <th className="text-left py-2 px-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {planos.map(p => {
              const nc = ncLabel(p.naoConformidadeId);
              return (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="py-2 px-3 font-mono text-xs">{nc?.codigo ?? p.naoConformidadeId}</td>
                  <td className="py-2 px-3">{p.accaoCorrectiva}</td>
                  <td className="py-2 px-3">{p.prazo ? formatDate(p.prazo) : '—'}</td>
                  <td className="py-2 px-3">{p.estado}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Plano de acção correctivo</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Não conformidade *</Label>
              <Select value={ncId?.toString() ?? ''} onValueChange={v => setNcId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar NC" /></SelectTrigger>
                <SelectContent>
                  {ncs.map(n => (
                    <SelectItem key={n.id} value={String(n.id)}>{n.codigo} — {n.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Acção correctiva *</Label><Textarea value={form.accaoCorrectiva} onChange={e => setForm(f => ({ ...f, accaoCorrectiva: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Select
                value={form.responsavelColaboradorId?.toString() ?? 'none'}
                onValueChange={v => setForm(f => ({ ...f, responsavelColaboradorId: v === 'none' ? null : Number(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {colabs.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Prazo</Label><Input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v as CiPlanoEstado }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CI_ESTADOS_PLANO.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Comentários</Label><Textarea value={form.comentarios} onChange={e => setForm(f => ({ ...f, comentarios: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void save()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
