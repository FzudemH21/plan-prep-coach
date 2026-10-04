import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The athlete's comment quoted above a coach's reply in the chat (reference.quote) — both sides see
 * which comment the answer belongs to. Long comments are cut; tap to expand.
 */
export function ChatQuote({ quote, isOwn }: { quote: string; isOwn: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const long = quote.length > 160;
  return (
    <button
      type="button"
      onClick={() => long && setExpanded(e => !e)}
      className={cn(
        'max-w-[75%] mb-0.5 border-l-2 pl-2 pr-1 py-0.5 text-left text-xs italic text-muted-foreground whitespace-pre-wrap break-words',
        isOwn ? 'border-primary/50' : 'border-muted-foreground/40',
        long && 'cursor-pointer',
      )}
      aria-expanded={long ? expanded : undefined}
    >
      “{long && !expanded ? `${quote.slice(0, 157)}…` : quote}”
    </button>
  );
}
