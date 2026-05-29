import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { comboboxPopoverContentProps } from '@/components/shared/comboboxPopoverProps';

export type EmployeeSelection = 'colaborador' | 'profile';

export type EmployeeOption = {
  id: number;
  nome: string;
  empresaId: number | null;
  email?: string | null;
  avatar?: string | null;
  colaboradorId?: number | null;
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

export type EmployeeSelectProps = {
  valueId: number | null;
  onChange: (nextId: number | null, option?: EmployeeOption | null) => void;
  /** Pesquisa em `colaboradores` (ERP). Em `profile`, pesquisa em `profiles` (chat / directório). */
  selection?: EmployeeSelection;
  /** Obrigatório quando `selection === 'colaborador'`. Ignorado em `profile`. */
  empresaId?: number | null;
  placeholder?: string;
  disabled?: boolean;
  minChars?: number;
  debounceMs?: number;
  limit?: number;
  className?: string;
  triggerClassName?: string;
  popoverContentClassName?: string;
  /** Mensagem quando não há resultados (após pesquisa válida). */
  emptyMessage?: string;
};

/**
 * Combobox pesquisável com debounce e cache; não carrega listas completas.
 * `selection="profile"`: RPC `search_profiles_chat` (id = `profiles.id`).
 * `selection="colaborador"`: RPC `search_colaboradores` (id = `colaboradores.id`).
 */
export function EmployeeSelect({
  valueId,
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
  popoverContentClassName,
  emptyMessage,
}: EmployeeSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState<EmployeeOption | null>(null);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const requestGenerationRef = useRef(0);

  const emptyDefault =
    selection === 'profile' ? 'Nenhum utilizador encontrado' : 'Nenhum colaborador encontrado';
  const emptyResolved = emptyMessage ?? emptyDefault;

  useEffect(() => {
    const qTrim = query.trim();
    requestGenerationRef.current += 1;
    const myGen = requestGenerationRef.current;

    if (!open) {
      return;
    }

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
        if (selection === 'profile') {
          const { data, error } = await supabase
            .from('profiles')
            .select('id,nome,email,empresa_id,avatar,colaborador_id')
            .eq('id', valueId)
            .maybeSingle();
          if (cancelled || error || !data) return;
          const row = data as Record<string, unknown>;
          setSelected({
            id: Number(row.id),
            nome: String(row.nome ?? ''),
            empresaId: row.empresa_id != null ? Number(row.empresa_id) : null,
            email: row.email != null ? String(row.email) : null,
            avatar: row.avatar != null ? String(row.avatar) : null,
            colaboradorId: row.colaborador_id != null ? Number(row.colaborador_id) : null,
          });
        } else {
          const { data, error } = await supabase.from('colaboradores').select('id,nome,empresa_id').eq('id', valueId).maybeSingle();
          if (cancelled || error || !data) return;
          const row = data as Record<string, unknown>;
          setSelected({
            id: Number(row.id),
            nome: String(row.nome ?? ''),
            empresaId: Number(row.empresa_id ?? row.empresaId),
          });
        }
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [valueId, options, selected?.id, selection]);

  const helperText = useMemo(() => {
    const q = query.trim();
    if (!open) return null;
    if (!q.length || q.length < minChars) return `Digite pelo menos ${minChars} caracteres`;
    if (selection === 'colaborador' && (empresaId == null || !Number.isFinite(Number(empresaId)))) {
      return 'Seleccione uma empresa para pesquisar.';
    }
    return null;
  }, [open, query, minChars, empresaId, selection]);

  const listMaxClass = limit > 12 ? 'max-h-[min(320px,50dvh)]' : 'max-h-[min(260px,40dvh)]';

  return (
    <div className={cn('w-full', className)}>
      <Popover
        modal={false}
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
            <span className="truncate text-left">
              {selected?.nome ?? (valueId != null ? `#${valueId}` : placeholder)}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : null}
              <ChevronsUpDown className="h-4 w-4 opacity-50" aria-hidden />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn('w-[--radix-popover-trigger-width] p-0', popoverContentClassName)}
          align="start"
          {...comboboxPopoverContentProps}
        >
          <Command shouldFilter={false} className="rounded-md border-0 shadow-none">
            <CommandInput
              value={query}
              onValueChange={(v) => setQuery(v)}
              placeholder={placeholder}
              autoFocus
            />
            <CommandList className={cn('overflow-y-auto overscroll-contain', listMaxClass)}>
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                {helperText ?? (loading ? 'A pesquisar…' : query.trim().length >= minChars ? emptyResolved : `Digite pelo menos ${minChars} caracteres`)}
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
                    <Check className="mr-2 h-4 w-4 opacity-0" aria-hidden />
                    <span className="truncate text-muted-foreground">Limpar selecção</span>
                  </CommandItem>
                ) : null}
                {!loading && !helperText
                  ? options.map((o) => (
                      <CommandItem
                        key={`${selection}-${o.id}`}
                        value={`emp-${o.id}`}
                        keywords={[String(o.id), o.nome, o.email ?? ''].filter(Boolean)}
                        onSelect={() => {
                          setSelected(o);
                          onChange(o.id, o);
                          setOpen(false);
                        }}
                      >
                        <Check className={cn('mr-2 h-4 w-4 shrink-0', valueId === o.id ? 'opacity-100' : 'opacity-0')} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{o.nome}</div>
                          {selection === 'profile' && o.email ? (
                            <div className="truncate text-xs text-muted-foreground">{o.email}</div>
                          ) : null}
                        </div>
                      </CommandItem>
                    ))
                  : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
