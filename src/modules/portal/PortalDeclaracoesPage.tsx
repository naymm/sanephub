import { useState } from 'react';
import { useData } from '@/context/DataContext';
import { useColaboradorId } from '@/hooks/useColaboradorId';
import type { Declaracao, TipoDeclaracao, StatusDeclaracao } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate } from '@/utils/formatters';
import { gerarPdfDeclaracaoServico } from '@/utils/declaracaoServicoPdf';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Plus, Eye, FileDown, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TIPO_OPTIONS: TipoDeclaracao[] = ['Para Banco', 'Embaixada', 'Rendimentos', 'Outro'];
const STATUS_OPTIONS: StatusDeclaracao[] = ['Pendente', 'Emitida', 'Entregue'];

const BANCOS = ['BAI', 'BANC', 'BIC', 'BCA', 'BCI', 'BDA', 'BE', 'BFA', 'BIR', 'BPA', 'BPC', 'BNI', 'KEVE', 'BPR', 'BSOL', 'BCGA', 'BMA', 'VTB', 'ACCESS', 'BMF', 'BKI', 'BCH', 'SBA', 'BPPH', 'BVB'];

const PAISES_EMBAIXADA = ['ESPANHA', 'PORTUGAL', 'CHINA', 'EUA', 'BRASIL'];

