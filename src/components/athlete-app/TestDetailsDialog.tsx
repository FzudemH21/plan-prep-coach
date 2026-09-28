/**
 * TestDetailsDialog — athlete app: how to perform a test (instructions + demo video from the
 * coach's parameter database) and the athlete's last value for it.
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';
import type { AthleteCalendarEvent } from '@/hooks/useAthleteApp';

/** YouTube video id from watch / youtu.be / embed / shorts / live links */
function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

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
  const ytId = videoUrl ? youTubeId(videoUrl) : null;

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

        {videoUrl && (
          ytId ? (
            <div className="rounded-lg overflow-hidden border bg-black aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                title={`${event?.title ?? 'Test'} video`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-lg border text-sm font-medium hover:bg-muted active:bg-muted/80"
            >
              <ExternalLink className="h-4 w-4" />
              Watch video
            </a>
          )
        )}

        {event?.instructions ? (
          <p className="text-sm leading-relaxed whitespace-pre-line">{event.instructions}</p>
        ) : !videoUrl ? (
          <p className="text-sm text-muted-foreground">No instructions for this test yet.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
