/**
 * Facade de assiduidade para a UI e integrações: impacto no salário, validações e (re)export do cálculo com IRT/INSS.
 * Persistência: `DataContext` + Supabase (`assiduidade_*`).
 */
export { calculateAttendanceImpact } from '@/services/assiduidade/attendanceImpact';
export {
  colaboradorComLicencaMaternidadeNoMes,
  colaboradorEmLicencaMaternidadeNoDia,
  podeJustificarAtrasoMesmoDia,
} from '@/services/assiduidade/attendanceValidation';
export { calcularInssIrtLiquidoComAssiduidade } from '@/lib/irtCalculo';
