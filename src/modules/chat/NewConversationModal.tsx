import { useState } from 'react';
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
import { MessageCircle, Users, X } from 'lucide-react';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { cn } from '@/lib/utils';
import { EmployeeSelect } from '@/components/shared/EmployeeSelect';
import { EmployeeMultiSelect } from '@/components/shared/EmployeeMultiSelect';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationModal({ open, onOpenChange, onCreated }: NewConversationModalProps) {
  const { createPrivateConversation, createGroupConversation } = useChat();
  const isMobile = useIsMobileViewport();
  const [tab, setTab] = useState<'private' | 'group'>('private');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedPrivateLabel, setSelectedPrivateLabel] = useState<{ nome: string; email: string; avatar?: string } | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  const handleCreatePrivate = async () => {
    if (!selectedUserId) return;
    const id = await createPrivateConversation(selectedUserId);
    if (id) {
      onCreated(id);
      onOpenChange(false);
      setSelectedUserId(null);
      setSelectedPrivateLabel(null);
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
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedUserId(null);
      setSelectedPrivateLabel(null);
      setSelectedGroupIds([]);
      setGroupName('');
    }
    onOpenChange(next);
  };

  const privateAvatar = selectedPrivateLabel?.avatar?.trim() || '?';

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
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">Para</span>
                  <div className="min-w-0 flex-1">
                    {tab === 'private' ? (
                      selectedPrivateLabel ? (
                        <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-background px-2 py-1 text-xs font-medium shadow-sm ring-1 ring-black/5">
                          <span className="truncate">{selectedPrivateLabel.nome}</span>
                          <button
                            type="button"
                            className="rounded-full p-0.5 hover:bg-muted"
                            aria-label="Remover destinatário"
                            onClick={() => {
                              setSelectedUserId(null);
                              setSelectedPrivateLabel(null);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <EmployeeSelect
                          selection="profile"
                          valueId={selectedUserId}
                          onChange={(id, opt) => {
                            setSelectedUserId(id);
                            setSelectedPrivateLabel(
                              opt ? { nome: opt.nome, email: opt.email ?? '', avatar: opt.avatar ?? undefined } : null,
                            );
                          }}
                          placeholder="Pesquisar utilizador (mín. 4 letras)…"
                          triggerClassName="h-9 border-0 bg-transparent shadow-none px-0 hover:bg-transparent"
                          popoverContentClassName="w-[min(100vw-2rem,22rem)]"
                        />
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {selectedGroupIds.length === 0
                          ? 'Adicione participantes abaixo'
                          : `${selectedGroupIds.length} participante${selectedGroupIds.length === 1 ? '' : 's'}`}
                      </span>
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
                  {selectedPrivateLabel ? (
                    <p className="text-xs text-muted-foreground">Pode iniciar a conversa.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Pesquise e seleccione um utilizador (mínimo 4 caracteres).</p>
                  )}
                  {selectedPrivateLabel ? (
                    <div className="flex items-center gap-3 rounded-2xl border bg-card px-3 py-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs">{privateAvatar.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{selectedPrivateLabel.nome}</div>
                        <div className="truncate text-xs text-muted-foreground">{selectedPrivateLabel.email}</div>
                      </div>
                    </div>
                  ) : null}
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
                    {selectedGroupIds.length > 0 ? `${selectedGroupIds.length} selecionado(s)` : 'Adicionar participantes'}
                  </p>
                  <EmployeeMultiSelect
                    selection="profile"
                    valueIds={selectedGroupIds}
                    onChange={(ids) => setSelectedGroupIds(ids)}
                    placeholder="Pesquisar utilizador (mín. 4 letras)…"
                  />
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
              <TabsContent value="private" className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">Seleccione um utilizador</p>
                <EmployeeSelect
                  selection="profile"
                  valueId={selectedUserId}
                  onChange={(id, opt) => {
                    setSelectedUserId(id);
                    setSelectedPrivateLabel(
                      opt ? { nome: opt.nome, email: opt.email ?? '', avatar: opt.avatar ?? undefined } : null,
                    );
                  }}
                  placeholder="Pesquisar por nome, email ou utilizador…"
                />
                {selectedPrivateLabel ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{privateAvatar.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{selectedPrivateLabel.nome}</div>
                      <div className="text-xs text-muted-foreground truncate">{selectedPrivateLabel.email}</div>
                    </div>
                  </div>
                ) : null}
              </TabsContent>
              <TabsContent value="group" className="mt-4 space-y-3">
                <div>
                  <Label>Nome do grupo</Label>
                  <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="ex: Equipa Projecto X" className="mt-1" />
                </div>
                <p className="text-sm text-muted-foreground">Participantes</p>
                <EmployeeMultiSelect
                  selection="profile"
                  valueIds={selectedGroupIds}
                  onChange={(ids) => setSelectedGroupIds(ids)}
                  placeholder="Pesquisar utilizador (mín. 4 letras)…"
                />
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              {tab === 'private' ? (
                <Button onClick={handleCreatePrivate} disabled={!selectedUserId}>
                  Iniciar conversa
                </Button>
              ) : (
                <Button onClick={handleCreateGroup} disabled={selectedGroupIds.length === 0}>
                  Criar grupo
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
