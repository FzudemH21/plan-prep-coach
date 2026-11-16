/**
 * The planner (macro-, meso-, microcycle pages) for another coach's program: read-only.
 *
 * Organizations: every coach builds their own programs and changes only those (owners and coaches
 * with "edit all" change every program — lib/programStore). Opening someone else's program shows
 * it in the planner with a banner ("Duplicate as my program"), and everything that would change it
 * is blocked: inputs, action buttons, menus, dropdowns and pickers, click-to-edit areas (data-edit),
 * drag & drop, typing and paste. Navigation keeps working — buttons marked data-nav (steps,
 * mesocycle / microcycle switching, the master planner, back to the library), tabs, expand / collapse
 * (aria-expanded without a popup, chevron toggles), and opening a session to look at it (data-open,
 * clicking only — never dragging). Nothing could be saved anyway: the store and the database refuse
 * changes to the program.
 *
 * The listeners are installed once when the app starts (window, capture phase), so they run before
 * those of any drag & drop library mounted later; they only act while a read-only planner is open.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy, Eye, Hand, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { usePlannerProgram } from '@/hooks/useProgramAccess';
import { useOrgCoaches } from '@/hooks/useOrgCoaches';
import { useTrainingPrograms } from '@/hooks/useTrainingPrograms';
import { useProgramLock } from '@/hooks/useProgramLock';
import { getProgramStoreState, refreshPrograms } from '@/lib/programStore';

/** Elements that act — blocked unless they navigate or open something to look at */
const ACTION = [
  'button', 'input', 'textarea', 'select', 'label', '[role="button"]', '[role="checkbox"]', '[role="switch"]',
  '[role="slider"]', '[role="combobox"]', '[role="option"]', '[role="menuitem"]', '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]', '[role="radio"]', '[role="spinbutton"]', '[contenteditable=""]', '[contenteditable="true"]',
  '[data-edit]', '[draggable="true"]', '[aria-roledescription]', '[data-rbd-drag-handle-draggable-id]',
  // Anything that opens a dropdown, picker or dialog — also badges and other non-buttons
  '[aria-haspopup]',
].join(', ');
/** Things that can be dragged — pressing them is always blocked (a click may still open them) */
const DRAG = '[draggable="true"], [aria-roledescription], [data-rbd-drag-handle-draggable-id], [data-rbd-draggable-id]';
/** Content the planner opens outside its own area (dialogs, sheets, menus, pickers) */
const PORTALS = '[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';
const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
const PRESS = ['pointerdown', 'mousedown', 'touchstart', 'dragstart'];
const ACTIVATE = ['click', 'dblclick', 'auxclick', 'mouseup', 'contextmenu', 'drop'];

/** Expand / collapse and stepping buttons: a chevron icon, no popup */
function isChevronToggle(el: Element): boolean {
  if (el.hasAttribute('aria-haspopup') || el.getAttribute('role') === 'combobox') return false;
  return !!el.querySelector(':scope > svg[class*="lucide-chevron-"]');
}

function navigates(el: Element): boolean {
  if (el.closest('[data-nav], [data-open], [data-dialog-close]')) return true;
  if (el.matches('[role="tab"], a[href]')) return true;
  // Opens / closes a section — but not a dropdown, picker or dialog (those stay closed)
  if (el.matches('[aria-expanded]') && !el.hasAttribute('aria-haspopup') && el.getAttribute('role') !== 'combobox') return true;
  return isChevronToggle(el);
}

const guard: { area: HTMLElement | null } = { area: null };

function inScope(target: EventTarget | null): target is Element {
  return !!guard.area && target instanceof Element && (guard.area.contains(target) || !!target.closest(PORTALS));
}

function blocked(target: Element, press: boolean): boolean {
  if (press && target.closest(DRAG)) return true;
  const el = target.closest(ACTION);
  return !!el && !navigates(el);
}

function stop(e: Event) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }

if (typeof window !== 'undefined') {
  PRESS.forEach(type => window.addEventListener(type, e => { if (inScope(e.target) && blocked(e.target, true)) stop(e); }, { capture: true, passive: false }));
  ACTIVATE.forEach(type => window.addEventListener(type, e => { if (inScope(e.target) && blocked(e.target, false)) stop(e); }, { capture: true, passive: false }));
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!guard.area) return;
    const t = e.target;
    if (e.key === 'Escape' || e.key === 'Tab') return;
    // Shortcuts of the planner (paste, cut, undo, delete) wherever the focus is
    if ((e.ctrlKey || e.metaKey) && /^[vxzyd]$/i.test(e.key)) { if (!(t instanceof Element) || inScope(t) || t === document.body) stop(e); return; }
    if (!inScope(t)) {
      if ((t === document.body || t === document.documentElement) && (e.key === 'Delete' || e.key === 'Backspace')) stop(e);
      return;
    }
    if (t.closest(TYPING) || blocked(t, false)) stop(e);
  }, { capture: true });
  ['beforeinput', 'paste', 'cut'].forEach(type => window.addEventListener(type, e => { if (inScope(e.target)) stop(e); }, { capture: true }));
}

