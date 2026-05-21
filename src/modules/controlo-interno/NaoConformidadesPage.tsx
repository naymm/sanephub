import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useCiEmpresaId } from '@/modules/controlo-interno/useCiEmpresaId';
import { mapCiNc } from '@/modules/controlo-interno/ciMappers';
import { CI_ESTADOS_NC, CI_GRAVIDADES } from '@/modules/controlo-interno/constants';
import type { CiNcEstado, CiNcGravidade } from '@/types/controloInterno';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/utils/formatters';

export default function NaoConformidadesPage() {
  const empresaId = useCiEmpresaId();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    gravidade: 'Médio' as CiNcGravidade,
    areaResponsavel: '',
    impacto: '',
    recomendacao: '',
    prazoResolucao: '',
    estado: 'Aberta' as CiNcEstado,
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ci', 'nc', empresaId],
    enabled: isSupabaseConfigured() && empresaId != null,
    queryFn: async () => {
      if (!supabase || empresaId == null) return [];
      const { data, error } = await supabase
        .from('ci_nao_conformidades')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(r => mapCiNc(r as Record<string, unknown>));
    },
  });

  const save = async () => {
    if (!supabase || empresaId == null || !form.titulo.trim()) return;
    const { error } = await supabase.from('ci_nao_conformidades').insert({
      empresa_id: empresaId,
      codigo: '',
      titulo: form.titulo.trim(),
      descricao: form.descricao,
      gravidade: form.gravidade,
      area_responsavel: form.areaResponsavel,
      impacto: form.impacto,
      recomendacao: form.recomendacao,
      prazo_resolucao: form.prazoResolucao || null,
      estado: form.estado,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Não conformidade registada.');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['ci'] });
    }
  };

  if (empresaId == null) return <p className="text-sm text-muted-foreground">Seleccione uma empresa.</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <p className="text-sm text-muted-foreground">{isLoading ? '…' : `${rows.length} registo(s)`}</p>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Nova NC</Button>
      </div>
      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Código</th>
              <th className="text-left py-2 px-3">Título</th>
              <th className="text-left py-2 px-3">Gravidade</th>
              <th className="text-left py-2 px-3">Prazo</th>
              <th className="text-left py-2 px-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(n => (
              <tr key={n.id} className="border-b border-border/50">
                <td className="py-2 px-3 font-mono text-xs">{n.codigo}</td>
                <td className="py-2 px-3 font-medium">{n.titulo}</td>
                <td className="py-2 px-3">
                  <Badge variant={n.gravidade === 'Crítico' ? 'destructive' : 'secondary'}>{n.gravidade}</Badge>
                </td>
                <td className="py-2 px-3">{n.prazoResolucao ? formatDate(n.prazoResolucao) : '—'}</td>
                <td className="py-2 px-3">{n.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <DialogHeader><DialogTitle>Nova não conformidade</DialogTitle></DialogHeader>
          <div className="overflow-y-auto space-y-3 py-1">
            <div className="space-y-1"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Gravidade</Label>
                <Select value={form.gravidade} onValueChange={v => setForm(f => ({ ...f, gravidade: v as CiNcGravidade }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CI_GRAVIDADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v as CiNcEstado }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CI_ESTADOS_NC.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Área responsável</Label><Input value={form.areaResponsavel} onChange={e => setForm(f => ({ ...f, areaResponsavel: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Prazo resolução</Label><Input type="date" value={form.prazoResolucao} onChange={e => setForm(f => ({ ...f, prazoResolucao: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Impacto</Label><Textarea value={form.impacto} onChange={e => setForm(f => ({ ...f, impacto: e.target.value }))} rows={2} /></div>
            <div className="space-y-1"><Label>Recomendação</Label><Textarea value={form.recomendacao} onChange={e => setForm(f => ({ ...f, recomendacao: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void save()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
