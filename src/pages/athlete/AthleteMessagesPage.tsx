import { useEffect, useRef, useState } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { Send, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAthleteApp } from '@/hooks/useAthleteApp';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { MessageReference } from '@/hooks/useChat';

function formatMessageDate(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'dd MMM, HH:mm');
}

function dayLabel(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, d MMMM');
}

export default function AthleteMessagesPage() {
  const { connection, loading: connLoading, schedule } = useAthleteApp();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleReferenceClick = (ref: MessageReference) => {
    if (!ref.date || !schedule) return;
    const entry = schedule.find((e) => e.date === ref.date);
    if (!entry) return;
    const sessionIdx = ref.sessionName
      ? Math.max(0, entry.sessions.findIndex((s) => s.name === ref.sessionName))
      : 0;
    navigate('/athlete/session', { state: { entry, sessionIdx, log: null } });
  };
  const connectionId = connection?.id ?? null;

  const { messages, loading, sendMessage, markRead } = useChat({
    connectionId,
    callerRole: 'athlete',
  });

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when page is visible
  useEffect(() => {
    if (!loading && connectionId) markRead();
  }, [loading, connectionId, markRead]);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(draft);
      setDraft('');
      textareaRef.current?.focus();
    } catch {
      // error handled silently
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by day for date separators
  const grouped: { day: string; msgs: typeof messages }[] = [];
  for (const msg of messages) {
    const day = msg.createdAt.slice(0, 10);
    const last = grouped[grouped.length - 1];
    if (last && last.day === day) {
      last.msgs.push(msg);
    } else {
      grouped.push({ day, msgs: [msg] });
    }
  }

  if (connLoading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <MessageCircle className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold mb-1">No coach connected</h2>
        <p className="text-sm text-muted-foreground">Connect with your coach to start messaging.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0">
        <p className="text-xs text-muted-foreground">Coach</p>
        <p className="text-sm font-semibold leading-tight">{connection.athleteName ? 'Your Coach' : 'Coach'}</p>
      </div>

      {/* Message list */}
      <ScrollArea className="flex-1 px-3 py-2">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No messages yet. Say hi to your coach!</p>
          </div>
        )}
        {grouped.map(({ day, msgs }) => (
          <div key={day}>
            {/* Day separator */}
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground shrink-0">{dayLabel(day + 'T12:00:00')}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-1">
              {msgs.map((msg) => {
                const isOwn = msg.senderAuthUserId === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}
                  >
                    {msg.messageType === 'exercise_comment' && msg.reference && (
                      <button
                        onClick={() => handleReferenceClick(msg.reference!)}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full mb-0.5 max-w-[80%] text-left hover:opacity-80 active:opacity-60 transition-opacity hover:underline underline-offset-2',
                          isOwn
                            ? 'bg-primary/10 text-primary self-end'
                            : 'bg-muted text-muted-foreground self-start'
                        )}
                      >
                        📎 {[msg.reference.exerciseName, msg.reference.sectionName, msg.reference.sessionName, msg.reference.date ? format(parseISO(msg.reference.date + 'T12:00:00'), 'd MMM yyyy') : undefined].filter(Boolean).join(' · ')}
                      </button>
                    )}
                    <div
                      className={cn(
                        'max-w-[78%] px-3 py-2 rounded-2xl text-sm break-words',
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      )}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {formatMessageDate(msg.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Input bar */}
      <div className="shrink-0 border-t px-3 py-2 flex items-end gap-2 bg-background">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message your coach..."
          rows={1}
          className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm py-2"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="h-10 w-10 shrink-0"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
