import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useData } from '@/context/DataContext';
import { useCiEmpresaId } from '@/modules/controlo-interno/useCiEmpresaId';
import { useCiCanManage } from '@/modules/controlo-interno/useCiCanManage';
import { mapCiInspecao } from '@/modules/controlo-interno/ciMappers';
import {
  CiEmpresaNaturezaFields,
  validateCiEmpresaNaturezaForm,
  type CiEmpresaNaturezaFormValues,
} from '@/modules/controlo-interno/CiEmpresaNaturezaFields';
import { CI_ESTADOS_INSPECCAO } from '@/modules/controlo-interno/constants';
import type { CiInspecao, CiInspecaoEstado } from '@/types/controloInterno';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/utils/formatters';

function areaLabel(i: CiInspecao): string {
  if (i.natureza === 'Direccionada') return i.areaDireccionada || '—';
  return i.areaDepartamento || '—';
}

const emptyCore = (empresaId = 0): CiEmpresaNaturezaFormValues => ({
  empresaId,
  data: '',
  prazo: '',
  areaDepartamento: '',
  natureza: 'Orgânica',
  areaDireccionada: '',
});

export default function InspeccoesPage() {
  const tenantEmpresaId = useCiEmpresaId();
  const canManage = useCiCanManage();
  const { empresas, colaboradoresTodos } = useData();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CiInspecao | null>(null);
  const [core, setCore] = useState<CiEmpresaNaturezaFormValues>(emptyCore());
  const [estado, setEstado] = useState<CiInspecaoEstado>('Planeada');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [inspetorId, setInspetorId] = useState<number | null>(null);

  const empresasActivas = useMemo(
    () => empresas.filter(e => e.activo !== false).map(e => ({ id: e.id, nome: e.nome, codigo: e.codigo })),
    [empresas],
  );

  const empresaNome = useCallback(
    (id: number) => empresas.find(e => e.id === id)?.nome ?? `#${id}`,
    [empresas],
  );

  const colabs = useMemo(() => {
    if (!core.empresaId) return colaboradoresTodos;
    return colaboradoresTodos.filter(c => c.empresaId === core.empresaId);
  }, [colaboradoresTodos, core.empresaId]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ci', 'inspeccoes', canManage, tenantEmpresaId],
    enabled: isSupabaseConfigured() && (canManage || tenantEmpresaId != null),
    staleTime: 30_000,
    queryFn: async () => {
      if (!supabase) return [];
      let q = supabase.from('ci_inspecoes').select('*').order('created_at', { ascending: false });
      if (!canManage && tenantEmpresaId != null) {
        q = q.eq('empresa_id', tenantEmpresaId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(r => mapCiInspecao(r as Record<string, unknown>));
    },
  });

  const openCreate = () => {
    setEditing(null);
    setCore(emptyCore(tenantEmpresaId ?? empresasActivas[0]?.id ?? 0));
    setEstado('Planeada');
    setTitulo('');
    setDescricao('');
    setObservacoes('');
    setInspetorId(null);
    setOpen(true);
  };

  const openEdit = (i: CiInspecao) => {
    setEditing(i);
    setCore({
      empresaId: i.empresaId,
      data: i.dataInspecao ?? '',
      prazo: i.prazo ?? '',
      areaDepartamento: i.areaDepartamento,
      natureza: i.natureza,
      areaDireccionada: i.areaDireccionada,
    });
    setEstado(i.estado);
    setTitulo(i.titulo);
    setDescricao(i.descricao);
    setObservacoes(i.observacoes);
    setInspetorId(i.inspetorColaboradorId);
    setOpen(true);
  };

  const save = async () => {
    const err = validateCiEmpresaNaturezaForm(core);
    if (err) {
      toast.error(err);
      return;
    }
    if (!supabase) return;

    const areaDept =
      core.natureza === 'Orgânica' ? core.areaDepartamento.trim() : core.areaDireccionada.trim();
    const autoTitulo = `Inspecção — ${empresaNome(core.empresaId)} — ${areaDept || core.natureza}`;

    const payload = {
      empresa_id: core.empresaId,
      natureza: core.natureza,
      area_departamento: areaDept,
      area_direccionada: core.natureza === 'Direccionada' ? core.areaDireccionada.trim() : '',
      data_inspecao: core.data,
      prazo: core.prazo,
      titulo: titulo.trim() || autoTitulo,
      descricao,
      estado,
      inspetor_colaborador_id: inspetorId,
      observacoes,
    };

    try {
      if (editing) {
        const { error } = await supabase.from('ci_inspecoes').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Inspecção actualizada.');
      } else {
        const { error } = await supabase.from('ci_inspecoes').insert({ ...payload, codigo: '' });
        if (error) throw error;
        toast.success('Inspecção registada.');
      }
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['ci'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  if (!canManage && tenantEmpresaId == null) {
    return <p className="text-sm text-muted-foreground">Seleccione uma empresa no contexto.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Registo de inspecções realizadas nas empresas do grupo (mesma lógica de empresa, data, prazo,
        área e tipo orgânica ou direccionada).
      </p>

      <div className="flex justify-between items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'A carregar…' : `${rows.length} inspecção(ões)`}
        </p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Nova inspecção
        </Button>
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Código</th>
              <th className="text-left py-2 px-3">Empresa</th>
              <th className="text-left py-2 px-3">Título</th>
              <th className="text-left py-2 px-3">Tipo</th>
              <th className="text-left py-2 px-3">Área</th>
              <th className="text-left py-2 px-3">Data</th>
              <th className="text-left py-2 px-3">Prazo</th>
              <th className="text-left py-2 px-3">Estado</th>
              <th className="text-right py-2 px-3">Acções</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(i => (
              <tr key={i.id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="py-2 px-3 font-mono text-xs">{i.codigo}</td>
                <td className="py-2 px-3">{empresaNome(i.empresaId)}</td>
                <td className="py-2 px-3 font-medium">{i.titulo}</td>
                <td className="py-2 px-3">
                  <Badge variant="outline">{i.natureza}</Badge>
                </td>
                <td className="py-2 px-3 text-muted-foreground">{areaLabel(i)}</td>
                <td className="py-2 px-3 text-xs text-muted-foreground">
                  {i.dataInspecao ? formatDate(i.dataInspecao) : '—'}
                </td>
                <td className="py-2 px-3 text-xs text-muted-foreground">
                  {i.prazo ? formatDate(i.prazo) : '—'}
                </td>
                <td className="py-2 px-3">
                  <Badge variant={i.estado === 'Em curso' ? 'default' : 'secondary'}>{i.estado}</Badge>
                </td>
                <td className="py-2 px-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(i)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[min(90dvh,90vh)] grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editing ? 'Editar inspecção' : 'Nova inspecção'}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto space-y-4 py-2 pr-1">
            <CiEmpresaNaturezaFields
              empresas={empresasActivas}
              values={core}
              onChange={patch => setCore(c => ({ ...c, ...patch }))}
              empresaLabel="Empresa inspeccionada"
            />
            <div className="space-y-1">
              <Label>Título (opcional)</Label>
              <Input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Gerado automaticamente se vazio"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Estado</Label>
                <Select value={estado} onValueChange={v => setEstado(v as CiInspecaoEstado)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CI_ESTADOS_INSPECCAO.map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Inspector</Label>
                <Select
                  value={inspetorId?.toString() ?? 'none'}
                  onValueChange={v => setInspetorId(v === 'none' ? null : Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {colabs.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descrição / âmbito</Label>
              <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void save()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
