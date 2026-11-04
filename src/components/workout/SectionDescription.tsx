/**
 * A section's description above its exercises (athlete app + coach logging): the first two lines,
 * "more" opens the rest — long descriptions don't push the exercises down.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export function SectionDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  // Only offer "more" when the text is actually cut off
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
      <p ref={ref} className={cn('whitespace-pre-line', !expanded && 'line-clamp-2')}>{text}</p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-1 -mb-1 min-h-[32px] text-xs font-medium text-primary active:opacity-60"
        >
          {expanded ? 'less' : 'more'}
        </button>
      )}
    </div>
  );
}
