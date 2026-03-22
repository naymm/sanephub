import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { ConversationList } from './ConversationList';
import { ConversationView } from './ConversationView';
import { NewConversationModal } from './NewConversationModal';

function ChatContent() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newConvoOpen, setNewConvoOpen] = useState(false);

  const cFromUrl = searchParams.get('c');

  useEffect(() => {
    if (cFromUrl) setSelectedId(cFromUrl);
  }, [cFromUrl]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSearchParams({ c: id }, { replace: true });
  };

  const handleCreated = (id: string) => {
    setSelectedId(id);
    setSearchParams({ c: id }, { replace: true });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        Inicie sessão para aceder ao chat.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl border border-border bg-card overflow-hidden">
      <div className="w-80 shrink-0 flex flex-col min-h-0">
        <ConversationList
          selectedId={selectedId}
          onSelect={handleSelect}
          onNewConversation={() => setNewConvoOpen(true)}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <ConversationView conversationId={selectedId} />
      </div>
      <NewConversationModal
        open={newConvoOpen}
        onOpenChange={setNewConvoOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <div className="space-y-4">
      <ChatContent />
    </div>
  );
}
