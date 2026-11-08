/**
 * Which program this browser tab has open in the wizard.
 *
 * The wizard's working copy and `activeProgramId` live in localStorage, which all tabs share. When
 * a second tab opened another program, it replaced them; the first tab kept its own program in
 * memory, and its next save wrote that program into the other one (on 2026-11-01 Junior's plan was
 * saved over Inese's this way). So each tab remembers the program it has loaded — a module variable
 * is per tab — and a save is refused once the shared `activeProgramId` no longer matches it.
 */

const readActive = () => {
  try { return localStorage.getItem('activeProgramId') ?? ''; } catch { return ''; }
};

// At start the tab's wizard state is read from localStorage, so it belongs to the program open there
let tabProgramId = readActive();

/** The program this tab now has loaded ('' or null: a new, not yet saved program) */
export function bindTabToProgram(id: string | null) {
  tabProgramId = id ?? '';
}

/** True when another tab has opened a different program since this tab loaded its own */
export function programSwitchedElsewhere(): boolean {
  return readActive() !== tabProgramId;
}

/** This tab takes over whatever program is open now (after re-reading the wizard state) */
export function bindTabToActiveProgram() {
  tabProgramId = readActive();
}

export class ProgramOpenElsewhereError extends Error {
  constructor() {
    super('Another tab opened a different program. Reload this tab to continue — nothing was saved, so the two programs stay apart.');
    this.name = 'ProgramOpenElsewhereError';
  }
}
