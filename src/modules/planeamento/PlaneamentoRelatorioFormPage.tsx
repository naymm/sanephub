import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import type { RelatorioMensalPlaneamento, LinhaPlaneamento, GastosPessoalItem, SaldoBancario, PendenteValor, CicloVidaEmpresa } from '@/types';
import { formatKz } from '@/utils/formatters';
import { calcularEbitda, calcularMargemBruta, calcularMargemEbitda, actualizarTotaisLinhas } from '@/utils/planeamentoCalculos';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

function emptyRelatorio(empresaId: number, mesAno: string): Omit<RelatorioMensalPlaneamento, 'id'> {
  return {
    empresaId,
    mesAno,
    status: 'Rascunho',
    actividadesComerciais: '',
    principaisConstrangimentos: '',
    estrategiasReceitas: '',
    estrategiasCustos: '',
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
            <th className="text-right p-2 w-28">{columnsLabel[2]}</th>
            <th className="text-right p-2 w-28">{columnsLabel[3]}</th>
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
                <Input type="number" className="h-8 text-right" value={l.precoUnitario || ''} onChange={e => update(i, { precoUnitario: Number(e.target.value) || 0 })} disabled={readOnly} />
              </td>
              <td className="p-2 text-right font-mono text-muted-foreground">{l.quantidade * l.precoUnitario}</td>
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

export default function PlaneamentoRelatorioFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { relatoriosPlaneamento, setRelatoriosPlaneamento, empresas } = useData();

  const location = useLocation();
  const isNew = id === 'novo';
  const editMode = isNew || location.pathname.endsWith('/editar');
  const empresaIdParam = Number(searchParams.get('empresaId')) || empresas.find(e => e.activo)?.id || 1;
  const mesAnoParam = searchParams.get('mesAno') || new Date().toISOString().slice(0, 7);

  const existing = id && id !== 'novo' ? relatoriosPlaneamento.find(r => r.id === Number(id)) : null;
  const [form, setForm] = useState<RelatorioMensalPlaneamento | (Omit<RelatorioMensalPlaneamento, 'id'> & { id?: number }) | null>(null);

  useEffect(() => {
    if (existing) setForm({ ...existing });
    else if (isNew) setForm({ ...emptyRelatorio(empresaIdParam, mesAnoParam), id: undefined });
  }, [id, existing?.id, isNew, empresaIdParam, mesAnoParam]);

  if (form == null) return <div className="p-6">A carregar...</div>;

  const vendasTotal = form.vendasProdutos.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0) + form.vendasServicos.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0);
  const ebitda = calcularEbitda(form as RelatorioMensalPlaneamento);
  const margemBruta = vendasTotal > 0 ? (vendasTotal - form.custoMercadoriasVendidas.reduce((s, l) => s + l.quantidade * l.precoUnitario, 0)) / vendasTotal : 0;
  const margemEbitda = vendasTotal > 0 ? ebitda / vendasTotal : 0;

  const save = () => {
    const payload = {
      ...form,
      ebitda,
      margemBruta,
      margemEbitda,
      gastosPessoal: form.gastosPessoal.map(l => ({ ...l, total: l.quantidade * l.precoUnitario })),
    };
    if (form.id != null) {
      setRelatoriosPlaneamento(prev => prev.map(r => r.id === form.id ? { ...payload, id: r.id } as RelatorioMensalPlaneamento : r));
    } else {
      setRelatoriosPlaneamento(prev => {
        const newId = Math.max(0, ...prev.map(r => r.id)) + 1;
        return [...prev, { ...payload, id: newId } as RelatorioMensalPlaneamento];
      });
    }
    navigate('/planeamento/relatorios');
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Actividades comerciais desenvolvidas no período</Label>
            <Textarea value={form.actividadesComerciais} onChange={e => setForm(f => f ? { ...f, actividadesComerciais: e.target.value } : f)} disabled={!editMode} rows={3} className="resize-none" />
          </div>
          <div className="space-y-2">
            <Label>Principais constrangimentos identificados</Label>
            <Textarea value={form.principaisConstrangimentos} onChange={e => setForm(f => f ? { ...f, principaisConstrangimentos: e.target.value } : f)} disabled={!editMode} rows={2} className="resize-none" />
          </div>
          <div className="space-y-2">
            <Label>Estratégias implementadas para aumento de receitas</Label>
            <Textarea value={form.estrategiasReceitas} onChange={e => setForm(f => f ? { ...f, estrategiasReceitas: e.target.value } : f)} disabled={!editMode} rows={2} className="resize-none" />
          </div>
          <div className="space-y-2">
            <Label>Estratégias implementadas para redução de custos</Label>
            <Textarea value={form.estrategiasCustos} onChange={e => setForm(f => f ? { ...f, estrategiasCustos: e.target.value } : f)} disabled={!editMode} rows={2} className="resize-none" />
          </div>
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
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-2 block">Stock inicial de matéria-prima</Label>
            <LinhasTable linhas={form.stockInicial} onChange={l => setForm(f => f ? { ...f, stockInicial: l } : f)} readOnly={!editMode} />
          </div>
          <div>
            <Label className="mb-2 block">Compras do período</Label>
            <LinhasTable linhas={form.comprasPeriodo} onChange={l => setForm(f => f ? { ...f, comprasPeriodo: l } : f)} readOnly={!editMode} />
          </div>
          <div>
            <Label className="mb-2 block">Stock final de matéria-prima</Label>
            <LinhasTable linhas={form.stockFinal} onChange={l => setForm(f => f ? { ...f, stockFinal: l } : f)} readOnly={!editMode} />
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
            <div className="space-y-2">
              {form.gastosPessoal.map((item, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium w-28">{GASTOS_PESSOAL_TIPOS.find(t => t.value === item.tipo)?.label}</span>
                  <Input type="number" className="w-24 h-8 text-right" value={item.quantidade || ''} onChange={e => setForm(f => {
                    if (!f) return f;
                    const next = [...f.gastosPessoal]; next[i] = { ...next[i], quantidade: Number(e.target.value) || 0 };
                    return { ...f, gastosPessoal: next };
                  })} disabled={!editMode} />
                  <Input type="number" className="w-28 h-8 text-right" value={item.precoUnitario || ''} onChange={e => setForm(f => {
                    if (!f) return f;
                    const next = [...f.gastosPessoal]; next[i] = { ...next[i], precoUnitario: Number(e.target.value) || 0 };
                    return { ...f, gastosPessoal: next };
                  })} disabled={!editMode} />
                  <span className="font-mono text-muted-foreground w-28 text-right">{item.quantidade * item.precoUnitario}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border border-border/80">
            <div>
              <p className="text-xs text-muted-foreground uppercase">EBITDA</p>
              <p className="text-lg font-semibold">{formatKz(ebitda)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Margem Bruta</p>
              <p className="text-lg font-semibold">{(margemBruta * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Margem EBITDA</p>
              <p className="text-lg font-semibold">{(margemEbitda * 100).toFixed(1)}%</p>
            </div>
          </div>
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
                  <Input type="number" className="w-32 h-8 text-right" value={s.saldoActual || ''} onChange={e => setForm(f => {
                    if (!f) return f; const n = [...f.saldosBancarios]; n[i] = { ...n[i], saldoActual: Number(e.target.value) || 0 }; return { ...f, saldosBancarios: n };
                  })} disabled={!editMode} placeholder="Saldo" />
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
                  <Input type="number" className="w-28 h-8 text-right" value={p.valor || ''} onChange={e => setForm(f => {
                    if (!f) return f; const n = [...f.pendentesPagamento]; n[i] = { ...n[i], valor: Number(e.target.value) || 0 }; return { ...f, pendentesPagamento: n };
                  })} disabled={!editMode} placeholder="Valor" />
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
                  <Input type="number" className="w-28 h-8 text-right" value={p.valor || ''} onChange={e => setForm(f => {
                    if (!f) return f; const n = [...f.pendentesRecebimento]; n[i] = { ...n[i], valor: Number(e.target.value) || 0 }; return { ...f, pendentesRecebimento: n };
                  })} disabled={!editMode} placeholder="Valor" />
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
