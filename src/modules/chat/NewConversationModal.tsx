import { useState } from 'react';
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
import { MessageCircle, Users, Search } from 'lucide-react';

interface NewConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewConversationModal({ open, onOpenChange, onCreated }: NewConversationModalProps) {
  const { user, usuarios } = useAuth();
  const { createPrivateConversation, createGroupConversation } = useChat();
  const [tab, setTab] = useState<'private' | 'group'>('private');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const others = usuarios.filter(u => u.id !== user?.id);
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

  const handleCreatePrivate = () => {
    if (!selectedUserId) return;
    const id = createPrivateConversation(selectedUserId);
    if (id) {
      onCreated(id);
      onOpenChange(false);
      setSelectedUserId(null);
      setSearchQuery('');
    }
  };

  const handleCreateGroup = () => {
    if (selectedGroupIds.length === 0) return;
    const id = createGroupConversation(groupName.trim() || 'Grupo', selectedGroupIds);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>Inicie uma conversa privada ou crie um grupo.</DialogDescription>
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
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum utilizador encontrado.</p>
              ) : (
              filteredOthers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full flex items-center gap-3 rounded-md p-2 text-left transition-colors ${
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
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum utilizador encontrado.</p>
                ) : (
                filteredOthers.map(u => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-muted cursor-pointer"
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
      </DialogContent>
    </Dialog>
  );
}
