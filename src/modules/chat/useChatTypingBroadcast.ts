import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const STOP_MS = 2800;
const PING_MS = 2200;
const PEER_TTL_MS = 4200;

export type ChatTypingPayload = { profileId: number; active: boolean };

/**
 * Indicador «a escrever…» via Supabase Realtime Broadcast (sem tabela).
 * Só com `enabled` (modo Supabase + conversa aberta).
 */
export function useChatTypingBroadcast(args: {
  conversationId: string | null;
  profileId: number;
  enabled: boolean;
}): {
  typingPeerIds: number[];
  onComposerActivity: () => void;
  setTypingInactive: () => void;
} {
  const { conversationId, profileId, enabled } = args;
  const [typingPeers, setTypingPeers] = useState<Map<number, number>>(() => new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    subscribedRef.current = false;
    if (!enabled || !supabase || !conversationId || profileId <= 0) {
      setTypingPeers(new Map());
      return;
    }

    const channelName = `intranet-chat-typing:${conversationId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'typing' }, (msg: { payload?: unknown }) => {
      const raw = msg.payload as ChatTypingPayload | undefined;
      if (!raw || typeof raw.profileId !== 'number') return;
      if (raw.profileId === profileId) return;
      setTypingPeers((prev) => {
        const next = new Map(prev);
        if (raw.active) {
          next.set(raw.profileId, Date.now());
        } else {
          next.delete(raw.profileId);
        }
        return next;
      });
    });

    channel.subscribe((status) => {
      subscribedRef.current = status === 'SUBSCRIBED';
    });

    channelRef.current = channel;

    const sweep = window.setInterval(() => {
      const now = Date.now();
      setTypingPeers((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, t] of prev) {
          if (now - t > PEER_TTL_MS) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 700);

    return () => {
      window.clearInterval(sweep);
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      if (stopTimerRef.current) {
        window.clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      subscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
      setTypingPeers(new Map());
    };
  }, [enabled, conversationId, profileId]);

  const sendTyping = useCallback(
    (active: boolean) => {
      const ch = channelRef.current;
      if (!ch || !subscribedRef.current) return;
      void ch.send({
        type: 'broadcast',
        event: 'typing',
        payload: { profileId, active } satisfies ChatTypingPayload,
      });
    },
    [profileId],
  );

  const clearPing = () => {
    if (pingTimerRef.current) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  };

  const clearStop = () => {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  };

  const setTypingInactive = useCallback(() => {
    clearPing();
    clearStop();
    sendTyping(false);
  }, [sendTyping]);

  const onComposerActivity = useCallback(() => {
    clearStop();
    if (!pingTimerRef.current) {
      sendTyping(true);
      pingTimerRef.current = window.setInterval(() => sendTyping(true), PING_MS);
    }
    stopTimerRef.current = window.setTimeout(() => {
      clearPing();
      sendTyping(false);
    }, STOP_MS);
  }, [sendTyping]);

  const typingPeerIds = [...typingPeers.keys()].sort((a, b) => a - b);

  return { typingPeerIds, onComposerActivity, setTypingInactive };
}
