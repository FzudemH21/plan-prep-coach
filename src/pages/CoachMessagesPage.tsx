import { useEffect, useRef, useState, useMemo } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { Send, MessageCircle, Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { useChat, useUnreadCounts } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

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

// ── Thread view ───────────────────────────────────────────────────────────────

function ThreadView({
  connectionId,
  athleteName,
  athleteLocalId,
  onBack,
}: {
  connectionId: string;
  athleteName: string;
  athleteLocalId: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { messages, loading, sendMessage, markRead } = useChat({
    connectionId,
    callerRole: 'coach',
  });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!loading) markRead();
  }, [loading, markRead]);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(draft);
      setDraft('');
      textareaRef.current?.focus();
    } catch {
      // silent
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

  const grouped: { day: string; msgs: typeof messages }[] = [];
  for (const msg of messages) {
    const day = msg.createdAt.slice(0, 10);
    const last = grouped[grouped.length - 1];
    if (last && last.day === day) last.msgs.push(msg);
    else grouped.push({ day, msgs: [msg] });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-sm font-semibold leading-tight">{athleteName}</p>
          <p className="text-xs text-muted-foreground">Athlete</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-2">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <MessageCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        )}
        {grouped.map(({ day, msgs }) => (
          <div key={day}>
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground shrink-0">{dayLabel(day + 'T12:00:00')}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-1">
              {msgs.map((msg) => {
                const isOwn = msg.senderRole === 'coach';
                return (
                  <div key={msg.id} className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
                    {msg.messageType === 'exercise_comment' && msg.reference && (
                      <button
                        onClick={() => navigate('/athletes', {
                          state: {
                            openAthleteId: athleteLocalId,
                            defaultTab: 'calendar',
                            defaultCalendarDate: msg.reference?.date,
                            defaultCalendarSessionName: msg.reference?.sessionName,
                          },
                        })}
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full mb-0.5 max-w-[80%] text-left hover:opacity-80 active:opacity-60 transition-opacity hover:underline underline-offset-2',
                          isOwn ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        )}
                      >
                        📎 {[
                          msg.reference.exerciseName,
                          msg.reference.sectionName,
                          msg.reference.sessionName,
                          msg.reference.date ? format(parseISO(msg.reference.date + 'T12:00:00'), 'd MMM yyyy') : undefined,
                        ].filter(Boolean).join(' · ')}
                      </button>
                    )}
                    <div className={cn(
                      'max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words',
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    )}>
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

      {/* Input */}
      <div className="shrink-0 border-t px-4 py-3 flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${athleteName}...`}
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

// ── Inbox list ────────────────────────────────────────────────────────────────

export default function CoachMessagesPage() {
  const { connections, loading: connLoading } = useAthleteConnections();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Only connected athletes (have athlete_auth_user_id)
  const connected = useMemo(
    () => connections.filter((c) => c.athleteAuthUserId),
    [connections]
  );

  const connectionIds = useMemo(() => connected.map((c) => c.id), [connected]);
  const { counts, totalUnread, reload } = useUnreadCounts(connectionIds, 'coach');

  // Reload unread counts when returning to inbox
  useEffect(() => {
    if (!selectedId) reload();
  }, [selectedId, reload]);

  const selectedConn = connected.find((c) => c.id === selectedId);

  if (selectedId && selectedConn) {
    return (
      <ThreadView
        connectionId={selectedId}
        athleteName={selectedConn.athleteName}
        athleteLocalId={selectedConn.athleteLocalId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Messages</h1>
        {totalUnread > 0 && (
          <Badge variant="destructive" className="text-xs">{totalUnread}</Badge>
        )}
      </div>

      {connLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!connLoading && connected.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          <p className="text-base font-semibold mb-1">No connected athletes</p>
          <p className="text-sm text-muted-foreground">Once an athlete connects, you can message them here.</p>
        </div>
      )}

      {!connLoading && connected.length > 0 && (
        <div className="space-y-1">
          {connected.map((conn) => {
            const unread = counts.get(conn.id) ?? 0;
            return (
              <button
                key={conn.id}
                onClick={() => setSelectedId(conn.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors text-left"
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
                  {conn.athleteName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{conn.athleteName}</p>
                  {conn.athleteEmail && (
                    <p className="text-xs text-muted-foreground truncate">{conn.athleteEmail}</p>
                  )}
                </div>
                {unread > 0 && (
                  <Badge variant="destructive" className="shrink-0 text-xs">
                    {unread}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
