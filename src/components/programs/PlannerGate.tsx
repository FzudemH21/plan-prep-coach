/**
 * The planner (macro-, meso-, microcycle pages) for another coach's program: read-only.
 *
 * Organizations: every coach builds their own programs and changes only those (owners and coaches
 * with "edit all" change every program — lib/programStore). Opening someone else's program shows
 * it in the planner with a banner ("Duplicate as my program"), and everything that would change it
 * is blocked: inputs, action buttons, menu actions, drag & drop, typing and paste. Navigation keeps
 * working — buttons marked data-nav (steps, mesocycle / microcycle switching, back to the library),
 * tabs, and anything that only opens or closes (aria-expanded) — so every detail can be looked at.
 * Nothing could be saved anyway: the store and the database refuse changes to the program.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { usePlannerProgram } from '@/hooks/useProgramAccess';
import { useOrgCoaches } from '@/hooks/useOrgCoaches';
import { useTrainingPrograms } from '@/hooks/useTrainingPrograms';

/** Elements that act — blocked unless they navigate */
const ACTION = [
  'button', 'input', 'textarea', 'select', 'label', '[role="button"]', '[role="checkbox"]', '[role="switch"]',
  '[role="slider"]', '[role="combobox"]', '[role="option"]', '[role="menuitem"]', '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]', '[role="radio"]', '[role="spinbutton"]', '[contenteditable=""]', '[contenteditable="true"]',
  '[draggable="true"]', '[aria-roledescription]',
].join(', ');
/** Navigation and opening / closing — allowed */
const NAV = '[data-nav], [role="tab"], [aria-expanded], a[href]';
/** Content the planner opens outside its own area (dialogs, menus, pickers) */
const PORTALS = '[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';
const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

const READONLY_CSS = `
.planner-readonly :is(button, [role="button"], [role="checkbox"], [role="switch"], [role="radio"]):not([data-nav]):not([role="tab"]):not([aria-expanded]),
body.planner-readonly-open :is([role="dialog"], [data-radix-popper-content-wrapper]) :is(button, [role="button"], [role="menuitem"], [role="option"]):not([data-nav]):not([role="tab"]):not([aria-expanded]):not([data-dialog-close]) {
  opacity: .45; cursor: not-allowed;
}
.planner-readonly :is(input, textarea, select, [aria-roledescription]),
body.planner-readonly-open [role="dialog"] :is(input, textarea, select) { cursor: not-allowed; }
`;

function isDialogClose(el: Element): boolean {
  if (el.hasAttribute('data-dialog-close')) return true;
  const label = `${el.getAttribute('aria-label') ?? ''} ${el.querySelector('.sr-only')?.textContent ?? ''}`.toLowerCase();
  return /\bclose\b/.test(label);
}

function ReadOnlyGuard({ children }: { children: ReactNode }) {
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add('planner-readonly-open');
    const inScope = (target: EventTarget | null): target is Element =>
      target instanceof Element && (!!area.current?.contains(target) || !!target.closest(PORTALS));
    const blocked = (target: Element): boolean => {
      const el = target.closest(ACTION);
      if (!el) return false;
      if (el.closest(NAV) || isDialogClose(el)) return false;
      return true;
    };
    const stop = (e: Event) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };

    const onPointer = (e: Event) => {
      if (inScope(e.target) && blocked(e.target)) stop(e);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (e.key === 'Escape' || e.key === 'Tab') return;
      // Shortcuts of the planner (paste, cut, undo, delete) wherever the focus is
      if ((e.ctrlKey || e.metaKey) && /^[vxzyd]$/i.test(e.key)) { if (!(t instanceof Element) || inScope(t) || t === document.body) stop(e); return; }
      if (!inScope(t)) {
        if ((t === document.body || t === document.documentElement) && (e.key === 'Delete' || e.key === 'Backspace')) stop(e);
        return;
      }
      if (t.closest(TYPING) || blocked(t)) stop(e);
    };
    const onInput = (e: Event) => { if (inScope(e.target)) stop(e); };

    const pointerEvents = ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'dragstart', 'drop', 'touchstart', 'contextmenu'];
    pointerEvents.forEach(type => document.addEventListener(type, onPointer, true));
    document.addEventListener('keydown', onKey, true);
    ['beforeinput', 'paste', 'cut'].forEach(type => document.addEventListener(type, onInput, true));
    return () => {
      document.body.classList.remove('planner-readonly-open');
      pointerEvents.forEach(type => document.removeEventListener(type, onPointer, true));
      document.removeEventListener('keydown', onKey, true);
      ['beforeinput', 'paste', 'cut'].forEach(type => document.removeEventListener(type, onInput, true));
    };
  }, []);

  return (
    <div ref={area} className="planner-readonly">
      <style>{READONLY_CSS}</style>
      {children}
    </div>
  );
}

function ReadOnlyBanner({ programId, authorName, name }: { programId: string; authorName: string; name: string }) {
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
        <span className="truncate">
          <span className="font-medium">{name || 'This program'}</span>
          <span className="text-muted-foreground"> — {authorName ? `${authorName}'s program` : "another coach's program"}, view only</span>
        </span>
      </div>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void duplicate()} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
        Duplicate as my program
      </Button>
    </div>
  );
}

export function PlannerGate({ children }: { children: ReactNode }) {
  const { readOnly, programId, authorId, name } = usePlannerProgram();
  const { coaches } = useOrgCoaches();
  if (!readOnly || !programId) return <>{children}</>;
  const authorName = coaches.find(c => c.userId === authorId)?.label ?? '';
  return (
    <>
      <ReadOnlyBanner programId={programId} authorName={authorName} name={name} />
      <ReadOnlyGuard>{children}</ReadOnlyGuard>
    </>
  );
}
