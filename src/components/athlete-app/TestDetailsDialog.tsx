/**
 * TestDetailsDialog — athlete app: how to perform a test (instructions + demo video from the
 * coach's parameter database) and the athlete's last value for it.
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink, Play } from 'lucide-react';
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
            // Preview that opens the video on YouTube (the YouTube app on a phone). Not embedded:
            // many channels (e.g. World Athletics) block playback inside other apps/websites.
            <a
              href={`https://www.youtube.com/watch?v=${ytId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative rounded-lg overflow-hidden border bg-black aspect-video active:opacity-90"
              aria-label="Watch the video on YouTube"
            >
              <img
                src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                alt=""
                className="w-full h-full object-cover opacity-90"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-14 h-14 rounded-full bg-black/70 flex items-center justify-center">
                  <Play className="h-7 w-7 text-white ml-0.5" fill="currentColor" />
                </span>
              </span>
              <span className="absolute bottom-2 right-2 text-[11px] font-medium text-white bg-black/70 rounded px-1.5 py-0.5">
                Opens YouTube
              </span>
            </a>
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
