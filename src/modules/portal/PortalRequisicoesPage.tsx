import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useColaboradorId } from '@/hooks/useColaboradorId';
import type { Requisicao, StatusRequisicao } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatKz, formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Eye, Paperclip, Trash2 } from 'lucide-react';

const STATUS_OPTIONS: { value: StatusRequisicao | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Em Análise', label: 'Em Análise' },
  { value: 'Aprovado', label: 'Aprovado' },
  { value: 'Rejeitado', label: 'Rejeitado' },
  { value: 'Enviado à Contabilidade', label: 'Enviado à Contabilidade' },
  { value: 'Pago', label: 'Pago' },
];

function nextNum(requisicoes: Requisicao[]): string {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;
  const nums = requisicoes.filter(r => r.num.startsWith(prefix)).map(r => parseInt(r.num.split('-')[2], 10));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export default function PortalRequisicoesPage() {
  const { user } = useAuth();
  const colaboradorId = useColaboradorId();
  const { requisicoes, setRequisicoes, centrosCusto, departamentos, colaboradores } = useData();
  const { currentEmpresaId } = useTenant();
  const [statusFilter, setStatusFilter] = useState<StatusRequisicao | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewReq, setViewReq] = useState<Requisicao | null>(null);
  const [form, setForm] = useState({
    fornecedor: '',
    descricao: '',
    valor: 0,
    departamento: '',
    centroCusto: 'CC-001',
    data: new Date().toISOString().slice(0, 10),
    proformaAnexos: [] as string[],
  });
  const [novoAnexoProforma, setNovoAnexoProforma] = useState('');

  const minhasRequisicoes = colaboradorId == null
    ? []
    : requisicoes.filter(r => r.requisitanteColaboradorId === colaboradorId);

  const filtered = minhasRequisicoes.filter(r => {
    const matchStatus = statusFilter === 'todos' || r.status === statusFilter;
    return matchStatus;
  });

  const openCreate = () => {
    const dept = departamentos.find(d => d.nome === user?.departamento)?.nome ?? departamentos[0]?.nome ?? '';
    setForm({
      fornecedor: '',
      descricao: '',
      valor: 0,
      departamento: dept,
      centroCusto: 'CC-001',
      data: new Date().toISOString().slice(0, 10),
      proformaAnexos: [],
    });
    setNovoAnexoProforma('');
    setDialogOpen(true);
  };

  const addProformaAnexo = (nome: string) => {
    if (!nome.trim()) return;
    setForm(f => ({
      ...f,
      proformaAnexos: [...f.proformaAnexos, nome.trim()],
    }));
    setNovoAnexoProforma('');
  };

  const removeProformaAnexo = (index: number) => {
    setForm(f => ({
      ...f,
      proformaAnexos: f.proformaAnexos.filter((_, i) => i !== index),
    }));
  };

  const save = () => {
    if (colaboradorId == null || !form.fornecedor.trim() || !form.descricao.trim() || form.valor <= 0 || !form.departamento.trim()) return;
    if (form.proformaAnexos.length === 0) return;
    const newId = Math.max(0, ...requisicoes.map(r => r.id)) + 1;
    const nova: Requisicao = {
      id: newId,
      num: nextNum(requisicoes),
      fornecedor: form.fornecedor.trim(),
      descricao: form.descricao.trim(),
      valor: form.valor,
      departamento: form.departamento,
      centroCusto: form.centroCusto,
      data: form.data,
      status: 'Pendente',
      proforma: true,
      proformaAnexos: form.proformaAnexos,
      factura: false,
      comprovante: false,
      enviadoContabilidade: false,
      requisitanteColaboradorId: colaboradorId,
      empresaId: typeof currentEmpresaId === 'number' ? currentEmpresaId : (colaboradores.find(c => c.id === colaboradorId)?.empresaId ?? 1),
    };
    setRequisicoes(prev => [...prev, nova]);
    setDialogOpen(false);
  };

  if (colaboradorId == null) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">Requisição à Área Financeira</h1>
        <p className="text-muted-foreground text-center py-12">Não tem um colaborador associado à sua conta. Contacte os Recursos Humanos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Requisição à Área Financeira</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Nova Requisição
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Requisições que submeteu à área financeira. Pode criar novas requisições para despesas do seu departamento.</p>

      <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusRequisicao | 'todos')}>
        <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nº</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fornecedor</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-mono text-xs">{r.num}</td>
                <td className="py-3 px-5 font-medium">{r.fornecedor}</td>
                <td className="py-3 px-5 text-muted-foreground max-w-48 truncate">{r.descricao}</td>
                <td className="py-3 px-5 text-right font-mono">{formatKz(r.valor)}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(r.data)}</td>
                <td className="py-3 px-5"><StatusBadge status={r.status} /></td>
                <td className="py-3 px-5 text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewReq(r); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma requisição encontrada.</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle>Nova requisição à Área Financeira</DialogTitle>
            <DialogDescription>Preencha os dados. A requisição será analisada pela equipa financeira.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 overflow-y-auto min-h-0">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição da despesa" />
            </div>
            <div className="space-y-2">
              <Label>Valor (Kz)</Label>
              <Input type="number" min={0} value={form.valor || ''} onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={form.departamento || undefined} onValueChange={v => setForm(f => ({ ...f, departamento: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar departamento" /></SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  {departamentos.map(d => (
                    <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centro de custo</Label>
              <Select value={form.centroCusto} onValueChange={v => setForm(f => ({ ...f, centroCusto: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  {centrosCusto.map(cc => (
                    <SelectItem key={cc.id} value={cc.codigo}>{cc.codigo} — {cc.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="space-y-2 border-t border-border/80 pt-4">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Factura proforma <span className="text-destructive">(obrigatório)</span>
              </Label>
              <p className="text-xs text-muted-foreground">Anexe pelo menos uma factura proforma. Indique o nome do ficheiro ou seleccione o ficheiro.</p>
              {form.proformaAnexos.length > 0 && (
                <ul className="space-y-1.5">
                  {form.proformaAnexos.map((nome, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <span className="truncate">{nome}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeProformaAnexo(i)} aria-label="Remover anexo">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do ficheiro (ex: proforma_fornecedor.pdf)"
                  value={novoAnexoProforma}
                  onChange={e => setNovoAnexoProforma(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProformaAnexo(novoAnexoProforma); } }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addProformaAnexo(novoAnexoProforma)}
                  disabled={!novoAnexoProforma.trim()}
                >
                  Adicionar
                </Button>
              </div>
              <div className="relative">
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-8"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) { addProformaAnexo(file.name); e.target.value = ''; }
                  }}
                />
                <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 py-2 text-xs text-muted-foreground pointer-events-none">
                  <Paperclip className="h-3.5 w-3.5" /> ou clique para seleccionar ficheiro (PDF, imagem, Word)
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border/80 pt-4 mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={save}
              disabled={!form.fornecedor.trim() || !form.descricao.trim() || form.valor <= 0 || !form.departamento.trim() || form.proformaAnexos.length === 0}
            >
              Submeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Requisição — {viewReq?.num}</DialogTitle>
            <DialogDescription>Detalhe da requisição</DialogDescription>
          </DialogHeader>
          {viewReq && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">Fornecedor:</span> {viewReq.fornecedor}</p>
              <p><span className="text-muted-foreground">Descrição:</span> {viewReq.descricao}</p>
              <p><span className="text-muted-foreground">Valor:</span> {formatKz(viewReq.valor)}</p>
              <p><span className="text-muted-foreground">Departamento:</span> {viewReq.departamento}</p>
              <p><span className="text-muted-foreground">Centro de custo:</span> {viewReq.centroCusto}</p>
              <p><span className="text-muted-foreground">Data:</span> {formatDate(viewReq.data)}</p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewReq.status} /></p>
              {(viewReq.proformaAnexos ?? []).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Factura(s) proforma anexada(s):</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {(viewReq.proformaAnexos ?? []).map((nome, i) => (
                      <li key={i}>{nome}</li>
                    ))}
                  </ul>
                </div>
              )}
              {viewReq.motivoRejeicao && <p><span className="text-muted-foreground">Motivo rejeição:</span> {viewReq.motivoRejeicao}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
