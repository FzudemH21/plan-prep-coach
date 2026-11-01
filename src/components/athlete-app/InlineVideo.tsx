/**
 * InlineVideo — athlete app: a demo video (test or exercise) that plays inside the app. A YouTube
 * link shows its preview; tapping it starts the player in place. Some channels (e.g. World
 * Athletics) block playback in other apps, so "Open in YouTube" stays available underneath. Any
 * other link is a "Watch video" button.
 */
import { useEffect, useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';

/** YouTube video id from watch / youtu.be / embed / shorts / live links, or a bare 11-character id */
export function youTubeId(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
}

/** A link with a protocol, so the browser doesn't treat it as relative */
function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function InlineVideo({ url, title }: { url: string; title?: string }) {
  const id = youTubeId(url);
  const [playing, setPlaying] = useState(false);
  // Another video (the dialog reused for the next test / exercise) starts as a preview again
  useEffect(() => { setPlaying(false); }, [url]);

  if (!id) {
    return (
      <a
        href={withProtocol(url.trim())}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border text-sm font-medium text-primary active:bg-primary/10"
      >
        <ExternalLink className="h-4 w-4" />
        Watch video
      </a>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative rounded-xl overflow-hidden border bg-black aspect-video">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`}
            title={title ?? 'Video'}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 w-full h-full active:opacity-90"
            aria-label="Play the video"
          >
            <img
              src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
              alt=""
              className="w-full h-full object-cover opacity-90"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-14 h-14 rounded-full bg-black/70 flex items-center justify-center">
                <Play className="h-7 w-7 text-white ml-0.5" fill="currentColor" />
              </span>
            </span>
          </button>
        )}
      </div>
      <a
        href={`https://www.youtube.com/watch?v=${id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-[44px] flex items-center justify-center gap-1.5 text-xs text-muted-foreground active:text-foreground"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open in YouTube
      </a>
    </div>
  );
}
