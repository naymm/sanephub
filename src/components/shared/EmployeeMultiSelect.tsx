import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function cacheKey(empresaId: number | null, limit: number, qTrimmed: string) {
  const q = qTrimmed.toLowerCase();
  return `${empresaId ?? 'null'}::${limit}::${q}`;
}

async function rpcSearchEmployees(q: string, empresaId: number, limit: number): Promise<EmployeeOption[]> {
  const { data, error } = await supabase.rpc('search_colaboradores', {
    p_query: q,
    p_empresa_id: empresaId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: number; nome: string; empresa_id: number }>;
  return rows.map((r) => ({ id: Number(r.id), nome: String(r.nome), empresaId: Number(r.empresa_id) }));
}

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
  const requestGenerationRef = useRef(0);
  const selectedByIdRef = useRef(selectedById);
  selectedByIdRef.current = selectedById;

  useEffect(() => {
    if (valueIds.length === 0) {
      setSelectedById((prev) => (prev.size ? new Map() : prev));
      return;
    }
    setSelectedById((prev) => {
      let next = prev;
      let changed = false;
      for (const o of options) {
        if (valueIds.includes(o.id) && !next.has(o.id)) {
          if (!changed) {
            next = new Map(prev);
            changed = true;
          }
          next.set(o.id, o);
        }
      }
      return changed ? next : prev;
    });
  }, [options, valueIds]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase || !empresaId) return;
    if (!valueIds.length) return;

    const missing = valueIds.filter((id) => !selectedByIdRef.current.has(id));
    if (!missing.length) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.from('colaboradores').select('id,nome,empresa_id').in('id', missing);
        if (cancelled || error || !data?.length) return;
        setSelectedById((prev) => {
          const next = new Map(prev);
          for (const row of data as Array<Record<string, unknown>>) {
            const id = Number(row.id);
            if (!valueIds.includes(id)) continue;
            next.set(id, {
              id,
              nome: String(row.nome ?? ''),
              empresaId: Number(row.empresa_id ?? row.empresaId),
            });
          }
          return next;
        });
      } catch {
        /* noop */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [valueIds, empresaId]);

  useEffect(() => {
    const qTrim = query.trim();
    requestGenerationRef.current += 1;
    const myGen = requestGenerationRef.current;

    if (!open) return;
    if (!qTrim.length || qTrim.length < minChars || !empresaId || disabled || !isSupabaseConfigured() || !supabase) {
      setLoading(false);
      setOptions([]);
      return;
    }

    const ck = cacheKey(empresaId, limit, qTrim);
    const cached = cacheRef.current.get(ck);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setLoading(false);
      setOptions(cached.options);
      return;
    }

    setLoading(false);
    const tid = window.setTimeout(() => {
      if (myGen !== requestGenerationRef.current) return;

      const c2 = cacheRef.current.get(ck);
      if (c2 && Date.now() - c2.ts < CACHE_TTL_MS) {
        setOptions(c2.options);
        setLoading(false);
        return;
      }

      setLoading(true);
      void rpcSearchEmployees(qTrim, empresaId, limit)
        .then((mapped) => {
          if (myGen !== requestGenerationRef.current) return;
          cacheRef.current.set(ck, { options: mapped, ts: Date.now() });
          setOptions(mapped);
        })
        .catch(() => {
          if (myGen !== requestGenerationRef.current) return;
          setOptions([]);
        })
        .finally(() => {
          if (myGen !== requestGenerationRef.current) return;
          setLoading(false);
        });
    }, debounceMs);

    return () => window.clearTimeout(tid);
  }, [open, query, minChars, debounceMs, empresaId, limit, disabled]);

  const invalidateRequests = useCallback(() => {
    requestGenerationRef.current += 1;
    setLoading(false);
  }, []);

  const helperText = useMemo(() => {
    const q = query.trim();
    if (!open) return null;
    if (!q.length) return `Digite pelo menos ${minChars} caracteres`;
    if (q.length < minChars) return `Digite pelo menos ${minChars} caracteres`;
    if (!empresaId) return 'Seleccione uma empresa para pesquisar.';
    return null;
  }, [open, query, minChars, empresaId]);

  const selectedOptions = useMemo(() => valueIds.map((id) => selectedById.get(id)).filter(Boolean) as EmployeeOption[], [valueIds, selectedById]);

  function remove(id: number) {
    const next = valueIds.filter((x) => x !== id);
    onChange(
      next,
      selectedOptions.filter((o) => o.id !== id),
    );
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
          invalidateRequests();
          if (!v) {
            setQuery('');
            setOptions([]);
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
            <CommandInput value={query} onValueChange={setQuery} placeholder={placeholder} disabled={loading} autoFocus />
            <CommandList>
              <CommandEmpty>
                {helperText ??
                  (loading ? 'A pesquisar…' : query.trim().length >= minChars ? 'Nenhum colaborador encontrado' : `Digite pelo menos ${minChars} caracteres`)}
              </CommandEmpty>

              <CommandGroup>
                {!loading && !helperText
                  ? options.map((o) => {
                      const already = valueIds.includes(o.id);
                      return (
                        <CommandItem
                          key={o.id}
                          value={`${o.id}-${o.nome}`}
                          keywords={[String(o.id), o.nome]}
                          onSelect={() => {
                            if (already) {
                              setOpen(false);
                              return;
                            }
                            const next = [...valueIds, o.id];
                            const nextOpts = [...selectedOptions, o];
                            setSelectedById((prev) => new Map(prev).set(o.id, o));
                            onChange(next, nextOpts);
                            setOpen(false);
                          }}
                          className={cn(already && 'opacity-60')}
                        >
                          <Check className={cn('mr-2 h-4 w-4', already ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate">{o.nome}</span>
                        </CommandItem>
                      );
                    })
                  : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
