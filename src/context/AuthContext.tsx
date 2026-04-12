import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Usuario, Perfil } from '@/types';
import { USUARIOS_SEED } from '@/data/seed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { PROFILES_SELECT_PUBLIC } from '@/lib/profileColumns';
import type { Database } from '@/types/supabase';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const STORAGE_USUARIOS = 'sanep_usuarios';

async function mergeFotoPerfilFromColaborador(
  client: NonNullable<typeof supabase>,
  u: Usuario,
  colaboradorId: number | null | undefined,
): Promise<Usuario> {
  if (colaboradorId == null) return u;
  const { data, error } = await client
    .from('colaboradores')
    .select('foto_perfil_url')
    .eq('id', colaboradorId)
    .maybeSingle();
  if (error || !data) return u;
  const url = (data as { foto_perfil_url?: string | null }).foto_perfil_url;
  const t = typeof url === 'string' ? url.trim() : '';
  if (!t) return u;
  return { ...u, fotoPerfilUrl: t };
}

function profileToUsuario(p: ProfileRow): Usuario {
  return {
    id: p.id,
    nome: p.nome,
    email: p.email,
    username: p.username,
    senha: '',
    perfil: p.perfil as Perfil,
    cargo: p.cargo ?? '',
    departamento: p.departamento ?? '',
    avatar: p.avatar ?? '?',
    primeiroAcessoPendente: p.primeiro_acesso_pendente === true,
    permissoes: p.permissoes ?? [],
    modulos: p.modulos ?? undefined,
    colaboradorId: p.colaborador_id ?? undefined,
    empresaId: p.empresa_id ?? undefined,
    numeroMec: p.numero_mec?.trim() ? p.numero_mec.trim() : undefined,
    assinaturaLinha: (p as any).assinatura_linha ?? undefined,
    assinaturaCargo: (p as any).assinatura_cargo ?? undefined,
    assinaturaImagemUrl: (p as any).assinatura_imagem_url ?? undefined,
  };
}

function loadUsuarios(): Usuario[] {
  try {
    const saved = localStorage.getItem(STORAGE_USUARIOS);
    if (saved) {
      const parsed = JSON.parse(saved) as Usuario[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const merged = parsed.map((u) => {
          const fromSeed = USUARIOS_SEED.find((s) => s.id === u.id);
          if (!fromSeed) return u;
          const m = { ...fromSeed, ...u };
          // Seed é fonte de verdade para empresa (evita login quebrado por empresaId antigo no localStorage)
          m.empresaId = fromSeed.empresaId ?? undefined;
          if (m.perfil === 'Colaborador' && (!m.modulos || m.modulos.length === 0) && fromSeed.modulos?.length) {
            m.modulos = fromSeed.modulos;
          }
          if (m.perfil === 'Colaborador' && m.modulos && !m.modulos.includes('portal-colaborador')) {
            m.modulos = ['portal-colaborador', ...m.modulos];
          }
          return m;
        });
        // Incluir utilizadores do seed que ainda não estão na lista (ex.: PCA adicionado depois)
        const existingIds = new Set(merged.map((u) => u.id));
        for (const s of USUARIOS_SEED) {
          if (!existingIds.has(s.id)) {
            merged.push(s);
            existingIds.add(s.id);
          }
        }
        return merged;
      }
    }
  } catch {}
  return USUARIOS_SEED;
}

/** Payload para criar utilizador no Supabase (Auth + profiles) via Edge Function. */
export interface CreateUserSupabasePayload {
  email: string;
  username: string;
  password: string;
  nome: string;
  perfil: string;
  cargo?: string;
  departamento?: string;
  avatar?: string;
  permissoes?: string[];
  modulos?: string[] | null;
  empresa_id?: number | null;
  colaborador_id?: number | null;
  numero_mec?: string | null;
}

interface AuthContextType {
  user: Usuario | null;
  usuarios: Usuario[];
  setUsuarios: React.Dispatch<React.SetStateAction<Usuario[]>>;
  /** Login: nome de utilizador ou email + senha (Supabase resolve username → email). */
  login: (identificador: string, senha: string) => boolean | Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  /** False enquanto Supabase restaura a sessão (evita flash da página de login). */
  isAuthReady: boolean;
  /** Cria utilizador no Supabase Auth + profiles (Edge Function). Só disponível com Supabase configurado. */
  createUserInSupabase: (payload: CreateUserSupabasePayload) => Promise<Usuario>;
  /** Recarrega o perfil a partir do Supabase (após alterações em `profiles`, PIN, etc.). */
  refreshSessionUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialUsuarios(): Usuario[] {
  return isSupabaseConfigured() ? [] : loadUsuarios();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(getInitialUsuarios);
  const [user, setUser] = useState<Usuario | null>(() => {
    if (isSupabaseConfigured()) return null;
    const saved = localStorage.getItem('sanep_user');
    if (saved) {
      try {
        const u = JSON.parse(saved) as Usuario;
        const found = loadUsuarios().find(x => x.id === u.id && x.email === u.email);
        if (!found) return null;
        const merged = { ...found, ...u };
        if (merged.perfil === 'Colaborador' && (!u.modulos || u.modulos.length === 0) && found.modulos?.length) {
          merged.modulos = found.modulos;
        }
        return merged;
      } catch { return null; }
    }
    return null;
  });
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured());

