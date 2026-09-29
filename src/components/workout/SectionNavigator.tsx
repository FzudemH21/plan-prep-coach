/**
 * SectionNavigator — moving between the sections of a running workout (athlete app + coach
 * mobile logging): ‹ / › step to the previous / next section, each dot jumps to its section
 * (e.g. when an exercise isn't possible right now). Completed sections show green.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The section to continue with after `current`: the next one that isn't complete, wrapping
 * around to skipped earlier sections; null when every other section is complete.
 */
export function nextUnfinishedSection(complete: boolean[], current: number): number | null {
  for (let step = 1; step < complete.length; step++) {
    const i = (current + step) % complete.length;
    if (!complete[i]) return i;
  }
  return null;
}

export function SectionNavigator({
  sectionNames,
  complete,
  currentIdx,
  onSelect,
  labels = { previous: 'Previous section', next: 'Next section' },
}: {
  sectionNames: string[];
  /** Per section: all its sets done */
  complete: boolean[];
  currentIdx: number;
  onSelect: (idx: number) => void;
  labels?: { previous: string; next: string };
}) {
  if (sectionNames.length < 2) return null;
  const navButton = 'w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted active:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none transition-colors';
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        className={navButton}
        disabled={currentIdx === 0}
        onClick={() => onSelect(currentIdx - 1)}
        aria-label={labels.previous}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="flex items-center justify-center flex-wrap min-w-0">
        {sectionNames.map((name, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={name}
            aria-current={i === currentIdx ? 'step' : undefined}
            title={name}
            className="h-11 min-w-[24px] px-1 flex items-center justify-center"
          >
            <span
              className={cn(
                'rounded-full transition-all',
                i === currentIdx
                  ? 'w-5 h-2.5 bg-primary'
                  : complete[i]
                    ? 'w-2.5 h-2.5 bg-green-500'
                    : 'w-2.5 h-2.5 bg-muted-foreground/30',
              )}
            />
          </button>
        ))}
      </div>
      <button
        type="button"
        className={navButton}
        disabled={currentIdx === sectionNames.length - 1}
        onClick={() => onSelect(currentIdx + 1)}
        aria-label={labels.next}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
