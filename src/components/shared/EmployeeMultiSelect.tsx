import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { EmployeeOption, EmployeeSelection } from '@/components/shared/EmployeeSelect';

type Props = {
  valueIds: number[];
  onChange: (nextIds: number[], options?: EmployeeOption[]) => void;
  selection?: EmployeeSelection;
  empresaId?: number | null;
  placeholder?: string;
  disabled?: boolean;
  minChars?: number;
  debounceMs?: number;
  limit?: number;
  className?: string;
  triggerClassName?: string;
  emptyMessage?: string;
};

type CacheEntry = { options: EmployeeOption[]; ts: number };
const CACHE_TTL_MS = 5 * 60_000;
const DEFAULT_MIN = 4;
const DEFAULT_DEBOUNCE = 300;
const DEFAULT_LIMIT = 20;

function cacheKey(selection: EmployeeSelection, empresaId: number | null | undefined, limit: number, qTrimmed: string) {
  const q = qTrimmed.toLowerCase();
  return `${selection}::${empresaId ?? 'null'}::${limit}::${q}`;
}

async function rpcSearchColaboradores(q: string, empresaId: number, limit: number): Promise<EmployeeOption[]> {
  const { data, error } = await supabase!.rpc('search_colaboradores', {
    p_query: q,
    p_empresa_id: empresaId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: number; nome: string; empresa_id: number }>;
  return rows.map((r) => ({
    id: Number(r.id),
    nome: String(r.nome),
    empresaId: Number(r.empresa_id),
  }));
}

async function rpcSearchProfilesChat(q: string, limit: number): Promise<EmployeeOption[]> {
  const { data, error } = await supabase!.rpc('search_profiles_chat', {
    p_query: q,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: number;
    nome: string;
    email: string;
    empresa_id: number | null;
    colaborador_id: number | null;
    avatar: string;
  }>;
  return rows.map((r) => ({
    id: Number(r.id),
    nome: String(r.nome),
    empresaId: r.empresa_id != null ? Number(r.empresa_id) : null,
    email: r.email,
    avatar: r.avatar,
    colaboradorId: r.colaborador_id != null ? Number(r.colaborador_id) : null,
  }));
}

export function EmployeeMultiSelect({
  valueIds,
  onChange,
  selection = 'colaborador',
  empresaId = null,
  placeholder = 'Pesquisar…',
  disabled,
  minChars = DEFAULT_MIN,
  debounceMs = DEFAULT_DEBOUNCE,
  limit = DEFAULT_LIMIT,
  className,
  triggerClassName,
  emptyMessage,
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

  const emptyDefault =
    selection === 'profile' ? 'Nenhum utilizador encontrado' : 'Nenhum colaborador encontrado';
  const emptyResolved = emptyMessage ?? emptyDefault;

  const listMaxClass = limit > 12 ? 'max-h-[min(320px,50dvh)]' : 'max-h-[min(260px,40dvh)]';

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
    if (!isSupabaseConfigured() || !supabase) return;
    if (!valueIds.length) return;

    const missing = valueIds.filter((id) => !selectedByIdRef.current.has(id));
    if (!missing.length) return;

    let cancelled = false;
    void (async () => {
      try {
        if (selection === 'profile') {
          const { data, error } = await supabase.from('profiles').select('id,nome,email,empresa_id,avatar,colaborador_id').in('id', missing);
          if (cancelled || error || !data?.length) return;
          setSelectedById((prev) => {
            const next = new Map(prev);
            for (const row of data as Array<Record<string, unknown>>) {
              const id = Number(row.id);
              if (!valueIds.includes(id)) continue;
              next.set(id, {
                id,
                nome: String(row.nome ?? ''),
                empresaId: row.empresa_id != null ? Number(row.empresa_id) : null,
                email: row.email != null ? String(row.email) : null,
                avatar: row.avatar != null ? String(row.avatar) : null,
                colaboradorId: row.colaborador_id != null ? Number(row.colaborador_id) : null,
              });
            }
            return next;
          });
        } else {
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
        }
      } catch {
        /* noop */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [valueIds, selection]);

  useEffect(() => {
    const qTrim = query.trim();
    requestGenerationRef.current += 1;
    const myGen = requestGenerationRef.current;

    if (!open) return;

    const needEmpresa = selection === 'colaborador' && (empresaId == null || !Number.isFinite(Number(empresaId)));
    if (!qTrim.length || qTrim.length < minChars || needEmpresa || disabled || !isSupabaseConfigured() || !supabase) {
      setLoading(false);
      setOptions([]);
      return;
    }

    const ck = cacheKey(selection, empresaId ?? null, limit, qTrim);
    const cached = cacheRef.current.get(ck);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setLoading(false);
      setOptions(cached.options);
      return;
    }

    const tid = window.setTimeout(() => {
      if (myGen !== requestGenerationRef.current) return;

      const c2 = cacheRef.current.get(ck);
      if (c2 && Date.now() - c2.ts < CACHE_TTL_MS) {
        setOptions(c2.options);
        setLoading(false);
        return;
      }

      setLoading(true);
      const run =
        selection === 'profile'
          ? rpcSearchProfilesChat(qTrim, limit)
          : rpcSearchColaboradores(qTrim, Number(empresaId), limit);

      void run
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
  }, [open, query, minChars, debounceMs, empresaId, limit, disabled, selection]);

  const invalidateRequests = useCallback(() => {
    requestGenerationRef.current += 1;
    setLoading(false);
  }, []);

  const helperText = useMemo(() => {
    const q = query.trim();
    if (!open) return null;
    if (!q.length || q.length < minChars) return `Digite pelo menos ${minChars} caracteres`;
    if (selection === 'colaborador' && (empresaId == null || !Number.isFinite(Number(empresaId)))) {
      return 'Seleccione uma empresa para pesquisar.';
    }
    return null;
  }, [open, query, minChars, empresaId, selection]);

  const selectedOptions = useMemo(
    () => valueIds.map((id) => selectedById.get(id)).filter(Boolean) as EmployeeOption[],
    [valueIds, selectedById],
  );

  function remove(id: number) {
    const next = valueIds.filter((x) => x !== id);
    onChange(
      next,
      selectedOptions.filter((o) => o.id !== id),
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
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
          setQuery('');
          setOptions([]);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled}
            className={cn('w-full justify-between font-normal', triggerClassName)}
          >
            <span className="truncate">{placeholder}</span>
            <span className="flex shrink-0 items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : null}
              <ChevronsUpDown className="h-4 w-4 opacity-50" aria-hidden />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false} className="rounded-md border-0 shadow-none">
            <CommandInput value={query} onValueChange={setQuery} placeholder={placeholder} disabled={loading} autoFocus />
            <CommandList className={cn('overflow-y-auto overscroll-contain', listMaxClass)}>
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                {helperText ??
                  (loading ? 'A pesquisar…' : query.trim().length >= minChars ? emptyResolved : `Digite pelo menos ${minChars} caracteres`)}
              </CommandEmpty>

              <CommandGroup>
                {!loading && !helperText
                  ? options.map((o) => {
                      const already = valueIds.includes(o.id);
                      return (
                        <CommandItem
                          key={`${selection}-${o.id}`}
                          value={`${o.id}-${o.nome}`}
                          keywords={[String(o.id), o.nome, o.email ?? ''].filter(Boolean)}
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
                          <Check className={cn('mr-2 h-4 w-4 shrink-0', already ? 'opacity-100' : 'opacity-0')} aria-hidden />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{o.nome}</div>
                            {selection === 'profile' && o.email ? (
                              <div className="truncate text-xs text-muted-foreground">{o.email}</div>
                            ) : null}
                          </div>
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
