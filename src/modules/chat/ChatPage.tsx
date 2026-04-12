import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { cn } from '@/lib/utils';
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

  const handleMobileBack = () => {
    setSelectedId(null);
    setSearchParams({}, { replace: true });
  };

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 text-center text-muted-foreground">
        Inicie sessão para aceder ao chat.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card',
        'max-md:flex-col max-md:h-[calc(100dvh-11.5rem)] max-md:rounded-2xl',
        'md:h-[calc(100vh-8rem)] md:flex-row',
      )}
    >
      <div
        className={cn(
          'flex min-h-0 shrink-0 flex-col',
          'max-md:w-full',
          selectedId ? 'max-md:hidden' : 'max-md:min-h-0 max-md:flex-1',
          'md:flex md:w-80',
        )}
      >
        <ConversationList
          selectedId={selectedId}
          onSelect={handleSelect}
          onNewConversation={() => setNewConvoOpen(true)}
        />
      </div>
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-col',
          !selectedId ? 'max-md:hidden' : 'max-md:flex-1',
          'md:flex md:flex-1',
        )}
      >
        <ConversationView conversationId={selectedId} onMobileBack={handleMobileBack} />
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
    <div className="w-full min-w-0 max-w-full md:space-y-4">
      <ChatContent />
    </div>
  );
}
