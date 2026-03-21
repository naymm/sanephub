import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Gift, Loader2, Send, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type BirthdayPersonLite = {
  id: number;
  name: string;
  company_id: number;
};

type ParabemRow = {
  id: number;
  mensagem: string;
  created_at: string;
  autor_colaborador_id: number;
  autor_nome: string;
};

type Props = {
  destinatario: BirthdayPersonLite;
  /** Destaca quando o utilizador autenticado é o aniversariante */
  isRecipientMe?: boolean;
  /** Só neste dia é possível enviar/receber parabéns (aniversariantes do dia). */
  isBirthdayToday: boolean;
  className?: string;
};

export function AniversariosParabensBlock({ destinatario, isRecipientMe, isBirthdayToday, className }: Props) {
  const { user } = useAuth();
  const myCid = user?.colaboradorId ?? null;
  const canSend =
    isBirthdayToday &&
    isSupabaseConfigured() &&
    supabase &&
    myCid != null &&
    myCid !== destinatario.id &&
    !isRecipientMe;

  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [messages, setMessages] = useState<ParabemRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const refreshCount = useCallback(async () => {
    if (!isBirthdayToday || !isSupabaseConfigured() || !supabase) return;
    setLoadingCount(true);
    try {
      const { count: c, error } = await supabase
        .from('aniversario_parabens')
        .select('id', { count: 'exact', head: true })
        .eq('destinatario_colaborador_id', destinatario.id);
      if (error) throw error;
      setCount(c ?? 0);
    } catch {
      setCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [destinatario.id, isBirthdayToday]);

  useEffect(() => {
    if (isBirthdayToday) void refreshCount();
  }, [refreshCount, isBirthdayToday]);

  const loadMessages = useCallback(async () => {
    if (!isBirthdayToday || !isSupabaseConfigured() || !supabase) return;
    setLoadingList(true);
    try {
      const { data: rows, error } = await supabase
        .from('aniversario_parabens')
        .select('id, mensagem, created_at, autor_colaborador_id')
        .eq('destinatario_colaborador_id', destinatario.id)
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
      setLoadingList(false);
    }
  }, [destinatario.id, isBirthdayToday]);

  useEffect(() => {
    if (open && isBirthdayToday) void loadMessages();
  }, [open, loadMessages, isBirthdayToday]);

  const handleSend = async () => {
    const t = text.trim();
    if (!supabase || !canSend || !isBirthdayToday || t.length < 1) return;
    setSending(true);
    try {
      const { error } = await supabase.from('aniversario_parabens').insert({
        empresa_id: destinatario.company_id,
        destinatario_colaborador_id: destinatario.id,
        autor_colaborador_id: myCid!,
        mensagem: t,
      });
      if (error) throw error;
      setText('');
      toast.success('Parabéns enviado!');
      await refreshCount();
      await loadMessages();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível enviar');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!supabase) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('aniversario_parabens').delete().eq('id', id);
      if (error) throw error;
      toast.success('Mensagem removida');
      await refreshCount();
      await loadMessages();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível remover');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isSupabaseConfigured()) return null;

  if (!isBirthdayToday) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-border/60 bg-muted/20 px-2 py-2 text-[11px] text-muted-foreground',
          className,
        )}
      >
        As mensagens de parabéns só estão disponíveis <span className="font-medium text-foreground">no dia do aniversário</span> desta
        pessoa.
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn('w-full min-w-0', className)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5 text-left text-xs',
            'hover:bg-muted/50 transition-colors',
          )}
        >
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <Gift className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            {isRecipientMe ? 'Os teus parabéns' : 'Parabéns'}
            {loadingCount ? (
              <Loader2 className="h-3 w-3 animate-spin opacity-60" />
            ) : count != null && count > 0 ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{count}</span>
            ) : null}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 rounded-lg border border-border/50 bg-background/50 p-2">
        {loadingList && open ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> A carregar…
          </p>
        ) : (
          <ScrollArea className="max-h-[200px] pr-2">
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">
                {isRecipientMe
                  ? 'Ainda não tens mensagens. Quando colegas celebrarem contigo, aparecem aqui.'
                  : 'Ainda não há mensagens. Sê o primeiro a parabenizar!'}
              </p>
            ) : (
              <ul className="space-y-2">
                {messages.map((m) => (
                  <li key={m.id} className="rounded-md border border-border/40 bg-card/50 px-2 py-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">{m.autor_nome}</span>
                        <span className="text-muted-foreground ml-1">
                          ·{' '}
                          {format(new Date(m.created_at), "d MMM yyyy, HH:mm", {
                            locale: pt,
                          })}
                        </span>
                        <p className="mt-1 text-foreground whitespace-pre-wrap break-words">{m.mensagem}</p>
                      </div>
                      {myCid === m.autor_colaborador_id ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={deletingId === m.id}
                          onClick={() => void handleDelete(m.id)}
                          aria-label="Remover mensagem"
                        >
                          {deletingId === m.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        )}

        {canSend ? (
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <Textarea
              placeholder="Escreve uma mensagem de parabéns…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              rows={2}
              className="min-h-[60px] text-xs resize-none"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">{text.trim().length}/2000</span>
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={sending || text.trim().length < 1}
                onClick={() => void handleSend()}
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Enviar
              </Button>
            </div>
          </div>
        ) : isRecipientMe || myCid === destinatario.id ? (
          <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
            Não podes enviar parabéns a ti próprio. Usa a aba &quot;Os meus parabéns&quot; para ver todas as mensagens.
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
            Liga a tua conta a um colaborador no perfil para enviar parabéns.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
