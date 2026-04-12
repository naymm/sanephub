import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { ConversationList } from './ConversationList';
import { ConversationView } from './ConversationView';
import { NewConversationModal } from './NewConversationModal';
import { Plus } from 'lucide-react';

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
        'relative flex w-full min-w-0 overflow-x-hidden rounded-xl border border-border bg-card',
        'max-md:h-full max-md:min-h-0 max-md:flex-1 max-md:flex-col max-md:overflow-hidden max-md:rounded-none max-md:border-0 max-md:bg-[#F0F0F2] max-md:shadow-none',
        'md:h-[calc(100vh-8rem)] md:flex-row md:overflow-hidden md:rounded-xl md:border md:bg-card',
      )}
    >
      <div
        className={cn(
          'relative flex min-h-0 shrink-0 flex-col',
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
        {!selectedId ? (
          <button
            type="button"
            onClick={() => setNewConvoOpen(true)}
            className="fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-4 z-[35] flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-primary-foreground shadow-lg shadow-black/20 md:hidden"
            aria-label="Nova conversa"
          >
            <Plus className="h-7 w-7" strokeWidth={2.25} />
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-col',
          !selectedId
            ? 'max-md:hidden'
            : 'max-md:h-full max-md:min-h-0 max-md:flex-1 max-md:overflow-hidden max-md:rounded-t-3xl max-md:bg-white',
          'md:flex md:flex-1 md:overflow-hidden',
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
    <div className="flex w-full min-w-0 max-w-full min-h-0 flex-1 flex-col md:space-y-4">
      <ChatContent />
    </div>
  );
}
