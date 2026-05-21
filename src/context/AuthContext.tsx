import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import type { Usuario, Perfil } from '@/types';
import { USUARIOS_SEED } from '@/data/seed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logIntranetAuditClientEvent } from '@/lib/intranetAudit';
import { PROFILES_SELECT_PUBLIC } from '@/lib/profileColumns';
import type { Database } from '@/types/supabase';
import { getSupabaseFunctionsInvokeErrorMessage } from '@/utils/supabaseFunctionsInvokeError';

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
    obrigarTrocaSenha: p.obrigar_troca_senha === true,
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

export interface AdminResetPasswordPayload {
  target_profile_id: number;
  new_password: string;
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
  /** True enquanto existe sessão mas o perfil ainda está a carregar (evita redirect /login no refresh). */
  isRestoringSession: boolean;
  /**
   * Incrementa quando a sessão Supabase muda (login, logout, refresh).
   * Os hooks de dados em tempo real usam-no para voltar a fazer fetch com o JWT correcto (ex.: mobile após login).
   */
  authSessionRevision: number;
  /** Cria utilizador no Supabase Auth + profiles (Edge Function). Só disponível com Supabase configurado. */
  createUserInSupabase: (payload: CreateUserSupabasePayload) => Promise<Usuario>;
  /** Admin: repor palavra-passe de outro utilizador (Edge Function); o utilizador deverá alterá-la ao entrar. */
  resetUserPasswordAsAdmin: (payload: AdminResetPasswordPayload) => Promise<Usuario>;
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
  const [restoringSession, setRestoringSession] = useState(isSupabaseConfigured());
  const [authSessionRevision, setAuthSessionRevision] = useState(0);

  const bumpAuthSessionRevision = useCallback(() => {
    setAuthSessionRevision((n) => n + 1);
  }, []);

  /** `onAuthStateChange` usa referência actual; evita `user === null` stale e “A carregar…” em todo o `SIGNED_IN`. */
  const userRef = useRef(user);
  userRef.current = user;

  const fetchProfileAndSetUser = useCallback(async (authUserId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILES_SELECT_PUBLIC)
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (error || !data) {
      // Não limpar `user` aqui: após `signIn`, o listener pode correr em paralelo e falhar
      // momentaneamente (RLS/rede), apagando o estado que o `login()` acabou de preencher.
      if (import.meta.env.DEV) {
        console.warn('[auth] fetchProfileAndSetUser: sem dados ou erro; mantém estado actual.', error);
      }
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
      setRestoringSession(false);
      return;
    }
    // IMPORTANTE: `getSession()` pode falhar (rede / bloqueios WebView / Safari).
    // Não podemos deixar `isAuthReady` preso em false, senão o UI só aparece após refresh.
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        // Evitar “flash” de /login no refresh: se existir sessão, tratar como "a restaurar"
        // até o perfil ficar disponível (com retries curtos).
        if (session?.user) {
          setRestoringSession(true);
          let ok = false;
          for (let i = 0; i < 3; i++) {
            await fetchProfileAndSetUser(session.user.id);
            // Se o perfil foi carregado, `user` deixa de ser null no próximo render.
            // Aqui só precisamos de evitar o redirect imediato.
            ok = true;
            break;
          }
          if (!ok) setUser(null);
        } else {
          setUser(null);
        }
      } catch {
        /* ignora: continua como "sem sessão" */
        setUser(null);
      } finally {
        setRestoringSession(false);
        setAuthReady(true);
        bumpAuthSessionRevision();
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Se houver eventos mas `getSession()` ficou preso, desbloqueia o layout.
      setAuthReady(true);
      // `TOKEN_REFRESHED` ao voltar à aba não deve incrementar revisão: cada bump recria todas as subscrições
      // realtime (`useRealtimeTable`) e volta a correr um fetch inicial de cada tabela.
      if (event === 'TOKEN_REFRESHED') {
        if (session?.user)
          void (async () => {
            try {
              await fetchProfileAndSetUser(session.user.id);
            } catch {
              /* mantém estado */
            }
          })();
        return;
      }

      bumpAuthSessionRevision();

      if (session?.user) {
        const shouldBlockUi = event === 'SIGNED_IN' && userRef.current == null;
        if (shouldBlockUi) setRestoringSession(true);
        void (async () => {
          try {
            await fetchProfileAndSetUser(session.user.id);
          } finally {
            if (shouldBlockUi) setRestoringSession(false);
          }
        })();
      } else {
        setUser(null);
        setRestoringSession(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchProfileAndSetUser, bumpAuthSessionRevision]);

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
        const ident = identificador.trim();
        // Pre-check: conta bloqueada?
        const { data: isBlocked, error: blockErr } = await supabase.rpc('auth_login_is_blocked', {
          p_identifier: ident,
        });
        if (blockErr) {
          // Não quebrar login por falha de RPC; seguir o fluxo normal.
          console.error('[login] auth_login_is_blocked RPC error', blockErr);
        } else if (isBlocked === true) {
          // Login bloqueado: só Admin desbloqueia.
          throw new Error('ACCOUNT_LOCKED');
        }

        let email = ident;
        if (!email.includes('@')) {
          const { data: resolved, error: rpcError } = await supabase.rpc('resolve_login_email', {
            p_username: email,
          });
          if (rpcError || resolved == null || typeof resolved !== 'string' || !resolved.trim()) {
            // Username não resolve → registar falha para esse identificador.
            await supabase.rpc('auth_login_register_failure', { p_identifier: ident });
            return false;
          }
          email = resolved.trim();
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) {
          await supabase.rpc('auth_login_register_failure', { p_identifier: ident });
          return false;
        }
        // Safari / mobile: garantir que o cliente aplicou o JWT antes dos selects (evita RLS vazio + UI presa).
        await supabase.auth.getSession();
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
        // Reset contador (não desbloqueia contas; só Admin).
        await supabase.rpc('auth_login_register_success', { p_auth_user_id: authUserId });
        logIntranetAuditClientEvent('login', {
          summary: 'Início de sessão',
          details: { email: u.email },
        });
        bumpAuthSessionRevision();
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
    [usuarios, bumpAuthSessionRevision]
  );

