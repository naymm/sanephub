import { useState } from 'react';
import type { Declaracao, TipoDeclaracao } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DECLARACAO_BANCOS,
  DECLARACAO_PAISES_EMBAIXADA,
  DECLARACAO_TIPO_OPTIONS,
} from '@/modules/declaracoes/declaracaoConstants';

export type DeclaracaoPedidoFormSlice = Pick<
  Declaracao,
  'tipo' | 'descricao' | 'banco' | 'paisEmbaixada' | 'dataPedido'
>;

type Props = {
  form: DeclaracaoPedidoFormSlice;
  onChange: (patch: Partial<DeclaracaoPedidoFormSlice>) => void;
};

export function DeclaracaoPedidoFields({ form, onChange }: Props) {
  const [bancoOpen, setBancoOpen] = useState(false);
  const [paisOpen, setPaisOpen] = useState(false);

  const setTipo = (v: TipoDeclaracao) => {
    onChange({ tipo: v, banco: undefined, paisEmbaixada: undefined });
    setBancoOpen(false);
    setPaisOpen(false);
  };

  return (
    <>
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={form.tipo} onValueChange={v => setTipo(v as TipoDeclaracao)}>
          <SelectTrigger className="min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DECLARACAO_TIPO_OPTIONS.map(t => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {form.tipo === 'Para Banco' && (
        <div className="space-y-2">
          <Label>Banco</Label>
          <Popover open={bancoOpen} onOpenChange={setBancoOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={bancoOpen}
                className="w-full justify-between font-normal"
              >
                {form.banco ?? 'Seleccionar banco...'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Pesquisar banco..." />
                <CommandList>
                  <CommandEmpty>Nenhum banco encontrado.</CommandEmpty>
                  <CommandGroup>
                    {DECLARACAO_BANCOS.map(b => (
                      <CommandItem
                        key={b}
                        value={b}
                        onSelect={() => {
                          onChange({ banco: b });
                          setBancoOpen(false);
                        }}
                      >
                        <Check
                          className={cn('mr-2 h-4 w-4', form.banco === b ? 'opacity-100' : 'opacity-0')}
                          aria-hidden
                        />
                        {b}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
      {form.tipo === 'Embaixada' && (
        <div className="space-y-2">
          <Label>País da Embaixada</Label>
          <Popover open={paisOpen} onOpenChange={setPaisOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={paisOpen}
                className="w-full justify-between font-normal"
              >
                {form.paisEmbaixada ?? 'Seleccionar país...'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Pesquisar país..." />
                <CommandList>
                  <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
                  <CommandGroup>
                    {DECLARACAO_PAISES_EMBAIXADA.map(p => (
                      <CommandItem
                        key={p}
                        value={p}
                        onSelect={() => {
                          onChange({ paisEmbaixada: p });
                          setPaisOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            form.paisEmbaixada === p ? 'opacity-100' : 'opacity-0',
                          )}
                          aria-hidden
                        />
                        {p}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
      <div className="space-y-2 min-w-0">
        <Label>Descrição (opcional)</Label>
        <Input
          value={form.descricao ?? ''}
          onChange={e => onChange({ descricao: e.target.value || undefined })}
          placeholder="ex: Crédito habitação"
          className="min-w-0"
        />
      </div>
      <div className="space-y-2 min-w-0">
        <Label>Data pedido</Label>
        <Input
          type="date"
          value={form.dataPedido}
          onChange={e => onChange({ dataPedido: e.target.value })}
          className="min-w-0"
        />
      </div>
    </>
  );
}

/** Validação partilhada portal + RH. */
export function validateDeclaracaoPedido(form: DeclaracaoPedidoFormSlice): string | null {
  if (!form.dataPedido) return 'Indique a data do pedido.';
  if (form.tipo === 'Para Banco' && !form.banco) return 'Seleccione o banco.';
  if (form.tipo === 'Embaixada' && !form.paisEmbaixada) return 'Seleccione o país da embaixada.';
  return null;
}
