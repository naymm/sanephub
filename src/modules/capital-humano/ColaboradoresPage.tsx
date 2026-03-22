import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { mapRowFromDb } from '@/lib/supabaseMappers';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { fetchColaboradoresPaginated, fetchColaboradoresDepartamentos } from '@/lib/supabaseData';
import type { Colaborador, StatusColaborador, TipoContrato, Genero } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Search, Plus, Pencil, Eye, Trash2, UploadCloud, User, X, GraduationCap, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  criarPastaColaboradorNaGestao,
  nomePastaColaboradorMaiusculo,
  uploadDocumentosColaboradorParaPasta,
} from '@/lib/colaboradorGestaoDocumentos';
import { uploadColaboradorFotoPerfil } from '@/lib/colaboradorFotoPerfil';
import { DataTablePagination } from '@/components/shared/DataTablePagination';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

const STATUS_OPTIONS: StatusColaborador[] = ['Activo', 'Inactivo', 'Suspenso', 'Em férias'];
const TIPO_CONTRATO_OPTIONS: TipoContrato[] = ['Efectivo', 'Prazo Certo', 'Prestação', 'Estágio'];
const GENERO_OPTIONS: Genero[] = ['M', 'F', 'Outro'];

const ESTADO_CIVIL_OPTIONS = [
  'Solteiro(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viúvo(a)',
  'União de facto',
  'Outro',
] as const;

const CARGO_OPTIONS = ['Técnico', 'Coordenador', 'Director'] as const;

/** Nacionalidades permitidas no cadastro (Capital Humano). */
const NACIONALIDADE_OPCOES = ['Angola', 'Cuba', 'Espanha', 'Portugal'] as const;

/** Níveis académicos (Capital Humano). */
const NIVEL_ACADEMICO_OPCOES = [
  'Ensino Primário',
  'Ensino Secundário',
  'Ensino Médio',
  'Licenciatura',
  'Mestrado',
  'Doutoramento',
] as const;

/** Valor sentinela para o Select quando ainda não há departamento escolhido. */
const DEPARTAMENTO_SELECT_VAZIO = '__departamento_nenhum__';

/** Alinha valores antigos da BD às opções fixas do select. */
function nacionalidadeParaSelect(valorGuardado: string): string {
  const v = valorGuardado.trim();
  const map: Record<string, string> = {
    Angolana: 'Angola',
    angolana: 'Angola',
    Portuguesa: 'Portugal',
    portuguesa: 'Portugal',
    Português: 'Portugal',
    Portugues: 'Portugal',
    Espanhola: 'Espanha',
    espanhola: 'Espanha',
    Cubana: 'Cuba',
    cubana: 'Cuba',
  };
  if (map[v]) return map[v];
  if ((NACIONALIDADE_OPCOES as readonly string[]).includes(v)) return v;
  return v || 'Angola';
}

const emptyForm: Omit<Colaborador, 'id'> = {
  empresaId: 1,
  nome: '',
  dataNascimento: '',
  genero: 'M',
  estadoCivil: 'Solteiro(a)',
  bi: '',
  nif: '',
  niss: '',
  nacionalidade: 'Angola',
  nivelAcademico: 'Ensino Secundário',
  endereco: '',
  cargo: 'Técnico',
  departamento: '',
  dataAdmissao: '',
  tipoContrato: 'Efectivo',
  salarioBase: 0,
  iban: '',
  emailCorporativo: '',
  telefonePrincipal: '',
  status: 'Activo',
};

const DOC_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx']);

function extDoc(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : '';
}

function formatBytesDoc(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Primeiro nome, nomes intermédios e apelido (para ficha estilo detalhe). */
function partesNomeCompleto(nomeCompleto: string): { primeiro: string; meios: string; ultimo: string } {
  const parts = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { primeiro: '—', meios: '—', ultimo: '—' };
  if (parts.length === 1) return { primeiro: parts[0], meios: '—', ultimo: '—' };
  if (parts.length === 2) return { primeiro: parts[0], meios: '—', ultimo: parts[1] };
  return { primeiro: parts[0], meios: parts.slice(1, -1).join(' '), ultimo: parts[parts.length - 1] };
}

function labelGenero(g: Genero): string {
  if (g === 'M') return 'Masculino';
  if (g === 'F') return 'Feminino';
  return 'Outro';
}

function ColaboradorDetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold leading-snug text-foreground break-words">{value ?? '—'}</p>
    </div>
  );
}

function ColaboradorSectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm md:p-5">
      <h3 className="mb-4 border-b border-border/60 pb-2 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** Foto no preview: URL limpa, recarrega quando muda, fallback se o pedido falhar (CORS, 404, etc.). */
