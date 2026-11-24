/**
 * "Values from" — which of its method's periodization sessions an exercise takes its values from
 * (ExerciseDistribution.methodSessionSlot). Automatic = the method's Nth session of the week gets
 * Session N; choosing one lets e.g. a hold (Session 1) and a push (Session 2) share a session.
 * Shown only when the method has at least two sessions in the periodization table (or a choice is
 * already set).
 */
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const AUTO = 'auto';

export const slotLabel = (slot: number | undefined) => (slot === undefined ? 'Automatic' : `Session ${slot + 1}`);

/** Whether the choice is offered: the method has ≥ 2 periodization sessions, or one is set already */
export const showsSessionSlot = (count: number, slot: number | undefined) => count >= 2 || slot !== undefined;

function SlotItems({ count, slot, onChange }: { count: number; slot: number | undefined; onChange: (slot: number | undefined) => void }) {
  const n = Math.max(count, (slot ?? -1) + 1);
  return (
    <DropdownMenuRadioGroup
      value={slot === undefined ? AUTO : String(slot)}
      onValueChange={v => onChange(v === AUTO ? undefined : Number(v))}
    >
      <DropdownMenuRadioItem value={AUTO}>Automatic (order in the week)</DropdownMenuRadioItem>
      {Array.from({ length: n }, (_, i) => (
        <DropdownMenuRadioItem key={i} value={String(i)}>Session {i + 1}</DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

/** As a submenu of an exercise's ⋮ menu */
export function SessionSlotSubmenu({ count, slot, onChange }: { count: number; slot: number | undefined; onChange: (slot: number | undefined) => void }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="text-sm">
        Values from: {slotLabel(slot)}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="z-[130]">
        <SlotItems count={count} slot={slot} onChange={onChange} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** A small inline picker (Master Planner card) — read-only text without onChange */
export function SessionSlotInline({ count, slot, onChange }: { count: number; slot: number | undefined; onChange?: (slot: number | undefined) => void }) {
  if (!showsSessionSlot(count, slot)) return null;
  const label = slot === undefined ? 'Values: auto' : `Values: Session ${slot + 1}`;
  if (!onChange) {
    return slot === undefined ? null : <span className="text-[11px] font-medium text-primary">{label}</span>;
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={e => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-0.5 rounded px-1 text-[11px] hover:bg-muted',
            slot === undefined ? 'text-muted-foreground' : 'font-medium text-primary',
          )}
          title="Which periodization session this exercise takes its values from"
        >
          {label}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-[130]" onClick={e => e.stopPropagation()}>
        <SlotItems count={count} slot={slot} onChange={onChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Badge on an exercise card when a session is chosen */
export function SessionSlotBadge({ slot }: { slot: number | undefined }) {
  if (slot === undefined) return null;
  return (
    <span
      className="mt-0.5 shrink-0 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary"
      title={`Values from Session ${slot + 1} of the periodization table`}
    >
      S{slot + 1}
    </span>
  );
}
