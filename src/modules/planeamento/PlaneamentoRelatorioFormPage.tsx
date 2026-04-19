import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import type {
  RelatorioMensalPlaneamento,
  LinhaPlaneamento,
  LinhaGestaoStockMateriaPrima,
  GastosPessoalItem,
  SaldoBancario,
  PendenteValor,
  CicloVidaEmpresa,
} from '@/types';
import { formatKz } from '@/utils/formatters';
import {
  calcularEbitda,
  calcularMargemBruta,
  calcularMargemEbitda,
  calcularResultadoLiquido,
  actualizarTotaisLinhas,
} from '@/utils/planeamentoCalculos';
import { Input } from '@/components/ui/input';
import { MonetaryInput } from '@/components/ui/monetary-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { deserializePlaneamentoTextList } from '@/utils/planeamentoTextLists';
import { emptyGestaoStockMateriaRow, legacyMateriasStockFromUnified, unifiedMateriasStockFromLegacy } from '@/utils/planeamentoStocks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

const CICLO_VIDA_OPTIONS: CicloVidaEmpresa[] = ['Startup', 'Crescimento', 'Maturidade', 'Declínio', 'Encerramento'];

const GASTOS_PESSOAL_TIPOS: { value: GastosPessoalItem['tipo']; label: string }[] = [
  { value: 'salarios_base', label: 'Salários base' },
  { value: 'subsidios', label: 'Subsídios' },
  { value: 'inss', label: 'INSS' },
  { value: 'irt', label: 'IRT' },
];

function emptyLinha(): LinhaPlaneamento {
  return { descricao: '', quantidade: 0, precoUnitario: 0, total: 0 };
}

function emptyGastosItem(tipo: GastosPessoalItem['tipo']): GastosPessoalItem {
  return { tipo, descricao: '', quantidade: 0, precoUnitario: 0, total: 0 };
}

function normalizeRelatorioListFields<T extends RelatorioMensalPlaneamento | (Omit<RelatorioMensalPlaneamento, 'id'> & { id?: number })>(
  r: T,
): T {
  return {
    ...r,
    actividadesComerciais: deserializePlaneamentoTextList(r.actividadesComerciais as unknown),
    principaisConstrangimentos: deserializePlaneamentoTextList(r.principaisConstrangimentos as unknown),
    estrategiasReceitas: deserializePlaneamentoTextList(r.estrategiasReceitas as unknown),
    estrategiasCustos: deserializePlaneamentoTextList(r.estrategiasCustos as unknown),
  };
}

function emptyRelatorio(empresaId: number, mesAno: string): Omit<RelatorioMensalPlaneamento, 'id'> {
  return {
    empresaId,
    mesAno,
    status: 'Rascunho',
    actividadesComerciais: [],
    principaisConstrangimentos: [],
    estrategiasReceitas: [],
    estrategiasCustos: [],
    cicloVida: 'Maturidade',
    necessidadesInvestimento: [],
    stockInicial: [],
    comprasPeriodo: [],
    stockFinal: [],
    vendasProdutos: [],
    vendasServicos: [],
    custoMercadoriasVendidas: [],
    fornecimentoServicosExternos: [],
    gastosPessoal: GASTOS_PESSOAL_TIPOS.map(t => emptyGastosItem(t.value)),
    saldosBancarios: [],
    pendentesPagamento: [],
    pendentesRecebimento: [],
    jurosFinanceiros: 0,
    depreciacaoAmortizacoes: 0,
    impostosLucro: 0,
  };
}

