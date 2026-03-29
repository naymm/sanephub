import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import type { Colaborador, ReciboSalario } from '@/types';
import { calcularInssIrtLiquido, IRT_ESCALOES_FALLBACK } from '@/lib/irtCalculo';
import { formatKz } from '@/utils/formatters';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { Search, Plus, Check, X, ChevronsUpDown, Calculator } from 'lucide-react';

const MESES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ANO_ACTUAL = new Date().getFullYear();
const MES_ACTUAL = new Date().getMonth() + 1; // 1..12

type ModoProcessamento = 'singular' | 'lote';

interface ResultadoProcessamento {
  colaboradorId: number;
  colaboradorNome: string;
  acao: 'criado' | 'actualizado' | 'skip_existe';
  inss: number;
  irt: number;
  liquido: number;
}

function clampNumber(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

export default function ProcessamentoSalarialPage() {
  const { colaboradores, recibos, addRecibo, updateRecibo, irtEscalaes } = useData();

  const [modo, setModo] = useState<ModoProcessamento>('singular');
  const [ano, setAno] = useState(String(ANO_ACTUAL));
  const [mes, setMes] = useState('01');

  const mesAno = `${ano}-${mes}`;

  const [colaboradorIdSingular, setColaboradorIdSingular] = useState<number>(0);
  const [singularOpen, setSingularOpen] = useState(false);
  const [singularSearch, setSingularSearch] = useState('');
  const [loteOpen, setLoteOpen] = useState(false);
  const [loteSearch, setLoteSearch] = useState('');
  const [colaboradoresSelecionados, setColaboradoresSelecionados] = useState<number[]>([]);

  const [outrasDeducoes, setOutrasDeducoes] = useState(0);

  const [overwrite, setOverwrite] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResult, setLastResult] = useState<ResultadoProcessamento[]>([]);
  const warnedIrtFallbackRef = useRef(false);

  const colaboradoresActivos = useMemo(() => {
    return [...colaboradores].filter(c => c.status === 'Activo').sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  }, [colaboradores]);

  const colaboradoresFiltrados = useMemo(() => {
    const q = loteSearch.trim().toLowerCase();
    if (!q) return colaboradoresActivos;
    return colaboradoresActivos.filter(c => c.nome.toLowerCase().includes(q));
  }, [colaboradoresActivos, loteSearch]);

  const colaboradoresSingularFiltrados = useMemo(() => {
    const q = singularSearch.trim().toLowerCase();
    if (!q) return colaboradoresActivos;
    return colaboradoresActivos.filter(c => c.nome.toLowerCase().includes(q));
  }, [colaboradoresActivos, singularSearch]);

  const nomeColab = (id: number) => colaboradoresActivos.find(c => c.id === id)?.nome ?? `#${id}`;

  const toggleColab = (id: number) => {
    setColaboradoresSelecionados(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const selectedIds = useMemo(() => {
    return modo === 'singular' ? (colaboradorIdSingular ? [colaboradorIdSingular] : []) : colaboradoresSelecionados;
  }, [modo, colaboradorIdSingular, colaboradoresSelecionados]);

  const irtEscalaesEfetivos = useMemo(() => {
    return irtEscalaes?.length ? irtEscalaes : IRT_ESCALOES_FALLBACK;
  }, [irtEscalaes]);

  const validarAntesProcessar = () => {
    const anoNum = Number(ano);
    const mesNum = Number(mes);
    if (!Number.isFinite(anoNum) || !Number.isFinite(mesNum)) {
      toast.error('Ano/Mês inválido.');
      return false;
    }
    if (anoNum > ANO_ACTUAL || (anoNum === ANO_ACTUAL && mesNum > MES_ACTUAL)) {
      toast.error('Por segurança, não é permitido processar meses futuros.');
      return false;
    }
    if (selectedIds.length === 0) {
      toast.error('Seleccione pelo menos um colaborador para processar.');
      return false;
    }
    return true;
  };

  const calcularParaColaborador = (col: Colaborador) => {
    return calcularInssIrtLiquido(
      {
        salarioBase: col.salarioBase,
        subsidioAlimentacao: col.subsidioAlimentacao ?? 0,
        subsidioTransporte: col.subsidioTransporte ?? 0,
        outrosSubsidios: col.outrosSubsidios ?? 0,
        outrasDeducoes: outrasDeducoes,
      },
      irtEscalaesEfetivos,
    );
  };

  const abrirConfirmacao = () => {
    if (!validarAntesProcessar()) return;
    if (!irtEscalaes?.length && !warnedIrtFallbackRef.current) {
      warnedIrtFallbackRef.current = true;
      toast.warning('Tabela de IRT não carregada no Supabase. A usar escalões locais de fallback.');
    }
    setConfirmOpen(true);
  };

  const processar = async () => {
    setProcessing(true);
    try {
      const results: ResultadoProcessamento[] = [];

      // Executar sequencial para reduzir carga no banco e evitar corrida de inserts (lote).
      for (const id of selectedIds) {
        const col = colaboradoresActivos.find(c => c.id === id);
        if (!col) continue;

        const existing = recibos.find(r => r.colaboradorId === id && r.mesAno === mesAno);
        const calc = calcularParaColaborador(col);

        const payload: Partial<ReciboSalario> = {
          colaboradorId: col.id,
          mesAno,
          vencimentoBase: col.salarioBase,
          subsidioAlimentacao: col.subsidioAlimentacao ?? 0,
          subsidioTransporte: col.subsidioTransporte ?? 0,
          outrosSubsidios: col.outrosSubsidios ?? 0,
          inss: calc.inss,
          irt: calc.irt,
          outrasDeducoes: outrasDeducoes,
          liquido: calc.liquido,
          status: 'Emitido',
        };

        if (existing) {
          if (!overwrite) {
            results.push({
              colaboradorId: id,
              colaboradorNome: col.nome,
              acao: 'skip_existe',
              inss: calc.inss,
              irt: calc.irt,
              liquido: calc.liquido,
            });
            continue;
          }

          await updateRecibo(existing.id, payload);
          results.push({
            colaboradorId: id,
            colaboradorNome: col.nome,
            acao: 'actualizado',
            inss: calc.inss,
            irt: calc.irt,
            liquido: calc.liquido,
          });
        } else {
          await addRecibo(payload);
          results.push({
            colaboradorId: id,
            colaboradorNome: col.nome,
            acao: 'criado',
            inss: calc.inss,
            irt: calc.irt,
            liquido: calc.liquido,
          });
        }
      }

      setLastResult(results);
      setConfirmOpen(false);
      toast.success(`Processamento concluído (${results.length} registos processados).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao processar salários');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Processamento Salarial</h1>
        <div className="flex items-center gap-3">
          <Button onClick={abrirConfirmacao} className="bg-primary text-primary-foreground" disabled={processing}>
            <Calculator className="h-4 w-4 mr-2" /> {processing ? 'Processando…' : 'Processar'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Modo</Label>
          <Select value={modo} onValueChange={v => setModo(v as ModoProcessamento)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="singular">Singular</SelectItem>
              <SelectItem value="lote">Em lote</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Ano</Label>
          <Select value={ano} onValueChange={v => setAno(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[ANO_ACTUAL, ANO_ACTUAL - 1, ANO_ACTUAL - 2].map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Mês</Label>
          <Select value={mes} onValueChange={v => setMes(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem
                  key={m}
                  value={m}
                  disabled={
                    Number(ano) > ANO_ACTUAL ||
                    (Number(ano) === ANO_ACTUAL && Number(m) > MES_ACTUAL)
                  }
                >
                  {MES_LABELS[i]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {modo === 'singular' ? (
          <div className="space-y-2 lg:col-span-1">
            <Label>Colaborador</Label>
            <Popover
              open={singularOpen}
              onOpenChange={(open) => {
                setSingularOpen(open);
                if (open) setSingularSearch('');
              }}
            >
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between font-normal">
                  <span className="truncate text-left">
                    {colaboradorIdSingular ? nomeColab(colaboradorIdSingular) : 'Seleccionar colaborador…'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Pesquisar por nome…"
                    value={singularSearch}
                    onChange={e => setSingularSearch(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto p-2 space-y-1">
                  {colaboradoresSingularFiltrados.length === 0 && (
                    <p className="text-sm text-muted-foreground px-2 py-3">Nenhum colaborador encontrado.</p>
                  )}
                  {colaboradoresSingularFiltrados.map(c => {
                    const selected = colaboradorIdSingular === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setColaboradorIdSingular(c.id);
                          setSingularOpen(false);
                        }}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input',
                            selected && 'border-primary bg-primary text-primary-foreground',
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                        <span className="flex-1 truncate">{c.nome}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{formatKz(c.salarioBase)}</span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        ) : (
          <div className="space-y-2 lg:col-span-2">
            <Label>Colaboradores (lote)</Label>
            <Popover open={loteOpen} onOpenChange={setLoteOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-between font-normal">
                  <span className="truncate text-left">
                    {colaboradoresSelecionados.length === 0 ? 'Seleccionar colaboradores…' : `${colaboradoresSelecionados.length} seleccionado(s)`}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Pesquisar por nome…"
                    value={loteSearch}
                    onChange={e => setLoteSearch(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto p-2 space-y-1">
                  {colaboradoresFiltrados.length === 0 && (
                    <p className="text-sm text-muted-foreground px-2 py-3">Nenhum colaborador encontrado.</p>
                  )}
                  {colaboradoresFiltrados.map(c => {
                    const checked = colaboradoresSelecionados.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => toggleColab(c.id)}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input',
                            checked && 'border-primary bg-primary text-primary-foreground',
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <span className="flex-1 truncate">{c.nome}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{formatKz(c.salarioBase)}</span>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {colaboradoresSelecionados.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {colaboradoresSelecionados.map(id => (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1 font-normal">
                    {nomeColab(id)}
                    <button type="button" className="rounded-full p-0.5 hover:bg-muted-foreground/20" onClick={() => toggleColab(id)} aria-label={`Remover ${nomeColab(id)}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 lg:col-span-1">
          <Label className="flex items-center justify-between">
            <span>Recibos existentes</span>
          </Label>
          <div className="flex items-center gap-2 border rounded-md px-3 py-2">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={e => setOverwrite(e.target.checked)}
              id="overwrite"
            />
            <Label htmlFor="overwrite" className="cursor-pointer">
              {overwrite ? 'Substituir' : 'Manter (skip se existir)'}
            </Label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2 lg:col-span-2">
          <Label>Subsídios</Label>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            Os valores são lidos automaticamente do cadastro do colaborador (<span className="font-medium text-foreground">alimentação</span>,{' '}
            <span className="font-medium text-foreground">transporte</span> e <span className="font-medium text-foreground">outros subsídios</span>).
          </div>
        </div>
        <div className="space-y-2">
          <Label>Outras deduções</Label>
          <Input type="number" min={0} value={outrasDeducoes} onChange={e => setOutrasDeducoes(clampNumber(e.target.value))} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Período</Label>
          <div className="border rounded-md px-3 py-2 bg-muted/20 text-sm font-mono tabular-nums">
            {mesAno}
          </div>
        </div>
      </div>

      {lastResult.length > 0 && (
        <div className="space-y-3 border rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-base">Resultado do último processamento</Label>
            <Button variant="outline" size="sm" onClick={() => setLastResult([])} disabled={processing}>Limpar</Button>
          </div>
          <div className="table-container overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/80">
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Colaborador</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acção</th>
                  <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">INSS</th>
                  <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">IRT</th>
                  <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {lastResult.map(r => (
                  <tr key={r.colaboradorId} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-5 font-medium">{r.colaboradorNome}</td>
                    <td className="py-2 px-5">
                      {r.acao === 'skip_existe' ? 'Skip (já existe)' : r.acao === 'criado' ? 'Criado' : 'Atualizado'}
                    </td>
                    <td className="py-2 px-5 text-right font-mono">{formatKz(r.inss)}</td>
                    <td className="py-2 px-5 text-right font-mono">{formatKz(r.irt)}</td>
                    <td className="py-2 px-5 text-right font-mono">{formatKz(r.liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={open => setConfirmOpen(open)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirmar processamento</DialogTitle>
            <DialogDescription>
              Vai calcular e gerar recibos para <strong>{mesAno}</strong>.
              {overwrite ? ' Irá substituir recibos existentes.' : ' Se já existir recibo, será ignorado.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Colaboradores</span>
              <span className="font-medium tabular-nums">{selectedIds.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subsídios</span>
              <span className="font-medium tabular-nums">Automáticos</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Outras deduções</span>
              <span className="font-medium tabular-nums">{formatKz(outrasDeducoes)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button onClick={processar} disabled={processing}>
              {processing ? 'Processando…' : 'Confirmar e processar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

