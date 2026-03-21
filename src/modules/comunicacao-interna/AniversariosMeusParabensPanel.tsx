import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Gift } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type ParabemRow = {
  id: number;
  mensagem: string;
  created_at: string;
  autor_colaborador_id: number;
  autor_nome: string;
};

type Props = {
  destinatarioColaboradorId: number;
};

/**
 * Aba dedicada ao aniversariante: lista completa de parabéns recebidos neste dia.
 */
export function AniversariosMeusParabensPanel({ destinatarioColaboradorId }: Props) {
  const { user } = useAuth();
  const myCid = user?.colaboradorId ?? null;
  const [messages, setMessages] = useState<ParabemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadMessages = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('aniversario_parabens')
        .select('id, mensagem, created_at, autor_colaborador_id')
        .eq('destinatario_colaborador_id', destinatarioColaboradorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = (rows ?? []) as {
        id: number;
        mensagem: string;
        created_at: string;
        autor_colaborador_id: number;
      }[];
      const autorIds = [...new Set(list.map((r) => r.autor_colaborador_id))];
      let nomes = new Map<number, string>();
      if (autorIds.length > 0) {
        const { data: cols, error: e2 } = await supabase
          .from('colaboradores')
          .select('id, nome')
          .in('id', autorIds);
        if (!e2 && cols) {
          nomes = new Map((cols as { id: number; nome: string }[]).map((c) => [c.id, c.nome]));
        }
      }
      setMessages(
        list.map((r) => ({
          ...r,
          autor_nome: nomes.get(r.autor_colaborador_id) ?? 'Colaborador',
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar parabéns');
    } finally {
      setLoading(false);
    }
  }, [destinatarioColaboradorId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const handleDelete = async (id: number) => {
    if (!supabase) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('aniversario_parabens').delete().eq('id', id);
      if (error) throw error;
      toast.success('Mensagem removida');
      await loadMessages();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível remover');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isSupabaseConfigured()) return null;

  return (
    <div className="rounded-xl border border-border/80 bg-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200">
          <Gift className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Os meus parabéns</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Todas as mensagens que os teus colegas te deixaram hoje. Feliz aniversário!
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
        </p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border/60 rounded-lg">
          Ainda não tens mensagens. Partilha esta página com a equipa para receberes os parabéns!
        </p>
      ) : (
        <ScrollArea className="max-h-[min(70vh,520px)] pr-3">
          <ul className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-border/60 bg-background/50 px-4 py-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-foreground">{m.autor_nome}</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      {format(new Date(m.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: pt })}
                    </span>
                    <p className="mt-2 text-foreground whitespace-pre-wrap break-words">{m.mensagem}</p>
                  </div>
                  {myCid === m.autor_colaborador_id ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === m.id}
                      onClick={() => void handleDelete(m.id)}
                      aria-label="Remover mensagem"
                    >
                      {deletingId === m.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