function LinhasTable({
  linhas,
  onChange,
  readOnly,
  columnsLabel = ['Descrição', 'Quantidade', 'Preço unitário', 'Total'],
}: {
  linhas: LinhaPlaneamento[];
  onChange: (l: LinhaPlaneamento[]) => void;
  readOnly?: boolean;
  columnsLabel?: [string, string, string, string];
}) {
  const update = (i: number, f: Partial<LinhaPlaneamento>) => {
    const next = linhas.map((l, idx) => idx === i ? actualizarTotaisLinhas([{ ...l, ...f }])[0] : l);
    onChange(next);
  };
  const add = () => onChange([...linhas, emptyLinha()]);
  const remove = (i: number) => onChange(linhas.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <table className="w-full text-sm border border-border/80 rounded-md">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left p-2">{columnsLabel[0]}</th>
            <th className="text-right p-2 w-24">{columnsLabel[1]}</th>
            <th className="text-right p-2 w-32">{columnsLabel[2]} (Kz)</th>
            <th className="text-right p-2 w-36">{columnsLabel[3]}</th>
            {!readOnly && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-t border-border/50">
              <td className="p-2">
                <Input className="h-8" value={l.descricao} onChange={e => update(i, { descricao: e.target.value })} disabled={readOnly} placeholder="Descrição" />
              </td>
              <td className="p-2">
                <Input type="number" className="h-8 text-right" value={l.quantidade || ''} onChange={e => update(i, { quantidade: Number(e.target.value) || 0 })} disabled={readOnly} />
              </td>
              <td className="p-2">
                <MonetaryInput
                  className="h-8 text-right tabular-nums"
                  value={l.precoUnitario}
                  onChange={n => update(i, { precoUnitario: n })}
                  disabled={readOnly}
                />
              </td>
              <td className="p-2 text-right font-mono text-muted-foreground tabular-nums text-xs sm:text-sm">
                {formatKz(l.quantidade * l.precoUnitario)}
              </td>
              {!readOnly && (
                <td className="p-2">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && <Button type="button" variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4 mr-1" /> Adicionar linha</Button>}
    </div>
  );
}

function MateriasPrimasStockTable({
  stockInicial,
  stockFinal,
  onApplyUnified,
  readOnly,
}: {
  stockInicial: LinhaPlaneamento[];
  stockFinal: LinhaPlaneamento[];
  onApplyUnified: (rows: LinhaGestaoStockMateriaPrima[]) => void;
  readOnly?: boolean;
}) {
  const rows = unifiedMateriasStockFromLegacy(stockInicial, stockFinal);

  const patchRow = (i: number, p: Partial<LinhaGestaoStockMateriaPrima>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...p } : r));
    onApplyUnified(next);
  };

  const add = () => onApplyUnified([...rows, emptyGestaoStockMateriaRow()]);
  const removeAt = (i: number) => onApplyUnified(rows.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Uma linha por matéria-prima: descrição única para stock inicial e stock final (quantidades e preços
        podem diferir entre início e fim do período).
      </p>
      <div className="overflow-x-auto rounded-md border border-border/80">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: readOnly ? '34%' : '22%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            {!readOnly && <col style={{ width: '12%' }} />}
          </colgroup>
          <thead>
            <tr className="bg-muted/50 border-b border-border/80">
              <th className="px-3 py-2 text-left align-bottom font-medium" rowSpan={2}>
                Matéria-prima
              </th>
              <th className="px-2 py-2 text-center font-medium" colSpan={3}>
                Stock inicial
              </th>
              <th className="px-2 py-2 text-center font-medium" colSpan={3}>
                Stock final
              </th>
              {!readOnly && (
                <th className="px-1 py-2 text-center align-bottom" rowSpan={2} aria-label="Remover" />
              )}
            </tr>
            <tr className="border-b border-border/80 bg-muted/40 text-xs font-normal text-muted-foreground">
              <th className="px-2 py-2 text-right">Qtd</th>
              <th className="px-2 py-2 text-right">P. unit. (Kz)</th>
              <th className="px-2 py-2 text-right">Total (Kz)</th>
              <th className="px-2 py-2 text-right">Qtd</th>
              <th className="px-2 py-2 text-right">P. unit. (Kz)</th>
              <th className="px-2 py-2 text-right">Total (Kz)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/50 align-middle">
                <td className="px-3 py-2">
                  <Input
                    className="h-8 w-full min-w-0"
                    value={r.descricao}
                    onChange={e => patchRow(i, { descricao: e.target.value })}
                    disabled={readOnly}
                    placeholder="Descrição"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    className="h-8 w-full min-w-0 text-right tabular-nums"
                    value={r.qtdStockInicial || ''}
                    onChange={e => patchRow(i, { qtdStockInicial: Number(e.target.value) || 0 })}
                    disabled={readOnly}
                  />
                </td>
                <td className="px-2 py-2">
                  <MonetaryInput
                    className="h-8 w-full min-w-0 text-right tabular-nums"
                    value={r.precoUnitInicial}
                    onChange={n => patchRow(i, { precoUnitInicial: n })}
                    disabled={readOnly}
                  />
                </td>
                <td className="px-2 py-2 text-right font-mono text-muted-foreground tabular-nums text-xs">
                  {formatKz(r.qtdStockInicial * r.precoUnitInicial)}
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    className="h-8 w-full min-w-0 text-right tabular-nums"
                    value={r.qtdStockFinal || ''}
                    onChange={e => patchRow(i, { qtdStockFinal: Number(e.target.value) || 0 })}
                    disabled={readOnly}
                  />
                </td>
                <td className="px-2 py-2">
                  <MonetaryInput
                    className="h-8 w-full min-w-0 text-right tabular-nums"
                    value={r.precoUnitFinal}
                    onChange={n => patchRow(i, { precoUnitFinal: n })}
                    disabled={readOnly}
                  />
                </td>
                <td className="px-2 py-2 text-right font-mono text-muted-foreground tabular-nums text-xs">
                  {formatKz(r.qtdStockFinal * r.precoUnitFinal)}
                </td>
                {!readOnly && (
                  <td className="px-1 py-2 text-center align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeAt(i)}
                      aria-label="Remover linha"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar matéria-prima
        </Button>
      )}
    </div>
  );
}