function ColaboradorPreviewFoto({
  fotoUrl,
  nome,
}: {
  fotoUrl: string | null | undefined;
  nome: string;
}) {
  const [failed, setFailed] = useState(false);
  const clean = (fotoUrl ?? '').trim();
  useEffect(() => {
    setFailed(false);
  }, [clean]);
  const initial = nome.trim().charAt(0).toLocaleUpperCase('pt-PT') || '?';
  if (!clean || failed) {
    return (
      <div className="flex h-32 w-32 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 text-3xl font-bold text-muted-foreground">
        {initial}
      </div>
    );
  }
  return (
    <img
      key={clean}
      src={clean}
      alt=""
      className="h-32 w-32 rounded-lg border-2 border-border object-cover shadow-sm"
      referrerPolicy="no-referrer"
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/** ID de empresa positivo para Gestão documental / RLS (evita NaN por tipos inconsistentes). */
function parseEmpresaIdGestao(...candidates: unknown[]): number {
  for (const v of candidates) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return NaN;
}

export default function ColaboradoresPage() {
  const { colaboradores, addColaborador, updateColaborador, deleteColaborador, empresas, departamentos: departamentosCatalogo, refetch } = useData();
  const { usuarios, user } = useAuth();
  const { currentEmpresaId } = useTenant();
  const empresaIdForNew = currentEmpresaId === 'consolidado' ? (empresas.find(e => e.activo)?.id ?? 1) : currentEmpresaId;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusColaborador | 'todos'>('todos');
  const [deptFilter, setDeptFilter] = useState<string>('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<Colaborador | null>(null);
  const [viewItem, setViewItem] = useState<Colaborador | null>(null);
  const [viewDetalhesLoading, setViewDetalhesLoading] = useState(false);
  const [form, setForm] = useState<Omit<Colaborador, 'id'>>(emptyForm);
  const [associarUtilizadorId, setAssociarUtilizadorId] = useState<number | null>(null);
  /** Anexos do cadastro (só «Novo colaborador») — enviados para Gestão documental após criar o registo. */
  const [novoColaboradorAnexos, setNovoColaboradorAnexos] = useState<File[]>([]);
  const [docDragActive, setDocDragActive] = useState(false);
  const docDragDepth = useRef(0);
  const novoDocInputRef = useRef<HTMLInputElement>(null);
  const fotoPerfilInputRef = useRef<HTMLInputElement>(null);
  const [fotoPerfilPendente, setFotoPerfilPendente] = useState<File | null>(null);
  const [fotoPreviewObjectUrl, setFotoPreviewObjectUrl] = useState<string | null>(null);
  /** Se true, grava `foto_perfil_url` = null na BD (sem novo ficheiro). */
  const [fotoPerfilRemovida, setFotoPerfilRemovida] = useState(false);
  const [saving, setSaving] = useState(false);

  const usePaginated = isSupabaseConfigured() && !!supabase;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [tableRows, setTableRows] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(false);
  const [departamentosList, setDepartamentosList] = useState<string[]>([]);
  const [searchDebounced, setSearchDebounced] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!usePaginated) {
      setSearchDebounced(search);
      return;
    }
    searchDebounceRef.current = setTimeout(() => setSearchDebounced(search), 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search, usePaginated]);

  const empresaIds = useMemo(() => {
    if (currentEmpresaId === 'consolidado') {
      return empresas.filter(e => e.activo).map(e => e.id);
    }
    return typeof currentEmpresaId === 'number' ? [currentEmpresaId] : [];
  }, [currentEmpresaId, empresas]);

  const fetchPaginated = useCallback(async () => {
    if (!supabase || empresaIds.length === 0) return;
    setLoading(true);
    try {
      const [res, depts] = await Promise.all([
        fetchColaboradoresPaginated(supabase, {
          empresaIds,
          page,
          pageSize,
          search: searchDebounced.trim() || undefined,
          status: statusFilter === 'todos' ? undefined : statusFilter,
          departamento: deptFilter === 'todos' ? undefined : deptFilter,
        }),
        fetchColaboradoresDepartamentos(supabase, empresaIds),
      ]);
      setTableRows(res.data);
      setTotalCount(res.totalCount);
      setDepartamentosList(depts);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar colaboradores');
      setTableRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [empresaIds, page, pageSize, searchDebounced, statusFilter, deptFilter]);

  useEffect(() => {
    if (usePaginated) {
      fetchPaginated();
    } else {
      setDepartamentosList(Array.from(new Set(colaboradores.map(c => c.departamento))).sort());
    }
  }, [usePaginated, fetchPaginated, colaboradores]);

  const filtered = useMemo(() => {
    if (usePaginated) return tableRows;
    return colaboradores.filter(c => {
      const matchSearch =
        c.nome.toLowerCase().includes(search.toLowerCase()) ||
        c.cargo.toLowerCase().includes(search.toLowerCase()) ||
        c.departamento.toLowerCase().includes(search.toLowerCase()) ||
        c.emailCorporativo.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'todos' || c.status === statusFilter;
      const matchDept = deptFilter === 'todos' || c.departamento === deptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [usePaginated, tableRows, colaboradores, search, statusFilter, deptFilter]);

  const totalFiltered = usePaginated ? totalCount : filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = usePaginated ? page : Math.min(page, Math.max(0, totalPages - 1));
  const paginatedSlice = useMemo(() => {
    if (usePaginated) return filtered;
    const from = currentPage * pageSize;
    return filtered.slice(from, from + pageSize);
  }, [usePaginated, filtered, currentPage, pageSize]);
  const from = totalFiltered === 0 ? 0 : currentPage * pageSize + 1;
  const to = Math.min(currentPage * pageSize + pageSize, totalFiltered);
  const canPrev = currentPage > 0;
  const canNext = currentPage < totalPages - 1;

  const goToPage = (p: number) => setPage(Math.max(0, Math.min(p, totalPages - 1)));
  const onPageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(0);
  };
  const resetPage = () => setPage(0);

  /** Nomes de departamento para o filtro da tabela (valores existentes nos colaboradores). */
  const departamentosFiltroOpcoes = usePaginated ? departamentosList : Array.from(new Set(colaboradores.map(c => c.departamento))).sort();

  const cargoSelectOptions = useMemo(() => {
    const set = new Set<string>([...CARGO_OPTIONS]);
    if (form.cargo.trim() && !set.has(form.cargo)) set.add(form.cargo);
    return Array.from(set);
  }, [form.cargo]);

  const estadoCivilSelectOptions = useMemo(() => {
    const set = new Set<string>([...ESTADO_CIVIL_OPTIONS]);
    if (form.estadoCivil.trim() && !set.has(form.estadoCivil)) set.add(form.estadoCivil);
    return Array.from(set);
  }, [form.estadoCivil]);

  const nacionalidadeSelectOptions = useMemo(() => {
    const set = new Set<string>([...NACIONALIDADE_OPCOES]);
    if (form.nacionalidade.trim() && !set.has(form.nacionalidade)) set.add(form.nacionalidade);
    return Array.from(set);
  }, [form.nacionalidade]);

  const nivelAcademicoSelectOptions = useMemo(() => {
    const set = new Set<string>([...NIVEL_ACADEMICO_OPCOES]);
    const v = (form.nivelAcademico ?? '').trim();
    if (v && !set.has(v)) set.add(v);
    return Array.from(set);
  }, [form.nivelAcademico]);

  /** Nomes do catálogo de departamentos + valor legado do colaborador em edição, se não existir no catálogo. */
  const departamentoSelectOptions = useMemo(() => {
    const nomes = departamentosCatalogo.map(d => d.nome.trim()).filter(Boolean);
    const unique = [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt'));
    if (form.departamento.trim() && !unique.includes(form.departamento)) {
      return [...unique, form.departamento].sort((a, b) => a.localeCompare(b, 'pt'));
    }
    return unique;
  }, [departamentosCatalogo, form.departamento]);

  const limparPreviewFoto = useCallback(() => {
    setFotoPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFotoPerfilPendente(null);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setAssociarUtilizadorId(null);
    setNovoColaboradorAnexos([]);
    docDragDepth.current = 0;
    setDocDragActive(false);
    limparPreviewFoto();
    setFotoPerfilRemovida(false);
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...emptyForm, empresaId: empresaIdForNew, dataAdmissao: today });
    setDialogOpen(true);
  };

  const openEdit = (c: Colaborador) => {
    setNovoColaboradorAnexos([]);
    docDragDepth.current = 0;
    setDocDragActive(false);
    limparPreviewFoto();
    setFotoPerfilRemovida(false);
    setEditing(c);
    const usuarioLinked = usuarios.find(u => u.colaboradorId === c.id);
    setAssociarUtilizadorId(usuarioLinked?.id ?? null);
    setForm({
      empresaId: c.empresaId,
      nome: c.nome,
      dataNascimento: c.dataNascimento,
      genero: c.genero,
      estadoCivil: c.estadoCivil?.trim() || 'Solteiro(a)',
      bi: c.bi,
      nif: c.nif,
      niss: c.niss,
      nacionalidade: nacionalidadeParaSelect(c.nacionalidade ?? ''),
      nivelAcademico: c.nivelAcademico?.trim() || 'Ensino Secundário',
      fotoPerfilUrl: c.fotoPerfilUrl ?? undefined,
      endereco: c.endereco,
      cargo: c.cargo?.trim() || 'Técnico',
      departamento: c.departamento,
      dataAdmissao: c.dataAdmissao,
      tipoContrato: c.tipoContrato,
      dataFimContrato: c.dataFimContrato,
      salarioBase: c.salarioBase,
      iban: c.iban,
      emailCorporativo: c.emailCorporativo,
      emailPessoal: c.emailPessoal,
      telefonePrincipal: c.telefonePrincipal,
      telefoneAlternativo: c.telefoneAlternativo,
      contactoEmergenciaNome: c.contactoEmergenciaNome,
      contactoEmergenciaTelefone: c.contactoEmergenciaTelefone,
      status: c.status,
    });
    setDialogOpen(true);
  };

  /** Abre o preview e, com Supabase, recarrega o registo para incluir `foto_perfil_url` e demais campos actualizados. */
  const openViewDetalhes = useCallback(async (c: Colaborador) => {
    setViewItem(c);
    setViewOpen(true);
    if (!isSupabaseConfigured() || !supabase) return;
    setViewDetalhesLoading(true);
    try {
      const { data, error } = await supabase.from('colaboradores').select('*').eq('id', c.id).maybeSingle();
      if (error) {
        console.warn('[colaboradores] preview', error.message);
        return;
      }
      if (data) {
        setViewItem(mapRowFromDb<Colaborador>('colaboradores', data as Record<string, unknown>));
      }
    } finally {
      setViewDetalhesLoading(false);
    }
  }, []);

  const fotoMostrada =
    fotoPreviewObjectUrl ??
    (!fotoPerfilRemovida && form.fotoPerfilUrl ? form.fotoPerfilUrl : null);

  const onSelectFotoPerfil = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Seleccione uma imagem (JPEG, PNG, GIF ou WebP).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 3 MB.');
      return;
    }
    setFotoPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFotoPerfilPendente(file);
    setFotoPerfilRemovida(false);
  };

  const removerFotoPerfil = () => {
    setFotoPreviewObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFotoPerfilPendente(null);
    setFotoPerfilRemovida(true);
    setForm((f) => ({ ...f, fotoPerfilUrl: undefined }));
  };

  const applyNovoColaboradorFiles = (raw: File[]) => {
    const list = raw.filter((f) => DOC_EXT.has(extDoc(f.name)));
    const skipped = raw.length - list.length;
    if (skipped > 0) {
      toast.error(`${skipped} ficheiro(s) ignorados (use PDF, Word ou Excel).`);
    }
    setNovoColaboradorAnexos((prev) => {
      const seen = new Set(prev.map((p) => `${p.name}-${p.size}`));
      const merged = [...prev];
      for (const f of list) {
        const k = `${f.name}-${f.size}`;
        if (!seen.has(k)) {
          seen.add(k);
          merged.push(f);
        }
      }
      return merged;
    });
  };

  const save = async () => {
    if (!form.nome.trim() || !form.emailCorporativo.trim()) return;
    const payloadColaborador: Omit<Colaborador, 'id'> = {
      ...form,
      empresaId: form.empresaId ?? empresaIdForNew,
    };
    if (fotoPerfilPendente) {
      delete payloadColaborador.fotoPerfilUrl;
    } else if (fotoPerfilRemovida) {
      payloadColaborador.fotoPerfilUrl = null;
    }
    setSaving(true);
    try {
      let colaboradorId: number;
      /** Empresa usada na pasta/arquivos (prioriza valor gravado na BD no insert). */
      let empresaIdParaGestao = parseEmpresaIdGestao(payloadColaborador.empresaId, empresaIdForNew);
      if (editing) {
        await updateColaborador(editing.id, payloadColaborador);
        colaboradorId = editing.id;
        empresaIdParaGestao = parseEmpresaIdGestao(payloadColaborador.empresaId, empresaIdForNew);
      } else {
        const created = await addColaborador(payloadColaborador);
        colaboradorId = created.id;
        empresaIdParaGestao = parseEmpresaIdGestao(created.empresaId, payloadColaborador.empresaId, empresaIdForNew);
      }

      if (fotoPerfilPendente) {
        if (!isSupabaseConfigured() || !supabase) {
          toast.warning('A fotografia não foi guardada: ligue o Supabase para carregar imagens de perfil.', {
            duration: 8000,
          });
        } else {
          try {
            const url = await uploadColaboradorFotoPerfil(
              supabase,
              empresaIdParaGestao,
              colaboradorId,
              fotoPerfilPendente,
            );
            await updateColaborador(colaboradorId, { fotoPerfilUrl: url });
          } catch (fe) {
            toast.error(
              fe instanceof Error ? fe.message : 'Não foi possível carregar a fotografia de perfil.',
              { duration: 10_000 },
            );
          }
        }
      }
      if (isSupabaseConfigured() && supabase && (associarUtilizadorId != null || editing)) {
        const colabIdToSync = editing ? editing.id : colaboradorId;
        const { error: clearErr } = await supabase
          .from('profiles')
          .update({ colaborador_id: null })
          .eq('colaborador_id', colabIdToSync);
        if (clearErr) console.warn('Ao desassociar perfis:', clearErr.message);
        if (associarUtilizadorId != null) {
          const { error: linkErr } = await supabase
            .from('profiles')
            .update({ colaborador_id: colaboradorId })
            .eq('id', associarUtilizadorId);
          if (linkErr) throw new Error(linkErr.message);
        }
      }

      let docSuccessSuffix = '';
      const profileIdGestao = user?.id != null ? Number(user.id) : NaN;
      const profileOk = Number.isFinite(profileIdGestao) && profileIdGestao > 0;
      const supabaseOk = isSupabaseConfigured() && !!supabase;
      const empresaOk = Number.isFinite(empresaIdParaGestao) && empresaIdParaGestao > 0;
      /** Novo colaborador: criar pasta em Gestão documental (vazia ou com anexos). */
      const podeCriarPastaColaborador = !editing && supabaseOk && empresaOk;

      if (!editing && novoColaboradorAnexos.length > 0 && !podeCriarPastaColaborador) {
        const razoes: string[] = [];
        if (!supabaseOk) razoes.push('Supabase não está configurado.');
        else if (!empresaOk)
          razoes.push(
            `Empresa inválida para documentos (empresaId: ${String(payloadColaborador.empresaId ?? empresaIdForNew)}).`,
          );
        toast.error(
          `Colaborador criado, mas ${novoColaboradorAnexos.length} documento(s) não foram enviados: ${razoes.join(' ')}`,
          { duration: 14_000 },
        );
      }

      if (podeCriarPastaColaborador && supabase) {
        const pastaRes = await criarPastaColaboradorNaGestao(
          supabase,
          empresaIdParaGestao,
          colaboradorId,
          payloadColaborador.nome.trim(),
        );
        if ('error' in pastaRes) {
          toast.error(
            `Colaborador criado, mas não foi possível criar a pasta em Gestão documental: ${pastaRes.error}`,
            { duration: 12_000 },
          );
        } else {
          const nomePasta = nomePastaColaboradorMaiusculo(payloadColaborador.nome.trim());
          if (novoColaboradorAnexos.length > 0) {
            if (!profileOk) {
              toast.error(
                `Pasta «${nomePasta}» criada, mas ${novoColaboradorAnexos.length} documento(s) não foram enviados: sessão sem perfil válido (volte a iniciar sessão).`,
                { duration: 14_000 },
              );
            } else {
              const up = await uploadDocumentosColaboradorParaPasta(
                supabase,
                empresaIdParaGestao,
                profileIdGestao,
                pastaRes.pastaId,
                novoColaboradorAnexos,
              );
              if (up.ok > 0) {
                docSuccessSuffix = ` ${up.ok} documento(s) em Capital Humano / Colaboradores / ${nomePasta}.`;
              }
              if (up.errors.length > 0) {
                toast.error(
                  up.errors.length <= 2
                    ? up.errors.join(' ')
                    : `${up.errors.slice(0, 2).join(' ')}… (+${up.errors.length - 2})`,
                  { duration: 12_000 },
                );
              }
            }
          } else {
            docSuccessSuffix = ` Pasta criada (vazia) em Capital Humano / Colaboradores / ${nomePasta}.`;
          }
        }
      }

      setFotoPerfilPendente(null);
      setFotoPerfilRemovida(false);
      limparPreviewFoto();
      setDialogOpen(false);
      setEditing(null);
      setAssociarUtilizadorId(null);
      setNovoColaboradorAnexos([]);
      if (usePaginated) {
        fetchPaginated();
        refetch();
      }
      toast.success(
        (editing ? 'Colaborador actualizado.' : 'Colaborador criado.') + docSuccessSuffix,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Colaborador) => {
    if (!window.confirm(`Remover o colaborador "${c.nome}"? Esta acção não pode ser desfeita.`)) return;
    try {
      await deleteColaborador(c.id);
      if (usePaginated) {
        fetchPaginated();
        refetch();
      }
      toast.success('Colaborador removido.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="page-header">Colaboradores</h1>
        <Button onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Novo Colaborador
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v as StatusColaborador | 'todos'); resetPage(); }}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={v => { setDeptFilter(v); resetPage(); }}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {departamentosFiltroOpcoes.map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="table-container overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th className="w-14 py-3 px-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Foto</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cargo</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Departamento</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Admissão</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contrato</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Salário Base</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acções</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-8 text-center text-muted-foreground text-sm">A carregar…</td></tr>
            ) : (
              paginatedSlice.map(c => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-2 align-middle">
                    {c.fotoPerfilUrl ? (
                      <img
                        src={c.fotoPerfilUrl}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover border border-border/80"
                      />
                    ) : (
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                        title={c.nome}
                      >
                        {c.nome.trim().charAt(0).toLocaleUpperCase('pt-PT') || '?'}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-5 font-medium">{c.nome}</td>
                  <td className="py-3 px-5 text-muted-foreground">{c.cargo}</td>
                  <td className="py-3 px-5 text-muted-foreground">{c.departamento}</td>
                  <td className="py-3 px-5 text-muted-foreground">{formatDate(c.dataAdmissao)}</td>
                  <td className="py-3 px-5"><StatusBadge status={c.tipoContrato} variant="neutral" /></td>
                  <td className="py-3 px-5 text-right font-mono">{formatKz(c.salarioBase)}</td>
                  <td className="py-3 px-5"><StatusBadge status={c.status} /></td>
                  <td className="py-3 px-5 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void openViewDetalhes(c)}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(c)} title="Remover"><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && paginatedSlice.length === 0 && (
        <p className="text-center py-8 text-muted-foreground text-sm">Nenhum colaborador encontrado.</p>
      )}

      <DataTablePagination
        from={from}
        to={to}
        totalFiltered={totalFiltered}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        currentPage={currentPage}
        totalPages={totalPages}
        canPrev={canPrev}
        canNext={canNext}
        onPrev={() => goToPage(currentPage - 1)}
        onNext={() => goToPage(currentPage + 1)}
        onPageSizeChange={onPageSizeChange}
      />

      {/* Dialog Criar/Editar */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) limparPreviewFoto();
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar colaborador' : 'Novo colaborador'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Dados do colaborador.'
                : 'Dados do colaborador. Pode anexar documentos (arrastar ou clicar) — serão guardados na pasta «Colaboradores» já existente em Gestão documental (Capital Humano ou RH), dentro de uma subpasta com o nome do colaborador em maiúsculas.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-start">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 border-border bg-background shadow-sm">
                {fotoMostrada ? (
                  <img src={fotoMostrada} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <User className="h-14 w-14 opacity-60" aria-hidden />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 text-center sm:text-left">
                <Label>Fotografia de perfil</Label>
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fotoPerfilInputRef.current?.click()}
                  >
                    Escolher imagem…
                  </Button>
                  {(fotoPreviewObjectUrl || (form.fotoPerfilUrl && !fotoPerfilRemovida)) && (
                    <Button type="button" variant="ghost" size="sm" onClick={removerFotoPerfil}>
                      Remover foto
                    </Button>
                  )}
                </div>
                <input
                  ref={fotoPerfilInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    onSelectFotoPerfil(e.target.files);
                    e.target.value = '';
                  }}
                />
                <p className="text-xs text-muted-foreground">JPEG, PNG, GIF ou WebP · máximo 3 MB</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Data nascimento</Label>
                <Input type="date" value={form.dataNascimento} onChange={e => setForm(f => ({ ...f, dataNascimento: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Género</Label>
                <Select value={form.genero} onValueChange={v => setForm(f => ({ ...f, genero: v as Genero }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GENERO_OPTIONS.map(g => (
                      <SelectItem key={g} value={g}>{g === 'M' ? 'Masculino' : g === 'F' ? 'Feminino' : 'Outro'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado civil</Label>
                <Select
                  value={form.estadoCivil}
                  onValueChange={v => setForm(f => ({ ...f, estadoCivil: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado civil" />
                  </SelectTrigger>
                  <SelectContent>
                    {estadoCivilSelectOptions.map(ec => (
                      <SelectItem key={ec} value={ec}>
                        {ec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>BI</Label>
                <Input value={form.bi} onChange={e => setForm(f => ({ ...f, bi: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>NIF</Label>
                <Input value={form.nif} onChange={e => setForm(f => ({ ...f, nif: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>INSS</Label>
                <Input value={form.niss} onChange={e => setForm(f => ({ ...f, niss: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nacionalidade</Label>
                <Select
                  value={form.nacionalidade}
                  onValueChange={(v) => setForm((f) => ({ ...f, nacionalidade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar nacionalidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {nacionalidadeSelectOptions.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nível académico</Label>
                <Select
                  value={form.nivelAcademico ?? 'Ensino Secundário'}
                  onValueChange={(v) => setForm((f) => ({ ...f, nivelAcademico: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar nível académico" />
                  </SelectTrigger>
                  <SelectContent>
                    {nivelAcademicoSelectOptions.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
            </div>
            <hr className="border-border/80" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select value={form.cargo} onValueChange={v => setForm(f => ({ ...f, cargo: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {cargoSelectOptions.map(cg => (
                      <SelectItem key={cg} value={cg}>
                        {cg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                {departamentoSelectOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border/60 px-3 py-2">
                    Não há departamentos no catálogo. Cadastre em Configurações → Departamentos.
                  </p>
                ) : null}
                <Select
                  value={form.departamento.trim() ? form.departamento : DEPARTAMENTO_SELECT_VAZIO}
                  onValueChange={v =>
                    setForm(f => ({ ...f, departamento: v === DEPARTAMENTO_SELECT_VAZIO ? '' : v }))
                  }
                  disabled={departamentoSelectOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEPARTAMENTO_SELECT_VAZIO}>— Seleccionar —</SelectItem>
                    {departamentoSelectOptions.map(nome => (
                      <SelectItem key={nome} value={nome}>
                        {nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data admissão</Label>
                <Input type="date" value={form.dataAdmissao} onChange={e => setForm(f => ({ ...f, dataAdmissao: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tipo contrato</Label>
                <Select value={form.tipoContrato} onValueChange={v => setForm(f => ({ ...f, tipoContrato: v as TipoContrato }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_CONTRATO_OPTIONS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.tipoContrato !== 'Efectivo' && (
              <div className="space-y-2">
                <Label>Data fim contrato</Label>
                <Input type="date" value={form.dataFimContrato ?? ''} onChange={e => setForm(f => ({ ...f, dataFimContrato: e.target.value || undefined }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Salário base (Kz)</Label>
                <Input type="number" min={0} value={form.salarioBase || ''} onChange={e => setForm(f => ({ ...f, salarioBase: Number(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>IBAN</Label>
                <Input value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} />
              </div>
            </div>
            <hr className="border-border/80" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email corporativo</Label>
                <Input type="email" value={form.emailCorporativo} onChange={e => setForm(f => ({ ...f, emailCorporativo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email pessoal (opcional)</Label>
                <Input type="email" value={form.emailPessoal ?? ''} onChange={e => setForm(f => ({ ...f, emailPessoal: e.target.value || undefined }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone principal</Label>
                <Input value={form.telefonePrincipal} onChange={e => setForm(f => ({ ...f, telefonePrincipal: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Telefone alternativo (opcional)</Label>
                <Input value={form.telefoneAlternativo ?? ''} onChange={e => setForm(f => ({ ...f, telefoneAlternativo: e.target.value || undefined }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contacto emergência - Nome</Label>
                <Input value={form.contactoEmergenciaNome ?? ''} onChange={e => setForm(f => ({ ...f, contactoEmergenciaNome: e.target.value || undefined }))} />
              </div>
              <div className="space-y-2">
                <Label>Contacto emergência - Telefone</Label>
                <Input value={form.contactoEmergenciaTelefone ?? ''} onChange={e => setForm(f => ({ ...f, contactoEmergenciaTelefone: e.target.value || undefined }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as StatusColaborador }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editing && isSupabaseConfigured() && (
              <div className="space-y-3 border-t border-border/80 pt-4">
                <Label className="text-base">Pasta e documentos do colaborador</Label>
                <p className="text-xs text-muted-foreground">
                  Ao guardar, é criada a subpasta em{' '}
                  <strong>… / Colaboradores / {form.nome.trim() ? nomePastaColaboradorMaiusculo(form.nome) : 'PRIMEIRO ÚLTIMO'}</strong>{' '}
                  (primeiro e último nome em maiúsculas), mesmo sem ficheiros — fica vazia até carregar documentos abaixo ou na Gestão documental.
                  Requer «Capital Humano» (ou «RH») e «Colaboradores» já existentes na Gestão documental.
                </p>
                <div
                  className={cn(
                    'cursor-pointer rounded-lg border-2 border-dashed px-3 py-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    docDragActive
                      ? 'border-primary bg-primary/10'
                      : 'border-border/80 bg-muted/20 hover:border-muted-foreground/40 hover:bg-muted/30',
                  )}
                  onClick={() => novoDocInputRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    docDragDepth.current += 1;
                    setDocDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    docDragDepth.current -= 1;
                    if (docDragDepth.current <= 0) {
                      docDragDepth.current = 0;
                      setDocDragActive(false);
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    docDragDepth.current = 0;
                    setDocDragActive(false);
                    applyNovoColaboradorFiles(Array.from(e.dataTransfer.files));
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      novoDocInputRef.current?.click();
                    }
                  }}
                >
                  <input
                    ref={novoDocInputRef}
                    type="file"
                    multiple
                    className="sr-only"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => {
                      applyNovoColaboradorFiles(e.target.files ? Array.from(e.target.files) : []);
                      e.target.value = '';
                    }}
                  />
                  <UploadCloud
                    className={cn('mx-auto h-9 w-9', docDragActive ? 'text-primary' : 'text-muted-foreground')}
                    aria-hidden
                  />
                  <p className="mt-2 text-sm font-medium">Arraste documentos aqui ou clique para seleccionar</p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF, Word ou Excel · vários ficheiros</p>
                </div>
                {novoColaboradorAnexos.length > 0 && (
                  <ul className="max-h-32 space-y-1.5 overflow-y-auto rounded-md border border-border/60 bg-background/50 p-2 text-xs">
                    {novoColaboradorAnexos.map((f, i) => (
                      <li key={`${i}-${f.name}-${f.size}`} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">{f.name}</span>
                        <span className="flex shrink-0 items-center gap-2 tabular-nums text-muted-foreground">
                          {extDoc(f.name).toUpperCase()} · {formatBytesDoc(f.size)}
                          <button
                            type="button"
                            className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                            aria-label={`Remover ${f.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setNovoColaboradorAnexos((prev) => prev.filter((_, j) => j !== i));
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {isSupabaseConfigured() && usuarios.length > 0 && (
              <div className="space-y-2 border-t border-border/80 pt-4">
                <Label>Associar a utilizador (opcional)</Label>
                <Select
                  value={associarUtilizadorId != null ? String(associarUtilizadorId) : 'nenhum'}
                  onValueChange={v => setAssociarUtilizadorId(v === 'nenhum' ? null : Number(v))}
                >
                  <SelectTrigger><SelectValue placeholder="Nenhum — colaborador sem conta de acesso" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {usuarios.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.nome} — {u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se associar a um utilizador, ele verá no Portal (Meus Recibos, Férias, etc.) os dados deste colaborador.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={save}
              disabled={!form.nome.trim() || !form.emailCorporativo.trim() || saving}
            >
              {saving ? 'A guardar…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) setViewDetalhesLoading(false);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl gap-0 overflow-y-auto border-border/80 p-0 sm:rounded-xl">
          {viewItem && (
            <>
              <DialogTitle className="sr-only">Colaborador: {viewItem.nome}</DialogTitle>
              <Tabs key={viewItem.id} defaultValue="pessoal" className="w-full">
              <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border/80 bg-background/95 px-4 py-3 pr-12 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pr-14">
                <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-0 bg-transparent p-0 sm:w-auto sm:gap-2">
                  <TabsTrigger
                    value="pessoal"
                    className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    Dados pessoais
                  </TabsTrigger>
                  <TabsTrigger
                    value="formacao"
                    className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    Formação
                  </TabsTrigger>
                  <TabsTrigger
                    value="emprego"
                    className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    Emprego
                  </TabsTrigger>
                </TabsList>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => {
                    const c = viewItem;
                    setViewOpen(false);
                    window.setTimeout(() => openEdit(c), 0);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Editar detalhes
                </Button>
              </div>

              <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
                <TabsContent value="pessoal" className="mt-0 space-y-6 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">Dados pessoais</h2>
                  </div>

                  <ColaboradorSectionCard title="Informação pessoal">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                      <div className="mx-auto shrink-0 lg:mx-0">
                        {viewDetalhesLoading ? (
                          <div
                            className="flex h-32 w-32 animate-pulse items-center justify-center rounded-lg border-2 border-border bg-muted"
                            aria-hidden
                          />
                        ) : (
                          <ColaboradorPreviewFoto fotoUrl={viewItem.fotoPerfilUrl} nome={viewItem.nome} />
                        )}
                      </div>
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        <ColaboradorDetailField
                          label="Primeiro nome"
                          value={partesNomeCompleto(viewItem.nome).primeiro}
                        />
                        <ColaboradorDetailField
                          label="Nomes intermédios"
                          value={partesNomeCompleto(viewItem.nome).meios}
                        />
                        <ColaboradorDetailField
                          label="Apelido"
                          value={partesNomeCompleto(viewItem.nome).ultimo}
                        />
                        <ColaboradorDetailField label="Email corporativo" value={viewItem.emailCorporativo} />
                        <ColaboradorDetailField label="Email pessoal" value={viewItem.emailPessoal?.trim() || '—'} />
                        <ColaboradorDetailField label="Telefone principal" value={viewItem.telefonePrincipal} />
                        <ColaboradorDetailField label="Telefone alternativo" value={viewItem.telefoneAlternativo?.trim() || '—'} />
                        <ColaboradorDetailField label="Data de nascimento" value={formatDate(viewItem.dataNascimento)} />
                        <ColaboradorDetailField label="Género" value={labelGenero(viewItem.genero)} />
                        <ColaboradorDetailField label="Cargo / função" value={viewItem.cargo} />
                        <ColaboradorDetailField label="BI" value={viewItem.bi?.trim() || '—'} />
                        <ColaboradorDetailField label="NIF" value={viewItem.nif?.trim() || '—'} />
                        <ColaboradorDetailField label="INSS (NISS)" value={viewItem.niss?.trim() || '—'} />
                      </div>
                    </div>
                  </ColaboradorSectionCard>

                  <ColaboradorSectionCard title="Morada">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <ColaboradorDetailField label="Morada completa" value={viewItem.endereco?.trim() || '—'} />
                      <ColaboradorDetailField label="Empresa (tenant)" value={empresas.find((e) => e.id === viewItem.empresaId)?.nome ?? '—'} />
                    </div>
                  </ColaboradorSectionCard>

                  <ColaboradorSectionCard title="Recursos humanos">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      <ColaboradorDetailField label="Nº interno (ID)" value={String(viewItem.id)} />
                      <ColaboradorDetailField label="Data de admissão" value={formatDate(viewItem.dataAdmissao)} />
                      <ColaboradorDetailField label="Tipo de contrato" value={viewItem.tipoContrato} />
                      <ColaboradorDetailField
                        label="Fim do contrato"
                        value={viewItem.dataFimContrato ? formatDate(viewItem.dataFimContrato) : '—'}
                      />
                      <ColaboradorDetailField label="Salário base" value={formatKz(viewItem.salarioBase)} />
                      <ColaboradorDetailField label="Estado" value={<StatusBadge status={viewItem.status} />} />
                    </div>
                  </ColaboradorSectionCard>

                  <ColaboradorSectionCard title="Contacto de emergência">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <ColaboradorDetailField label="Nome" value={viewItem.contactoEmergenciaNome?.trim() || '—'} />
                      <ColaboradorDetailField label="Telefone" value={viewItem.contactoEmergenciaTelefone?.trim() || '—'} />
                    </div>
                  </ColaboradorSectionCard>
                </TabsContent>

                <TabsContent value="formacao" className="mt-0 space-y-6 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">Formação e identificação</h2>
                  </div>
                  <ColaboradorSectionCard title="Formação académica e civil">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      <ColaboradorDetailField label="Nível académico" value={viewItem.nivelAcademico?.trim() || '—'} />
                      <ColaboradorDetailField label="Nacionalidade" value={viewItem.nacionalidade} />
                      <ColaboradorDetailField label="Estado civil" value={viewItem.estadoCivil?.trim() || '—'} />
                    </div>
                  </ColaboradorSectionCard>
                </TabsContent>

                <TabsContent value="emprego" className="mt-0 space-y-6 focus-visible:ring-0 focus-visible:ring-offset-0">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">Emprego</h2>
                  </div>
                  <ColaboradorSectionCard title="Dados profissionais">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      <ColaboradorDetailField
                        label="Empresa"
                        value={empresas.find((e) => e.id === viewItem.empresaId)?.nome ?? '—'}
                      />
                      <ColaboradorDetailField label="Departamento" value={viewItem.departamento} />
                      <ColaboradorDetailField label="Cargo" value={viewItem.cargo} />
                      <ColaboradorDetailField label="Nº colaborador" value={String(viewItem.id)} />
                      <ColaboradorDetailField label="Data de admissão" value={formatDate(viewItem.dataAdmissao)} />
                      <ColaboradorDetailField label="Contrato" value={viewItem.tipoContrato} />
                      <ColaboradorDetailField
                        label="Data fim do contrato"
                        value={viewItem.dataFimContrato ? formatDate(viewItem.dataFimContrato) : '—'}
                      />
                      <ColaboradorDetailField label="Salário base" value={formatKz(viewItem.salarioBase)} />
                      <ColaboradorDetailField label="IBAN" value={viewItem.iban?.trim() || '—'} />
                      <ColaboradorDetailField label="Status" value={<StatusBadge status={viewItem.status} />} />
                    </div>
                  </ColaboradorSectionCard>
                </TabsContent>
              </div>
            </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
