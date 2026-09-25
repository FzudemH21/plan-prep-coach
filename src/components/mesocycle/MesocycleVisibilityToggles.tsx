import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MesocycleVisibilityTogglesProps {
  mesocycles: Array<{ id: string; name: string }>;
  visibleIds: Set<string>;
  onToggle: (mesocycleId: string) => void;
  onShowAll: () => void;
  className?: string;
}

/**
 * "Show: All | Mesocycle 1 | Mesocycle 2 …" — pick any combination of mesocycles to display
 * side by side. Used by Method Periodization (step 4) and Exercise Selection (step 5), which
 * share one selection. At least one mesocycle always stays visible.
 */
export function MesocycleVisibilityToggles({ mesocycles, visibleIds, onToggle, onShowAll, className }: MesocycleVisibilityTogglesProps) {
  if (mesocycles.length <= 1) return null;

  return (
    <div className={cn('flex items-center gap-3 flex-wrap', className)}>
      <span className="text-sm text-muted-foreground shrink-0">Show:</span>
      <Button
        variant="outline"
        size="sm"
        onClick={onShowAll}
        disabled={visibleIds.size === mesocycles.length}
        className="h-7 px-3 text-xs shrink-0"
      >
        All
      </Button>
      <div className="h-6 w-px bg-border shrink-0" />
      <div className="flex-1 flex items-center gap-2 overflow-x-auto py-1 pl-1">
        {mesocycles.map((meso) => {
          const isVisible = visibleIds.has(meso.id);
          return (
            <Button
              key={meso.id}
              variant={isVisible ? 'default' : 'outline'}
              size="sm"
              onClick={() => onToggle(meso.id)}
              className={cn(
                'min-w-[80px] shrink-0 transition-all',
                isVisible ? 'ring-2 ring-primary shadow-sm' : 'opacity-60 hover:opacity-100'
              )}
            >
              {meso.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
