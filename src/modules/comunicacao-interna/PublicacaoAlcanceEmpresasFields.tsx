import { useMemo } from 'react';
import type { Empresa } from '@/types';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { empresaIdsActivos, type AlcancePublicacaoModo } from '@/modules/comunicacao-interna/publicacaoAlcanceEmpresas';

type Props = {
  empresas: Empresa[];
  currentEmpresaId: number | 'consolidado';
  modo: AlcancePublicacaoModo;
  onModoChange: (m: AlcancePublicacaoModo) => void;
  umaEmpresaId: number | null;
  onUmaEmpresaIdChange: (id: number | null) => void;
  empresasEscolhidas: number[];
  onEmpresasEscolhidasChange: (ids: number[]) => void;
};

export function PublicacaoAlcanceEmpresasFields({
  empresas,
  currentEmpresaId,
  modo,
  onModoChange,
  umaEmpresaId,
  onUmaEmpresaIdChange,
  empresasEscolhidas,
  onEmpresasEscolhidasChange,
}: Props) {
  const lista = useMemo(() => empresas.filter(e => e.activo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt')), [empresas]);
  const todasCount = empresaIdsActivos(empresas).length;

  const toggleEscolhida = (id: number, checked: boolean) => {
    if (checked) {
      onEmpresasEscolhidasChange([...new Set([...empresasEscolhidas, id])]);
    } else {
      onEmpresasEscolhidasChange(empresasEscolhidas.filter(x => x !== id));
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-muted/15 p-3 sm:p-4 space-y-3">
      <div>
        <Label className="text-sm font-medium">Alcance da publicação</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Escolha se o conteúdo fica só na empresa actual, numa empresa específica, em várias seleccionadas ou em todas as empresas activas.
        </p>
      </div>

      <RadioGroup
        value={modo}
        onValueChange={v => onModoChange(v as AlcancePublicacaoModo)}
        className="grid gap-3"
      >
        {currentEmpresaId !== 'consolidado' ? (
          <div className="flex items-start gap-2.5">
            <RadioGroupItem value="empresa_actual" id="alcance-empresa-actual" className="mt-0.5" />
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor="alcance-empresa-actual" className="font-normal cursor-pointer leading-snug">
                Apenas a empresa actual (selector no topo)
              </Label>
              <p className="text-[11px] text-muted-foreground">Usa a empresa que está seleccionada na barra de contexto.</p>
            </div>
          </div>
        ) : null}

        <div className="flex items-start gap-2.5">
          <RadioGroupItem value="uma_empresa" id="alcance-uma" className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="alcance-uma" className="font-normal cursor-pointer leading-snug">
              Uma empresa específica
            </Label>
            {modo === 'uma_empresa' ? (
              <Select
                value={umaEmpresaId != null ? String(umaEmpresaId) : ''}
                onValueChange={v => onUmaEmpresaIdChange(v ? Number(v) : null)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Escolher empresa…" />
                </SelectTrigger>
                <SelectContent>
                  {lista.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <RadioGroupItem value="empresas_escolhidas" id="alcance-varias" className="mt-0.5" />
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="alcance-varias" className="font-normal cursor-pointer leading-snug">
              Várias empresas (seleccionar)
            </Label>
            {modo === 'empresas_escolhidas' ? (
              <ScrollArea className="h-40 rounded-lg border border-border/60 bg-background">
                <div className="p-2 space-y-1">
                  {lista.map(e => (
                    <div key={e.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40">
                      <Checkbox
                        id={`emp-alc-${e.id}`}
                        checked={empresasEscolhidas.includes(e.id)}
                        onCheckedChange={v => toggleEscolhida(e.id, Boolean(v))}
                      />
                      <Label htmlFor={`emp-alc-${e.id}`} className="text-sm font-normal cursor-pointer flex-1 truncate">
                        {e.nome}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : null}
            {modo === 'empresas_escolhidas' ? (
              <p className="text-[11px] text-muted-foreground">
                {empresasEscolhidas.length} empresa(s) seleccionada(s).
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <RadioGroupItem value="todas_empresas" id="alcance-todas" className="mt-0.5" />
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor="alcance-todas" className="font-normal cursor-pointer leading-snug">
              Todas as empresas activas
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Será criado um registo por empresa ({todasCount} no total).
            </p>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}
