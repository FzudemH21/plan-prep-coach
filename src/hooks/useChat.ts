/**
 * useChat
 *
 * Real-time 1:1 chat between coach and athlete, keyed by athlete_connections.id.
 * Works for both sides — role is determined by callerRole prop.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export type SenderRole = 'coach' | 'athlete';
export type MessageType = 'text' | 'exercise_comment';

export interface MessageReference {
  exerciseName?: string;
  sectionName?: string;
  sessionName?: string;
  date?: string; // yyyy-MM-dd
}

export interface ChatMessage {
  id: string;
  connectionId: string;
  senderRole: SenderRole;
  senderAuthUserId: string;
  content: string;
  messageType: MessageType;
  reference?: MessageReference;
  readByCoachAt: string | null;
  readByAthleteAt: string | null;
  createdAt: string;
}

function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as string,
    connectionId: row.connection_id as string,
    senderRole: row.sender_role as SenderRole,
    senderAuthUserId: row.sender_auth_user_id as string,
    content: row.content as string,
    messageType: (row.message_type as MessageType) ?? 'text',
    reference: row.reference as MessageReference | undefined,
    readByCoachAt: row.read_by_coach_at as string | null,
    readByAthleteAt: row.read_by_athlete_at as string | null,
    createdAt: row.created_at as string,
  };
}

interface UseChatOptions {
  connectionId: string | null;
  callerRole: SenderRole;
}

export function useChat({ connectionId, callerRole }: UseChatOptions) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load history ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!connectionId || !user) return;

    let cancelled = false;
    setLoading(true);

    supabase
      .from('chat_messages')
      .select('*')
      .eq('connection_id', connectionId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error('[useChat] load error', error); }
        setMessages((data ?? []).map(rowToMessage));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [connectionId, user]);

  // ── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    if (!connectionId || !user) return;

    const channel = supabase
      .channel(`chat:${connectionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `connection_id=eq.${connectionId}`,
        },
        (payload) => {
          const newMsg = rowToMessage(payload.new as Record<string, unknown>);
          setMessages((prev) => {
            // deduplicate by id
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [connectionId, user]);

  // ── Mark messages as read ───────────────────────────────────────────────────
  const markRead = useCallback(async () => {
    if (!connectionId || !user) return;
    const col = callerRole === 'coach' ? 'read_by_coach_at' : 'read_by_athlete_at';
    const now = new Date().toISOString();
    await supabase
      .from('chat_messages')
      .update({ [col]: now })
      .eq('connection_id', connectionId)
      .is(col, null)
      .neq('sender_auth_user_id', user.id); // only mark the OTHER person's messages
    setMessages((prev) =>
      prev.map((m) =>
        m.senderAuthUserId !== user.id && !m[callerRole === 'coach' ? 'readByCoachAt' : 'readByAthleteAt']
          ? { ...m, [callerRole === 'coach' ? 'readByCoachAt' : 'readByAthleteAt']: now }
          : m
      )
    );
  }, [connectionId, user, callerRole]);

  // ── Send a message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (
      content: string,
      opts?: { messageType?: MessageType; reference?: MessageReference }
    ) => {
      if (!connectionId || !user || !content.trim()) return;

      const row = {
        connection_id: connectionId,
        sender_role: callerRole,
        sender_auth_user_id: user.id,
        content: content.trim(),
        message_type: opts?.messageType ?? 'text',
        reference: opts?.reference ?? null,
      };

      const { error } = await supabase.from('chat_messages').insert(row);
      if (error) {
        console.error('[useChat] send error', error);
        throw error;
      }
    },
    [connectionId, user, callerRole]
  );

  // ── Unread count (messages FROM the other side that haven't been read) ──────
  const unreadCount = messages.filter((m) => {
    if (m.senderRole === callerRole) return false; // own messages
    const readAt = callerRole === 'coach' ? m.readByCoachAt : m.readByAthleteAt;
    return !readAt;
  }).length;

  return { messages, loading, sendMessage, markRead, unreadCount };
}

// ── useUnreadCounts ─────────────────────────────────────────────────────────
// Lightweight hook that returns unread counts across ALL connections for the
// coach, without subscribing to full message history.

export interface ConnectionUnread {
  connectionId: string;
  count: number;
}

export function useUnreadCounts(
  connectionIds: string[],
  callerRole: SenderRole
) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    if (!user || connectionIds.length === 0) return;
    const col = callerRole === 'coach' ? 'read_by_coach_at' : 'read_by_athlete_at';
    const { data, error } = await supabase
      .from('chat_messages')
      .select('connection_id')
      .in('connection_id', connectionIds)
      .is(col, null)
      .neq('sender_role', callerRole);

    if (error) return;
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      const cid = row.connection_id as string;
      map.set(cid, (map.get(cid) ?? 0) + 1);
    }
    setCounts(map);
  }, [user, connectionIds, callerRole]);

  useEffect(() => {
    load();
    // Re-poll every 15 s — lightweight, avoids subscribing N channels
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const totalUnread = Array.from(counts.values()).reduce((a, b) => a + b, 0);

  return { counts, totalUnread, reload: load };
}