  const logout = useCallback(() => {
    void (async () => {
      if (isSupabaseConfigured() && supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          logIntranetAuditClientEvent('logout', { summary: 'Fim de sessão' });
          await new Promise((r) => setTimeout(r, 150));
        }
        await supabase.auth.signOut();
      }
      setUser(null);
      bumpAuthSessionRevision();
    })();
  }, [bumpAuthSessionRevision]);

  const createUserInSupabase = useCallback(
    async (payload: CreateUserSupabasePayload): Promise<Usuario> => {
      if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase não configurado');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Sessão expirada ou em falta. Faça login novamente antes de criar utilizadores.');
      }
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: payload,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) {
        const msg = await getSupabaseFunctionsInvokeErrorMessage(
          error,
          (error as Error).message || 'Erro ao criar utilizador',
        );
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

  const resetUserPasswordAsAdmin = useCallback(
    async (payload: AdminResetPasswordPayload): Promise<Usuario> => {
      if (!isSupabaseConfigured() || !supabase) throw new Error('Supabase não configurado');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Sessão expirada ou em falta. Faça login novamente.');
      }
      const { data, error } = await supabase.functions.invoke('admin-reset-user-password', {
        body: {
          target_profile_id: payload.target_profile_id,
          new_password: payload.new_password,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) {
        const msg = await getSupabaseFunctionsInvokeErrorMessage(
          error,
          (error as Error).message || 'Erro ao repor senha',
        );
        throw new Error(msg);
      }
      const raw = data as unknown;
      if (raw && typeof raw === 'object' && 'error' in raw && typeof (raw as { error: string }).error === 'string') {
        throw new Error((raw as { error: string }).error);
      }
      const profile = raw as ProfileRow;
      if (!profile?.id) throw new Error('Resposta inválida da função');
      const updatedUsuario = profileToUsuario(profile);
      setUsuarios(prev => prev.map(u => (u.id === updatedUsuario.id ? { ...u, ...updatedUsuario } : u)));
      return updatedUsuario;
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      usuarios,
      setUsuarios,
      login,
      logout,
      isAuthenticated: !!user,
      isAuthReady: authReady,
      isRestoringSession: restoringSession,
      authSessionRevision,
      createUserInSupabase,
      resetUserPasswordAsAdmin,
      refreshSessionUser,
    }),
    [user, usuarios, login, logout, authReady, restoringSession, authSessionRevision, createUserInSupabase, resetUserPasswordAsAdmin, refreshSessionUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
  /** Produtividade: actividades do dia-a-dia. */
  'produtividade': [
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
  /** Inventário físico: local, responsável e histórico. */
  'patrimonio': ['Admin', 'PCA', 'Secretaria', 'Director', 'Financeiro', 'RH', 'Contabilidade', 'Planeamento'],
  'portal-colaborador': ['Colaborador'],
  'configuracoes': ['Admin'],
  'controlo-interno': ['Admin', 'PCA', 'Director'],
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
  // Facturação: segue as mesmas permissões de Finanças (módulo é um sub-domínio).
  if (module === 'facturacao') return hasModuleAccess(user, 'financas');
  // Dashboard no menu agrupa Chat + Notificações (+ link ao painel): sempre acessível a quem tem sessão.
  if (module === 'dashboard') return true;
  if (user.perfil === 'Colaborador') {
    // Notícias / eventos / aniversários: acesso de leitura alinhado ao menu (não exigir módulo explícito na lista).
    if (module === 'comunicacao-interna') return true;
    // Produtividade: transversal (uso diário) — não depende da lista `modulos` do colaborador.
    if (module === 'produtividade') return true;
    if (!Array.isArray(user.modulos) || user.modulos.length === 0) {
      return MODULE_ACCESS_BY_PERFIL[module]?.includes(user.perfil) ?? false;
    }
    if (module === 'gestao-documentos' && user.modulos.includes('secretaria')) return true;
    if (module === 'patrimonio' && user.modulos.includes('secretaria')) return true;
    return user.modulos.includes(module);
  }

  const porPerfil = MODULE_ACCESS_BY_PERFIL[module]?.includes(user.perfil) ?? false;
  if (!Array.isArray(user.modulos) || user.modulos.length === 0) {
    return porPerfil;
  }
  if (module === 'gestao-documentos' && user.modulos.includes('secretaria')) return true;
  if (module === 'patrimonio' && user.modulos.includes('secretaria')) return true;
  if (user.modulos.includes(module)) return true;
  return porPerfil;
}
