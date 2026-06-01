import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import type { Colaborador, ReciboSalario, TipoFalta } from '@/types';
import { mapRowFromDb } from '@/lib/supabaseMappers';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  calcularInssIrtLiquidoComAssiduidade,
  DIAS_UTEIS_MES_NORMA_TRABALHO,
  IRT_ESCALOES_FALLBACK,
} from '@/lib/irtCalculo';
import { formatKz } from '@/utils/formatters';
import { formatRetencaoPercentLabel } from '@/utils/colaboradorRemuneracao';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

import { Calculator } from 'lucide-react';
import { EmployeeMultiSelect } from '@/components/shared/EmployeeMultiSelect';
import { EmployeeSelect } from '@/components/shared/EmployeeSelect';
import { MobileExpandableList } from '@/components/shared/MobileExpandableList';
import { useMobileListSort, useSortedMobileSlice } from '@/hooks/useMobileListSort';

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
  diasFaltaDesconto: number;
  diasJustificadosSoSubsidios: number;
  descontoFaltas: number;
  descontoMontanteRegraCompleta: number;
  descontoMontanteSoSubsidios: number;
  faltasContagemPorTipo: { tipo: TipoFalta; dias: number }[];
}

function clampNumber(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function descricaoRegraDescontoTipo(tipo: TipoFalta): string {
  if (tipo === 'Injustificada' || tipo === 'Por atrasos') {
    return 'Vencimento base + todos os subsídios (valor ÷ d.u. por dia)';
  }
  return 'Só subsídios: alimentação, transporte, risco e disponibilidade (valor ÷ d.u. por dia)';
}

export default function ProcessamentoSalarialPage() {
  const { user } = useAuth();
  const { currentEmpresaId } = useTenant();
  const { colaboradores, recibos, faltas, assiduidadeLicencas, addRecibo, updateRecibo, irtEscalaes } = useData();

  const empresaIdForSearch =
    currentEmpresaId === 'consolidado'
      ? typeof user?.empresaId === 'number'
        ? user.empresaId
        : null
      : currentEmpresaId;

  const selectDisabled = currentEmpresaId === 'consolidado' && typeof user?.empresaId !== 'number';

  const [modo, setModo] = useState<ModoProcessamento>('singular');
  const [ano, setAno] = useState(String(ANO_ACTUAL));
  const [mes, setMes] = useState('01');

  const mesAno = `${ano}-${mes}`;

  const [colaboradorIdSingular, setColaboradorIdSingular] = useState<number | null>(null);
  const [colaboradoresSelecionados, setColaboradoresSelecionados] = useState<number[]>([]);
  /** Colaboradores seleccionados via pesquisa e ainda não presentes na lista tenant (fetch por id). */
  const [extras, setExtras] = useState<Record<number, Colaborador | false>>({});

  const [outrasDeducoes, setOutrasDeducoes] = useState(0);

  const [overwrite, setOverwrite] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResult, setLastResult] = useState<ResultadoProcessamento[]>([]);
  const warnedIrtFallbackRef = useRef(false);

  const { sortState: mobileSort, toggleSort: toggleMobileSort } = useMobileListSort('colaboradorNome');
  const mobileComparators = useMemo(
    () => ({
      colaboradorNome: (a: ResultadoProcessamento, b: ResultadoProcessamento) =>
        a.colaboradorNome.localeCompare(b.colaboradorNome, 'pt', { sensitivity: 'base' }),
      acao: (a: ResultadoProcessamento, b: ResultadoProcessamento) => a.acao.localeCompare(b.acao),
      liquido: (a: ResultadoProcessamento, b: ResultadoProcessamento) => a.liquido - b.liquido,
    }),
    [],
  );
  const sortedMobileLastResult = useSortedMobileSlice(lastResult, mobileSort, mobileComparators);

  const activoPorId = useMemo(() => {
    const m = new Map<number, Colaborador>();
    for (const c of colaboradores) {
      if (c.status === 'Activo') m.set(c.id, c);
    }
    return m;
  }, [colaboradores]);

  useEffect(() => {
    setExtras({});
    setColaboradorIdSingular(null);
    setColaboradoresSelecionados([]);
  }, [empresaIdForSearch]);

  const selectedIds = useMemo(() => {
    return modo === 'singular' ? (colaboradorIdSingular != null ? [colaboradorIdSingular] : []) : colaboradoresSelecionados;
  }, [modo, colaboradorIdSingular, colaboradoresSelecionados]);

  const selectionKey = useMemo(() => [...selectedIds].sort((a, b) => a - b).join('|'), [selectedIds]);

  useEffect(() => {
    const ids = selectionKey ? selectionKey.split('|').map(Number) : [];
    setExtras((prev) => {
      const next: Record<number, Colaborador | false> = {};
      for (const id of ids) {
        if (Object.prototype.hasOwnProperty.call(prev, id)) next[id] = prev[id]!;
      }
      const same =
        Object.keys(next).length === Object.keys(prev).length &&
        Object.keys(next).every((k) => {
          const id = Number(k);
          return prev[id] === next[id];
        });
      return same ? prev : next;
    });
  }, [selectionKey]);

  useEffect(() => {
    const pending = selectedIds.filter((id) => !activoPorId.has(id) && extras[id] === undefined);
    if (!pending.length) return;

    if (!isSupabaseConfigured() || !supabase) {
      setExtras((prev) => {
        const nx = { ...prev };
        for (const id of pending) nx[id] = false;
        return nx;
      });
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.from('colaboradores').select('*').in('id', pending);
        if (cancelled) return;
        if (error) {
          setExtras((prev) => {
            const nx = { ...prev };
            for (const id of pending) {
              if (nx[id] === undefined) nx[id] = false;
            }
            return nx;
          });
          return;
        }
        const mapped = (data ?? []).map((row) =>
          mapRowFromDb<Colaborador>('colaboradores', row as Record<string, unknown>),
        );
        const byId = new Map(mapped.map((r) => [r.id, r]));
        setExtras((prev) => {
          const nx = { ...prev };
          for (const id of pending) {
            const row = byId.get(id);
            if (row && row.status === 'Activo') nx[id] = row;
            else nx[id] = false;
          }
          return nx;
        });
      } catch {
        if (!cancelled) {
          setExtras((prev) => {
            const nx = { ...prev };
            for (const id of pending) {
              if (nx[id] === undefined) nx[id] = false;
            }
            return nx;
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedIds, activoPorId, extras]);

  const getColaboradorActivo = useCallback(
    (id: number): Colaborador | null => {
      const fromTenant = activoPorId.get(id);
      if (fromTenant) return fromTenant;
      const ex = extras[id];
      return ex && ex !== false ? ex : null;
    },
    [activoPorId, extras],
  );

  const extrasLoading = useMemo(
    () => selectedIds.some((id) => !activoPorId.has(id) && extras[id] === undefined),
    [selectedIds, activoPorId, extras],
  );

  const nomeColabResolvido = useCallback((id: number) => getColaboradorActivo(id)?.nome ?? `#${id}`, [getColaboradorActivo]);

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
    if (empresaIdForSearch == null) {
      toast.error(
        'Para pesquisar e processar, seleccione uma empresa no cabeçalho (visão grupo) ou utilize uma conta com empresa definida.',
      );
      return false;
    }
    if (extrasLoading || selectedIds.some((id) => !getColaboradorActivo(id))) {
      toast.error(
        extrasLoading
          ? 'Ainda a carregar dados dos colaboradores. Aguarde um momento e tente de novo.'
          : 'Um ou mais colaboradores seleccionados não estão disponíveis ou estão inactivos.',
      );
      return false;
    }
    return true;
  };

  const calcularParaColaborador = (col: Colaborador) => {
    return calcularInssIrtLiquidoComAssiduidade(col, mesAno, faltas, assiduidadeLicencas, irtEscalaesEfetivos, {
      outrasDeducoes,
    });
  };

  const previewSingular = useMemo(() => {
    if (modo !== 'singular' || colaboradorIdSingular == null) return null;
    const col = getColaboradorActivo(colaboradorIdSingular);
    if (!col) return null;
    return calcularParaColaborador(col);
  }, [
    modo,
    colaboradorIdSingular,
    getColaboradorActivo,
    mesAno,
    faltas,
    assiduidadeLicencas,
    irtEscalaesEfetivos,
    outrasDeducoes,
  ]);

  const previewAvencado = useMemo(() => {
    if (modo !== 'singular' || colaboradorIdSingular == null) return false;
    return getColaboradorActivo(colaboradorIdSingular)?.isAvencado === true;
  }, [modo, colaboradorIdSingular, getColaboradorActivo]);

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
        const col = getColaboradorActivo(id);
        if (!col) continue;

        const existing = recibos.find(r => r.colaboradorId === id && r.mesAno === mesAno);
        const calc = calcularParaColaborador(col);
        const ass = calc.detalheAssiduidade;
        const mat = ass.modo === 'licenca_maternidade';

        const avencado = col.isAvencado === true;
        const payload: Partial<ReciboSalario> = {
          colaboradorId: col.id,
          mesAno,
          vencimentoBase: avencado ? col.salarioBase : col.salarioBase,
          subsidioAlimentacao: avencado || mat ? 0 : col.subsidioAlimentacao ?? 0,
          subsidioTransporte: avencado || mat ? 0 : col.subsidioTransporte ?? 0,
          outrosSubsidios: avencado || mat ? 0 : col.outrosSubsidios ?? 0,
          descontoFaltas: avencado ? 0 : calc.descontoFaltas,
          diasFaltaDesconto: avencado ? 0 : calc.diasFaltaDesconto,
          inss: avencado ? 0 : calc.inss,
          irt: avencado ? 0 : calc.irt,
          retencao: avencado ? (calc.retencao ?? 0) : 0,
          outrasDeducoes: avencado ? 0 : outrasDeducoes,
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
              diasFaltaDesconto: calc.diasFaltaDesconto,
              diasJustificadosSoSubsidios: ass.diasJustificadosSoSubsidios,
              descontoFaltas: calc.descontoFaltas,
              descontoMontanteRegraCompleta: ass.descontoMontanteRegraCompleta,
              descontoMontanteSoSubsidios: ass.descontoMontanteSoSubsidios,
              faltasContagemPorTipo: ass.faltasContagemPorTipo,
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
            diasFaltaDesconto: calc.diasFaltaDesconto,
            diasJustificadosSoSubsidios: ass.diasJustificadosSoSubsidios,
            descontoFaltas: calc.descontoFaltas,
            descontoMontanteRegraCompleta: ass.descontoMontanteRegraCompleta,
            descontoMontanteSoSubsidios: ass.descontoMontanteSoSubsidios,
            faltasContagemPorTipo: ass.faltasContagemPorTipo,
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
            diasFaltaDesconto: calc.diasFaltaDesconto,
            diasJustificadosSoSubsidios: ass.diasJustificadosSoSubsidios,
            descontoFaltas: calc.descontoFaltas,
            descontoMontanteRegraCompleta: ass.descontoMontanteRegraCompleta,
            descontoMontanteSoSubsidios: ass.descontoMontanteSoSubsidios,
            faltasContagemPorTipo: ass.faltasContagemPorTipo,
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

      {/* <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-2 max-w-4xl">
        <p className="font-medium text-foreground">Assiduidade e descontos (bruto, antes de impostos)</p>
        <p>
          Usa-se <strong>{DIAS_UTEIS_MES_NORMA_TRABALHO} dias úteis</strong> como divisor. Faltas{' '}
          <strong>justificadas</strong> (e similares) descontam apenas subsídios de alimentação, transporte, risco e disponibilidade; faltas{' '}
          <strong>injustificadas</strong> ou <strong>Por atrasos</strong> descontam também o salário base e o montante «outros subsídios» do
          colaborador. Licença de <strong>maternidade</strong> (registo em Assiduidade) zera subsídios no recibo, mantém o salário base e ignora
          faltas nesse mês para o cálculo. O INSS e o IRT aplicam-se ao bruto já ajustado.
        </p>
      </div> */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {modo === 'singular' ? (
          <div className="space-y-2 lg:col-span-1">
            <Label>Colaborador</Label>
            <EmployeeSelect
              valueId={colaboradorIdSingular}
              onChange={(nextId) => setColaboradorIdSingular(nextId)}
              empresaId={empresaIdForSearch}
              disabled={selectDisabled}
              placeholder={selectDisabled ? 'Seleccione uma empresa específica…' : 'Pesquisar colaborador (mín. 4 letras)…'}
            />
            {selectDisabled ? (
              <p className="text-xs text-muted-foreground">
                Em modo grupo, escolha uma empresa no selector do cabeçalho ou utilize uma conta com empresa definida.
              </p>
            ) : null}
            {colaboradorIdSingular != null &&
            !activoPorId.has(colaboradorIdSingular) &&
            extras[colaboradorIdSingular] === undefined ? (
              <p className="text-xs text-muted-foreground">A carregar dados do colaborador…</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 lg:col-span-2">
            <Label>Colaboradores (lote)</Label>
            <EmployeeMultiSelect
              valueIds={colaboradoresSelecionados}
              empresaId={empresaIdForSearch}
              disabled={selectDisabled}
              onChange={(next) => setColaboradoresSelecionados(next)}
              placeholder={
                selectDisabled
                  ? 'Seleccione uma empresa específica…'
                  : colaboradoresSelecionados.length === 0
                    ? 'Seleccionar colaboradores…'
                    : `${colaboradoresSelecionados.length} seleccionado(s)`
              }
            />
            {selectDisabled ? (
              <p className="text-xs text-muted-foreground">
                Em modo grupo, escolha uma empresa no selector do cabeçalho ou utilize uma conta com empresa definida.
              </p>
            ) : null}
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

      {modo === 'singular' && previewSingular != null && colaboradorIdSingular != null ? (
        <div className="space-y-4 border rounded-lg bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Resumo individual</h2>
              <p className="text-sm text-muted-foreground">
                Pré-visualização com o período <span className="font-mono tabular-nums">{mesAno}</span>, assiduidade actual e
                «outras deduções» — referência visual tipo processamento individual (ex.: Primavera).
              </p>
            </div>
            <Badge variant="outline" className="w-fit shrink-0 font-mono tabular-nums">
              {nomeColabResolvido(colaboradorIdSingular)}
            </Badge>
          </div>

          {previewAvencado ? (
            <p className="text-sm text-muted-foreground rounded-md border border-dashed bg-muted/20 px-3 py-2">
              Colaborador avençado: vencimento igual ao salário líquido cadastrado (
              {formatKz(previewSingular.salarioBruto)}). Retenção{' '}
              {formatRetencaoPercentLabel(previewSingular.retencaoPercent ?? 6.5)}:{' '}
              <span className="font-mono font-medium text-foreground">
                {formatKz(previewSingular.retencao ?? 0)}
              </span>
              . O colaborador recebe o líquido integral; sem INSS nem IRT.
            </p>
          ) : null}

          {!previewAvencado &&
          (() => {
            const d = previewSingular.detalheAssiduidade;
            if (d.modo === 'licenca_maternidade') {
              return (
                <p className="text-sm text-muted-foreground rounded-md border border-dashed bg-muted/20 px-3 py-2">
                  Licença de maternidade activa no mês: as faltas do período não entram no cálculo; subsídios não são pagos no bruto.
                </p>
              );
            }
            const temLinhas = d.faltasContagemPorTipo.length > 0;
            return (
              <div className="rounded-md border">
                <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                  Faltas consideradas ({previewSingular.resumoIndividual.periodoLabel})
                </div>
                {!temLinhas ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    Sem registos de falta neste mês para este colaborador. O divisor de assiduidade continua a ser{' '}
                    <span className="font-mono">{DIAS_UTEIS_MES_NORMA_TRABALHO}</span> dias úteis quando existirem faltas.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wide">
                          <th className="py-2 px-3">Tipo</th>
                          <th className="py-2 px-3 text-right w-20">Dias</th>
                          <th className="py-2 px-3">Regra no vencimento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.faltasContagemPorTipo.map(row => (
                          <tr key={row.tipo} className="border-b border-border/60 last:border-0">
                            <td className="py-2 px-3 font-medium">{row.tipo}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">{row.dias}</td>
                            <td className="py-2 px-3 text-muted-foreground">{descricaoRegraDescontoTipo(row.tipo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(previewSingular.descontoFaltas > 0 ||
                  d.descontoMontanteRegraCompleta > 0 ||
                  d.descontoMontanteSoSubsidios > 0) && (
                  <div className="border-t bg-muted/15 px-3 py-3 text-sm space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Desconto no <span className="font-medium text-foreground">bruto</span> (antes de INSS/IRT), repartido por regra de
                      assiduidade:
                    </p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      <div className="flex flex-col gap-0.5 rounded border bg-background/80 px-3 py-2">
                        <span className="text-xs text-muted-foreground">Injustificada / «Por atrasos»</span>
                        <span className="font-mono tabular-nums text-base font-medium">
                          {formatKz(d.descontoMontanteRegraCompleta)}
                        </span>
                        <span className="text-xs text-muted-foreground">{d.diasInjustificados} dia(s)</span>
                      </div>
                      <div className="flex flex-col gap-0.5 rounded border bg-background/80 px-3 py-2">
                        <span className="text-xs text-muted-foreground">Justificada / atestado / licença (em falta)</span>
                        <span className="font-mono tabular-nums text-base font-medium">
                          {formatKz(d.descontoMontanteSoSubsidios)}
                        </span>
                        <span className="text-xs text-muted-foreground">{d.diasJustificadosSoSubsidios} dia(s)</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2 text-sm font-medium">
                      <span>Total desconto assiduidade no bruto</span>
                      <span className="font-mono tabular-nums">{formatKz(previewSingular.descontoFaltas)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
              <div className="rounded-md border">
                <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Remunerações</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="py-2 px-3 w-14">Cód.</th>
                        <th className="py-2 px-3">Descrição</th>
                        <th className="py-2 px-3 w-24">Período</th>
                        <th className="py-2 px-3 text-right w-24">Qtd.</th>
                        <th className="py-2 px-3 text-right w-28">Valor unit.</th>
                        <th className="py-2 px-3 text-right w-32">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const r = previewSingular.resumoIndividual;
                        const c = r.componentes;
                        const per = r.periodoLabel;
                        const d = r.diasUteisReferencia;
                        const rows: { cod: string; desc: string; qtd: string; unit: string; total: number }[] =
                          previewAvencado
                            ? [
                                {
                                  cod: 'R01',
                                  desc: 'Vencimento',
                                  qtd: '1',
                                  unit: formatKz(c.salarioBaseEfetivo),
                                  total: c.salarioBaseEfetivo,
                                },
                              ]
                            : [
                                {
                                  cod: 'R01',
                                  desc: 'Vencimento base',
                                  qtd: '1',
                                  unit: formatKz(c.salarioBaseEfetivo),
                                  total: c.salarioBaseEfetivo,
                                },
                                {
                                  cod: 'R11',
                                  desc: 'Subsídio de alimentação',
                                  qtd: String(d),
                                  unit: formatKz(d > 0 ? c.subsidioAlimentacaoNominal / d : 0),
                                  total: c.subsidioAlimentacaoEfetivo,
                                },
                                {
                                  cod: 'R12',
                                  desc: 'Subsídio de transporte',
                                  qtd: String(d),
                                  unit: formatKz(d > 0 ? c.subsidioTransporteNominal / d : 0),
                                  total: c.subsidioTransporteEfetivo,
                                },
                                {
                                  cod: 'R13',
                                  desc: 'Outros subsídios (incl. risco e disponibilidade)',
                                  qtd: String(d),
                                  unit: formatKz(d > 0 ? c.outrosSubsidiosAgregadoNominal / d : 0),
                                  total: c.outrosSubsidiosEfetivo,
                                },
                              ];
                        return rows.map(row => (
                          <tr key={row.cod} className="border-b border-border/60 last:border-0">
                            <td className="py-2 px-3 font-mono text-muted-foreground">{row.cod}</td>
                            <td className="py-2 px-3">{row.desc}</td>
                            <td className="py-2 px-3 font-mono tabular-nums text-muted-foreground">{per}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">{row.qtd}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">{row.unit}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">{formatKz(row.total)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-medium">
                        <td colSpan={5} className="py-2 px-3 text-right">
                          Total abonos (bruto)
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{formatKz(previewSingular.salarioBruto)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {previewSingular.detalheAssiduidade.modo === 'licenca_maternidade' ? (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    Licença de maternidade no mês: subsídios não entram no bruto; INSS sobre o vencimento base.
                  </p>
                ) : previewSingular.descontoFaltas > 0 ? (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    O detalhe por tipo de falta e o reparto do desconto (injustificada vs. justificada) estão na secção{' '}
                    <span className="font-medium text-foreground">Faltas consideradas</span> acima. Total no bruto:{' '}
                    <span className="font-mono font-medium text-foreground">{formatKz(previewSingular.descontoFaltas)}</span>.
                  </p>
                ) : null}
              </div>

              <div className="rounded-md border">
                <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Descontos</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="py-2 px-3 w-14">Cód.</th>
                        <th className="py-2 px-3">Descrição</th>
                        <th className="py-2 px-3 w-24">Período</th>
                        <th className="py-2 px-3 text-right w-24">Qtd.</th>
                        <th className="py-2 px-3 text-right w-28">%</th>
                        <th className="py-2 px-3 text-right w-32">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewAvencado ? (
                        <tr className="border-b border-border/60">
                          <td className="py-2 px-3 font-mono text-muted-foreground">D01</td>
                          <td className="py-2 px-3">
                            Retenção ({formatRetencaoPercentLabel(previewSingular.retencaoPercent ?? 6.5)})
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums text-muted-foreground">
                            {previewSingular.resumoIndividual.periodoLabel}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">—</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {formatRetencaoPercentLabel(previewSingular.retencaoPercent ?? 6.5)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {formatKz(previewSingular.retencao ?? 0)}
                          </td>
                        </tr>
                      ) : (
                        <>
                          <tr className="border-b border-border/60">
                            <td className="py-2 px-3 font-mono text-muted-foreground">D01</td>
                            <td className="py-2 px-3">Segurança social (INSS)</td>
                            <td className="py-2 px-3 font-mono tabular-nums text-muted-foreground">
                              {previewSingular.resumoIndividual.periodoLabel}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">—</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">3%</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">{formatKz(previewSingular.inss)}</td>
                          </tr>
                          <tr className="border-b border-border/60">
                            <td className="py-2 px-3 font-mono text-muted-foreground">D02</td>
                            <td className="py-2 px-3">IRT (sobre matéria colectável)</td>
                            <td className="py-2 px-3 font-mono tabular-nums text-muted-foreground">
                              {previewSingular.resumoIndividual.periodoLabel}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">—</td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">—</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">{formatKz(previewSingular.irt)}</td>
                          </tr>
                          {outrasDeducoes > 0 ? (
                            <tr className="border-b border-border/60">
                              <td className="py-2 px-3 font-mono text-muted-foreground">D03</td>
                              <td className="py-2 px-3">Outras deduções (manual)</td>
                              <td className="py-2 px-3 font-mono tabular-nums text-muted-foreground">
                                {previewSingular.resumoIndividual.periodoLabel}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-muted-foreground">—</td>
                              <td className="py-2 px-3 text-right font-mono text-muted-foreground">—</td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums">{formatKz(outrasDeducoes)}</td>
                            </tr>
                          ) : null}
                        </>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-medium">
                        <td colSpan={5} className="py-2 px-3 text-right">
                          Total descontos
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {formatKz(
                            previewAvencado
                              ? previewSingular.retencao ?? 0
                              : previewSingular.inss + previewSingular.irt + outrasDeducoes,
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {previewAvencado ? (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    Retenção informativa no recibo; o total líquido pago ao colaborador não subtrai este valor.
                  </p>
                ) : (
                <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                  Matéria colectável (referência IRT):{' '}
                  <span className="font-mono text-foreground">{formatKz(previewSingular.resumoIndividual.materiaColetavel)}</span>
                  {previewSingular.escalonIrt ? (
                    <>
                      {' '}
                      · escalão: ordem <span className="font-mono">{previewSingular.escalonIrt.ordem}</span>
                    </>
                  ) : null}
                </p>
                )}
              </div>
            </div>

            <Card className="xl:col-span-4 h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Totais</CardTitle>
                <CardDescription>Valores finais do cálculo actual.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-muted-foreground">Salário hora (aprox.)</span>
                  <span className="font-mono tabular-nums font-medium">{formatKz(previewSingular.resumoIndividual.salarioHoraAprox)}</span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-muted-foreground">Total abonos (bruto)</span>
                  <span className="font-mono tabular-nums font-medium">{formatKz(previewSingular.salarioBruto)}</span>
                </div>
                <div className="flex justify-between gap-4 border-b pb-2">
                  <span className="text-muted-foreground">Total descontos</span>
                  <span className="font-mono tabular-nums font-medium">
                    {formatKz(
                      previewAvencado
                        ? previewSingular.retencao ?? 0
                        : previewSingular.inss + previewSingular.irt + outrasDeducoes,
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-4 pt-1 text-base">
                  <span className="font-semibold">Total líquido</span>
                  <span className="font-mono tabular-nums font-bold">{formatKz(previewSingular.liquido)}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Salário hora ≈ vencimento base efectivo ÷ ({DIAS_UTEIS_MES_NORMA_TRABALHO} × 8 h).
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 hidden">
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
          <div className="hidden md:block table-container overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/80">
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Colaborador</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acção</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[140px]">
                    Faltas (tipo × dias)
                  </th>
                  <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Dias inj./atr.</th>
                  <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Dias just./out.</th>
                  <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Desc. inj./atr.</th>
                  <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Desc. just./out.</th>
                  <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Desc. assid. Σ</th>
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
                    <td className="py-2 px-5 text-xs text-muted-foreground leading-snug">
                      {r.faltasContagemPorTipo.length === 0
                        ? '—'
                        : r.faltasContagemPorTipo.map(x => `${x.tipo}×${x.dias}`).join(' · ')}
                    </td>
                    <td className="py-2 px-5 text-right font-mono tabular-nums">{r.diasFaltaDesconto}</td>
                    <td className="py-2 px-5 text-right font-mono tabular-nums">{r.diasJustificadosSoSubsidios}</td>
                    <td className="py-2 px-5 text-right font-mono tabular-nums">{formatKz(r.descontoMontanteRegraCompleta)}</td>
                    <td className="py-2 px-5 text-right font-mono tabular-nums">{formatKz(r.descontoMontanteSoSubsidios)}</td>
                    <td className="py-2 px-5 text-right font-mono tabular-nums">{formatKz(r.descontoFaltas)}</td>
                    <td className="py-2 px-5 text-right font-mono">{formatKz(r.inss)}</td>
                    <td className="py-2 px-5 text-right font-mono">{formatKz(r.irt)}</td>
                    <td className="py-2 px-5 text-right font-mono">{formatKz(r.liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden">
            <MobileExpandableList
              items={sortedMobileLastResult}
              rowId={r => r.colaboradorId}
              sortBar={{
                options: [
                  { key: 'colaboradorNome', label: 'Colaborador' },
                  { key: 'acao', label: 'Acção' },
                  { key: 'liquido', label: 'Líquido' },
                ],
                state: mobileSort,
                onToggle: toggleMobileSort,
              }}
              renderSummary={r => ({
                title: r.colaboradorNome,
                trailing: <span className="text-xs font-mono text-muted-foreground">{formatKz(r.liquido)}</span>,
              })}
              renderDetails={r => [
                {
                  label: 'Acção',
                  value: r.acao === 'skip_existe' ? 'Skip (já existe)' : r.acao === 'criado' ? 'Criado' : 'Atualizado',
                },
                {
                  label: 'Faltas (tipo×dias)',
                  value:
                    r.faltasContagemPorTipo.length === 0
                      ? '—'
                      : r.faltasContagemPorTipo.map(x => `${x.tipo}×${x.dias}`).join('; '),
                },
                { label: 'Dias inj./atrasos', value: String(r.diasFaltaDesconto) },
                { label: 'Dias just./out.', value: String(r.diasJustificadosSoSubsidios) },
                { label: 'Desc. inj./atr.', value: formatKz(r.descontoMontanteRegraCompleta) },
                { label: 'Desc. just./out.', value: formatKz(r.descontoMontanteSoSubsidios) },
                { label: 'Desc. assiduidade Σ', value: formatKz(r.descontoFaltas) },
                { label: 'INSS', value: formatKz(r.inss) },
                { label: 'IRT', value: formatKz(r.irt) },
                { label: 'Líquido', value: formatKz(r.liquido) },
              ]}
            />
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
            <p className="text-xs text-muted-foreground border-t pt-2 mt-1">
              Regras de assiduidade (faltas + licença de maternidade) aplicam-se automaticamente antes de INSS e IRT (divisor {DIAS_UTEIS_MES_NORMA_TRABALHO}{' '}
              d.u.).
            </p>
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

