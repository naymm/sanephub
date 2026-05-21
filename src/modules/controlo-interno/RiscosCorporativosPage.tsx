import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useData } from '@/context/DataContext';
import { useCiEmpresaId } from '@/modules/controlo-interno/useCiEmpresaId';
import { mapCiRisco } from '@/modules/controlo-interno/ciMappers';
import { ciRiscoNivel, ciRiscoNivelClass, ciRiscoScore } from '@/modules/controlo-interno/controloInternoRisk';
import { CI_CATEGORIAS_RISCO, CI_ESTADOS_RISCO } from '@/modules/controlo-interno/constants';
import type { CiRiscoCategoria, CiRiscoEstado } from '@/types/controloInterno';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function RiscosCorporativosPage() {
  const empresaId = useCiEmpresaId();
  const { colaboradoresTodos } = useData();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    categoria: 'Operacional' as CiRiscoCategoria,
    probabilidade: 3,
    impacto: 3,
    mitigacao: '',
    responsavelColaboradorId: null as number | null,
    estado: 'Identificado' as CiRiscoEstado,
  });

  const score = ciRiscoScore(form.probabilidade, form.impacto);
  const nivel = ciRiscoNivel(score);

  const { data: rows = [] } = useQuery({
    queryKey: ['ci', 'riscos', empresaId],
    enabled: isSupabaseConfigured() && empresaId != null,
    queryFn: async () => {
      if (!supabase || empresaId == null) return [];
      const { data, error } = await supabase.from('ci_riscos').select('*').eq('empresa_id', empresaId).order('score', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(r => mapCiRisco(r as Record<string, unknown>));
    },
  });

  const save = async () => {
    if (!supabase || empresaId == null || !form.titulo.trim()) return;
    const { error } = await supabase.from('ci_riscos').insert({
      empresa_id: empresaId,
      titulo: form.titulo.trim(),
      categoria: form.categoria,
      probabilidade: form.probabilidade,
      impacto: form.impacto,
      mitigacao: form.mitigacao,
      responsavel_colaborador_id: form.responsavelColaboradorId,
      estado: form.estado,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Risco registado.');
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['ci'] });
    }
  };

  const colabs = colaboradoresTodos.filter(c => empresaId == null || c.empresaId === empresaId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{rows.length} risco(s) — score = impacto × probabilidade</p>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo risco</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Matriz de risco (resumo)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="border p-2 bg-muted">P \ I</th>
                {[1, 2, 3, 4, 5].map(i => (
                  <th key={i} className="border p-2 bg-muted">I{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[5, 4, 3, 2, 1].map(p => (
                <tr key={p}>
                  <td className="border p-2 font-medium bg-muted">P{p}</td>
                  {[1, 2, 3, 4, 5].map(i => {
                    const s = p * i;
                    const n = ciRiscoNivel(s);
                    return (
                      <td key={i} className={cn('border p-2 text-center', ciRiscoNivelClass(n))}>
                        {s}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Título</th>
              <th className="text-left py-2 px-3">Categoria</th>
              <th className="text-left py-2 px-3">P×I</th>
              <th className="text-left py-2 px-3">Nível</th>
              <th className="text-left py-2 px-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="py-2 px-3 font-medium">{r.titulo}</td>
                <td className="py-2 px-3">{r.categoria}</td>
                <td className="py-2 px-3">{r.score}</td>
                <td className="py-2 px-3">
                  <Badge className={ciRiscoNivelClass(ciRiscoNivel(r.score))}>{ciRiscoNivel(r.score)}</Badge>
                </td>
                <td className="py-2 px-3">{r.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo risco corporativo</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v as CiRiscoCategoria }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CI_CATEGORIAS_RISCO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Probabilidade (1–5)</Label>
                <Input type="number" min={1} max={5} value={form.probabilidade} onChange={e => setForm(f => ({ ...f, probabilidade: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>Impacto (1–5)</Label>
                <Input type="number" min={1} max={5} value={form.impacto} onChange={e => setForm(f => ({ ...f, impacto: Number(e.target.value) }))} />
              </div>
            </div>
            <p className="text-sm">
              Score: <strong>{score}</strong> — <Badge className={ciRiscoNivelClass(nivel)}>{nivel}</Badge>
            </p>
            <div className="space-y-1"><Label>Mitigação</Label><Textarea value={form.mitigacao} onChange={e => setForm(f => ({ ...f, mitigacao: e.target.value }))} /></div>
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
