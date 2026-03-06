import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';

/** Retorna o ID do colaborador associado ao utilizador logado (portal). null se não for colaborador ou não houver vínculo. */
export function useColaboradorId(): number | null {
  const { user } = useAuth();
  const { colaboradores } = useData();
  if (!user) return null;
  if (user.colaboradorId != null) return user.colaboradorId;
  const byName = colaboradores.find(c => c.nome === user.nome);
  return byName?.id ?? null;
}