const DIMMED = ':is(button, [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [role="combobox"], [role="menuitem"], [role="option"], [data-edit], [aria-haspopup])'
  + ':not([data-nav]):not([data-nav] *):not([data-open]):not([data-dialog-close]):not([role="tab"])'
  + ':not([aria-expanded]:not([aria-haspopup]):not([role="combobox"])):not(:not([aria-haspopup]):not([role="combobox"]):has(> svg[class*="lucide-chevron-"]))';
const READONLY_CSS = `
.planner-readonly ${DIMMED},
body.planner-readonly-open :is([role="dialog"], [data-radix-popper-content-wrapper]) ${DIMMED} { opacity: .45; cursor: not-allowed; }
.planner-readonly :is(input, textarea, select, [aria-roledescription], [data-rbd-drag-handle-draggable-id]),
body.planner-readonly-open [role="dialog"] :is(input, textarea, select) { cursor: default; }
`;

function ReadOnlyGuard({ children }: { children: ReactNode }) {
  const area = useRef<HTMLDivElement>(null);
  useEffect(() => {
    guard.area = area.current;
    document.body.classList.add('planner-readonly-open');
    return () => {
      guard.area = null;
      document.body.classList.remove('planner-readonly-open');
    };
  }, []);
  return (
    <div ref={area} className="planner-readonly">
      <style>{READONLY_CSS}</style>
      {children}
    </div>
  );
}

function ReadOnlyBanner({ programId, message, children }: { programId: string; message: ReactNode; children?: ReactNode }) {
  const { copyProgram, loadProgramIntoSession } = useTrainingPrograms();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const duplicate = async () => {
    setBusy(true);
    try {
      const copy = await copyProgram(programId);
      if (!copy) throw new Error('not copied');
      loadProgramIntoSession(copy.id, copy);
      toast({ title: 'Your copy is open', description: `"${copy.name}" is yours to change.` });
      // A fresh start: the planner pages keep the program they loaded in memory
      window.location.assign('/macrocycle');
    } catch {
      setBusy(false);
      toast({ title: 'Not copied', description: 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="sticky top-0 z-30 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/80 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">{message}</span>
      </div>
      <div className="flex items-center gap-2">
        {children}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void duplicate()} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
          Duplicate as my program
        </Button>
      </div>
    </div>
  );
}

export function PlannerGate({ children }: { children: ReactNode }) {
  const { mayChange, programId, authorId, name } = usePlannerProgram();
  const { coaches, enabled: severalCoaches, isOwner, myId } = useOrgCoaches();
  const { loadProgramIntoSession } = useTrainingPrograms();
  const [reloading, setReloading] = useState(false);

  // The newest stored version into the planner, then a fresh page (the pages keep what they loaded)
  const loadLatest = useCallback(async () => {
    if (!programId) return;
    setReloading(true);
    await refreshPrograms().catch(() => false);
    const latest = getProgramStoreState().programs.find(p => p.id === programId);
    if (latest) loadProgramIntoSession(latest.id, latest);
    window.location.reload();
  }, [programId, loadProgramIntoSession]);

  // Edit lock: only where several coaches could change the same program
  const lock = useProgramLock(programId, severalCoaches && mayChange && !!programId, () => { void loadLatest(); });

  if (!programId) return <>{children}</>;
  const label = (id: string | null) => coaches.find(c => c.userId === id)?.label ?? '';
  const title = <span className="font-medium">{name || 'This program'}</span>;

  if (!mayChange) {
    const authorName = label(authorId);
    return (
      <>
        <ReadOnlyBanner programId={programId} message={<>{title}<span className="text-muted-foreground"> — {authorName ? `${authorName}'s program` : "another coach's program"}, view only</span></>} />
        <ReadOnlyGuard>{children}</ReadOnlyGuard>
      </>
    );
  }

  if (lock.status === 'other' || lock.status === 'lost' || lock.status === 'freed') {
    const who = lock.holderName || 'Another coach';
    const canTakeOver = isOwner || authorId === myId;
    const message = lock.status === 'other'
      ? <>{title}<span className="text-muted-foreground"> — {who} is editing it right now. You can look through it; changes are possible once they're done.</span></>
      : lock.status === 'lost'
        ? <>{title}<span className="text-muted-foreground"> — {who} took over editing. Your changes until then are saved.</span></>
        : <>{title}<span className="text-muted-foreground"> — {who} is done. Load the latest version to keep editing.</span></>;
    return (
      <>
        <ReadOnlyBanner programId={programId} message={message}>
          {lock.status === 'freed' ? (
            <Button size="sm" className="gap-1.5" onClick={() => void loadLatest()} disabled={reloading}>
              {reloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Load the latest version
            </Button>
          ) : lock.status === 'other' && canTakeOver ? (
            <Button size="sm" variant="outline" className="gap-1.5" disabled={reloading}
              title={`${who} can't save their changes after that — they see that you took over`}
              onClick={async () => { if (await lock.takeOver()) void loadLatest(); }}>
              <Hand className="h-3.5 w-3.5" />Take over editing
            </Button>
          ) : null}
        </ReadOnlyBanner>
        <ReadOnlyGuard>{children}</ReadOnlyGuard>
      </>
    );
  }
  return <>{children}</>;
}
