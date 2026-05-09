import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * Combobox pesquisável (Supabase RPC). Por defeito só pede dados após {minChars} caracteres + debounce.
 * Lista limitada a {limit} pela API — adequado mesmo com milhares de colaboradores.
 */
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
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    const qTrim = query.trim();
    requestGenerationRef.current += 1;
    const myGen = requestGenerationRef.current;

    if (!open) {
      return;
    }
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

  useEffect(() => {
    if (valueId == null) {
      setSelected(null);
      return;
    }
    if (selected?.id === valueId) return;
    const fromList = options.find((o) => o.id === valueId);
    if (fromList) {
      setSelected(fromList);
      return;
    }
    if (!isSupabaseConfigured() || !supabase) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase.from('colaboradores').select('id,nome,empresa_id').eq('id', valueId).maybeSingle();
        if (cancelled || error || !data) return;
        const row = data as Record<string, unknown>;
        setSelected({
          id: Number(row.id),
          nome: String(row.nome ?? ''),
          empresaId: Number(row.empresa_id ?? row.empresaId),
        });
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [valueId, options, selected?.id]);

  const helperText = useMemo(() => {
    const q = query.trim();
    if (!open) return null;
    if (!q.length) return `Digite pelo menos ${minChars} caracteres`;
    if (q.length < minChars) return `Digite pelo menos ${minChars} caracteres`;
    if (!empresaId) return 'Seleccione uma empresa para pesquisar.';
    return null;
  }, [open, query, minChars, empresaId]);

  return (
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
            onValueChange={(v) => setQuery(v)}
            placeholder={placeholder}
            disabled={loading}
            autoFocus
          />
          <CommandList>
            <CommandEmpty>
              {helperText ??
                (loading ? 'A pesquisar…' : query.trim().length >= minChars ? 'Nenhum colaborador encontrado' : `Digite pelo menos ${minChars} caracteres`)}
            </CommandEmpty>

            <CommandGroup>
              {valueId != null && !loading ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    setSelected(null);
                    onChange(null, null);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4 opacity-0')} aria-hidden />
                  <span className="truncate text-muted-foreground">Limpar selecção</span>
                </CommandItem>
              ) : null}
              {!loading && !helperText
                ? options.map((o) => (
                    <CommandItem
                      key={o.id}
                      value={`${o.id}-${o.nome}`}
                      keywords={[String(o.id), o.nome]}
                      onSelect={() => {
                        setSelected(o);
                        onChange(o.id, o);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', valueId === o.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{o.nome}</span>
                    </CommandItem>
                  ))
                : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
