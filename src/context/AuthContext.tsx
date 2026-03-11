import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Usuario, Perfil } from '@/types';
import { USUARIOS_SEED } from '@/data/seed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

const STORAGE_USUARIOS = 'sanep_usuarios';

function profileToUsuario(p: ProfileRow): Usuario {
  return {
    id: p.id,
    nome: p.nome,
    email: p.email,
    senha: '',
    perfil: p.perfil as Perfil,
    cargo: p.cargo ?? '',
    departamento: p.departamento ?? '',
    avatar: p.avatar ?? '?',
    permissoes: p.permissoes ?? [],
    modulos: p.modulos ?? undefined,
    colaboradorId: p.colaborador_id ?? undefined,
    empresaId: p.empresa_id ?? undefined,
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

export type LoginEmpresaId = number | 'grupo';

interface AuthContextType {
  user: Usuario | null;
  usuarios: Usuario[];
  setUsuarios: React.Dispatch<React.SetStateAction<Usuario[]>>;
  /** Login por empresa: seleccionar 'grupo' para Admin/PCA, ou id da empresa para utilizadores dessa empresa. */
  login: (empresaId: LoginEmpresaId, email: string, senha: string) => boolean | Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  /** False enquanto Supabase restaura a sessão (evita flash da página de login). */
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(loadUsuarios);
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
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (!error && data) setUser(profileToUsuario(data as ProfileRow));
    else setUser(null);
  }, []);

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
    async (empresaId: LoginEmpresaId, email: string, senha: string): Promise<boolean> => {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) return false;
        const authUserId = data.user?.id;
        if (!authUserId) return false;
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_user_id', authUserId)
          .maybeSingle();
        if (profileError || !profile) {
          await supabase.auth.signOut();
          return false;
        }
        const eid = empresaId === 'grupo' ? 'grupo' : Number(empresaId);
        const profileEmpresaId = (profile as ProfileRow).empresa_id ?? null;
        if (eid === 'grupo' && profileEmpresaId != null) {
          await supabase.auth.signOut();
          return false;
        }
        if (eid !== 'grupo' && profileEmpresaId !== eid) {
          await supabase.auth.signOut();
          return false;
        }
        setUser(profileToUsuario(profile as ProfileRow));
        return true;
      }
      const eid = empresaId === 'grupo' ? 'grupo' : Number(empresaId);
      const found = usuarios.find(u => {
        if (u.email !== email || u.senha !== senha) return false;
        if (eid === 'grupo') return u.empresaId == null;
        return Number(u.empresaId) === eid;
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

  return (
    <AuthContext.Provider value={{ user, usuarios, setUsuarios, login, logout, isAuthenticated: !!user, isAuthReady: authReady }}>
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
  'dashboard': ['Admin', 'PCA', 'Planeamento', 'Director', 'RH', 'Financeiro', 'Contabilidade', 'Secretaria', 'Juridico'],
  'capital-humano': ['Admin', 'RH'],
  'financas': ['Admin', 'Financeiro'],
  'contabilidade': ['Admin', 'Contabilidade', 'Financeiro'],
  'secretaria': ['Admin', 'Secretaria'],
  'juridico': ['Admin', 'Juridico', 'Director', 'PCA'],
  'planeamento': ['Admin', 'PCA', 'Planeamento', 'Director'],
  'conselho-administracao': ['Admin', 'PCA'],
  'portal-colaborador': ['Colaborador'],
  'configuracoes': ['Admin'],
};

/** Verifica se o utilizador tem acesso ao módulo. Admin tem sempre acesso. Colaborador: se modulos estiver vazio/indefinido usa perfil (portal); senão usa a lista. */
export function hasModuleAccess(user: Usuario | null, module: string): boolean {
  if (!user) return false;
  if (user.perfil === 'Admin') return true;
  if (user.perfil === 'Colaborador') {
    if (!Array.isArray(user.modulos) || user.modulos.length === 0) {
      return MODULE_ACCESS_BY_PERFIL[module]?.includes(user.perfil) ?? false;
    }
    return user.modulos.includes(module);
  }
  if (Array.isArray(user.modulos) && user.modulos.length > 0) return user.modulos.includes(module);
  return MODULE_ACCESS_BY_PERFIL[module]?.includes(user.perfil) ?? false;
}
