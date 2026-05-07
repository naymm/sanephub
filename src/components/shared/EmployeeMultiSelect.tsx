import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type EmployeeOption = {
  id: number;
  nome: string;
  empresaId: number;
};

type Props = {
  valueIds: number[];
  onChange: (nextIds: number[], options?: EmployeeOption[]) => void;
  empresaId: number | null;
  placeholder?: string;
  disabled?: boolean;
  minChars?: number;
  debounceMs?: number;
  limit?: number;
};

type CacheEntry = { options: EmployeeOption[]; ts: number };
const CACHE_TTL_MS = 5 * 60_000;

export function EmployeeMultiSelect({
  valueIds,
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
  const [selectedById, setSelectedById] = useState<Map<number, EmployeeOption>>(new Map());

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const lastRequestKeyRef = useRef<string>('');
  const inFlightRef = useRef<number>(0);

  const requestKey = useMemo(() => {
    const q = query.trim().toLowerCase();
    return `${empresaId ?? 'null'}::${limit}::${q}`;
  }, [empresaId, limit, query]);

  // manter labels dos seleccionados quando a opção vem em resultados
  useEffect(() => {
    if (valueIds.length === 0) {
      if (selectedById.size) setSelectedById(new Map());
      return;
    }
    let changed = false;
    const next = new Map(selectedById);
    for (const o of options) {
      if (valueIds.includes(o.id) && !next.has(o.id)) {
        next.set(o.id, o);
        changed = true;
      }
    }
    if (changed) setSelectedById(next);
  }, [options, valueIds]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q || q.length < minChars) {
      setOptions([]);
      return;
    }
    if (!empresaId || disabled) return;
    if (!isSupabaseConfigured() || !supabase) return;

    const cached = cacheRef.current.get(requestKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setOptions(cached.options);
      return;
    }
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
          const mapped: EmployeeOption[] = rows.map(r => ({
            id: Number(r.id),
            nome: String(r.nome),
            empresaId: Number(r.empresa_id),
          }));
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
    if (!q || q.length < minChars) return `Digite pelo menos ${minChars} caracteres`;
    if (!empresaId) return 'Seleccione uma empresa para pesquisar.';
    return null;
  }, [query, minChars, empresaId]);

  const selectedOptions = useMemo(() => {
    return valueIds.map(id => selectedById.get(id)).filter(Boolean) as EmployeeOption[];
  }, [valueIds, selectedById]);

  function remove(id: number) {
    const next = valueIds.filter(x => x !== id);
    onChange(next, selectedOptions.filter(o => o.id !== id));
  }

  return (
    <div className="space-y-2">
      {valueIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {valueIds.map((id) => {
            const opt = selectedById.get(id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                <span className="max-w-[240px] truncate">{opt?.nome ?? `#${id}`}</span>
                <button
                  type="button"
                  className="ml-1 rounded-sm opacity-70 hover:opacity-100"
                  onClick={() => remove(id)}
                  aria-label="Remover"
                  disabled={disabled}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}

      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setQuery('');
            setOptions([]);
            setLoading(false);
            inFlightRef.current += 1;
            lastRequestKeyRef.current = '';
          } else {
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
            <span className="truncate">{placeholder}</span>
            <span className="flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput value={query} onValueChange={setQuery} placeholder={placeholder} autoFocus />
            <CommandList>
              {helperText ? <CommandEmpty>{helperText}</CommandEmpty> : null}
              {!helperText && !loading && options.length === 0 ? <CommandEmpty>Nenhum colaborador encontrado</CommandEmpty> : null}

              <CommandGroup>
                {options.map((o) => {
                  const already = valueIds.includes(o.id);
                  return (
                    <CommandItem
                      key={o.id}
                      value={String(o.id)}
                      onSelect={() => {
                        if (already) {
                          setOpen(false);
                          return;
                        }
                        const next = [...valueIds, o.id];
                        const nextOpts = [...selectedOptions, o];
                        setSelectedById(prev => new Map(prev).set(o.id, o));
                        onChange(next, nextOpts);
                        setOpen(false);
                      }}
                      className={cn(already && 'opacity-60')}
                    >
                      <Check className={cn('mr-2 h-4 w-4', already ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{o.nome}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