function DynamicStringListField({
  label,
  items,
  onChange,
  readOnly,
  addLabel,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
  addLabel?: string;
}) {
  const updateAt = (i: number, value: string) => {
    const next = [...items];
    next[i] = value;
    onChange(next);
  };
  const removeAt = (i: number) => onChange(items.filter((_, j) => j !== i));
  const add = () => onChange([...items, '']);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {items.length === 0 && readOnly && <p className="text-sm text-muted-foreground">—</p>}
        {items.map((val, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              className="h-9 flex-1"
              value={val}
              onChange={e => updateAt(i, e.target.value)}
              disabled={readOnly}
              placeholder={`Ponto ${i + 1}`}
            />
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive"
                onClick={() => removeAt(i)}
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" />
          {addLabel ?? 'Adicionar'}
        </Button>
      )}
    </div>
  );
}

export default function PlaneamentoRelatorioFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { relatoriosPlaneamento, addRelatorioPlaneamento, updateRelatorioPlaneamento, empresas } = useData();

  const location = useLocation();
  const isNew = !id || id === 'novo';
  const editMode = isNew || location.pathname.endsWith('/editar');
  const directorEmpresaId = user?.perfil === 'Director' && user?.empresaId != null ? user.empresaId : null;
  const empresaIdFromQuery = Number(searchParams.get('empresaId'));
  const empresaIdParam =
    directorEmpresaId != null
      ? directorEmpresaId
      : (Number.isFinite(empresaIdFromQuery) && empresaIdFromQuery > 0
          ? empresaIdFromQuery
          : empresas.find(e => e.activo)?.id ?? 1);
  const mesAnoParam = searchParams.get('mesAno') || new Date().toISOString().slice(0, 7);

  const existing = id && id !== 'novo' ? relatoriosPlaneamento.find(r => r.id === Number(id)) : null;
  const rawInitial: RelatorioMensalPlaneamento | (Omit<RelatorioMensalPlaneamento, 'id'> & { id?: number }) | null =
    existing ? { ...existing } :
    isNew ? { ...emptyRelatorio(empresaIdParam, mesAnoParam), id: undefined } :
    null;
  const initialForm = rawInitial ? normalizeRelatorioListFields(rawInitial) : null;

  const [form, setForm] = useState<RelatorioMensalPlaneamento | (Omit<RelatorioMensalPlaneamento, 'id'> & { id?: number }) | null>(initialForm);

  useEffect(() => {
    if (!isNew) return;
    const dup = relatoriosPlaneamento.find(
      r => r.empresaId === empresaIdParam && r.mesAno === mesAnoParam,
    );
    if (!dup) return;
    if (dup.status === 'Rascunho') {
      navigate(`/planeamento/relatorios/${dup.id}/editar`, { replace: true });
      return;
    }
    toast.error('Já existe relatório para este mês. Não é possível criar outro após a submissão.');
    navigate('/planeamento/relatorios', { replace: true });
  }, [isNew, empresaIdParam, mesAnoParam, relatoriosPlaneamento, navigate]);

  useEffect(() => {
    if (!existing || directorEmpresaId == null) return;
    if (existing.empresaId !== directorEmpresaId) {
      toast.error('Sem permissão para aceder a este relatório.');
      navigate('/planeamento/relatorios', { replace: true });
    }
  }, [existing, directorEmpresaId, navigate]);

  if (form == null) return <div className="p-6">A carregar...</div>;

  const vendasTotal = form.vendasProdutos.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0) + form.vendasServicos.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0);
  const ebitda = calcularEbitda(form as RelatorioMensalPlaneamento);
  const margemBruta = vendasTotal > 0 ? (vendasTotal - form.custoMercadoriasVendidas.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0)) / vendasTotal : 0;
  const margemEbitda = vendasTotal > 0 ? ebitda / vendasTotal : 0;
  const resultadoLiquido = calcularResultadoLiquido(form as RelatorioMensalPlaneamento);
  const margemLiquida = vendasTotal > 0 ? resultadoLiquido / vendasTotal : 0;

  const encargosPosEbitda = (
    <div className="space-y-3 border-t border-border/80 pt-4">
      <div>
        <p className="text-sm font-medium">Encargos complementares (referência)</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Juros, depreciação e amortizações, e impostos sobre o lucro (ex.: IRC). Não entram no resultado líquido calculado acima
          (volume − CMV − pessoal com INSS e IRT − serviços externos).
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Juros financeiros (Kz)</Label>
          {editMode ? (
            <MonetaryInput
              className="h-9 text-right tabular-nums"
              value={form.jurosFinanceiros ?? 0}
              onChange={n => setForm(f => (f ? { ...f, jurosFinanceiros: n } : f))}
            />
          ) : (
            <p className="text-sm font-mono tabular-nums">{formatKz(form.jurosFinanceiros ?? 0)}</p>
          )}
        </div>
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Depreciação e amortizações (Kz)</Label>
          {editMode ? (
            <MonetaryInput
              className="h-9 text-right tabular-nums"
              value={form.depreciacaoAmortizacoes ?? 0}
              onChange={n => setForm(f => (f ? { ...f, depreciacaoAmortizacoes: n } : f))}
            />
          ) : (
            <p className="text-sm font-mono tabular-nums">{formatKz(form.depreciacaoAmortizacoes ?? 0)}</p>
          )}
        </div>
        <div>
          <Label className="mb-2 block text-xs text-muted-foreground">Impostos sobre o lucro (Kz)</Label>
          {editMode ? (
            <MonetaryInput
              className="h-9 text-right tabular-nums"
              value={form.impostosLucro ?? 0}
              onChange={n => setForm(f => (f ? { ...f, impostosLucro: n } : f))}
            />
          ) : (
            <p className="text-sm font-mono tabular-nums">{formatKz(form.impostosLucro ?? 0)}</p>
          )}
        </div>
      </div>
    </div>
  );

  const save = async () => {
    const rl = calcularResultadoLiquido(form as RelatorioMensalPlaneamento);
    const payload = {
      ...form,
      ebitda,
      margemBruta,
      margemEbitda,
      resultadoLiquido: rl,
      gastosPessoal: form.gastosPessoal.map(l => ({ ...l, total: l.quantidade * l.precoUnitario })),
    };
    try {
      if (form.id != null) {
        await updateRelatorioPlaneamento(form.id, payload);
      } else {
        await addRelatorioPlaneamento(payload);
      }
      navigate('/planeamento/relatorios');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const empresaNome = empresas.find(e => e.id === form.empresaId)?.nome ?? String(form.empresaId);
  const mesAnoLabel = `${form.mesAno.slice(5)}/${form.mesAno.slice(0, 4)}`;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/planeamento/relatorios')}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="page-header">Relatório Mensal — {empresaNome} ({mesAnoLabel})</h1>
          <p className="text-sm text-muted-foreground">Planeamento Estratégico</p>
        </div>
        {editMode && (
          <Button className="ml-auto" onClick={save}>Guardar relatório</Button>
        )}
      </div>

      {/* Secção 1: Análise da Empresa e do Negócio */}
      <Card>
        <CardHeader><CardTitle className="text-base">1. Análise da Empresa e do Negócio</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <DynamicStringListField
            label="Actividades comerciais desenvolvidas no período"
            items={form.actividadesComerciais}
            onChange={next => setForm(f => (f ? { ...f, actividadesComerciais: next } : f))}
            readOnly={!editMode}
            addLabel="Adicionar actividade"
          />
          <DynamicStringListField
            label="Principais constrangimentos identificados"
            items={form.principaisConstrangimentos}
            onChange={next => setForm(f => (f ? { ...f, principaisConstrangimentos: next } : f))}
            readOnly={!editMode}
            addLabel="Adicionar constrangimento"
          />
          <DynamicStringListField
            label="Estratégias implementadas para aumento de receitas"
            items={form.estrategiasReceitas}
            onChange={next => setForm(f => (f ? { ...f, estrategiasReceitas: next } : f))}
            readOnly={!editMode}
            addLabel="Adicionar estratégia"
          />
          <DynamicStringListField
            label="Estratégias implementadas para redução de custos"
            items={form.estrategiasCustos}
            onChange={next => setForm(f => (f ? { ...f, estrategiasCustos: next } : f))}
            readOnly={!editMode}
            addLabel="Adicionar estratégia"
          />
          <div className="space-y-2">
            <Label>Ciclo de vida da empresa</Label>
            <Select value={form.cicloVida} onValueChange={v => setForm(f => f ? { ...f, cicloVida: v as CicloVidaEmpresa } : f)} disabled={!editMode}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CICLO_VIDA_OPTIONS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Secção 2: Necessidades de investimento */}
      <Card>
        <CardHeader><CardTitle className="text-base">2. Análise Financeira — Necessidades de investimento</CardTitle></CardHeader>
        <CardContent>
          <LinhasTable linhas={form.necessidadesInvestimento} onChange={l => setForm(f => f ? { ...f, necessidadesInvestimento: l } : f)} readOnly={!editMode} />
        </CardContent>
      </Card>

      {/* Secção 3: Gestão de stocks */}
      <Card>
        <CardHeader><CardTitle className="text-base">3. Gestão de Stocks</CardTitle></CardHeader>
        <CardContent className="space-y-8">
          <MateriasPrimasStockTable
            stockInicial={form.stockInicial}
            stockFinal={form.stockFinal}
            onApplyUnified={rows => {
              const { stockInicial, stockFinal } = legacyMateriasStockFromUnified(rows);
              setForm(f => (f ? { ...f, stockInicial, stockFinal } : f));
            }}
            readOnly={!editMode}
          />
          <div>
            <Label className="mb-2 block">Compras do período</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Movimentos de compra independentes (podem incluir vários artigos ou fornecedores, sem coincidir
              linha-a-linha com as matérias-prima acima).
            </p>
            <LinhasTable
              linhas={form.comprasPeriodo}
              onChange={l => setForm(f => (f ? { ...f, comprasPeriodo: l } : f))}
              readOnly={!editMode}
            />
          </div>
        </CardContent>
      </Card>

      {/* Secção 4: Demonstração de resultados + EBITDA */}
      <Card>
        <CardHeader><CardTitle className="text-base">4. Demonstração de Resultados</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-2 block">Venda de produtos</Label>
            <LinhasTable linhas={form.vendasProdutos} onChange={l => setForm(f => f ? { ...f, vendasProdutos: l } : f)} readOnly={!editMode} />
          </div>
          <div>
            <Label className="mb-2 block">Venda de serviços</Label>
            <LinhasTable linhas={form.vendasServicos} onChange={l => setForm(f => f ? { ...f, vendasServicos: l } : f)} readOnly={!editMode} />
          </div>
          <div>
            <Label className="mb-2 block">Custo de mercadorias vendidas</Label>
            <LinhasTable linhas={form.custoMercadoriasVendidas} onChange={l => setForm(f => f ? { ...f, custoMercadoriasVendidas: l } : f)} readOnly={!editMode} />
          </div>
          <div>
            <Label className="mb-2 block">Fornecimento de serviços externos</Label>
            <LinhasTable linhas={form.fornecimentoServicosExternos} onChange={l => setForm(f => f ? { ...f, fornecimentoServicosExternos: l } : f)} readOnly={!editMode} />
          </div>
          <div>
            <Label className="mb-2 block">Gastos com pessoal</Label>
            <p className="text-xs text-muted-foreground mb-2">
              INSS e IRT entram no resultado líquido; no EBITDA são excluídos (só salários base e subsídios na base do EBITDA).
            </p>
            <div className="space-y-2">
              {form.gastosPessoal.map((item, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium w-28">{GASTOS_PESSOAL_TIPOS.find(t => t.value === item.tipo)?.label}</span>
                  <Input type="number" className="w-24 h-8 text-right" value={item.quantidade || ''} onChange={e => setForm(f => {
                    if (!f) return f;
                    const next = [...f.gastosPessoal]; next[i] = { ...next[i], quantidade: Number(e.target.value) || 0 };
                    return { ...f, gastosPessoal: next };
                  })} disabled={!editMode} />
                  <MonetaryInput
                    className="w-32 h-8 text-right tabular-nums"
                    value={item.precoUnitario}
                    onChange={n => setForm(f => {
                      if (!f) return f;
                      const next = [...f.gastosPessoal]; next[i] = { ...next[i], precoUnitario: n };
                      return { ...f, gastosPessoal: next };
                    })}
                    disabled={!editMode}
                  />
                  <span className="font-mono text-muted-foreground min-w-[7.5rem] text-right tabular-nums text-sm">
                    {formatKz(item.quantidade * item.precoUnitario)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 border border-border/80">
            <div>
              <p className="text-xs text-muted-foreground uppercase">EBITDA</p>
              <p className="text-lg font-semibold">{formatKz(ebitda)}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Volume de negócio − CMV − gasto com pessoal (sem INSS e IRT) − fornecimento de serviços externos. INSS e IRT
                ficam na secção de pessoal mas não entram no EBITDA; impostos sobre o lucro, juros e depreciação só como
                referência abaixo.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Resultado líquido</p>
              <p className="text-lg font-semibold">{formatKz(resultadoLiquido)}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Volume de negócio − CMV − gasto com pessoal (com INSS e IRT) − fornecimento de serviços externos.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Margem bruta</p>
              <p className="text-lg font-semibold">{(margemBruta * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Margem EBITDA</p>
              <p className="text-lg font-semibold">{(margemEbitda * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Margem líquida</p>
              <p className="text-lg font-semibold">{(margemLiquida * 100).toFixed(1)}%</p>
            </div>
          </div>
          {encargosPosEbitda}
        </CardContent>
      </Card>

      {/* Secção 5: Liquidez */}
      <Card>
        <CardHeader><CardTitle className="text-base">5. Liquidez Financeira</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-2 block">Saldos bancários</Label>
            <div className="space-y-2">
              {form.saldosBancarios.map((s, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input className="w-32 h-8" value={s.banco} onChange={e => setForm(f => {
                    if (!f) return f; const n = [...f.saldosBancarios]; n[i] = { ...n[i], banco: e.target.value }; return { ...f, saldosBancarios: n };
                  })} disabled={!editMode} placeholder="Banco" />
                  <Input className="w-40 h-8" value={s.numeroConta} onChange={e => setForm(f => {
                    if (!f) return f; const n = [...f.saldosBancarios]; n[i] = { ...n[i], numeroConta: e.target.value }; return { ...f, saldosBancarios: n };
                  })} disabled={!editMode} placeholder="Nº conta" />
                  <MonetaryInput
                    className="w-36 h-8 text-right tabular-nums"
                    value={s.saldoActual}
                    onChange={n => setForm(f => {
                      if (!f) return f;
                      const arr = [...f.saldosBancarios]; arr[i] = { ...arr[i], saldoActual: n };
                      return { ...f, saldosBancarios: arr };
                    })}
                    disabled={!editMode}
                    placeholder="Saldo"
                  />
                  {editMode && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setForm(f => f ? { ...f, saldosBancarios: form.saldosBancarios.filter((_, j) => j !== i) } : f)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              ))}
              {editMode && <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => f ? { ...f, saldosBancarios: [...f.saldosBancarios, { banco: '', numeroConta: '', saldoActual: 0 }] } : f)}><Plus className="h-4 w-4 mr-1" /> Banco</Button>}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Pendentes a pagamento</Label>
            <div className="space-y-2">
              {form.pendentesPagamento.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input className="flex-1 min-w-[120px] h-8" value={p.nome} onChange={e => setForm(f => {
                    if (!f) return f; const n = [...f.pendentesPagamento]; n[i] = { ...n[i], nome: e.target.value }; return { ...f, pendentesPagamento: n };
                  })} disabled={!editMode} placeholder="Fornecedor" />
                  <MonetaryInput
                    className="w-32 h-8 text-right tabular-nums"
                    value={p.valor}
                    onChange={n => setForm(f => {
                      if (!f) return f;
                      const arr = [...f.pendentesPagamento]; arr[i] = { ...arr[i], valor: n };
                      return { ...f, pendentesPagamento: arr };
                    })}
                    disabled={!editMode}
                    placeholder="Valor"
                  />
                  {editMode && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setForm(f => f ? { ...f, pendentesPagamento: form.pendentesPagamento.filter((_, j) => j !== i) } : f)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              ))}
              {editMode && <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => f ? { ...f, pendentesPagamento: [...f.pendentesPagamento, { nome: '', valor: 0 }] } : f)}><Plus className="h-4 w-4 mr-1" /> Pendente</Button>}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Pendentes de recebimento</Label>
            <div className="space-y-2">
              {form.pendentesRecebimento.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input className="flex-1 min-w-[120px] h-8" value={p.nome} onChange={e => setForm(f => {
                    if (!f) return f; const n = [...f.pendentesRecebimento]; n[i] = { ...n[i], nome: e.target.value }; return { ...f, pendentesRecebimento: n };
                  })} disabled={!editMode} placeholder="Cliente" />
                  <MonetaryInput
                    className="w-32 h-8 text-right tabular-nums"
                    value={p.valor}
                    onChange={n => setForm(f => {
                      if (!f) return f;
                      const arr = [...f.pendentesRecebimento]; arr[i] = { ...arr[i], valor: n };
                      return { ...f, pendentesRecebimento: arr };
                    })}
                    disabled={!editMode}
                    placeholder="Valor"
                  />
                  {editMode && <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setForm(f => f ? { ...f, pendentesRecebimento: form.pendentesRecebimento.filter((_, j) => j !== i) } : f)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              ))}
              {editMode && <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => f ? { ...f, pendentesRecebimento: [...f.pendentesRecebimento, { nome: '', valor: 0 }] } : f)}><Plus className="h-4 w-4 mr-1" /> Pendente</Button>}
            </div>
          </div>
        </CardContent>
      </Card>

      {editMode && <div className="flex justify-end"><Button onClick={save}>Guardar relatório</Button></div>}
      {!editMode && form.status === 'Rascunho' && form.id != null && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => navigate(`/planeamento/relatorios/${form.id}/editar`)}>Editar relatório</Button>
        </div>
      )}
    </div>
  );
}