export default function PortalDeclaracoesPage() {
  const colaboradorId = useColaboradorId();
  const { declaracoes, addDeclaracao, colaboradores } = useData();
  const [statusFilter, setStatusFilter] = useState<StatusDeclaracao | 'todos'>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<Declaracao | null>(null);
  const [form, setForm] = useState<Omit<Declaracao, 'id'>>({
    colaboradorId: 0,
    tipo: 'Para Banco',
    dataPedido: new Date().toISOString().slice(0, 10),
    status: 'Pendente',
  });
  const [bancoOpen, setBancoOpen] = useState(false);
  const [paisOpen, setPaisOpen] = useState(false);

  const minhasDeclaracoes = colaboradorId == null
    ? []
    : declaracoes.filter(d => d.colaboradorId === colaboradorId);

  const filtered = minhasDeclaracoes.filter(d => {
    const matchStatus = statusFilter === 'todos' || d.status === statusFilter;
    return matchStatus;
  });

  const handleImprimirPdf = async (d: Declaracao) => {
    if (d.status !== 'Emitida' && d.status !== 'Entregue') {
      toast.error('Só pode imprimir declarações emitidas ou entregues.');
      return;
    }
    const col = colaboradores.find(c => c.id === d.colaboradorId);
    if (!col) {
      toast.error('Dados do colaborador não encontrados.');
      return;
    }
    try {
      await gerarPdfDeclaracaoServico(d, col);
      toast.success('PDF da declaração gerado. Verifique os transferidos.');
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast.error('Não foi possível gerar o PDF.');
    }
  };

  const openPedir = () => {
    if (colaboradorId == null) return;
    setForm({
      colaboradorId,
      tipo: 'Para Banco',
      descricao: undefined,
      banco: undefined,
      paisEmbaixada: undefined,
      dataPedido: new Date().toISOString().slice(0, 10),
      status: 'Pendente',
    });
    setBancoOpen(false);
    setPaisOpen(false);
    setDialogOpen(true);
  };

  const setTipo = (v: TipoDeclaracao) => {
    setForm(f => ({ ...f, tipo: v, banco: undefined, paisEmbaixada: undefined }));
  };

  const save = async () => {
    if (!form.colaboradorId || !form.dataPedido) return;
    if (form.tipo === 'Para Banco' && !form.banco) {
      toast.error('Seleccione o banco.');
      return;
    }
    if (form.tipo === 'Embaixada' && !form.paisEmbaixada) {
      toast.error('Seleccione o país da embaixada.');
      return;
    }
    try {
      await addDeclaracao(form);
      setDialogOpen(false);
      toast.success('Pedido de declaração registado. Será processado pelos Recursos Humanos.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao registar');
    }
  };

  if (colaboradorId == null) {
    return (
      <div className="space-y-6">
        <h1 className="page-header">As Minhas Declarações</h1>
        <p className="text-muted-foreground text-center py-12">Não tem um colaborador associado à sua conta. Contacte os Recursos Humanos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">As Minhas Declarações</h1>
        <Button onClick={openPedir} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Pedir Declaração
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Declarações de serviço (para banco, rendimentos, antiguidade). Pode solicitar nova declaração.</p>

      <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusDeclaracao | 'todos')}>
        <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {STATUS_OPTIONS.map(s => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data pedido</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data emissão</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                <td className="py-3 px-5 font-medium">{d.tipo}</td>
                <td className="py-3 px-5 text-muted-foreground">{formatDate(d.dataPedido)}</td>
                <td className="py-3 px-5 text-muted-foreground">{d.dataEmissao ? formatDate(d.dataEmissao) : '—'}</td>
                <td className="py-3 px-5"><StatusBadge status={d.status} /></td>
                <td className="py-3 px-5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhe" onClick={() => { setViewItem(d); setViewOpen(true); }}><Eye className="h-4 w-4" /></Button>
                    {(d.status === 'Emitida' || d.status === 'Entregue') && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Imprimir PDF" onClick={() => handleImprimirPdf(d)}><FileDown className="h-4 w-4" /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma declaração encontrada.</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pedir declaração</DialogTitle>
            <DialogDescription>Solicite uma declaração de serviço. O pedido será tratado pelos Recursos Humanos.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setTipo(v as TipoDeclaracao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.tipo === 'Para Banco' && (
              <div className="space-y-2">
                <Label>Banco</Label>
                <Popover open={bancoOpen} onOpenChange={setBancoOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={bancoOpen}
                      className="w-full justify-between font-normal"
                    >
                      {form.banco ?? 'Seleccionar banco...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar banco..." />
                      <CommandList>
                        <CommandEmpty>Nenhum banco encontrado.</CommandEmpty>
                        <CommandGroup>
                          {BANCOS.map((b) => (
                            <CommandItem
                              key={b}
                              value={b}
                              onSelect={() => {
                                setForm(f => ({ ...f, banco: b }));
                                setBancoOpen(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', form.banco === b ? 'opacity-100' : 'opacity-0')} />
                              {b}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {form.tipo === 'Embaixada' && (
              <div className="space-y-2">
                <Label>País da Embaixada</Label>
                <Popover open={paisOpen} onOpenChange={setPaisOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={paisOpen}
                      className="w-full justify-between font-normal"
                    >
                      {form.paisEmbaixada ?? 'Seleccionar país...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Pesquisar país..." />
                      <CommandList>
                        <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
                        <CommandGroup>
                          {PAISES_EMBAIXADA.map((p) => (
                            <CommandItem
                              key={p}
                              value={p}
                              onSelect={() => {
                                setForm(f => ({ ...f, paisEmbaixada: p }));
                                setPaisOpen(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', form.paisEmbaixada === p ? 'opacity-100' : 'opacity-0')} />
                              {p}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={form.descricao ?? ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value || undefined }))} placeholder="ex: Crédito habitação" />
            </div>
            <div className="space-y-2">
              <Label>Data pedido</Label>
              <Input type="date" value={form.dataPedido} onChange={e => setForm(f => ({ ...f, dataPedido: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.dataPedido}>Enviar pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Declaração — {viewItem?.tipo}</DialogTitle>
            <DialogDescription>Detalhe da sua declaração</DialogDescription>
          </DialogHeader>
          {viewItem && (() => {
            const col = colaboradores.find(c => c.id === viewItem.colaboradorId);
            return (
              <div className="space-y-4">
                <div className="space-y-3 text-sm">
                  <p><span className="text-muted-foreground">Tipo:</span> {viewItem.tipo}</p>
                  {viewItem.banco && <p><span className="text-muted-foreground">Banco:</span> {viewItem.banco}</p>}
                  {viewItem.paisEmbaixada && <p><span className="text-muted-foreground">País (Embaixada):</span> {viewItem.paisEmbaixada}</p>}
                  {viewItem.descricao && <p><span className="text-muted-foreground">Descrição:</span> {viewItem.descricao}</p>}
                  <p><span className="text-muted-foreground">Data pedido:</span> {formatDate(viewItem.dataPedido)}</p>
                  <p><span className="text-muted-foreground">Data emissão:</span> {viewItem.dataEmissao ? formatDate(viewItem.dataEmissao) : '—'}</p>
                  <p><span className="text-muted-foreground">Data entrega:</span> {viewItem.dataEntrega ? formatDate(viewItem.dataEntrega) : '—'}</p>
                  <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewItem.status} /></p>
                  {viewItem.emitidoPor && <p><span className="text-muted-foreground">Emitido por:</span> {viewItem.emitidoPor}</p>}
                </div>
                {col && (viewItem.status === 'Emitida' || viewItem.status === 'Entregue') && (
                  <Button onClick={() => { handleImprimirPdf(viewItem); setViewOpen(false); }} className="w-full sm:w-auto">
                    <FileDown className="h-4 w-4 mr-2" />
                    Imprimir PDF (Declaração de Serviço)
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
