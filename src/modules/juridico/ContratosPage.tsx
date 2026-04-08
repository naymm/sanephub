import { useState, useEffect, useMemo, useId } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useClientSidePagination } from '@/hooks/useClientSidePagination';
import { DataTablePagination } from '@/components/shared/DataTablePagination';
import type { Contrato, StatusContrato } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatDate, formatKz, diasRestantes } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  garantirPastaNumeroContratoNaGestao,
  uploadAnexosContratoParaGestao,
  resolveContratoDocumentoPublicUrl,
} from '@/lib/contratoGestaoDocumentos';
import { fetchNomeEmpresaPorNifGue } from '@/utils/guePublicacaoNomeEmpresa';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Pencil, Trash2, Eye, FileText, ChevronsUpDown, Upload, Search, Loader2 } from 'lucide-react';

const TIPO_PRESTACAO = 'Prestação de Serviços';

function proximoNumeroContrato(contratos: Contrato[], empresaId: number): string {
  const y = new Date().getFullYear();
  const sameEmp = contratos.filter(c => c.empresaId === empresaId);
  let maxSeq = 0;
  for (const c of sameEmp) {
    const m = /^CONT-(\d{4})-(\d+)$/i.exec(c.numero.trim());
    if (m) {
      const yr = parseInt(m[1], 10);
      const seq = parseInt(m[2], 10);
      if (!Number.isNaN(seq) && yr === y && seq > maxSeq) maxSeq = seq;
    }
  }
  const next = maxSeq + 1;
  return `CONT-${y}-${String(next).padStart(6, '0')}`;
}

const TIPOS_CONTRATO = [
  'Empréstimo',
  'Trabalho Tempo Indeterminado',
  'Trabalho Tempo Determinado',
  'Prestação de Serviços',
  'Fornecimento',
  'Compra e Venda',
  'Arrendamento',
  'Parceria',
  'Outro',
] as const;

const STATUS_OPCOES: StatusContrato[] = ['Activo', 'A Renovar', 'Em Negociação', 'Suspenso', 'Rescindido', 'Expirado'];

