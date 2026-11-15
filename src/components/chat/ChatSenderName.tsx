/**
 * Who wrote a coach message — once several coaches of an organization write in the same athlete
 * chat. The name comes from the message itself (chat_messages.sender_name, filled by the database).
 *
 * Shown on the first message of a run by the same coach, and only when it helps:
 *  - coach side: when someone other than you has written as coach in this chat (your own then
 *    show as "You")
 *  - athlete side: when more than one coach has written in this chat
 */
import type { ChatMessage } from '@/hooks/useChat';
import { cn } from '@/lib/utils';

export function chatSenderLabels(
  messages: ChatMessage[],
  opts: { viewer: 'coach' | 'athlete'; myId: string | null | undefined; you: string; fallback: string },
): Map<string, string> {
  const labels = new Map<string, string>();
  const coachIds = new Set(messages.filter((m) => m.senderRole === 'coach').map((m) => m.senderAuthUserId));
  const show = opts.viewer === 'coach'
    ? [...coachIds].some((id) => id !== opts.myId)
    : coachIds.size > 1;
  if (!show) return labels;
  messages.forEach((m, i) => {
    if (m.senderRole !== 'coach') return;
    const prev = messages[i - 1];
    if (prev && prev.senderRole === 'coach' && prev.senderAuthUserId === m.senderAuthUserId) return;
    labels.set(m.id, opts.viewer === 'coach' && m.senderAuthUserId === opts.myId
      ? opts.you
      : (m.senderName?.trim() || opts.fallback));
  });
  return labels;
}

export function ChatSenderName({ name, isOwn }: { name: string | undefined; isOwn: boolean }) {
  if (!name) return null;
  return (
    <span className={cn('text-xs text-muted-foreground mt-1.5 mb-0.5 px-1', isOwn ? 'self-end' : 'self-start')}>
      {name}
    </span>
  );
}
