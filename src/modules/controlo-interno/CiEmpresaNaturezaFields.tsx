import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CI_NATUREZAS } from '@/modules/controlo-interno/constants';
import type { CiNatureza } from '@/types/controloInterno';

export type CiEmpresaNaturezaFormValues = {
  empresaId: number;
  data: string;
  prazo: string;
  areaDepartamento: string;
  natureza: CiNatureza;
  areaDireccionada: string;
};

type EmpresaOpt = { id: number; nome: string; codigo?: string };

type Props = {
  empresas: EmpresaOpt[];
  values: CiEmpresaNaturezaFormValues;
  onChange: (patch: Partial<CiEmpresaNaturezaFormValues>) => void;
  empresaLabel?: string;
};

export function validateCiEmpresaNaturezaForm(v: CiEmpresaNaturezaFormValues): string | null {
  if (!v.empresaId) return 'Seleccione a empresa.';
  if (!v.data.trim()) return 'Indique a data.';
  if (!v.prazo.trim()) return 'Indique o prazo.';
  if (v.natureza === 'Orgânica' && !v.areaDepartamento.trim()) return 'Indique a área.';
  if (v.natureza === 'Direccionada' && !v.areaDireccionada.trim()) {
    return 'Indique o nome da área (auditoria direccionada).';
  }
  return null;
}

export function CiEmpresaNaturezaFields({
  empresas,
  values,
  onChange,
  empresaLabel = 'Empresa',
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>{empresaLabel} *</Label>
        <Select
          value={values.empresaId ? String(values.empresaId) : ''}
          onValueChange={v => onChange({ empresaId: Number(v) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar empresa" />
          </SelectTrigger>
          <SelectContent>
            {empresas.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>
                {e.codigo ? `${e.codigo} — ` : ''}
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Data *</Label>
          <Input
            type="date"
            value={values.data}
            onChange={e => onChange({ data: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Prazo *</Label>
          <Input
            type="date"
            value={values.prazo}
            onChange={e => onChange({ prazo: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tipo *</Label>
        <RadioGroup
          value={values.natureza}
          onValueChange={v => onChange({ natureza: v as CiNatureza, areaDireccionada: '' })}
          className="flex flex-col gap-2 sm:flex-row sm:gap-6"
        >
          {CI_NATUREZAS.map(n => (
            <div key={n} className="flex items-center gap-2">
              <RadioGroupItem value={n} id={`ci-nat-${n}`} />
              <Label htmlFor={`ci-nat-${n}`} className="font-normal cursor-pointer">
                {n}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {values.natureza === 'Orgânica' ? (
        <div className="space-y-1">
          <Label>Área *</Label>
          <Input
            value={values.areaDepartamento}
            onChange={e => onChange({ areaDepartamento: e.target.value })}
            placeholder="Ex.: Finanças, RH, Operações…"
          />
        </div>
      ) : (
        <div className="space-y-1">
          <Label>Nome da área (direccionada) *</Label>
          <Input
            value={values.areaDireccionada}
            onChange={e => onChange({ areaDireccionada: e.target.value })}
            placeholder="Área ou unidade objecto da auditoria direccionada"
          />
        </div>
      )}
    </div>
  );
}
