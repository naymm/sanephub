import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type EmployeeOption = {
  id: number;
  nome: string;
  empresaId: number;
};

type Props = {
  valueId: number | null;
  onChange: (nextId: number | null, option?: EmployeeOption | null) => void;
  /** Empresa para pesquisa (obrigatória no contexto consolidado). */
  empresaId: number | null;
  placeholder?: string;
  disabled?: boolean;
  /** Quantidade mínima de caracteres para pesquisar. Default 4. */
  minChars?: number;
  /** Debounce em ms. Default 300. */
  debounceMs?: number;
  /** Limite de resultados. Default 20. */
  limit?: number;
};

type CacheEntry = { options: EmployeeOption[]; ts: number };
const CACHE_TTL_MS = 5 * 60_000;

export function EmployeeSelect({
  valueId,
  onChange,
  empresaId,
  placeholder = 'Pesquisar colaborador…',
  disabled,
  minChars = 4,
  debounceMs = 300,
  limit = 20,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState<EmployeeOption | null>(null);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const lastRequestKeyRef = useRef<string>('');
  const inFlightRef = useRef<number>(0);

  const requestKey = useMemo(() => {
    const q = query.trim().toLowerCase();
    return `${empresaId ?? 'null'}::${limit}::${q}`;
  }, [empresaId, limit, query]);

  useEffect(() => {
    // manter label do seleccionado (evita ficar sem nome quando fecha/abre)
    if (valueId == null) {
      setSelected(null);
      return;
    }
    if (selected?.id === valueId) return;
    const fromList = options.find(o => o.id === valueId);
    if (fromList) setSelected(fromList);
  }, [valueId, options, selected?.id]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setOptions([]);
      return;
    }
    if (q.length < minChars) {
      setOptions([]);
      return;
    }
    if (!empresaId || disabled) return;
    if (!isSupabaseConfigured() || !supabase) return;

    // cache hit
    const cached = cacheRef.current.get(requestKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setOptions(cached.options);
      return;
    }
    // evitar repetir a mesma query em loop
    if (lastRequestKeyRef.current === requestKey) return;

    setLoading(true);
    const token = ++inFlightRef.current;
    const t = window.setTimeout(() => {
      lastRequestKeyRef.current = requestKey;
      void (async () => {
        try {
          const { data, error } = await supabase.rpc('search_colaboradores', {
            p_query: q,
            p_empresa_id: empresaId,
            p_limit: limit,
          });
          if (token !== inFlightRef.current) return;
          if (error) throw new Error(error.message);
          const rows = (data ?? []) as Array<{ id: number; nome: string; empresa_id: number }>;
          const mapped: EmployeeOption[] = rows.map(r => ({ id: Number(r.id), nome: String(r.nome), empresaId: Number(r.empresa_id) }));
          setOptions(mapped);
          cacheRef.current.set(requestKey, { options: mapped, ts: Date.now() });
        } catch {
          setOptions([]);
        } finally {
          if (token === inFlightRef.current) setLoading(false);
        }
      })();
    }, debounceMs);

    return () => window.clearTimeout(t);
  }, [open, query, minChars, debounceMs, empresaId, limit, disabled, requestKey]);

  const helperText = useMemo(() => {
    const q = query.trim();
    if (!q) return `Digite pelo menos ${minChars} caracteres`;
    if (q.length < minChars) return `Digite pelo menos ${minChars} caracteres`;
    if (!empresaId) return 'Seleccione uma empresa para pesquisar.';
    return null;
  }, [query, minChars, empresaId]);

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          // ao fechar, limpar input e estado transitório (evita “preso” num termo antigo)
          setQuery('');
          setOptions([]);
          setLoading(false);
          inFlightRef.current += 1; // invalida requests pendentes
          lastRequestKeyRef.current = '';
        } else {
          // ao abrir, começar sempre limpo
          setQuery('');
          setOptions([]);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          <span className="truncate">
            {selected?.nome ?? (valueId != null ? `#${valueId}` : placeholder)}
          </span>
          <span className="flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={placeholder}
            autoFocus
          />
          <CommandList>
            {helperText ? <CommandEmpty>{helperText}</CommandEmpty> : null}
            {!helperText && !loading && options.length === 0 ? (
              <CommandEmpty>Nenhum colaborador encontrado</CommandEmpty>
            ) : null}

            <CommandGroup>
              {valueId != null ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    setSelected(null);
                    onChange(null, null);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', 'opacity-0')} />
                  <span className="truncate text-muted-foreground">Limpar selecção</span>
                </CommandItem>
              ) : null}
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={String(o.id)}
                  onSelect={() => {
                    setSelected(o);
                    onChange(o.id, o);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', valueId === o.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{o.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

