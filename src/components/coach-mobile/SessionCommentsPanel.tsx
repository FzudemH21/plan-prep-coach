/**
 * Coach mobile: the comments of a logged session — athlete feedback, exercise comments and the
 * coach's private remarks. A reply goes into the one athlete chat with the comment quoted.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, MessageSquare, Reply, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  fetchCoachRemark, removeCoachExerciseRemark, saveCoachRemark, sendCommentReply, type ExerciseComment,
} from '@/utils/sessionComments';

interface Props {
  connectionId: string;
  logId: string;
  date: string;
  sessionName: string;
  feedback: string | null;
  /** 'coach' when the session was logged with the coach app — its feedback was typed in by the coach */
  startedBy: string | null;
  exerciseComments: ExerciseComment[];
}

interface ReplyTarget { quote: string; exerciseName?: string; sectionName?: string }

export function SessionCommentsPanel({ connectionId, logId, date, sessionName, feedback, startedBy, exerciseComments }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [remark, setRemark] = useState('');
  const [savedRemark, setSavedRemark] = useState('');
  const [exerciseNotes, setExerciseNotes] = useState<ExerciseComment[]>([]);
  const [saving, setSaving] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchCoachRemark(logId).then(r => {
      if (cancelled) return;
      setRemark(r.remark); setSavedRemark(r.remark); setExerciseNotes(r.exerciseRemarks);
    });
    return () => { cancelled = true; };
  }, [logId]);

  const loggedByCoach = startedBy === 'coach';
  const athleteComments = exerciseComments.filter(c => c.author !== 'coach');
  // The coach's own exercise notes: private ones + older ones saved with the session log
  const allExerciseNotes = [...exerciseComments.filter(c => c.author === 'coach'), ...exerciseNotes];

  const removeNote = async (noteId: string) => {
    const next = await removeCoachExerciseRemark(logId, connectionId, noteId);
    if (next) setExerciseNotes(next);
  };

  const sendReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    setSending(true);
    const error = await sendCommentReply(connectionId, replyText, { ...replyTarget, sessionName, date });
    setSending(false);
    if (error) { toast({ title: t('coachMobile.sessionComments.replyError'), description: error, variant: 'destructive' }); return; }
    setReplyTarget(null);
    setReplyText('');
    toast({ title: t('coachMobile.sessionComments.replySent') });
  };

  const saveRemark = async () => {
    setSaving(true);
    const error = await saveCoachRemark(logId, connectionId, remark);
    setSaving(false);
    if (error) { toast({ title: t('coachMobile.sessionComments.remarkError'), description: error, variant: 'destructive' }); return; }
    setSavedRemark(remark.trim());
    toast({ title: t('coachMobile.sessionComments.remarkSaved') });
  };

  const replyButton = (target: ReplyTarget) => (
    <Button variant="ghost" size="sm" className="h-9 px-2 text-xs gap-1 shrink-0 active:opacity-60" onClick={() => setReplyTarget(target)}>
      <Reply className="h-3.5 w-3.5" />
      {t('coachMobile.sessionComments.reply')}
    </Button>
  );

  return (
    <div className="space-y-2">
      {feedback && (
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              {loggedByCoach ? t('coachMobile.sessionComments.feedbackByCoach') : t('coachMobile.sessionComments.feedback')}
            </p>
            {!loggedByCoach && replyButton({ quote: feedback })}
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">{feedback}</p>
        </div>
      )}

      {athleteComments.map(c => (
        <div key={c.id} className="rounded-xl border-l-2 border-violet-400 bg-violet-50/60 dark:bg-violet-950/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {c.exerciseName} · {c.author === 'coach' ? t('coachMobile.sessionComments.notedWhileLogging') : t('coachMobile.sessionComments.athlete')}
            </p>
            {c.author !== 'coach' && replyButton({ quote: c.text, exerciseName: c.exerciseName, sectionName: c.sectionName })}
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">{c.text}</p>
        </div>
      ))}

      <div className="rounded-xl border p-3 space-y-2">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          {t('coachMobile.sessionComments.remarks')}
        </p>
        {allExerciseNotes.length > 0 && (
          <ul className="space-y-1">
            {allExerciseNotes.map(n => (
              <li key={n.id} className="flex items-start gap-2 rounded-lg bg-muted/40 px-2 py-1.5 text-sm">
                <span className="flex-1 min-w-0 whitespace-pre-wrap break-words">
                  <span className="font-medium">{n.exerciseName}:</span> {n.text}
                </span>
                {exerciseNotes.some(e => e.id === n.id) && (
                  <button type="button" onClick={() => void removeNote(n.id)}
                    className="shrink-0 w-8 h-8 -m-1 flex items-center justify-center text-muted-foreground active:text-destructive"
                    aria-label={t('coachMobile.sessionComments.removeNote')}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <Textarea value={remark} onChange={e => setRemark(e.target.value)} rows={3} className="text-sm resize-none"
          placeholder={t('coachMobile.sessionComments.remarksPlaceholder')} />
        <div className="flex justify-end">
          <Button size="sm" className="h-9" disabled={saving || remark.trim() === savedRemark} onClick={saveRemark}>
            {saving ? t('coachMobile.sessionComments.saving') : t('coachMobile.sessionComments.save')}
          </Button>
        </div>
      </div>

      <Dialog open={replyTarget !== null} onOpenChange={o => { if (!o) { setReplyTarget(null); setReplyText(''); } }}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{t('coachMobile.sessionComments.replyTitle')}</DialogTitle>
            <DialogDescription className="text-xs">
              {[replyTarget?.exerciseName, sessionName, new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })].filter(Boolean).join(' · ')}
            </DialogDescription>
          </DialogHeader>
          {replyTarget && (
            <p className="border-l-2 border-muted-foreground/40 pl-2 text-sm italic text-muted-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
              “{replyTarget.quote}”
            </p>
          )}
          <Textarea autoFocus value={replyText} onChange={e => setReplyText(e.target.value)} rows={4} className="resize-none text-sm"
            placeholder={t('coachMobile.sessionComments.replyPlaceholder')} />
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1 h-11" onClick={() => { setReplyTarget(null); setReplyText(''); }}>
              {t('coachMobile.sessionComments.cancel')}
            </Button>
            <Button className="flex-1 h-11" disabled={!replyText.trim() || sending} onClick={sendReply}>
              {sending ? t('coachMobile.sessionComments.sending') : t('coachMobile.sessionComments.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
