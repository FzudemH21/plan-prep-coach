/**
 * TestDetailsDialog — athlete app: how to perform a test (instructions + demo video from the
 * coach's parameter database) and the athlete's last value for it.
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineVideo } from '@/components/athlete-app/InlineVideo';
import type { AthleteCalendarEvent } from '@/hooks/useAthleteApp';

export function TestDetailsDialog({
  event,
  lastValueLabel,
  onClose,
}: {
  event: AthleteCalendarEvent | null;
  /** e.g. "8.5 s · Jun 15" */
  lastValueLabel?: string | null;
  onClose: () => void;
}) {
  const videoUrl = event?.videoUrl?.trim();

  return (
    <Dialog open={!!event} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="w-[calc(100vw-32px)] max-w-[400px] rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{event?.title}</DialogTitle>
          {(event?.targetValue || lastValueLabel) && (
            <DialogDescription className="space-y-0.5">
              {event?.targetValue && (
                <span className="block">Goal: {event.targetValue}{event.unit ? ` ${event.unit}` : ''}</span>
              )}
              {lastValueLabel && <span className="block">Last value: {lastValueLabel}</span>}
            </DialogDescription>
          )}
        </DialogHeader>

        {videoUrl && <InlineVideo url={videoUrl} title={event?.title} />}

        {event?.instructions ? (
          <p className="text-sm leading-relaxed whitespace-pre-line">{event.instructions}</p>
        ) : !videoUrl ? (
          <p className="text-sm text-muted-foreground">No instructions for this test yet.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
