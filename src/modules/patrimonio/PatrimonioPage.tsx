import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth, hasModuleAccess } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTenant } from '@/context/TenantContext';
import type {
  PatrimonioActivo,
  PatrimonioCategoriaCfg,
  PatrimonioComputadorSO,
  PatrimonioEstado,
  PatrimonioMovimentoTipo,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Package, History, Plus, ArrowRightLeft, Users, UserX, Building2, Check, ChevronsUpDown } from 'lucide-react';

const TRI_NA = '__na__';

const ESTADO_LABEL: Record<PatrimonioEstado, string> = {
  disponivel: 'Disponível',
  em_uso: 'Em uso',
  inactivo: 'Inactivo',
};

const COMPUTADOR_SO_OPTIONS: { value: PatrimonioComputadorSO; label: string }[] = [
  { value: 'windows_10', label: 'Windows 10' },
  { value: 'windows_11', label: 'Windows 11' },
  { value: 'mac_os', label: 'Mac OS' },
  { value: 'linux', label: 'Linux' },
];

function parseOptionalNonNegIntGb(raw: string): number | null | 'invalid' {
  const t = raw.trim();
  if (t === '') return null;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0) return 'invalid';
  return n;
}

function mesActualAnoMes(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function nextCodigoPatrimonio(activos: PatrimonioActivo[], empresaId: number): string {
  let max = 0;
  for (const a of activos) {
    if (a.empresaId !== empresaId) continue;
    const m = /^PAT-(\d+)$/i.exec(String(a.codigo).trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PAT-${String(max + 1).padStart(4, '0')}`;
}

function triToString(v: boolean | null | undefined): string {
  if (v === true) return 'sim';
  if (v === false) return 'nao';
  return TRI_NA;
}

function triFromString(s: string): boolean | null {
  if (s === 'sim') return true;
  if (s === 'nao') return false;
  return null;
}

function slugPatrimonioCategoria(nome: string): string {
  const base = nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return base || 'categoria';
}

export default function PatrimonioPage() {
  const { user } = useAuth();
  const { currentEmpresaId } = useTenant();
  const empresaIdNum = currentEmpresaId === 'consolidado' ? null : currentEmpresaId;

  const {
    empresas,
    colaboradores,
    patrimonioActivos,
    patrimonioMovimentos,
    patrimonioVerificacoes,
    patrimonioVerificacaoItens,
    patrimonioCategorias,
    setPatrimonioCategorias,
    patrimonioSubcategorias,
    addPatrimonioCategoria,
    updatePatrimonioCategoria,
    deletePatrimonioCategoria,
    addPatrimonioSubcategoria,
    deletePatrimonioSubcategoria,
    addPatrimonioActivo,
    updatePatrimonioActivo,
    deletePatrimonioActivo,
    addPatrimonioMovimento,
    addPatrimonioVerificacao,
    updatePatrimonioVerificacao,
    addPatrimonioVerificacaoItem,
    updatePatrimonioVerificacaoItem,
  } = useData();

  const canUse = user && hasModuleAccess(user, 'patrimonio');

  const [tab, setTab] = useState<'activos' | 'categorias' | 'verificacao'>('activos');
  const [dialogNovo, setDialogNovo] = useState(false);
  const [dialogHist, setDialogHist] = useState<PatrimonioActivo | null>(null);
  const [dialogMov, setDialogMov] = useState<PatrimonioActivo | null>(null);

  const [formNovo, setFormNovo] = useState({
    nome: '',
    quantidade: 1,
    categoriaId: '' as string | number,
    subcategoriaId: '' as string | number,
    viaturaMarca: '',
    viaturaModelo: '',
    viaturaCor: '',
    viaturaMatricula: '',
    computadorMarca: '',
    computadorModelo: '',
    computadorSistemaOperacional: '' as '' | PatrimonioComputadorSO,
    computadorProcessador: '',
    computadorArmazenamentoGb: '',
    computadorRamGb: '',
    empresaId: '' as string | number,
    responsavelColaboradorId: '' as string | number,
    estado: 'disponivel' as PatrimonioEstado,
  });

  const [movTipo, setMovTipo] = useState<'atribuir' | 'remover' | 'transferir' | 'estado'>('atribuir');
  const [movColabId, setMovColabId] = useState<string>('');
  const [movEmpresaId, setMovEmpresaId] = useState<string>('');
  const [movEstado, setMovEstado] = useState<PatrimonioEstado>('disponivel');

  const [mesVerif, setMesVerif] = useState(mesActualAnoMes());
  const [novoResponsavelOpen, setNovoResponsavelOpen] = useState(false);
  const [novaCatNome, setNovaCatNome] = useState('');
  const [subcatDraft, setSubcatDraft] = useState<Record<number, string>>({});

  const nomeEmpresa = useCallback((id: number) => empresas.find(e => e.id === id)?.nome ?? `Empresa ${id}`, [empresas]);
  const nomeColab = useCallback(
    (id: number | null | undefined) => {
      if (id == null) return '—';
      return colaboradores.find(c => c.id === id)?.nome ?? `Colaborador ${id}`;
    },
    [colaboradores],
  );

  const colaboradoresNovoActivoEmpresa = useMemo(() => {
    const eid = typeof formNovo.empresaId === 'number' ? formNovo.empresaId : Number(formNovo.empresaId);
    if (!eid) return [];
    return colaboradores.filter(c => c.empresaId === eid);
  }, [colaboradores, formNovo.empresaId]);

  const nomeCategoria = useCallback(
    (categoriaId: number | null | undefined) => {
      if (categoriaId == null) return '—';
      return patrimonioCategorias.find(c => c.id === categoriaId)?.nome ?? `Categoria ${categoriaId}`;
    },
    [patrimonioCategorias],
  );

  const nomeSubcategoria = useCallback(
    (subId: number | null | undefined) => {
      if (subId == null) return '';
      return patrimonioSubcategorias.find(s => s.id === subId)?.nome ?? '';
    },
    [patrimonioSubcategorias],
  );

  const categoriasFormEmpresa = useMemo(() => {
    const eid = typeof formNovo.empresaId === 'number' ? formNovo.empresaId : Number(formNovo.empresaId);
    if (!eid) return [];
    return patrimonioCategorias.filter(c => c.empresaId === eid).sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  }, [patrimonioCategorias, formNovo.empresaId]);

  const categoriaIdFormNum = useMemo(() => {
    const raw = formNovo.categoriaId;
    if (raw === '' || raw === '__none__') return 0;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [formNovo.categoriaId]);

  const categoriaActivaForm = useMemo(
    () => patrimonioCategorias.find(c => Number(c.id) === categoriaIdFormNum),
    [patrimonioCategorias, categoriaIdFormNum],
  );

  const subcategoriasForm = useMemo(() => {
    if (!categoriaIdFormNum) return [];
    return patrimonioSubcategorias
      .filter(s => Number(s.categoriaId) === categoriaIdFormNum)
      .sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  }, [patrimonioSubcategorias, categoriaIdFormNum]);

  const categoriasTabEmpresa = useMemo(() => {
    if (!empresaIdNum) return [];
    return patrimonioCategorias.filter(c => c.empresaId === empresaIdNum).sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  }, [patrimonioCategorias, empresaIdNum]);

  const movsPorActivo = useCallback(
    (activoId: number) =>
      [...patrimonioMovimentos].filter(m => m.activoId === activoId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [patrimonioMovimentos],
  );

  const logMov = useCallback(
    async (
      activo: PatrimonioActivo,
      tipo: PatrimonioMovimentoTipo,
      resumo: string,
      detalhe: Record<string, unknown> = {},
    ) => {
      await addPatrimonioMovimento({
        activoId: activo.id,
        empresaId: activo.empresaId,
        tipo,
        resumo,
        detalhe,
        actorPerfilId: user?.id ?? null,
        actorNome: user?.nome ?? null,
      });
    },
    [addPatrimonioMovimento, user?.id, user?.nome],
  );

  const abrirNovo = () => {
    if (!empresaIdNum) {
      toast.error('Seleccione uma empresa (não use «consolidado») para criar activos.');
      return;
    }
    setFormNovo({
      nome: '',
      quantidade: 1,
      categoriaId: '',
      subcategoriaId: '',
      viaturaMarca: '',
      viaturaModelo: '',
      viaturaCor: '',
      viaturaMatricula: '',
      computadorMarca: '',
      computadorModelo: '',
      computadorSistemaOperacional: '',
      computadorProcessador: '',
      computadorArmazenamentoGb: '',
      computadorRamGb: '',
      empresaId: empresaIdNum,
      responsavelColaboradorId: '',
      estado: 'disponivel',
    });
    setDialogNovo(true);
  };

  const guardarNovo = async () => {
    if (!user) return;
    const eid = typeof formNovo.empresaId === 'number' ? formNovo.empresaId : Number(formNovo.empresaId);
    if (!eid) {
      toast.error('Empresa obrigatória.');
      return;
    }
    const nome = formNovo.nome.trim();
    if (!nome) {
      toast.error('Indique o nome do activo.');
      return;
    }
    const qtd = Number(formNovo.quantidade);
    if (!Number.isFinite(qtd) || qtd < 1 || !Number.isInteger(qtd)) {
      toast.error('Indique uma quantidade inteira maior ou igual a 1.');
      return;
    }
    const resp =
      formNovo.responsavelColaboradorId === '' || formNovo.responsavelColaboradorId === '__none__'
        ? null
        : Number(formNovo.responsavelColaboradorId);
    const codigo = nextCodigoPatrimonio(patrimonioActivos, eid);
    const estado: PatrimonioEstado = resp != null ? 'em_uso' : formNovo.estado;
    const catId = typeof formNovo.categoriaId === 'number' ? formNovo.categoriaId : Number(formNovo.categoriaId);
    if (!catId) {
      toast.error('Seleccione uma categoria (configure categorias no separador homónimo, se necessário).');
      return;
    }
    const catRow = patrimonioCategorias.find(c => Number(c.id) === catId);
    const vi = catRow?.comportamentoViatura ?? false;
    const comp = catRow?.comportamentoComputador ?? false;
    let computadorArmazenamentoGb: number | null = null;
    let computadorRamGb: number | null = null;
    if (comp) {
      const pa = parseOptionalNonNegIntGb(formNovo.computadorArmazenamentoGb);
      const pr = parseOptionalNonNegIntGb(formNovo.computadorRamGb);
      if (pa === 'invalid' || pr === 'invalid') {
        toast.error('Armazenamento e RAM devem ser números inteiros ≥ 0 ou vazios.');
        return;
      }
      computadorArmazenamentoGb = pa;
      computadorRamGb = pr;
    }
    const soVals: PatrimonioComputadorSO[] = ['windows_10', 'windows_11', 'mac_os', 'linux'];
    const soRaw = formNovo.computadorSistemaOperacional;
    const computadorSistemaOperacional: PatrimonioComputadorSO | null =
      comp && soRaw && soVals.includes(soRaw as PatrimonioComputadorSO) ? (soRaw as PatrimonioComputadorSO) : null;
    const subIdRaw = formNovo.subcategoriaId;
    let subcategoriaId: number | null =
      subIdRaw === '' || subIdRaw === '__none__' ? null : typeof subIdRaw === 'number' ? subIdRaw : Number(subIdRaw);
    if (subcategoriaId != null) {
      const permitida = patrimonioSubcategorias.some(
        s => Number(s.id) === subcategoriaId && Number(s.categoriaId) === catId,
      );
      if (!permitida) subcategoriaId = null;
    }
    try {
      const row = await addPatrimonioActivo({
        empresaId: eid,
        codigo,
        nome,
        quantidade: qtd,
        categoriaId: catId,
        subcategoriaId,
        viaturaMarca: vi ? (formNovo.viaturaMarca.trim() || null) : null,
        viaturaModelo: vi ? (formNovo.viaturaModelo.trim() || null) : null,
        viaturaCor: vi ? (formNovo.viaturaCor.trim() || null) : null,
        viaturaMatricula: vi ? (formNovo.viaturaMatricula.trim() || null) : null,
        computadorMarca: comp ? (formNovo.computadorMarca.trim() || null) : null,
        computadorModelo: comp ? (formNovo.computadorModelo.trim() || null) : null,
        computadorSistemaOperacional: comp ? computadorSistemaOperacional : null,
        computadorProcessador: comp ? (formNovo.computadorProcessador.trim() || null) : null,
        computadorArmazenamentoGb: comp ? computadorArmazenamentoGb : null,
        computadorRamGb: comp ? computadorRamGb : null,
        responsavelColaboradorId: resp,
        estado,
      });
      await logMov(row, 'criacao', `Activos ${codigo} criado: ${nome}.`, {
        codigo,
        quantidade: qtd,
        categoriaId: catId,
        subcategoriaId,
        responsavelColaboradorId: resp,
        estado,
      });
      if (resp != null) {
        await logMov(row, 'atribuir_colaborador', `${codigo} atribuído a ${nomeColab(resp)}.`, {
          colaboradorId: resp,
        });
      }
      toast.success('Activo registado.');
      setDialogNovo(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar.');
    }
  };

  const aplicarMovimentacao = async () => {
    const a = dialogMov;
    if (!a || !user) return;
    try {
      if (movTipo === 'remover') {
        const antes = a.responsavelColaboradorId;
        await updatePatrimonioActivo(a.id, { responsavelColaboradorId: null, estado: 'disponivel' });
        await logMov({ ...a, responsavelColaboradorId: null, estado: 'disponivel' }, 'remover_colaborador', `${a.codigo}: removido responsável (${nomeColab(antes)}).`, {
          deColaboradorId: antes,
        });
        toast.success('Responsável removido.');
      } else if (movTipo === 'atribuir') {
        const cid = Number(movColabId);
        if (!cid) {
          toast.error('Seleccione o colaborador.');
          return;
        }
        const antes = a.responsavelColaboradorId;
        await updatePatrimonioActivo(a.id, { responsavelColaboradorId: cid, estado: 'em_uso' });
        const tipo: PatrimonioMovimentoTipo = antes == null ? 'atribuir_colaborador' : 'trocar_responsavel';
        const resumo =
          tipo === 'atribuir_colaborador'
            ? `${a.codigo} atribuído a ${nomeColab(cid)}.`
            : `${a.codigo}: responsável de ${nomeColab(antes)} → ${nomeColab(cid)}.`;
        await logMov({ ...a, responsavelColaboradorId: cid, estado: 'em_uso' }, tipo, resumo, {
          deColaboradorId: antes,
          paraColaboradorId: cid,
        });
        toast.success('Responsável actualizado.');
      } else if (movTipo === 'transferir') {
        const ne = Number(movEmpresaId);
        if (!ne || ne === a.empresaId) {
          toast.error('Seleccione outra empresa.');
          return;
        }
        const slugOrig = patrimonioCategorias.find(c => c.id === a.categoriaId)?.slug;
        const catsDestino = patrimonioCategorias
          .filter(c => c.empresaId === ne)
          .sort((x, y) => x.ordem - y.ordem || x.id - y.id);
        const novoCategoriaId =
          (slugOrig ? catsDestino.find(c => c.slug === slugOrig)?.id : undefined) ??
          catsDestino.find(c => c.slug === 'equipamento')?.id ??
          catsDestino[0]?.id;
        if (novoCategoriaId == null) {
          toast.error('A empresa destino não tem categorias de património. Abra o separador Categorias e crie-as manualmente.');
          return;
        }
        const de = nomeEmpresa(a.empresaId);
        const para = nomeEmpresa(ne);
        await updatePatrimonioActivo(a.id, {
          empresaId: ne,
          responsavelColaboradorId: null,
          estado: 'disponivel',
          categoriaId: novoCategoriaId,
          subcategoriaId: null,
        });
        await logMov(
          { ...a, empresaId: ne, categoriaId: novoCategoriaId, subcategoriaId: null },
          'transferir_empresa',
          `${a.codigo} transferido de ${de} → ${para}.`,
          {
            empresaAnteriorId: a.empresaId,
            empresaNovaId: ne,
            categoriaIdAnterior: a.categoriaId,
            categoriaIdNova: novoCategoriaId,
          },
        );
        toast.success('Transferência registada.');
      } else if (movTipo === 'estado') {
        const ant = a.estado;
        await updatePatrimonioActivo(a.id, { estado: movEstado });
        await logMov({ ...a, estado: movEstado }, 'alterar_estado', `${a.codigo}: estado ${ESTADO_LABEL[ant]} → ${ESTADO_LABEL[movEstado]}.`, {
          estadoAnterior: ant,
          estadoNovo: movEstado,
        });
        toast.success('Estado actualizado.');
      }
      setDialogMov(null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Erro.');
    }
  };

  const criarOuAbrirVerificacao = async () => {
    if (!empresaIdNum || !user) {
      toast.error('Seleccione uma empresa.');
      return;
    }
    const anoMes = mesVerif.trim();
    if (!/^\d{4}-\d{2}$/.test(anoMes)) {
      toast.error('Use o formato AAAA-MM.');
      return;
    }
    const existente = patrimonioVerificacoes.find(v => v.empresaId === empresaIdNum && v.anoMes === anoMes);
    try {
      if (existente) {
        toast.message('Verificação já existe para este mês.');
        return;
      }
      const cab = await addPatrimonioVerificacao({
        empresaId: empresaIdNum,
        anoMes,
        titulo: `Verificação ${anoMes}`,
        fechada: false,
        createdBy: user.id,
      });
      const activosE = patrimonioActivos.filter(x => x.empresaId === empresaIdNum);
      for (const ac of activosE) {
        await addPatrimonioVerificacaoItem({
          verificacaoId: cab.id,
          activoId: ac.id,
          existe: null,
          localCorrecto: null,
          responsavelCorrecto: null,
          observacoes: '',
        });
      }
      toast.success('Verificação criada. Preencha as linhas abaixo.');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Erro ao criar verificação.');
    }
  };

  const verificacaoActual = useMemo(
    () => patrimonioVerificacoes.find(v => empresaIdNum != null && v.empresaId === empresaIdNum && v.anoMes === mesVerif.trim()) ?? null,
    [patrimonioVerificacoes, empresaIdNum, mesVerif],
  );

  const itensVerificacao = useMemo(() => {
    if (!verificacaoActual) return [];
    return patrimonioVerificacaoItens.filter(i => i.verificacaoId === verificacaoActual.id);
  }, [patrimonioVerificacaoItens, verificacaoActual]);

  const fecharVerificacao = async () => {
    if (!verificacaoActual) return;
    try {
      await updatePatrimonioVerificacao(verificacaoActual.id, { fechada: true });
      toast.success('Verificação fechada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro.');
    }
  };

  const actualizarItemVerif = async (
    itemId: number,
    patch: Partial<{ existe: boolean | null; localCorrecto: boolean | null; responsavelCorrecto: boolean | null; observacoes: string }>,
  ) => {
    if (!verificacaoActual || verificacaoActual.fechada) {
      toast.error('Verificação fechada ou inexistente.');
      return;
    }
    try {
      await updatePatrimonioVerificacaoItem(itemId, patch);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar.');
    }
  };

  const guardarNovaCategoria = async () => {
    if (!empresaIdNum) return;
    const nome = novaCatNome.trim();
    if (!nome) {
      toast.error('Indique o nome da categoria.');
      return;
    }
    const base = slugPatrimonioCategoria(nome);
    const existentes = patrimonioCategorias.filter(c => c.empresaId === empresaIdNum);
    const taken = new Set(existentes.map(c => c.slug));
    let slug = base;
    let n = 2;
    while (taken.has(slug)) {
      slug = `${base}_${n}`;
      n += 1;
    }
    const maxOrdem = existentes.reduce((m, c) => Math.max(m, c.ordem), -1);
    try {
      await addPatrimonioCategoria({
        empresaId: empresaIdNum,
        nome,
        slug,
        ordem: maxOrdem + 1,
        comportamentoViatura: false,
        comportamentoComputador: false,
      });
      setNovaCatNome('');
      toast.success('Categoria adicionada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro.');
    }
  };

  const guardarSubcategoria = async (categoriaId: number) => {
    const nome = (subcatDraft[categoriaId] ?? '').trim();
    if (!nome) {
      toast.error('Indique o nome da subcategoria.');
      return;
    }
    const irmaos = patrimonioSubcategorias.filter(s => s.categoriaId === categoriaId);
    const maxOrdem = irmaos.reduce((m, s) => Math.max(m, s.ordem), -1);
    try {
      await addPatrimonioSubcategoria({ categoriaId, nome, ordem: maxOrdem + 1 });
      setSubcatDraft(d => ({ ...d, [categoriaId]: '' }));
      toast.success('Subcategoria adicionada.');
    } catch (e) {
      const raw =
        e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : '';
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
      if (code === '23505' || /duplicate key|unique constraint/i.test(raw)) {
        toast.error('Já existe uma subcategoria com esse nome nesta categoria.');
        return;
      }
      if (/row-level security|violates row-level security/i.test(raw)) {
        toast.error('Sem permissão para adicionar subcategorias nesta empresa (perfil ou empresa incorrectos).');
        return;
      }
      toast.error(raw || (e instanceof Error ? e.message : 'Erro ao adicionar subcategoria.'));
    }
  };

  const apagarCategoria = async (c: PatrimonioCategoriaCfg) => {
    const emUso = patrimonioActivos.some(a => a.categoriaId === c.id);
    if (emUso) {
      toast.error('Não é possível apagar: existem activos com esta categoria.');
      return;
    }
    if (!window.confirm(`Remover a categoria «${c.nome}» e as suas subcategorias?`)) return;
    try {
      await deletePatrimonioCategoria(c.id);
      toast.success('Categoria removida.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro.');
    }
  };

  const apagarSubcategoria = async (subId: number) => {
    const emUso = patrimonioActivos.some(a => a.subcategoriaId === subId);
    if (emUso) {
      toast.error('Não é possível apagar: existe um activo com esta subcategoria.');
      return;
    }
    if (!window.confirm('Remover esta subcategoria?')) return;
    try {
      await deletePatrimonioSubcategoria(subId);
      toast.success('Subcategoria removida.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro.');
    }
  };

  if (!canUse) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-6 text-sm text-muted-foreground">
        Sem permissão para o módulo Património.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-1 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" aria-hidden />
            Património
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Localização (empresa), responsável opcional e histórico de movimentações. Verificação mensal por activo.
          </p>
        </div>
        <Button onClick={abrirNovo} className="shrink-0 gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Novo activo
        </Button>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as 'activos' | 'categorias' | 'verificacao')}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="verificacao">Verificação mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="activos" className="mt-4 space-y-4">
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right w-[100px]">Qtd.</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acções</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patrimonioActivos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                      Sem activos nesta empresa. Crie o primeiro com «Novo activo».
                    </TableCell>
                  </TableRow>
                ) : (
                  patrimonioActivos.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.codigo}</TableCell>
                      <TableCell className="font-medium">{a.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.quantidade ?? 1}</TableCell>
                      <TableCell>
                        <div>{nomeCategoria(a.categoriaId)}</div>
                        {a.subcategoriaId != null ? (
                          <div className="text-xs text-muted-foreground">{nomeSubcategoria(a.subcategoriaId)}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>{nomeEmpresa(a.empresaId)}</TableCell>
                      <TableCell>{nomeColab(a.responsavelColaboradorId)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ESTADO_LABEL[a.estado]}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => setDialogHist(a)}>
                          <History className="h-3.5 w-3.5 mr-1" />
                          Histórico
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setMovTipo('atribuir');
                            setMovColabId(a.responsavelColaboradorId != null ? String(a.responsavelColaboradorId) : '');
                            setMovEmpresaId('');
                            setMovEstado(a.estado);
                            setDialogMov(a);
                          }}
                        >
                          Movimentar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="categorias" className="mt-4 space-y-4">
          {!empresaIdNum ? (
            <p className="text-sm text-muted-foreground">
              Seleccione uma empresa no selector global (não use «consolidado») para gerir categorias e subcategorias.
            </p>
          ) : (
            <div className="space-y-6 rounded-xl border border-border/80 bg-card p-4">
              <p className="text-sm text-muted-foreground max-w-xl">
                Cada empresa tem o seu próprio catálogo. Não existem categorias por padrão: crie as categorias e
                subcategorias necessárias antes de registar activos.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="space-y-2 flex-1">
                  <Label>Nova categoria</Label>
                  <Input
                    value={novaCatNome}
                    onChange={e => setNovaCatNome(e.target.value)}
                    placeholder="ex.: Electrónica"
                    className="max-w-md"
                  />
                </div>
                <Button type="button" onClick={() => void guardarNovaCategoria()}>
                  Adicionar categoria
                </Button>
              </div>
              <div className="space-y-4">
                {categoriasTabEmpresa.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem categorias. Adicione a primeira manualmente.</p>
                ) : (
                  categoriasTabEmpresa.map(cat => {
                    const subs = patrimonioSubcategorias
                      .filter(s => s.categoriaId === cat.id)
                      .sort((a, b) => a.ordem - b.ordem || a.id - b.id);
                    return (
                      <div key={cat.id} className="rounded-lg border border-border/70 p-4 space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                            <Input
                              key={`${cat.id}-${cat.nome}`}
                              defaultValue={cat.nome}
                              className="max-w-xs font-medium"
                              onBlur={e => {
                                const next = e.target.value.trim();
                                if (!next || next === cat.nome) return;
                                void updatePatrimonioCategoria(cat.id, { nome: next }).catch(err =>
                                  toast.error(err instanceof Error ? err.message : 'Erro ao actualizar.'),
                                );
                              }}
                            />
                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                              <div className="flex items-center gap-2 text-sm">
                                <Switch
                                  checked={cat.comportamentoViatura}
                                  onCheckedChange={v =>
                                    void updatePatrimonioCategoria(cat.id, { comportamentoViatura: v }).catch(err =>
                                      toast.error(err instanceof Error ? err.message : 'Erro.'),
                                    )
                                  }
                                  id={`viatura-${cat.id}`}
                                />
                                <Label htmlFor={`viatura-${cat.id}`} className="cursor-pointer font-normal">
                                  Dados de viatura
                                </Label>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Switch
                                  checked={cat.comportamentoComputador}
                                  onCheckedChange={v =>
                                    void updatePatrimonioCategoria(cat.id, { comportamentoComputador: v }).catch(err =>
                                      toast.error(err instanceof Error ? err.message : 'Erro.'),
                                    )
                                  }
                                  id={`pc-${cat.id}`}
                                />
                                <Label htmlFor={`pc-${cat.id}`} className="cursor-pointer font-normal">
                                  Dados de computador
                                </Label>
                              </div>
                            </div>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => void apagarCategoria(cat)}>
                            Apagar categoria
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">slug: {cat.slug}</p>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Subcategorias</Label>
                          <ul className="space-y-1 text-sm">
                            {subs.length === 0 ? (
                              <li className="text-muted-foreground">Nenhuma.</li>
                            ) : (
                              subs.map(s => (
                                <li key={s.id} className="flex items-center justify-between gap-2 rounded bg-muted/30 px-2 py-1">
                                  <span>{s.nome}</span>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => void apagarSubcategoria(s.id)}>
                                    Remover
                                  </Button>
                                </li>
                              ))
                            )}
                          </ul>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              value={subcatDraft[cat.id] ?? ''}
                              onChange={e => setSubcatDraft(d => ({ ...d, [cat.id]: e.target.value }))}
                              placeholder="Nome da subcategoria"
                              className="max-w-sm"
                            />
                            <Button type="button" variant="secondary" size="sm" onClick={() => void guardarSubcategoria(cat.id)}>
                              Adicionar subcategoria
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="verificacao" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label>Mês (AAAA-MM)</Label>
              <Input value={mesVerif} onChange={e => setMesVerif(e.target.value)} placeholder="2026-04" className="max-w-xs" />
            </div>
            <Button type="button" variant="secondary" onClick={() => void criarOuAbrirVerificacao()} disabled={!empresaIdNum}>
              Criar verificação deste mês
            </Button>
            {verificacaoActual && !verificacaoActual.fechada ? (
              <Button type="button" variant="outline" onClick={() => void fecharVerificacao()}>
                Fechar verificação
              </Button>
            ) : null}
          </div>

          {!verificacaoActual ? (
            <p className="text-sm text-muted-foreground">
              Não há campanha para <strong>{mesVerif}</strong> nesta empresa. Crie com o botão acima (são geradas linhas para todos os activos actuais).
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={verificacaoActual.fechada ? 'secondary' : 'default'}>
                  {verificacaoActual.fechada ? 'Fechada' : 'Em curso'}
                </Badge>
                <span className="text-muted-foreground">{verificacaoActual.titulo || `Verificação ${verificacaoActual.anoMes}`}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Activos</TableHead>
                      <TableHead>Existe?</TableHead>
                      <TableHead>Local correcto?</TableHead>
                      <TableHead>Responsável correcto?</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensVerificacao.map(item => {
                      const ac = patrimonioActivos.find(x => x.id === item.activoId);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{ac?.nome ?? `#${item.activoId}`}</div>
                            <div className="text-xs text-muted-foreground font-mono">{ac?.codigo}</div>
                            {ac != null && (ac.quantidade ?? 1) !== 1 ? (
                              <div className="text-xs text-muted-foreground">Quantidade: {ac.quantidade ?? 1}</div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Select
                              disabled={verificacaoActual.fechada}
                              value={triToString(item.existe)}
                              onValueChange={v => void actualizarItemVerif(item.id, { existe: triFromString(v) })}
                            >
                              <SelectTrigger className="w-[110px]">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={TRI_NA}>—</SelectItem>
                                <SelectItem value="sim">Sim</SelectItem>
                                <SelectItem value="nao">Não</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              disabled={verificacaoActual.fechada}
                              value={triToString(item.localCorrecto)}
                              onValueChange={v => void actualizarItemVerif(item.id, { localCorrecto: triFromString(v) })}
                            >
                              <SelectTrigger className="w-[110px]">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={TRI_NA}>—</SelectItem>
                                <SelectItem value="sim">Sim</SelectItem>
                                <SelectItem value="nao">Não</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              disabled={verificacaoActual.fechada}
                              value={triToString(item.responsavelCorrecto)}
                              onValueChange={v => void actualizarItemVerif(item.id, { responsavelCorrecto: triFromString(v) })}
                            >
                              <SelectTrigger className="w-[110px]">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={TRI_NA}>—</SelectItem>
                                <SelectItem value="sim">Sim</SelectItem>
                                <SelectItem value="nao">Não</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Textarea
                              disabled={verificacaoActual.fechada}
                              rows={2}
                              defaultValue={item.observacoes}
                              onBlur={e => {
                                if (verificacaoActual.fechada) return;
                                void actualizarItemVerif(item.id, { observacoes: e.target.value });
                              }}
                              className="min-h-[60px]"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogNovo} onOpenChange={setDialogNovo}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo activo</DialogTitle>
            <DialogDescription>Empresa obrigatória; responsável opcional. Código gerado automaticamente (PAT-0001…).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={formNovo.nome} onChange={e => setFormNovo(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                step={1}
                className="max-w-[140px]"
                value={formNovo.quantidade}
                onChange={e => {
                  const v = parseInt(e.target.value, 10);
                  setFormNovo(f => ({
                    ...f,
                    quantidade: e.target.value === '' ? 1 : Number.isFinite(v) && v >= 1 ? v : 1,
                  }));
                }}
              />
              <p className="text-xs text-muted-foreground">Número de unidades representadas por esta linha (ex.: 10 cadeiras iguais).</p>
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select
                value={String(formNovo.empresaId)}
                onValueChange={v => {
                  const ne = Number(v);
                  setFormNovo(f => ({
                    ...f,
                    empresaId: ne,
                    quantidade: 1,
                    categoriaId: '',
                    subcategoriaId: '',
                    viaturaMarca: '',
                    viaturaModelo: '',
                    viaturaCor: '',
                    viaturaMatricula: '',
                    computadorMarca: '',
                    computadorModelo: '',
                    computadorSistemaOperacional: '',
                    computadorProcessador: '',
                    computadorArmazenamentoGb: '',
                    computadorRamGb: '',
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={formNovo.categoriaId === '' ? '__none__' : String(formNovo.categoriaId)}
                onValueChange={v =>
                  setFormNovo(f => ({
                    ...f,
                    categoriaId: v === '__none__' ? '' : Number(v),
                    subcategoriaId: '',
                    viaturaMarca: '',
                    viaturaModelo: '',
                    viaturaCor: '',
                    viaturaMatricula: '',
                    computadorMarca: '',
                    computadorModelo: '',
                    computadorSistemaOperacional: '',
                    computadorProcessador: '',
                    computadorArmazenamentoGb: '',
                    computadorRamGb: '',
                  }))
                }
                disabled={categoriasFormEmpresa.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>
                    Seleccionar categoria
                  </SelectItem>
                  {categoriasFormEmpresa.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {categoriaIdFormNum > 0 ? (
              <div className="space-y-2">
                <Label>Subcategoria (opcional)</Label>
                <Select
                  value={formNovo.subcategoriaId === '' ? '__none__' : String(formNovo.subcategoriaId)}
                  onValueChange={v => setFormNovo(f => ({ ...f, subcategoriaId: v === '__none__' ? '' : Number(v) }))}
                  disabled={subcategoriasForm.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        subcategoriasForm.length === 0
                          ? 'Sem subcategorias definidas'
                          : 'Seleccionar subcategoria'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {subcategoriasForm.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subcategoriasForm.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Não há subcategorias para esta categoria. Defina-as no separador «Categorias».
                  </p>
                ) : null}
              </div>
            ) : null}
            {categoriaActivaForm?.comportamentoComputador ? (
              <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Dados do computador</p>
                </div>
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Input
                    value={formNovo.computadorMarca}
                    onChange={e => setFormNovo(f => ({ ...f, computadorMarca: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input
                    value={formNovo.computadorModelo}
                    onChange={e => setFormNovo(f => ({ ...f, computadorModelo: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Sistema operacional</Label>
                  <Select
                    value={formNovo.computadorSistemaOperacional === '' ? '__none__' : formNovo.computadorSistemaOperacional}
                    onValueChange={v =>
                      setFormNovo(f => ({
                        ...f,
                        computadorSistemaOperacional: v === '__none__' ? '' : (v as PatrimonioComputadorSO),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {COMPUTADOR_SO_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Processador</Label>
                  <Input
                    value={formNovo.computadorProcessador}
                    onChange={e => setFormNovo(f => ({ ...f, computadorProcessador: e.target.value }))}
                    placeholder="ex.: Intel Core i5-1235U"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Armazenamento (GB)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="max-w-[160px]"
                    value={formNovo.computadorArmazenamentoGb}
                    onChange={e => setFormNovo(f => ({ ...f, computadorArmazenamentoGb: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>RAM (GB)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="max-w-[160px]"
                    value={formNovo.computadorRamGb}
                    onChange={e => setFormNovo(f => ({ ...f, computadorRamGb: e.target.value }))}
                  />
                </div>
              </div>
            ) : null}
            {categoriaActivaForm?.comportamentoViatura ? (
              <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground">Dados da viatura</p>
                </div>
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Input value={formNovo.viaturaMarca} onChange={e => setFormNovo(f => ({ ...f, viaturaMarca: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input value={formNovo.viaturaModelo} onChange={e => setFormNovo(f => ({ ...f, viaturaModelo: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Input value={formNovo.viaturaCor} onChange={e => setFormNovo(f => ({ ...f, viaturaCor: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Matrícula</Label>
                  <Input
                    value={formNovo.viaturaMatricula}
                    onChange={e => setFormNovo(f => ({ ...f, viaturaMatricula: e.target.value }))}
                  />
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Responsável (opcional)</Label>
              <Popover open={novoResponsavelOpen} onOpenChange={setNovoResponsavelOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={novoResponsavelOpen}
                    className="w-full justify-between font-normal"
                  >
                    {formNovo.responsavelColaboradorId === ''
                      ? 'Nenhum'
                      : nomeColab(Number(formNovo.responsavelColaboradorId))}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar responsável..." />
                    <CommandList>
                      <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="nenhum sem responsável"
                          onSelect={() => {
                            setFormNovo(f => ({ ...f, responsavelColaboradorId: '' }));
                            setNovoResponsavelOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              formNovo.responsavelColaboradorId === '' ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          Nenhum
                        </CommandItem>
                        {colaboradoresNovoActivoEmpresa.map(c => (
                          <CommandItem
                            key={c.id}
                            value={`${c.nome} ${c.departamento} ${c.cargo} ${c.numeroMec ?? ''} ${c.id}`}
                            onSelect={() => {
                              setFormNovo(f => ({ ...f, responsavelColaboradorId: c.id }));
                              setNovoResponsavelOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                Number(formNovo.responsavelColaboradorId) === c.id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            {c.nome} — {c.departamento}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Estado (se sem responsável)</Label>
              <Select
                value={formNovo.estado}
                onValueChange={v => setFormNovo(f => ({ ...f, estado: v as PatrimonioEstado }))}
                disabled={formNovo.responsavelColaboradorId !== ''}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ESTADO_LABEL) as PatrimonioEstado[]).map(k => (
                    <SelectItem key={k} value={k}>
                      {ESTADO_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovo(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void guardarNovo()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dialogHist} onOpenChange={o => !o && setDialogHist(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico — {dialogHist?.codigo}
            </DialogTitle>
            <DialogDescription>{dialogHist?.nome}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh] pr-3">
            <ul className="space-y-3 text-sm">
              {dialogHist &&
                movsPorActivo(dialogHist.id).map(m => (
                  <li key={m.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="font-medium text-foreground">{m.resumo}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {m.actorNome ?? '—'} · {new Date(m.createdAt).toLocaleString('pt-PT')}
                    </p>
                  </li>
                ))}
              {dialogHist && movsPorActivo(dialogHist.id).length === 0 ? (
                <li className="text-muted-foreground">Sem movimentações.</li>
              ) : null}
            </ul>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogHist(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dialogMov} onOpenChange={o => !o && setDialogMov(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Movimentação</DialogTitle>
            <DialogDescription>{dialogMov?.codigo} — {dialogMov?.nome}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'atribuir' as const, label: 'Atribuir / trocar', icon: Users },
                  { id: 'remover' as const, label: 'Remover resp.', icon: UserX },
                  { id: 'transferir' as const, label: 'Transferir empresa', icon: Building2 },
                  { id: 'estado' as const, label: 'Estado', icon: ArrowRightLeft },
                ] as const
              ).map(x => (
                <Button
                  key={x.id}
                  type="button"
                  size="sm"
                  variant={movTipo === x.id ? 'default' : 'outline'}
                  onClick={() => setMovTipo(x.id)}
                  className={cn('gap-1')}
                >
                  <x.icon className="h-3.5 w-3.5" />
                  {x.label}
                </Button>
              ))}
            </div>
            {movTipo === 'atribuir' ? (
              <div className="space-y-2">
                <Label>Colaborador</Label>
                <Select value={movColabId} onValueChange={setMovColabId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {dialogMov &&
                      colaboradores
                        .filter(c => c.empresaId === dialogMov.empresaId)
                        .map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.nome}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {movTipo === 'transferir' ? (
              <div className="space-y-2">
                <Label>Nova empresa</Label>
                <Select value={movEmpresaId} onValueChange={setMovEmpresaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas
                      .filter(e => dialogMov && e.id !== dialogMov.empresaId)
                      .map(e => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {movTipo === 'estado' ? (
              <div className="space-y-2">
                <Label>Novo estado</Label>
                <Select value={movEstado} onValueChange={v => setMovEstado(v as PatrimonioEstado)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ESTADO_LABEL) as PatrimonioEstado[]).map(k => (
                      <SelectItem key={k} value={k}>
                        {ESTADO_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMov(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void aplicarMovimentacao()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
