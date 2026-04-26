/**
 * Integração assiduidade ↔ processamento salarial.
 * A lógica numérica vive em `attendanceImpact` e `calcularInssIrtLiquidoComAssiduidade` (`irtCalculo`).
 */
export { calculateAttendanceImpact } from '@/services/assiduidade/attendanceImpact';
export type { AttendancePayrollImpactDetalhe, CalculateAttendanceImpactInput } from '@/services/assiduidade/attendanceImpact';
export { calcularInssIrtLiquidoComAssiduidade } from '@/lib/irtCalculo';
export type { ProcessamentoSalarialComAssiduidadeResultado } from '@/lib/irtCalculo';