export default function ContratosPage() {
  const { contratos, addContrato, updateContrato, deleteContrato, empresas, colaboradoresTodos } = useData();
  const { currentEmpresaId } = useTenant();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterEmpresa, setFilterEmpresa] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContrato, setPreviewContrato] = useState<Contrato | null>(null);
  const [previewInlinePdfUrl, setPreviewInlinePdfUrl] = useState<string | null>(null);
  const [contractPdfPreviewOpen, setContractPdfPreviewOpen] = useState(false);
  const [contractPdfPreviewUrl, setContractPdfPreviewUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState<Contrato | null>(null);
  const [form, setForm] = useState<Partial<Contrato>>({
    numero: '',
    tipo: TIPO_PRESTACAO,
    parteA: '',
    parteB: '',
    contraparteNif: '',
    contraparteColaboradorId: undefined,
    personalidadeContraparte: undefined,
    objecto: '',
    valor: 0,
    moeda: 'Kz',
    dataAssinatura: '',
    dataInicio: '',
    dataFim: '',
    advogado: '',
    responsavelJuridico: '',
    alertarAntesDias: 90,
    status: 'Activo',
    historico: [],
  });
  const [anexosContrato, setAnexosContrato] = useState<File[]>([]);
  const [anexosEmpresaCliente, setAnexosEmpresaCliente] = useState<File[]>([]);
  const [colabComboOpen, setColabComboOpen] = useState(false);
  const [gueNifLookupLoading, setGueNifLookupLoading] = useState(false);

  const empresaIdForNew = currentEmpresaId === 'consolidado' ? empresas.find(e => e.activo)?.id ?? 1 : currentEmpresaId;
  const canEdit = user?.perfil === 'Admin';

  const filtered = contratos.filter(c => {
    const matchSearch =
      !search ||
      c.numero.toLowerCase().includes(search.toLowerCase()) ||
      c.parteB.toLowerCase().includes(search.toLowerCase()) ||
      c.objecto.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === 'todos' || c.tipo === filterTipo;
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
    const matchEmpresa = filterEmpresa === 'todos' || (c.empresaId != null && String(c.empresaId) === filterEmpresa);
    return matchSearch && matchTipo && matchStatus && matchEmpresa;
  });
  const pagination = useClientSidePagination({ items: filtered, pageSize: 25 });

  const getDiasClass = (dataFim: string) => {
    const d = diasRestantes(dataFim);
    if (d < 0) return 'text-muted-foreground';
    if (d < 30) return 'text-destructive font-bold';
    if (d < 90) return 'text-amber-600 font-semibold';
    return 'text-emerald-600';
  };

  const empresaNome = (id: number | undefined) => (id != null ? empresas.find(e => e.id === id)?.nome ?? String(id) : '—');

  const colaboradoresEmpresa = useMemo(() => {
    const eid = form.empresaId;
    if (eid == null) return colaboradoresTodos;
    return colaboradoresTodos.filter(c => c.empresaId === eid);
  }, [colaboradoresTodos, form.empresaId]);

  const colaboradorSeleccionado = useMemo(
    () => colaboradoresTodos.find(c => c.id === form.contraparteColaboradorId),
    [colaboradoresTodos, form.contraparteColaboradorId],
  );

  /** Empresas activas; em edição, inclui a empresa do contrato mesmo se estiver inactiva. */
  const empresasParteA = useMemo(() => {
    const act = empresas.filter(e => e.activo);
    const cur = form.empresaId;
    if (cur != null && !act.some(e => e.id === cur)) {
      const extra = empresas.find(e => e.id === cur);
      return extra ? [...act, extra] : act;
    }
    return act;
  }, [empresas, form.empresaId]);

  useEffect(() => {
    if (!dialogOpen || editing != null) return;
    const eid = form.empresaId;
    if (typeof eid !== 'number') return;
    const next = proximoNumeroContrato(contratos, eid);
    setForm(f => (f.numero === next ? f : { ...f, numero: next }));
  }, [dialogOpen, editing, form.empresaId, contratos]);

  const openCreate = () => {
    setEditing(null);
    const eid = typeof empresaIdForNew === 'number' ? empresaIdForNew : 1;
    setAnexosContrato([]);
    setAnexosEmpresaCliente([]);
    const nomeEmpresaA = empresas.find(em => em.id === eid)?.nome ?? '';
    setForm({
      empresaId: eid,
      numero: proximoNumeroContrato(contratos, eid),
      tipo: TIPO_PRESTACAO,
      parteA: nomeEmpresaA,
      parteB: '',
      contraparteNif: '',
      contraparteColaboradorId: undefined,
      personalidadeContraparte: undefined,
      objecto: '',
      valor: 0,
      moeda: 'Kz',
      dataAssinatura: '',
      dataInicio: '',
      dataFim: '',
      advogado: user?.nome ?? '',
      responsavelJuridico: user?.nome ?? '',
      alertarAntesDias: 90,
      status: 'Activo',
      historico: [],
    });
    setDialogOpen(true);
  };

  const openEdit = (c: Contrato) => {
    setEditing(c);
    setAnexosContrato([]);
    setAnexosEmpresaCliente([]);
    let pers = c.personalidadeContraparte ?? undefined;
    if (c.tipo === TIPO_PRESTACAO && !pers) {
      if (c.contraparteColaboradorId != null) pers = 'Singular';
      else if (c.contraparteNif) pers = 'Colectivo';
    }
    setForm({
      ...c,
      parteA: empresas.find(em => em.id === c.empresaId)?.nome ?? c.parteA,
      historico: c.historico ?? [],
      contraparteNif: c.contraparteNif ?? '',
      personalidadeContraparte: pers,
    });
    setDialogOpen(true);
  };

  const openPreview = (c: Contrato) => {
    setPreviewContrato(c);
    setPreviewInlinePdfUrl(null);
    setPreviewOpen(true);
  };

  const openContractPdfPreview = async (c: Contrato) => {
    if (!isSupabaseConfigured() || !supabase) {
      toast.error('Configure o Supabase para pré-visualizar documentos.');
      return;
    }
    try {
      const url = await resolveContratoDocumentoPublicUrl(supabase, c);
      if (!url) {
        toast.error('Não foi possível localizar o documento deste contrato.');
        return;
      }
      setContractPdfPreviewUrl(url);
      setContractPdfPreviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao pré-visualizar.');
    }
  };

  const save = async () => {
    if (form.empresaId == null) {
      toast.error('Seleccione a empresa (Parte A).');
      return;
    }
    if (!form.numero?.trim() || !form.dataInicio || !form.dataFim) {
      toast.error('Preencha número (gerado), datas de início e fim.');
      return;
    }
    const isPrestacao = form.tipo === TIPO_PRESTACAO;
    let parteBVal = form.parteB?.trim() ?? '';
    let nifVal: string | null = form.contraparteNif?.trim() || null;
    let colabId: number | null = form.contraparteColaboradorId ?? null;
    let pers: string | null = form.personalidadeContraparte ?? null;

    if (isPrestacao) {
      if (!pers) {
        toast.error('Seleccione a personalidade da contraparte (Singular ou Colectivo).');
        return;
      }
      if (pers === 'Singular') {
        if (colabId == null) {
          toast.error('Seleccione o colaborador (contraparte singular).');
          return;
        }
        const col = colaboradoresTodos.find(x => x.id === colabId);
        parteBVal = col?.nome ?? parteBVal;
        if (!parteBVal) {
          toast.error('Colaborador inválido.');
          return;
        }
        nifVal = null;
      } else {
        if (!nifVal || !parteBVal) {
          toast.error('Indique o NIF e o nome da empresa (contraparte colectiva).');
          return;
        }
        colabId = null;
      }
    } else {
      if (!parteBVal) {
        toast.error('Indique a contraparte (Parte B).');
        return;
      }
      nifVal = null;
      colabId = null;
      pers = null;
    }

    const nomeResp = user?.nome ?? 'Sistema';
    const historico = editing
      ? [...(form.historico ?? []), { data: new Date().toISOString().slice(0, 10), acao: 'Contrato actualizado', utilizador: nomeResp }]
      : [{ data: new Date().toISOString().slice(0, 10), acao: 'Contrato criado', utilizador: nomeResp }];
    const payload: Partial<Contrato> = {
      empresaId: form.empresaId,
      numero: form.numero.trim(),
      tipo: form.tipo ?? 'Outro',
      parteA: form.parteA?.trim() ?? '',
      parteB: parteBVal,
      contraparteNif: isPrestacao && pers === 'Colectivo' ? nifVal : undefined,
      contraparteColaboradorId: isPrestacao && pers === 'Singular' ? colabId ?? undefined : undefined,
      personalidadeContraparte: isPrestacao ? pers : undefined,
      objecto: form.objecto?.trim() ?? '',
      valor: Number(form.valor) || 0,
      moeda: form.moeda ?? 'Kz',
      dataAssinatura: form.dataAssinatura ?? form.dataInicio ?? '',
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      advogado: nomeResp,
      responsavelJuridico: nomeResp,
      ficheiroPdf: anexosContrato[0]?.name ?? form.ficheiroPdf,
      alertarAntesDias: form.alertarAntesDias,
      status: form.status ?? 'Activo',
      historico,
    };
    try {
      if (editing) {
        await updateContrato(editing.id, payload);
      } else {
        const created = await addContrato(payload);
        const empId = form.empresaId ?? (typeof empresaIdForNew === 'number' ? empresaIdForNew : undefined);
        const todosAnexos = [...anexosContrato, ...anexosEmpresaCliente];
        if (typeof empId === 'number' && todosAnexos.length > 0 && isSupabaseConfigured() && supabase && user?.id) {
          const pasta = await garantirPastaNumeroContratoNaGestao(supabase, empId, created.numero);
          if ('error' in pasta) {
            toast.error(`Gestão documental: ${pasta.error}`);
          } else {
            if (anexosContrato.length > 0) {
              const r1 = await uploadAnexosContratoParaGestao(
                supabase,
                empId,
                user.id,
                pasta.pastaId,
                anexosContrato,
                'Contrato:',
              );
              r1.errors.forEach(m => toast.error(m));
              if (r1.ok > 0) toast.success(`${r1.ok} ficheiro(s) do contrato registados em Jurídico / Contratos / ${created.numero}.`);
            }
            if (anexosEmpresaCliente.length > 0) {
              const r2 = await uploadAnexosContratoParaGestao(
                supabase,
                empId,
                user.id,
                pasta.pastaId,
                anexosEmpresaCliente,
                'Documentos da empresa (cliente):',
              );
              r2.errors.forEach(m => toast.error(m));
              if (r2.ok > 0) toast.success(`${r2.ok} documento(s) do cliente registados na mesma pasta.`);
            }
          }
        } else if (todosAnexos.length > 0 && !isSupabaseConfigured()) {
          toast.info('Anexos não enviados: configure o Supabase para integrar com a Gestão documental.');
        }
      }
      setDialogOpen(false);
      setEditing(null);
      setAnexosContrato([]);
      setAnexosEmpresaCliente([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    }
  };

  const saveDisabled =
    form.empresaId == null ||
    !form.numero?.trim() ||
    !form.dataInicio ||
    !form.dataFim ||
    (form.tipo === TIPO_PRESTACAO &&
      (!form.personalidadeContraparte ||
        (form.personalidadeContraparte === 'Singular' && form.contraparteColaboradorId == null) ||
        (form.personalidadeContraparte === 'Colectivo' &&
          (!form.contraparteNif?.trim() || !form.parteB?.trim())))) ||
    (form.tipo !== TIPO_PRESTACAO && !form.parteB?.trim());

  const remove = async (c: Contrato) => {
    if (!window.confirm(`Remover contrato ${c.numero}?`)) return;
    try {
      await deleteContrato(c.id);
      setPreviewOpen(false);
      setPreviewContrato(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-header">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registo, organização e acompanhamento de contratos. Controlo de prazos e alertas de vencimento.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Novo contrato
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar nº, contraparte, objecto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 w-56 max-w-full"
          />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS_CONTRATO.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS_OPCOES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentEmpresaId === 'consolidado' && (
          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {empresas.filter(e => e.activo).map(e => (
                <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nº</th>
              {currentEmpresaId === 'consolidado' && (
                <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresa</th>
              )}
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contraparte</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Objecto</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Início</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fim</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Dias</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {pagination.slice.map(c => {
              const d = diasRestantes(c.dataFim);
              return (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-5 font-mono text-xs">{c.numero}</td>
                  {currentEmpresaId === 'consolidado' && (
                    <td className="py-3 px-5 text-muted-foreground">{empresaNome(c.empresaId)}</td>
                  )}
                  <td className="py-3 px-5">{c.tipo}</td>
                  <td className="py-3 px-5 font-medium">{c.parteB}</td>
                  <td className="py-3 px-5 text-muted-foreground max-w-48 truncate" title={c.objecto}>
                    {c.objecto}
                  </td>
                  <td className="py-3 px-5 font-mono text-xs">{formatKz(c.valor)}</td>
                  <td className="py-3 px-5 text-muted-foreground">{formatDate(c.dataInicio)}</td>
                  <td className="py-3 px-5 text-muted-foreground">{formatDate(c.dataFim)}</td>
                  <td className={cn('py-3 px-5', getDiasClass(c.dataFim))}>{d < 0 ? 'Vencido' : `${d} dias`}</td>
                  <td className="py-3 px-5">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="py-3 px-5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          Ações
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[240px]">
                        <DropdownMenuItem onSelect={() => openPreview(c)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver
                        </DropdownMenuItem>
                        {canEdit && (
                          <DropdownMenuItem onSelect={() => openEdit(c)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={!c.ficheiroPdf?.trim() || !isSupabaseConfigured()}
                          onSelect={() => void openContractPdfPreview(c)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Pré-visualizar documento
                        </DropdownMenuItem>
                        {canEdit && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => remove(c)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remover
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 space-y-3">
          <p className="text-muted-foreground text-sm">Nenhum contrato encontrado.</p>
          {canEdit && (
            <Button variant="outline" onClick={openCreate}>
              Criar primeiro contrato
            </Button>
          )}
        </div>
      )}
      <DataTablePagination {...pagination.paginationProps} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar contrato' : 'Novo contrato'}</DialogTitle>
            <DialogDescription>
              O número do contrato é gerado automaticamente por empresa e ano. O responsável jurídico será o utilizador
              que regista. Em «Prestação de Serviços», indique se a contraparte é singular ou colectiva.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Parte A (empresa)</Label>
              <Select
                value={form.empresaId != null ? String(form.empresaId) : ''}
                onValueChange={v => {
                  const id = Number(v);
                  const nome = empresas.find(e => e.id === id)?.nome ?? '';
                  setForm(f => ({
                    ...f,
                    empresaId: id,
                    parteA: nome,
                    contraparteColaboradorId: undefined,
                    parteB:
                      f.tipo === TIPO_PRESTACAO && f.personalidadeContraparte === 'Singular' ? '' : f.parteB,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empresa do grupo…" />
                </SelectTrigger>
                <SelectContent>
                  {empresasParteA.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nome}
                      {!e.activo ? ' (inactiva)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Qualquer empresa cadastrada no grupo. O número do contrato segue a empresa escolhida.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nº contrato</Label>
                <Input value={form.numero} readOnly className="bg-muted/50 font-mono text-sm" title="Gerado automaticamente" />
                <p className="text-[10px] text-muted-foreground">Sequencial por empresa e ano (ex.: CONT-2026-000001).</p>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onValueChange={v =>
                    setForm(f => ({
                      ...f,
                      tipo: v,
                      ...(v !== TIPO_PRESTACAO
                        ? {
                            personalidadeContraparte: undefined,
                            contraparteNif: '',
                            contraparteColaboradorId: undefined,
                          }
                        : {}),
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTRATO.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.tipo === TIPO_PRESTACAO ? (
              <div className="space-y-4 rounded-lg border border-border/80 p-4 bg-muted/20">
                <div className="space-y-2">
                  <Label>Personalidade da contraparte</Label>
                  <Select
                    value={form.personalidadeContraparte}
                    onValueChange={v =>
                      setForm(f => {
                        if (v === 'Singular') {
                          return {
                            ...f,
                            personalidadeContraparte: v,
                            contraparteNif: '',
                            contraparteColaboradorId: f.contraparteColaboradorId,
                            parteB: f.contraparteColaboradorId != null ? f.parteB : '',
                          };
                        }
                        return {
                          ...f,
                          personalidadeContraparte: v,
                          contraparteColaboradorId: undefined,
                          contraparteNif: f.contraparteNif ?? '',
                          parteB: f.parteB,
                        };
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Singular">Singular</SelectItem>
                      <SelectItem value="Colectivo">Colectivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.personalidadeContraparte === 'Singular' && (
                  <div className="space-y-2">
                    <Label>Colaborador (contraparte)</Label>
                    <Popover open={colabComboOpen} onOpenChange={setColabComboOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal" role="combobox">
                          {colaboradorSeleccionado ? colaboradorSeleccionado.nome : 'Pesquisar colaborador…'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Nome…" />
                          <CommandList>
                            <CommandEmpty>Nenhum colaborador nesta empresa.</CommandEmpty>
                            <CommandGroup>
                              {colaboradoresEmpresa.map(c => (
                                <CommandItem
                                  key={c.id}
                                  value={`${c.nome} ${c.departamento} ${c.cargo}`}
                                  onSelect={() => {
                                    setForm(f => ({
                                      ...f,
                                      contraparteColaboradorId: c.id,
                                      parteB: c.nome,
                                    }));
                                    setColabComboOpen(false);
                                  }}
                                >
                                  <span className="font-medium">{c.nome}</span>
                                  <span className="text-muted-foreground text-xs ml-2">{c.cargo}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
                {form.personalidadeContraparte === 'Colectivo' && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>NIF da empresa (cliente)</Label>
                      <div className="flex gap-2">
                        <Input
                          className="flex-1 min-w-0"
                          value={form.contraparteNif ?? ''}
                          onChange={e => setForm(f => ({ ...f, contraparteNif: e.target.value }))}
                          placeholder="999999999"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          disabled={gueNifLookupLoading || !(form.contraparteNif ?? '').replace(/\D/g, '')}
                          title="Consultar denominação no portal GUE (gue.gov.ao)"
                          onClick={async () => {
                            const nif = form.contraparteNif?.trim() ?? '';
                            if (!nif.replace(/\D/g, '')) {
                              toast.error('Preencha o NIF antes de pesquisar.');
                              return;
                            }
                            if (!isSupabaseConfigured()) {
                              toast.error('Supabase não configurado; não é possível consultar o GUE.');
                              return;
                            }
                            setGueNifLookupLoading(true);
                            try {
                              const r = await fetchNomeEmpresaPorNifGue(supabase, nif);
                              if (r.nome) {
                                setForm(f => ({ ...f, parteB: r.nome! }));
                                toast.success('Nome da empresa preenchido a partir do GUE.');
                              } else {
                                toast.error(r.error ?? 'Não foi possível obter o nome.');
                              }
                            } finally {
                              setGueNifLookupLoading(false);
                            }
                          }}
                        >
                          {gueNifLookupLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        A consulta vai a gue.gov.ao via função Supabase (requer deploy de{' '}
                        <code className="text-[10px]">gue-publicacao-nome</code>).
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome da empresa</Label>
                      <Input
                        value={form.parteB ?? ''}
                        onChange={e => setForm(f => ({ ...f, parteB: e.target.value }))}
                        placeholder="Denominação social" disabled
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Parte B (contraparte)</Label>
                <Input value={form.parteB} onChange={e => setForm(f => ({ ...f, parteB: e.target.value }))} placeholder="Nome da contraparte" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Objecto do contrato</Label>
              <Textarea value={form.objecto} onChange={e => setForm(f => ({ ...f, objecto: e.target.value }))} rows={2} placeholder="Descrição do objecto" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" value={form.valor || ''} onChange={e => setForm(f => ({ ...f, valor: Number(e.target.value) || 0 }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select value={form.moeda} onValueChange={v => setForm(f => ({ ...f, moeda: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kz">Kz</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data assinatura</Label>
                <Input type="date" value={form.dataAssinatura || ''} onChange={e => setForm(f => ({ ...f, dataAssinatura: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Data início</Label>
                <Input type="date" value={form.dataInicio || ''} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Data fim</Label>
                <Input type="date" value={form.dataFim || ''} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <p className="text-sm rounded-md border border-border/80 bg-muted/40 px-3 py-2 font-medium">{user?.nome ?? '—'}</p>
              <p className="text-[10px] text-muted-foreground">Preenchido automaticamente com o utilizador que regista.</p>
            </div>
            <div className="space-y-2">
              <Label>Alertar vencimento (dias antes)</Label>
              <Input type="number" min={0} value={form.alertarAntesDias ?? ''} onChange={e => setForm(f => ({ ...f, alertarAntesDias: Number(e.target.value) || undefined }))} placeholder="90" className="max-w-xs" />
            </div>
            {!editing && (
              <div className="space-y-4 rounded-lg border border-border/80 p-4">
                <p className="text-sm font-medium">Anexos (envio para Gestão documental)</p>
                <p className="text-xs text-muted-foreground">
                  Os ficheiros são gravados em <strong>Jurídico → Contratos → [número do contrato]</strong> após criar o
                  contrato.
                </p>
                <FileDropZone label="Contrato (documento principal)" files={anexosContrato} onChange={setAnexosContrato} />
                {form.tipo === TIPO_PRESTACAO && form.personalidadeContraparte === 'Colectivo' && (
                  <FileDropZone
                    label="Documentos da empresa (cliente)"
                    files={anexosEmpresaCliente}
                    onChange={setAnexosEmpresaCliente}
                  />
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as StatusContrato }))}>
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPCOES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saveDisabled}>
              {editing ? 'Guardar' : 'Criar contrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewOpen}
        onOpenChange={open => {
          setPreviewOpen(open);
          if (!open) setPreviewInlinePdfUrl(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewContrato?.numero}</DialogTitle>
            <DialogDescription>Pré-visualização do contrato</DialogDescription>
          </DialogHeader>
          {previewContrato &&
            (previewInlinePdfUrl ? (
              <div className="w-full h-[70vh] min-h-[320px]">
                <iframe
                  src={previewInlinePdfUrl}
                  title="Documento do contrato"
                  className="w-full h-full border-0 rounded-md"
                />
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="outline" onClick={() => setPreviewInlinePdfUrl(null)}>
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Empresa:</span> {empresaNome(previewContrato.empresaId)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tipo:</span> {previewContrato.tipo}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Parte A:</span> {previewContrato.parteA}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Parte B:</span> {previewContrato.parteB}
                  </div>
                  {previewContrato.personalidadeContraparte && (
                    <div>
                      <span className="text-muted-foreground">Personalidade:</span>{' '}
                      {previewContrato.personalidadeContraparte}
                    </div>
                  )}
                  {previewContrato.contraparteNif && (
                    <div>
                      <span className="text-muted-foreground">NIF contraparte:</span> {previewContrato.contraparteNif}
                    </div>
                  )}
                  {previewContrato.contraparteColaboradorId != null && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Colaborador (contraparte):</span>{' '}
                      {colaboradoresTodos.find(x => x.id === previewContrato.contraparteColaboradorId)?.nome ??
                        `ID ${previewContrato.contraparteColaboradorId}`}
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Objecto:</span> {previewContrato.objecto}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor:</span> {formatKz(previewContrato.valor)}{' '}
                    {previewContrato.moeda}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Responsável:</span>{' '}
                    {previewContrato.responsavelJuridico || previewContrato.advogado}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Início:</span> {formatDate(previewContrato.dataInicio)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fim:</span> {formatDate(previewContrato.dataFim)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span> <StatusBadge status={previewContrato.status} />
                  </div>
                </div>
                {previewContrato.ficheiroPdf?.trim() && (
                  <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm">
                    <p className="text-muted-foreground text-xs mb-1">Documento</p>
                    <button
                      type="button"
                      className="text-primary underline hover:no-underline"
                      disabled={!isSupabaseConfigured()}
                      onClick={() => {
                        void (async () => {
                          if (!supabase) {
                            toast.error('Supabase não configurado.');
                            return;
                          }
                          const url = await resolveContratoDocumentoPublicUrl(supabase, previewContrato);
                          if (url) setPreviewInlinePdfUrl(url);
                          else toast.error('Não foi possível pré-visualizar o documento.');
                        })();
                      }}
                    >
                      {previewContrato.ficheiroPdf?.startsWith('http')
                        ? previewContrato.ficheiroPdf.split('/').pop()?.split('?')[0] || previewContrato.ficheiroPdf
                        : previewContrato.ficheiroPdf}
                    </button>
                  </div>
                )}
                {previewContrato.historico && previewContrato.historico.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Histórico</Label>
                    <ul className="border rounded-md divide-y divide-border/80">
                      {[...previewContrato.historico].reverse().map((h, i) => (
                        <li key={i} className="p-3 text-sm flex justify-between gap-2">
                          <span>{h.acao}</span>
                          <span className="text-muted-foreground shrink-0">
                            {formatDate(h.data)} — {h.utilizador}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <DialogFooter className="gap-2 sm:gap-0">
                  {canEdit && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const cur = previewContrato;
                        setPreviewOpen(false);
                        openEdit(cur);
                      }}
                    >
                      Editar
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={!previewContrato.ficheiroPdf?.trim() || !isSupabaseConfigured()}
                    onClick={() => void openContractPdfPreview(previewContrato)}
                  >
                    Abrir documento em ecrã inteiro
                  </Button>
                  <Button onClick={() => setPreviewOpen(false)}>Fechar</Button>
                </DialogFooter>
              </div>
            ))}
        </DialogContent>
      </Dialog>

      <Dialog
        open={contractPdfPreviewOpen}
        onOpenChange={open => {
          setContractPdfPreviewOpen(open);
          if (!open) setContractPdfPreviewUrl(null);
        }}
      >
        <DialogContent className="max-w-[90vw] w-full h-[95vh] p-0">
          {contractPdfPreviewUrl ? (
            <div className="w-full h-full min-h-[80vh]">
              <iframe
                src={contractPdfPreviewUrl}
                title="Pré-visualização do documento"
                className="w-full h-full border-0 rounded-md"
              />
            </div>
          ) : (
            <DialogDescription className="p-6">A carregar pré-visualização…</DialogDescription>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileDropZone({
  label,
  files,
  onChange,
  disabled,
}: {
  label: string;
  files: File[];
  onChange: (f: File[]) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const add = (list: FileList | File[]) => {
    onChange([...files, ...Array.from(list)]);
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        role="presentation"
        className={cn(
          'rounded-lg border border-dashed border-border/80 p-4 text-center text-sm transition-colors',
          disabled ? 'opacity-50 pointer-events-none' : 'hover:bg-muted/30 cursor-pointer',
        )}
        onDragOver={e => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          if (disabled) return;
          if (e.dataTransfer.files?.length) add(e.dataTransfer.files);
        }}
        onClick={() => {
          if (!disabled) document.getElementById(inputId)?.click();
        }}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">Arraste ficheiros aqui ou clique para seleccionar</p>
        <input
          id={inputId}
          type="file"
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files?.length) add(e.target.files);
            e.target.value = '';
          }}
          onClick={e => e.stopPropagation()}
        />
      </div>
      {files.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded border border-border/60 px-2 py-1">
              <span className="truncate">{f.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1 shrink-0"
                onClick={ev => {
                  ev.stopPropagation();
                  onChange(files.filter((_, j) => j !== i));
                }}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
