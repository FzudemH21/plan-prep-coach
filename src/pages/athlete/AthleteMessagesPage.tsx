import { useEffect, useRef, useState } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { Send, MessageCircle, Loader2, Paperclip, X, FileText, ImageIcon, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAthleteApp } from '@/hooks/useAthleteApp';
import { useChat } from '@/hooks/useChat';
import type { ChatAttachment } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import type { MessageReference } from '@/hooks/useChat';
import { uploadChatFile } from '@/lib/storage';
import { ChatAttachmentDisplay } from '@/components/chat/ChatAttachmentDisplay';

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

function fileIcon(file: File) {
  if (file.type.startsWith('image/')) return <ImageIcon className="h-3 w-3" />;
  if (file.type.startsWith('video/')) return <Film className="h-3 w-3" />;
  return <FileText className="h-3 w-3" />;
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when page is visible
  useEffect(() => {
    if (!loading && connectionId) markRead();
  }, [loading, connectionId, markRead]);

  const handleSend = async () => {
    const hasText = draft.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if ((!hasText && !hasFiles) || sending || !connectionId) return;
    setSending(true);
    try {
      let attachments: ChatAttachment[] | undefined;
      if (hasFiles) {
        const results = await Promise.all(
          pendingFiles.map((f) => uploadChatFile(connectionId, f))
        );
        attachments = results as ChatAttachment[];
      }
      await sendMessage(draft, { attachments });
      setDraft('');
      setPendingFiles([]);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPendingFiles((prev) => [...prev, ...files]);
    e.target.value = '';
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
                    {/* Text bubble */}
                    {msg.content && (
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
                    )}
                    {/* Attachments */}
                    {msg.attachments?.map((att, i) => (
                      <ChatAttachmentDisplay key={i} attachment={att} isOwn={isOwn} />
                    ))}
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
      <div className="shrink-0 border-t px-3 py-2 bg-background">
        {/* Pending file chips */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {pendingFiles.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1 bg-muted rounded-full px-2 py-0.5 text-xs text-foreground"
              >
                {fileIcon(file)}
                <span className="max-w-[80px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            onChange={handleFileChange}
          />
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
            disabled={(!draft.trim() && pendingFiles.length === 0) || sending}
            className="h-10 w-10 shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
