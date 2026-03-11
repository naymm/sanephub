import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Usuario, Perfil } from '@/types';
import { USUARIOS_SEED } from '@/data/seed';

const STORAGE_USUARIOS = 'sanep_usuarios';

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
  login: (empresaId: LoginEmpresaId, email: string, senha: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(loadUsuarios);
  const [user, setUser] = useState<Usuario | null>(() => {
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

  useEffect(() => {
    localStorage.setItem(STORAGE_USUARIOS, JSON.stringify(usuarios));
  }, [usuarios]);

  useEffect(() => {
    if (user) {
      const updated = usuarios.find(u => u.id === user.id);
      const toSave = updated ? { ...updated, ...user } : user;
      localStorage.setItem('sanep_user', JSON.stringify(toSave));
    } else localStorage.removeItem('sanep_user');
  }, [user, usuarios]);

  useEffect(() => {
    if (user) {
      const fromList = usuarios.find(u => u.id === user.id);
      if (fromList) setUser(fromList);
    }
  }, [usuarios]);

  const login = (empresaId: LoginEmpresaId, email: string, senha: string): boolean => {
    const eid = empresaId === 'grupo' ? 'grupo' : Number(empresaId);
    const found = usuarios.find(u => {
      if (u.email !== email || u.senha !== senha) return false;
      if (eid === 'grupo') return u.empresaId == null;
      return Number(u.empresaId) === eid;
    });
    if (found) { setUser(found); return true; }
    return false;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, usuarios, setUsuarios, login, logout, isAuthenticated: !!user }}>
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
