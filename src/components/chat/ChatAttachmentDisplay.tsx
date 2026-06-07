/**
 * ChatAttachmentDisplay
 *
 * Renders a single chat attachment (image, video, or document).
 * Fetches a 7-day signed URL from Supabase Storage on mount.
 */
import { useEffect, useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { getSignedUrl } from '@/lib/storage';
import type { ChatAttachment } from '@/hooks/useChat';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ChatAttachmentDisplayProps {
  attachment: ChatAttachment;
  isOwn: boolean;
}

export function ChatAttachmentDisplay({ attachment, isOwn }: ChatAttachmentDisplayProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // 7-day signed URL — long enough for casual re-reading of chat history
    getSignedUrl(attachment.path, 60 * 60 * 24 * 7)
      .then(setUrl)
      .catch(() => setError(true));
  }, [attachment.path]);

  if (error) {
    return (
      <span className="text-xs italic opacity-60">[Attachment unavailable]</span>
    );
  }

  if (!url) {
    return <Loader2 className="h-4 w-4 animate-spin opacity-50 my-1" />;
  }

  // ── Image ────────────────────────────────────────────────────────────────────
  if (attachment.type === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-1">
        <img
          src={url}
          alt={attachment.name}
          className="max-w-[220px] max-h-[220px] rounded-xl object-cover cursor-pointer hover:opacity-90 active:opacity-75 transition-opacity"
        />
      </a>
    );
  }

  // ── Video ────────────────────────────────────────────────────────────────────
  if (attachment.type === 'video') {
    return (
      <div className="mt-1 flex flex-col gap-0.5">
        <video
          src={url}
          controls
          preload="metadata"
          className="max-w-[260px] rounded-xl"
        />
        <span className="text-[10px] opacity-60 truncate max-w-[260px]">
          {attachment.name} · {formatSize(attachment.size)}
        </span>
      </div>
    );
  }

  // ── Document ─────────────────────────────────────────────────────────────────
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={attachment.name}
      className={[
        'mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm max-w-[220px]',
        'transition-opacity hover:opacity-80 active:opacity-60',
        isOwn
          ? 'bg-white/20 text-primary-foreground'
          : 'bg-background border border-border text-foreground',
      ].join(' ')}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium leading-tight">{attachment.name}</p>
        <p className="text-[10px] opacity-60">{formatSize(attachment.size)}</p>
      </div>
      <Download className="h-3 w-3 shrink-0 opacity-60" />
    </a>
  );
}
