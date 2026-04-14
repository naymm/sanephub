import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Users, Search, X } from 'lucide-react';
import { usuariosColaboradoresParaChat } from '@/utils/chatColaboradores';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { cn } from '@/lib/utils';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationModal({ open, onOpenChange, onCreated }: NewConversationModalProps) {
  const { user, usuarios } = useAuth();
  const { createPrivateConversation, createGroupConversation } = useChat();
  const isMobile = useIsMobileViewport();
  const [tab, setTab] = useState<'private' | 'group'>('private');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const others = usuariosColaboradoresParaChat(user, usuarios);
  const filteredOthers = searchQuery.trim()
    ? others.filter(
        u =>
          u.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : others;

  const toggleGroupUser = (id: number) => {
    setSelectedGroupIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleCreatePrivate = async () => {
    if (!selectedUserId) return;
    const id = await createPrivateConversation(selectedUserId);
    if (id) {
      onCreated(id);
      onOpenChange(false);
      setSelectedUserId(null);
      setSearchQuery('');
    }
  };

  const handleCreateGroup = async () => {
    if (selectedGroupIds.length === 0) return;
    const id = await createGroupConversation(groupName.trim() || 'Grupo', selectedGroupIds);
    if (!id) return;
    onCreated(id);
    onOpenChange(false);
    setGroupName('');
    setSelectedGroupIds([]);
    setSearchQuery('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setSearchQuery('');
    onOpenChange(next);
  };

  const selectedUser = useMemo(
    () => (selectedUserId ? others.find(o => o.id === selectedUserId) ?? null : null),
    [others, selectedUserId],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'w-[calc(100vw-1rem)] max-w-md sm:w-full',
          isMobile
            ? 'fixed inset-0 left-0 top-0 h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 p-0 [&>button.absolute]:hidden'
            : 'max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto',
        )}
      >
        {isMobile ? (
          <div className="flex h-full min-h-0 flex-col bg-background">
            <div className="shrink-0 border-b border-border/60 bg-background/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-foreground hover:bg-muted"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex-1 text-center">
                  <div className="text-sm font-semibold leading-tight">Nova conversa</div>
                  <div className="text-[11px] text-muted-foreground">Escolha destinatário(s)</div>
                </div>
                <div className="h-10 w-10" />
              </div>

              <div className="mt-3 rounded-2xl bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Para</span>
                  <div className="min-w-0 flex-1">
                    {tab === 'private' ? (
                      selectedUser ? (
                        <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-background px-2 py-1 text-xs font-medium shadow-sm ring-1 ring-black/5">
                          <span className="truncate">{selectedUser.nome}</span>
                          <button
                            type="button"
                            className="rounded-full p-0.5 hover:bg-muted"
                            aria-label="Remover destinatário"
                            onClick={() => setSelectedUserId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Nome ou email…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="h-9 border-0 bg-transparent pl-6 pr-0 focus-visible:ring-0"
                          />
                        </div>
                      )
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Pesquisar participantes…"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="h-9 border-0 bg-transparent pl-6 pr-0 focus-visible:ring-0"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <Tabs value={tab} onValueChange={v => setTab(v as 'private' | 'group')}>
                  <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/40 p-1">
                    <TabsTrigger value="private" className="rounded-full text-xs">
                      Privada
                    </TabsTrigger>
                    <TabsTrigger value="group" className="rounded-full text-xs">
                      Grupo
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              {tab === 'private' ? (
                <div className="space-y-2">
                  {selectedUser ? (
                    <p className="text-xs text-muted-foreground">Pode iniciar a conversa.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Toque num utilizador para selecionar.</p>
                  )}
                  <div className="space-y-1">
                    {filteredOthers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {others.length === 0
                          ? 'Não há outros utilizadores disponíveis para conversa.'
                          : 'Nenhum resultado para a pesquisa.'}
                      </p>
                    ) : (
                      filteredOthers.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setSelectedUserId(u.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors',
                            selectedUserId === u.id ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-muted/40',
                          )}
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs">{u.avatar}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{u.nome}</div>
                            <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-muted/30 p-3">
                    <Label className="text-xs text-muted-foreground">Nome do grupo</Label>
                    <Input
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      placeholder="Ex: Equipa Projecto X"
                      className="mt-2"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedGroupIds.length > 0 ? `${selectedGroupIds.length} selecionado(s)` : 'Seleccione participantes'}
                  </p>
                  <div className="space-y-1">
                    {filteredOthers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {others.length === 0
                          ? 'Não há outros utilizadores disponíveis para conversa.'
                          : 'Nenhum resultado para a pesquisa.'}
                      </p>
                    ) : (
                      filteredOthers.map(u => {
                        const checked = selectedGroupIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleGroupUser(u.id)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors',
                              checked ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-muted/40',
                            )}
                          >
                            <div
                              className={cn(
                                'h-5 w-5 rounded-md border border-border/80',
                                checked && 'bg-primary border-primary',
                              )}
                              aria-hidden
                            />
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="text-xs">{u.avatar}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">{u.nome}</div>
                              <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-border/60 bg-background/90 px-4 py-3 pb-[max(0.9rem,env(safe-area-inset-bottom,0px))] backdrop-blur-xl">
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-2xl" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                {tab === 'private' ? (
                  <Button type="button" className="min-h-11 flex-1 rounded-2xl" onClick={handleCreatePrivate} disabled={!selectedUserId}>
                    Iniciar
                  </Button>
                ) : (
                  <Button type="button" className="min-h-11 flex-1 rounded-2xl" onClick={handleCreateGroup} disabled={selectedGroupIds.length === 0}>
                    Criar
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nova conversa</DialogTitle>
              <DialogDescription>
                Converse com qualquer utilizador do sistema (todas as empresas). Privada ou grupo.
              </DialogDescription>
            </DialogHeader>
            <Tabs value={tab} onValueChange={v => setTab(v as 'private' | 'group')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="private" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Privada
                </TabsTrigger>
                <TabsTrigger value="group" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Grupo
                </TabsTrigger>
              </TabsList>
              <TabsContent value="private" className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">Seleccione um utilizador</p>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar por nome ou email..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-1">
                  {filteredOthers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {others.length === 0
                        ? 'Não há outros utilizadores disponíveis para conversa.'
                        : 'Nenhum resultado para a pesquisa.'}
                    </p>
                  ) : (
                  filteredOthers.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors md:min-h-0 ${
                        selectedUserId === u.id ? 'bg-primary/15 text-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{u.avatar}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{u.nome}</span>
                      <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                    </button>
                  )))}
                </div>
              </TabsContent>
              <TabsContent value="group" className="mt-4">
                <div className="space-y-3">
                  <div>
                    <Label>Nome do grupo</Label>
                    <Input
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      placeholder="ex: Equipa Projecto X"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Seleccione os participantes</p>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Pesquisar por nome ou email..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
                    {filteredOthers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {others.length === 0
                          ? 'Não há outros utilizadores disponíveis para conversa.'
                          : 'Nenhum resultado para a pesquisa.'}
                      </p>
                    ) : (
                    filteredOthers.map(u => (
                      <label
                        key={u.id}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted md:min-h-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.includes(u.id)}
                          onChange={() => toggleGroupUser(u.id)}
                          className="rounded"
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{u.avatar}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{u.nome}</span>
                      </label>
                    )))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              {tab === 'private' ? (
                <Button onClick={handleCreatePrivate} disabled={!selectedUserId}>Iniciar conversa</Button>
              ) : (
                <Button onClick={handleCreateGroup} disabled={selectedGroupIds.length === 0}>Criar grupo</Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
