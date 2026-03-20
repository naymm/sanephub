import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, ArrowLeft, Star, Heart, MessageCircle, Reply } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import type { Noticia, NoticiaComentario } from '@/types';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mapRowsFromDb } from '@/lib/supabaseMappers';

export default function NoticiaDetalhePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const noticiaId = id ? Number(id) : null;

  const { noticias } = useData();
  const [comentarios, setComentarios] = useState<NoticiaComentario[]>([]);
  const [comentariosLoading, setComentariosLoading] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [myLikeId, setMyLikeId] = useState<number | null>(null);

  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  const noticia: Noticia | undefined = useMemo(() => {
    if (noticiaId == null) return undefined;
    return noticias.find(n => n.id === noticiaId);
  }, [noticiaId, noticias]);

  if (!user) return null;
  if (!noticiaId) return null;

  if (!noticia) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/comunicacao-interna/noticias')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Notícia não encontrada.</p>
      </div>
    );
  }

  const isAdmin = user.perfil === 'Admin';
  const canView = noticia.publicado || isAdmin;

  const loadCommentsAndLikes = useCallback(async () => {
    if (!noticia || !user) return;
    if (!isSupabaseConfigured() || !supabase) return;

    setComentariosLoading(true);
    try {
      const [cRes, lCountRes] = await Promise.all([
        supabase
          .from('noticias_comentarios')
          .select('*')
          .eq('noticia_id', noticia.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('noticias_gostos')
          .select('id', { count: 'exact', head: true })
          .eq('noticia_id', noticia.id),
      ]);

      const cRows = (cRes.data ?? []) as Record<string, unknown>[];
      const mapped = mapRowsFromDb<NoticiaComentario>('noticias_comentarios', cRows);
      setComentarios(mapped);

      setLikesCount(Number(lCountRes.count ?? 0));

      // Gosto é guardado pelo perfil (linha em `profiles`), não apenas por `colaborador_id`.
      const { data: myLikeRows, error: myLikeErr } = await supabase
        .from('noticias_gostos')
        .select('id')
        .eq('noticia_id', noticia.id)
        .eq('empresa_id', noticia.empresaId)
        .eq('autor_perfil_id', user.id)
        .limit(1);
      if (myLikeErr) throw myLikeErr;
      const rawId = (myLikeRows?.[0] as { id?: number | string } | undefined)?.id;
      setMyLikeId(rawId != null ? Number(rawId) : null);
    } catch (e) {
      console.error('[NoticiaDetalhePage] loadCommentsAndLikes failed', e);
    } finally {
      setComentariosLoading(false);
    }
  }, [noticia, user]);

  useEffect(() => {
    if (!canView) return;
    void loadCommentsAndLikes();
  }, [canView, loadCommentsAndLikes]);

  const topLevelComments = useMemo(
    () => comentarios.filter(c => c.parentComentarioId == null),
    [comentarios],
  );

  const repliesByParentId = useMemo(() => {
    const map = new Map<number, NoticiaComentario[]>();
    for (const c of comentarios) {
      if (c.parentComentarioId == null) continue;
      const arr = map.get(c.parentComentarioId) ?? [];
      arr.push(c);
      map.set(c.parentComentarioId, arr);
    }
    return map;
  }, [comentarios]);

  const submitComment = useCallback(
    async (opts: { parentId: number | null; text: string }) => {
      if (!noticia || !user) return;
      if (!isSupabaseConfigured() || !supabase) return;

      const text = opts.text.trim();
      if (!text) return;

      setComentariosLoading(true);
      try {
        await supabase.from('noticias_comentarios').insert({
          empresa_id: noticia.empresaId,
          noticia_id: noticia.id,
          autor_texto: user.nome,
          autor_colaborador_id: user.colaboradorId ?? null,
          conteudo: text,
          parent_comentario_id: opts.parentId,
        });
        setCommentText('');
        setReplyText('');
        setReplyToId(null);
        await loadCommentsAndLikes();
      } catch (e) {
        console.error('[NoticiaDetalhePage] submitComment failed', e);
      } finally {
        setComentariosLoading(false);
      }
    },
    [loadCommentsAndLikes, noticia, user],
  );

  const toggleLike = useCallback(async () => {
    if (!noticia || !user) return;
    if (!isSupabaseConfigured() || !supabase) return;

    setComentariosLoading(true);
    try {
      if (myLikeId != null) {
        await supabase.from('noticias_gostos').delete().eq('id', Number(myLikeId));
      } else {
        await supabase.from('noticias_gostos').insert({
          empresa_id: noticia.empresaId,
          noticia_id: noticia.id,
          autor_perfil_id: user.id,
        });
      }
      await loadCommentsAndLikes();
    } catch (e) {
      console.error('[NoticiaDetalhePage] toggleLike failed', e);
    } finally {
      setComentariosLoading(false);
    }
  }, [loadCommentsAndLikes, myLikeId, noticia, user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => navigate('/comunicacao-interna/noticias')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          {noticia.featured && (
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              <Star className="h-3 w-3" /> Destaque
            </span>
          )}
          <StatusBadge status={noticia.publicado ? 'Publicado' : 'Rascunho'} />
        </div>
      </div>

      {!canView ? (
        <div className="bg-card border border-border/80 rounded-xl p-6 text-sm text-muted-foreground">
          Esta notícia ainda está em rascunho.
        </div>
      ) : (
        <div className="bg-card border border-border/80 rounded-xl overflow-hidden">
          {noticia.imagemUrl && (
            <div className="h-60 bg-muted/30 overflow-hidden">
              <img src={noticia.imagemUrl} alt={noticia.titulo} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <h1 className="page-header">{noticia.titulo}</h1>
            </div>
            <div className={cn('whitespace-pre-wrap text-sm text-foreground', noticia.conteudo ? '' : 'text-muted-foreground')}>
              {noticia.conteudo}
            </div>
            {noticia.publicadoEm && (
              <div className="text-xs text-muted-foreground">
                Publicado em: {new Date(noticia.publicadoEm).toLocaleString('pt-PT')}
              </div>
            )}

            <div className="pt-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Heart
                  className={cn('h-4 w-4', myLikeId != null ? 'text-destructive fill-destructive' : '')}
                />
                <span>{likesCount} gostos</span>
                <span className="mx-2">•</span>
                <MessageCircle className="h-4 w-4" />
                <span>{comentarios.length} comentários</span>
              </div>

              <Button
                variant={myLikeId != null ? 'default' : 'outline'}
                className="gap-2"
                onClick={() => void toggleLike()}
              >
                <Heart className={cn('h-4 w-4', myLikeId != null ? 'fill-background' : '')} />
                Dar gosto
              </Button>
            </div>
          </div>
        </div>
      )}

      {canView && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Comentários</h2>
              <p className="text-sm text-muted-foreground mt-1">Partilha a tua opinião com a equipa.</p>
            </div>
            <div className="text-xs text-muted-foreground">
              {comentariosLoading ? 'Carregando...' : `${comentarios.length} no total`}
            </div>
          </div>

          <div className="space-y-3">
            {comentariosLoading && comentarios.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground bg-card rounded-xl border border-border/80">
                A carregar comentários...
              </div>
            ) : topLevelComments.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground bg-card rounded-xl border border-border/80">
                Ainda não há comentários. Seja o primeiro a comentar.
              </div>
            ) : (
              (() => {
                const renderComment = (c: NoticiaComentario, depth: number) => {
                  const replies = repliesByParentId.get(c.id) ?? [];
                  const isReplying = replyToId === c.id;

                  return (
                    <div key={c.id} className={cn('bg-card rounded-xl border border-border/80', depth === 0 ? 'p-4' : 'p-3')}>
                      <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9 ring-1 ring-border/50">
                          <AvatarFallback>{c.autorTexto?.slice(0, 1).toUpperCase() ?? '?'}</AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground truncate">{c.autorTexto}</p>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(c.createdAt).toLocaleString('pt-PT')}
                            </p>
                          </div>

                          <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{c.conteudo}</p>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setReplyToId(c.id)}>
                              <Reply className="h-4 w-4" />
                              Responder
                            </Button>
                          </div>
                        </div>
                      </div>

                      {isReplying && (
                        <div className="mt-4 space-y-2">
                          <Textarea
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Escreve a tua resposta..."
                            rows={3}
                            disabled={comentariosLoading}
                          />
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReplyToId(null)}
                              disabled={comentariosLoading}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => void submitComment({ parentId: c.id, text: replyText })}
                              disabled={comentariosLoading}
                            >
                              Publicar resposta
                            </Button>
                          </div>
                        </div>
                      )}

                      {replies.length > 0 && (
                        <div className="mt-4 space-y-3 pl-2 border-l border-border/50">
                          {replies.map(r => renderComment(r, depth + 1))}
                        </div>
                      )}
                    </div>
                  );
                };

                return topLevelComments.map(c => renderComment(c, 0));
              })()
            )}
          </div>

          <div className="bg-card rounded-xl border border-border/80 p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-9 w-9 ring-1 ring-border/50">
                <AvatarFallback>{user.nome?.slice(0, 1).toUpperCase() ?? '?'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <Textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Escreve um comentário..."
                  rows={3}
                  disabled={comentariosLoading}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => void submitComment({ parentId: null, text: commentText })}
                    disabled={comentariosLoading || commentText.trim().length === 0}
                  >
                    Comentar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

