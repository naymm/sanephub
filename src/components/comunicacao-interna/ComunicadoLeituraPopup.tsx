import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Comunicado } from '@/types';
import { labelComunicadoTipo } from '@/modules/comunicacao-interna/comunicadoTipo';
import { comunicadoConteudoToPlainText } from '@/modules/comunicacao-interna/comunicadoConteudoHtml';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function localStorageKey(profileId: number) {
  return `sanep.comunicado_leituras.v1.${profileId}`;
}

function readLocalLidos(profileId: number): Set<number> {
  try {
    const raw = localStorage.getItem(localStorageKey(profileId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)));
  } catch {
    return new Set();
  }
}

function writeLocalLidos(profileId: number, ids: Set<number>) {
  try {
    localStorage.setItem(localStorageKey(profileId), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

/**
 * Comunicados por ler (um de cada vez). "Marcar como lido" ou "Abrir" (ficha) regista leitura e fecha o aviso.
 * Com Supabase: `comunicado_leituras`. Sem Supabase: `localStorage`.
 */
export function ComunicadoLeituraPopup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { comunicados, dataLoading } = useData();

  const [lidos, setLidos] = useState<Set<number>>(() => new Set());
  const [lidosReady, setLidosReady] = useState(false);
  const [marking, setMarking] = useState(false);

  const profileId = user?.id;
  /** Qualquer sessão intranet/portal: não filtrar por módulo nem primeiro acesso. */
  const sessaoActiva = Boolean(user);

  const recarregarLidos = useCallback(async () => {
    if (profileId == null) {
      setLidos(new Set());
      setLidosReady(true);
      return;
    }
    if (!isSupabaseConfigured() || !supabase) {
      setLidos(readLocalLidos(profileId));
      setLidosReady(true);
      return;
    }
    setLidosReady(false);
    const { data, error } = await supabase.from('comunicado_leituras').select('comunicado_id').eq('profile_id', profileId);
    if (error) {
      console.warn('[comunicado_leituras]', error);
      setLidos(readLocalLidos(profileId));
    } else {
      setLidos(new Set((data ?? []).map((r: { comunicado_id: number }) => r.comunicado_id)));
    }
    setLidosReady(true);
  }, [profileId]);

  useEffect(() => {
    void recarregarLidos();
  }, [recarregarLidos]);

  const unreadQueue = useMemo(() => {
    const now = Date.now();
    return [...comunicados]
      .filter(c => {
        if (lidos.has(c.id)) return false;
        const t = new Date(c.publicadoEm).getTime();
        return !Number.isNaN(t) && t <= now;
      })
      .sort((a, b) => new Date(b.publicadoEm).getTime() - new Date(a.publicadoEm).getTime());
  }, [comunicados, lidos]);

  const current: Comunicado | null =
    sessaoActiva && lidosReady && !dataLoading && unreadQueue.length > 0 ? (unreadQueue[0] ?? null) : null;

  const registarLeitura = useCallback(
    async (comunicadoId: number): Promise<boolean> => {
      if (profileId == null) return false;
      setMarking(true);
      try {
        if (isSupabaseConfigured() && supabase) {
          const row = { comunicado_id: comunicadoId, profile_id: profileId };
          const { error } = await supabase.from('comunicado_leituras').insert(row as never);
          if (error && error.code !== '23505') {
            throw new Error(error.message);
          }
        } else {
          const next = new Set(readLocalLidos(profileId));
          next.add(comunicadoId);
          writeLocalLidos(profileId, next);
        }

        setLidos(prev => {
          const n = new Set(prev);
          n.add(comunicadoId);
          return n;
        });
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Não foi possível registar a leitura.');
        return false;
      } finally {
        setMarking(false);
      }
    },
    [profileId],
  );

  const marcarLido = async () => {
    if (!current) return;
    await registarLeitura(current.id);
  };

  const abrirFicha = async () => {
    if (!current) return;
    const id = current.id;
    const ok = await registarLeitura(id);
    if (!ok) return;
    navigate(`/comunicacao-interna/comunicados/${id}`);
  };

  const previewText = current
    ? (current.resumo?.trim() || comunicadoConteudoToPlainText(current.conteudo).slice(0, 280))
    : '';

  if (!sessaoActiva) return null;

  return (
    <AlertDialog open={current != null}>
      <AlertDialogContent
        className={cn(
          'max-h-[min(90dvh,90vh)] overflow-y-auto',
          // Mobile: o base do AlertDialog usa `left-1/2` + `translate-x-1/2` + `w-full` — sem `!` o painel desvia e corta o `rounded`.
          'max-md:!left-[max(1rem,env(safe-area-inset-left,0px))] max-md:!right-[max(1rem,env(safe-area-inset-right,0px))] max-md:!top-auto max-md:!bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] max-md:!translate-x-0 max-md:!translate-y-0 max-md:!w-auto max-md:max-h-[min(88dvh,88svh)] max-md:rounded-2xl max-md:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]',
          'max-md:max-w-[min(32rem,calc(100vw-2rem-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)))]',
        )}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="pr-2">Novo comunicado</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-foreground">
              {current ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {labelComunicadoTipo(current.tipo)}
                  </p>
                  <p className="text-base font-semibold leading-snug">{current.titulo}</p>
                  {previewText ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{previewText}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Publicado em {new Date(current.publicadoEm).toLocaleString('pt-PT')}
                  </p>
                </>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={!current || marking} onClick={() => void abrirFicha()}>
            Abrir
          </Button>
          <Button type="button" className="bg-primary text-primary-foreground" disabled={!current || marking} onClick={() => void marcarLido()}>
            Marcar como lido
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