  const fetchProfileAndSetUser = useCallback(async (authUserId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILES_SELECT_PUBLIC)
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (error || !data) {
      setUser(null);
      return;
    }
    const row = data as ProfileRow;
    let u = profileToUsuario(row);
    u = await mergeFotoPerfilFromColaborador(supabase, u, row.colaborador_id);
    setUser(u);
  }, []);

  const refreshSessionUser = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    const id = session?.user?.id;
    if (id) await fetchProfileAndSetUser(id);
  }, [fetchProfileAndSetUser]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfileAndSetUser(session.user.id);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchProfileAndSetUser(session.user.id);
      else setUser(null);
    });
    return () => subscription.unsubscribe();
  }, [fetchProfileAndSetUser]);

  // Com Supabase: lista de utilizadores só após haver sessão (JWT), senão a RLS devolve vazio.
  // Recarrega ao iniciar sessão / mudar utilizador (evita «Não há outros utilizadores» no Chat).
  const fetchUsuariosProfiles = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILES_SELECT_PUBLIC)
      .order('id', { ascending: true });
    if (error) {
      console.error('[auth] Erro ao carregar lista de perfis', error);
      return;
    }
    const rows = (data ?? []) as ProfileRow[];
    const colabIds = [
      ...new Set(
        rows
          .map(r => r.colaborador_id)
          .filter((id): id is number => typeof id === 'number' && id > 0),
      ),
    ];
    let fotoByColabId = new Map<number, string>();
    if (colabIds.length > 0) {
      const { data: fotos, error: fotoErr } = await supabase
        .from('colaboradores')
        .select('id, foto_perfil_url')
        .in('id', colabIds);
      if (!fotoErr && fotos) {
        for (const r of fotos as { id: number; foto_perfil_url?: string | null }[]) {
          const u = r.foto_perfil_url?.trim();
          if (u) fotoByColabId.set(r.id, u);
        }
      }
    }
    setUsuarios(
      rows.map(row => {
        let u = profileToUsuario(row);
        const cid = row.colaborador_id;
        if (cid != null && fotoByColabId.has(cid)) {
          u = { ...u, fotoPerfilUrl: fotoByColabId.get(cid)! };
        }
        return u;
      }),
    );
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;
    if (!user) {
      setUsuarios([]);
      return;
    }
    void fetchUsuariosProfiles();
  }, [user?.id, fetchUsuariosProfiles]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      localStorage.setItem(STORAGE_USUARIOS, JSON.stringify(usuarios));
    }
  }, [usuarios]);

  useEffect(() => {
    if (!isSupabaseConfigured() && user) {
      const updated = usuarios.find(u => u.id === user.id);
      const toSave = updated ? { ...updated, ...user } : user;
      localStorage.setItem('sanep_user', JSON.stringify(toSave));
    } else if (!isSupabaseConfigured()) {
      localStorage.removeItem('sanep_user');
    }
  }, [user, usuarios]);

  useEffect(() => {
    if (!isSupabaseConfigured() && user) {
      const fromList = usuarios.find(u => u.id === user.id);
      if (fromList) setUser(fromList);
    }
  }, [usuarios]);

  const login = useCallback(
    async (identificador: string, senha: string): Promise<boolean> => {
      if (isSupabaseConfigured() && supabase) {
        let email = identificador.trim();
        if (!email.includes('@')) {
          const { data: resolved, error: rpcError } = await supabase.rpc('resolve_login_email', {
            p_username: email,
          });
          if (rpcError || resolved == null || typeof resolved !== 'string' || !resolved.trim()) {
            return false;
          }
          email = resolved.trim();
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) return false;
        const authUserId = data.user?.id;
        if (!authUserId) return false;
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select(PROFILES_SELECT_PUBLIC)
          .eq('auth_user_id', authUserId)
          .maybeSingle();
        if (profileError || !profile) {
          await supabase.auth.signOut();
          return false;
        }
        const prow = profile as ProfileRow;
        let u = profileToUsuario(prow);
        u = await mergeFotoPerfilFromColaborador(supabase, u, prow.colaborador_id);
        setUser(u);
        return true;
      }
      const idLower = identificador.trim().toLowerCase();
      const found = usuarios.find(u => {
        if (u.senha !== senha) return false;
        if (u.email.toLowerCase() === idLower) return true;
        const uName = (u.username ?? u.email.split('@')[0] ?? '').toLowerCase();
        return uName === idLower;
      });
      if (found) {
        setUser(found);
        return true;
      }
      return false;
    },
    [usuarios]
  );

  const logout = useCallback(() => {
    if (isSupabaseConfigured() && supabase) supabase.auth.signOut();
    setUser(null);
  }, []);

  const createUserInSupabase = useCallback(
    async (payload: CreateUserSupabasePayload): Promise<Usuario> => {
      if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase não configurado');
      const { data, error } = await supabase.functions.invoke('create-user', { body: payload });
      if (error) {
        // Com respostas non-2xx o cliente devolve data=null; a mensagem vem no body em error.context (Response).
        let msg = (error as Error).message || 'Erro ao criar utilizador';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof (ctx as Response).json === 'function') {
          try {
            const body = (await (ctx as Response).json()) as { error?: string };
            if (body?.error && typeof body.error === 'string') msg = body.error;
          } catch {
            /* ignorar falha ao fazer parse */
          }
        }
        throw new Error(msg);
      }
      const raw = data as unknown;
      if (raw && typeof raw === 'object' && 'error' in raw && typeof (raw as { error: string }).error === 'string') {
        throw new Error((raw as { error: string }).error);
      }
      const profile = raw as ProfileRow;
      if (!profile?.id) throw new Error('Resposta inválida da função');
      const newUsuario = profileToUsuario(profile);
      setUsuarios(prev => [...prev, newUsuario]);
      return newUsuario;
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        usuarios,
        setUsuarios,
        login,
        logout,
        isAuthenticated: !!user,
        isAuthReady: authReady,
        createUserInSupabase,
        refreshSessionUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const MODULE_ACCESS_BY_PERFIL: Record<string, Perfil[]> = {
  /** Chat, notificações e entrada geral — disponível a todos os perfis (ver também `hasModuleAccess`). */
  'dashboard': [
    'Admin',
    'PCA',
    'Planeamento',
    'Director',
    'RH',
    'Financeiro',
    'Contabilidade',
    'Secretaria',
    'Juridico',
    'Colaborador',
  ],
  'capital-humano': ['Admin', 'RH'],
  'financas': ['Admin', 'Financeiro'],
  'contabilidade': ['Admin', 'Contabilidade', 'Financeiro'],
  'secretaria': ['Admin', 'Secretaria'],
  /** Exclusivo Admin: perfil Jurídico e outros não acedem ao módulo (ver `hasModuleAccess`). */
  'juridico': ['Admin'],
  'planeamento': ['Admin', 'PCA', 'Planeamento', 'Director'],
  'conselho-administracao': ['Admin', 'PCA'],
  'comunicacao-interna': ['Admin', 'PCA', 'Planeamento', 'Director', 'RH', 'Financeiro', 'Contabilidade', 'Secretaria', 'Juridico', 'Colaborador'],
  /** Repositório central de ficheiros; alinhado a quem pode carregar na BD (Secretaria, Finanças, Jurídico, RH…). */
  'gestao-documentos': [
    'Admin',
    'PCA',
    'Secretaria',
    'Director',
    'Financeiro',
    'Juridico',
    'RH',
    'Contabilidade',
    'Planeamento',
  ],
  'portal-colaborador': ['Colaborador'],
  'configuracoes': ['Admin'],
};

/**
 * Verifica se o utilizador tem acesso ao módulo.
 * - Admin: sempre.
 * - Colaborador: lista `modulos` em exclusivo (vazio → fallback por perfil); portal obrigatório noutros fluxos.
 * - Outros perfis (PCA, Director, RH, …): a lista `modulos` **não substitui** o perfil — faz união (OR).
 *   Assim, marcar só «Dashboard» não deixa o menu de aplicações vazio; o acesso base do perfil mantém-se.
 */
export function hasModuleAccess(user: Usuario | null, module: string): boolean {
  if (!user) return false;
  if (user.perfil === 'Admin') return true;
  /** Jurídico: apenas Admin (não conceder via `modulos` nem PCA/Director/Juridico). */
  if (module === 'juridico') return false;
  // Dashboard no menu agrupa Chat + Notificações (+ link ao painel): sempre acessível a quem tem sessão.
  if (module === 'dashboard') return true;
  if (user.perfil === 'Colaborador') {
    // Notícias / eventos / aniversários: acesso de leitura alinhado ao menu (não exigir módulo explícito na lista).
    if (module === 'comunicacao-interna') return true;
    if (!Array.isArray(user.modulos) || user.modulos.length === 0) {
      return MODULE_ACCESS_BY_PERFIL[module]?.includes(user.perfil) ?? false;
    }
    if (module === 'gestao-documentos' && user.modulos.includes('secretaria')) return true;
    return user.modulos.includes(module);
  }

  const porPerfil = MODULE_ACCESS_BY_PERFIL[module]?.includes(user.perfil) ?? false;
  if (!Array.isArray(user.modulos) || user.modulos.length === 0) {
    return porPerfil;
  }
  if (module === 'gestao-documentos' && user.modulos.includes('secretaria')) return true;
  if (user.modulos.includes(module)) return true;
  return porPerfil;
}
