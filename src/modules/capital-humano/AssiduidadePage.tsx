import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import type { AtrasoAssiduidade, LicencaAssiduidade, LicencaAssiduidadeTipo } from '@/types';
import { podeJustificarAtrasoMesmoDia } from '@/services/assiduidade/attendanceValidation';
import { formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ExternalLink, Pencil, Plus, ShieldCheck } from 'lucide-react';

export default function AssiduidadePage() {
  const { user } = useAuth();
  const {
    colaboradores,
    assiduidadeLicencas,
    assiduidadeAtrasos,
    addAssiduidadeLicenca,
    updateAssiduidadeLicenca,
    deleteAssiduidadeLicenca,
    addAssiduidadeAtraso,
    updateAssiduidadeAtraso,
  } = useData();

  const [colabFilter, setColabFilter] = useState<number | 'todos'>('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [licOpen, setLicOpen] = useState(false);
  const [licEdit, setLicEdit] = useState<LicencaAssiduidade | null>(null);
  const [licForm, setLicForm] = useState<Partial<LicencaAssiduidade>>({
    colaboradorId: 0,
    empresaId: 0,
    tipo: 'maternidade',
    dataInicio: new Date().toISOString().slice(0, 10),
    dataFim: new Date().toISOString().slice(0, 10),
    observacoes: '',
  });

  const [atrOpen, setAtrOpen] = useState(false);
  const [atrJustify, setAtrJustify] = useState<AtrasoAssiduidade | null>(null);
  const [atrJustText, setAtrJustText] = useState('');
  const [atrForm, setAtrForm] = useState<Partial<AtrasoAssiduidade>>({
    colaboradorId: 0,
    empresaId: 0,
    dataRef: new Date().toISOString().slice(0, 10),
    minutosAtraso: 0,
    justificado: false,
    registadoPor: user?.nome ?? '',
  });

  const nomeColab = (id: number) => colaboradores.find(c => c.id === id)?.nome ?? `#${id}`;

  const licencasFiltradas = useMemo(() => {
    return assiduidadeLicencas.filter(l => {
      if (colabFilter !== 'todos' && l.colaboradorId !== colabFilter) return false;
      const ini = String(l.dataInicio).slice(0, 10);
      const fim = String(l.dataFim).slice(0, 10);
      if (dataInicio && fim < dataInicio) return false;
      if (dataFim && ini > dataFim) return false;
      return true;
    });
  }, [assiduidadeLicencas, colabFilter, dataInicio, dataFim]);

  const atrasosFiltrados = useMemo(() => {
    return [...assiduidadeAtrasos]
      .filter(a => {
        if (colabFilter !== 'todos' && a.colaboradorId !== colabFilter) return false;
        const d = String(a.dataRef).slice(0, 10);
        if (dataInicio && d < dataInicio) return false;
        if (dataFim && d > dataFim) return false;
        return true;
      })
      .sort((a, b) => String(b.dataRef).localeCompare(String(a.dataRef)));
  }, [assiduidadeAtrasos, colabFilter, dataInicio, dataFim]);

  const openNovaLicenca = () => {
    const c0 = colaboradores[0];
    setLicEdit(null);
    setLicForm({
      colaboradorId: c0?.id ?? 0,
      empresaId: c0?.empresaId ?? 0,
      tipo: 'maternidade',
      dataInicio: new Date().toISOString().slice(0, 10),
      dataFim: new Date().toISOString().slice(0, 10),
      observacoes: '',
    });
    setLicOpen(true);
  };

  const openEditLicenca = (l: LicencaAssiduidade) => {
    setLicEdit(l);
    setLicForm({ ...l });
    setLicOpen(true);
  };

  const guardarLicenca = async () => {
    const col = colaboradores.find(c => c.id === licForm.colaboradorId);
    if (!col) {
      toast.error('Seleccione um colaborador.');
      return;
    }
    const payload: Partial<LicencaAssiduidade> = {
      ...licForm,
      colaboradorId: col.id,
      empresaId: col.empresaId,
      tipo: (licForm.tipo as LicencaAssiduidadeTipo) ?? 'maternidade',
      dataInicio: String(licForm.dataInicio).slice(0, 10),
      dataFim: String(licForm.dataFim).slice(0, 10),
      observacoes: licForm.observacoes ?? '',
    };
    try {
      if (licEdit) await updateAssiduidadeLicenca(licEdit.id, payload);
      else await addAssiduidadeLicenca(payload);
      toast.success('Licença guardada.');
      setLicOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const removerLicenca = async (l: LicencaAssiduidade) => {
    if (!window.confirm('Remover esta licença?')) return;
    try {
      await deleteAssiduidadeLicenca(l.id);
      toast.success('Removido.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  const openNovoAtraso = () => {
    const c0 = colaboradores[0];
    setAtrForm({
      colaboradorId: c0?.id ?? 0,
      empresaId: c0?.empresaId ?? 0,
      dataRef: new Date().toISOString().slice(0, 10),
      minutosAtraso: 15,
      justificado: false,
      registadoPor: user?.nome ?? '',
    });
    setAtrOpen(true);
  };

  const guardarAtraso = async () => {
    const col = colaboradores.find(c => c.id === atrForm.colaboradorId);
    if (!col) {
      toast.error('Seleccione um colaborador.');
      return;
    }
    const dataRef = String(atrForm.dataRef).slice(0, 10);
    const minutos = Math.max(0, Math.floor(Number(atrForm.minutosAtraso) || 0));
    const existente = assiduidadeAtrasos.find(a => a.colaboradorId === col.id && String(a.dataRef).slice(0, 10) === dataRef);
    const base: Partial<AtrasoAssiduidade> = {
      colaboradorId: col.id,
      empresaId: col.empresaId,
      dataRef,
      minutosAtraso: minutos,
      registadoPor: user?.nome ?? '',
    };
    try {
      if (existente) {
        await updateAssiduidadeAtraso(existente.id, { ...base, justificado: existente.justificado });
        toast.success('Atraso actualizado (já existia registo para este dia).');
      } else {
        await addAssiduidadeAtraso(base);
        toast.success('Atraso registado.');
      }
      setAtrOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const abrirJustificar = (a: AtrasoAssiduidade) => {
    if (!podeJustificarAtrasoMesmoDia(String(a.dataRef))) {
      toast.error('A justificação de atraso só é permitida no mesmo dia do registo.');
      return;
    }
    if (a.justificado) {
      toast.message('Este atraso já está justificado.');
      return;
    }
    setAtrJustify(a);
    setAtrJustText('');
  };

  const confirmarJustificacao = async () => {
    if (!atrJustify) return;
    if (!podeJustificarAtrasoMesmoDia(String(atrJustify.dataRef))) {
      toast.error('Prazo expirado para justificar este atraso.');
      return;
    }
    try {
      await updateAssiduidadeAtraso(atrJustify.id, {
        justificado: true,
        justificacao: atrJustText.trim() || 'Justificado',
        justificadoEm: new Date().toISOString(),
      });
      toast.success('Atraso justificado.');
      setAtrJustify(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao justificar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assiduidade</h1>
          <p className="text-muted-foreground text-sm">
            Licenças (ex.: maternidade), atrasos e ligação ao processamento salarial. Faltas detalhadas em{' '}
            <Link to="/capital-humano/faltas" className="text-primary underline-offset-4 hover:underline inline-flex items-center gap-1">
              Faltas <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            .
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/capital-humano/faltas">Abrir faltas</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Intervalo de datas aplica-se às licenças e aos atrasos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="space-y-2 min-w-[200px]">
            <Label>Colaborador</Label>
            <Select
              value={colabFilter === 'todos' ? 'todos' : String(colabFilter)}
              onValueChange={v => setColabFilter(v === 'todos' ? 'todos' : Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {colaboradores.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Desde</Label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Até</Label>
            <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Licenças</CardTitle>
            <CardDescription>Maternidade integra com o processamento salarial (subsídios zerados no mês afectado).</CardDescription>
          </div>
          <Button size="sm" onClick={openNovaLicenca}>
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Colaborador</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Início</th>
                <th className="py-2 pr-4">Fim</th>
                <th className="py-2 pr-4 w-32" />
              </tr>
            </thead>
            <tbody>
              {licencasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Sem licenças neste filtro.
                  </td>
                </tr>
              ) : (
                licencasFiltradas.map(l => (
                  <tr key={l.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">{nomeColab(l.colaboradorId)}</td>
                    <td className="py-2 pr-4 capitalize">{l.tipo}</td>
                    <td className="py-2 pr-4">{formatDate(l.dataInicio)}</td>
                    <td className="py-2 pr-4">{formatDate(l.dataFim)}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditLicenca(l)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removerLicenca(l)}>
                          ×
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Atrasos</CardTitle>
            <CardDescription>Um registo por colaborador e dia. Justificação apenas no mesmo dia.</CardDescription>
          </div>
          <Button size="sm" variant="secondary" onClick={openNovoAtraso}>
            <Plus className="h-4 w-4 mr-1" />
            Registar atraso
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Colaborador</th>
                <th className="py-2 pr-4">Dia</th>
                <th className="py-2 pr-4">Minutos</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4 w-40" />
              </tr>
            </thead>
            <tbody>
              {atrasosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Sem atrasos neste filtro.
                  </td>
                </tr>
              ) : (
                atrasosFiltrados.map(a => (
                  <tr key={a.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">{nomeColab(a.colaboradorId)}</td>
                    <td className="py-2 pr-4">{formatDate(a.dataRef)}</td>
                    <td className="py-2 pr-4 tabular-nums">{a.minutosAtraso}</td>
                    <td className="py-2 pr-4">
                      {a.justificado ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="h-4 w-4" /> Justificado
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Pendente</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {!a.justificado && podeJustificarAtrasoMesmoDia(String(a.dataRef)) ? (
                        <Button size="sm" variant="outline" onClick={() => abrirJustificar(a)}>
                          Justificar
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={licOpen} onOpenChange={setLicOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{licEdit ? 'Editar licença' : 'Nova licença'}</DialogTitle>
            <DialogDescription>Período inclusivo; afecta o cálculo salarial nos meses intersectados.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select
                value={licForm.colaboradorId ? String(licForm.colaboradorId) : ''}
                onValueChange={v => {
                  const id = Number(v);
                  const col = colaboradores.find(c => c.id === id);
                  setLicForm(f => ({ ...f, colaboradorId: id, empresaId: col?.empresaId ?? f.empresaId }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={licForm.tipo ?? 'maternidade'}
                onValueChange={v => setLicForm(f => ({ ...f, tipo: v as LicencaAssiduidadeTipo }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maternidade">Maternidade</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="date" value={String(licForm.dataInicio ?? '').slice(0, 10)} onChange={e => setLicForm(f => ({ ...f, dataInicio: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="date" value={String(licForm.dataFim ?? '').slice(0, 10)} onChange={e => setLicForm(f => ({ ...f, dataFim: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={licForm.observacoes ?? ''} onChange={e => setLicForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLicOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarLicenca}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={atrOpen} onOpenChange={setAtrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registar atraso</DialogTitle>
            <DialogDescription>Se já existir linha para o mesmo dia, o registo é actualizado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Select
                value={atrForm.colaboradorId ? String(atrForm.colaboradorId) : ''}
                onValueChange={v => {
                  const id = Number(v);
                  const col = colaboradores.find(c => c.id === id);
                  setAtrForm(f => ({ ...f, colaboradorId: id, empresaId: col?.empresaId ?? f.empresaId }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dia</Label>
              <Input type="date" value={String(atrForm.dataRef ?? '').slice(0, 10)} onChange={e => setAtrForm(f => ({ ...f, dataRef: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Minutos de atraso</Label>
              <Input
                type="number"
                min={0}
                value={atrForm.minutosAtraso ?? 0}
                onChange={e => setAtrForm(f => ({ ...f, minutosAtraso: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtrOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarAtraso}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!atrJustify} onOpenChange={o => !o && setAtrJustify(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificar atraso</DialogTitle>
            <DialogDescription>Só permitido no mesmo dia civil do atraso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea value={atrJustText} onChange={e => setAtrJustText(e.target.value)} rows={3} placeholder="Descreva o motivo…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtrJustify(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarJustificacao}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
