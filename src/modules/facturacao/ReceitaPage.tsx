import { Navigate } from 'react-router-dom';

/** Rota legada — dashboard unificado em /facturacao */
export default function ReceitaPage() {
  return <Navigate to="/facturacao" replace />;
}
