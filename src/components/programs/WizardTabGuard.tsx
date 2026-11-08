import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useWizardData } from '@/contexts/WizardDataContext';
import { useAIChatContext } from '@/contexts/AIChatContext';
import { bindTabToActiveProgram, programSwitchedElsewhere } from '@/lib/wizardTabProgram';

const WIZARD_PATHS = ['/macrocycle', '/mesocycle', '/microcycle'];
// Opening a program writes several storage keys; read them once all have arrived
const SETTLE_MS = 300;

/**
 * Another tab opened a different program (see wizardTabProgram.ts). Saving is already refused;
 * this makes the tab follow:
 * - outside the wizard: quietly take over the newly opened program, so the wizard shows it
 * - in the wizard: the page still holds the old program in memory and would keep writing it into
 *   the shared storage, so it's paused until reloaded
 */
export function WizardTabGuard() {
  const { pathname } = useLocation();
  const { loadWizardSession } = useWizardData();
  const aiChat = useAIChatContext();
  const [paused, setPaused] = useState(false);

  const onWizard = WIZARD_PATHS.some(p => pathname.startsWith(p));
  const latest = useRef({ onWizard, loadWizardSession, aiChat });
  latest.current = { onWizard, loadWizardSession, aiChat };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const follow = () => {
      timer = null;
      if (!programSwitchedElsewhere()) return;
      const { onWizard: inWizard, loadWizardSession: reload, aiChat: chats } = latest.current;
      if (inWizard) {
        setPaused(true);
        return;
      }
      reload();
      chats?.initChatsFromLocalStorage();
      bindTabToActiveProgram();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || (e.key !== null && e.key !== 'activeProgramId')) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(follow, SETTLE_MS);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Entering the wizard with another tab's program in storage (e.g. a storage event was missed)
  useEffect(() => {
    if (!onWizard || paused || !programSwitchedElsewhere()) return;
    setPaused(true);
  }, [onWizard, paused, pathname]);

  return (
    <AlertDialog open={paused}>
      <AlertDialogContent onEscapeKeyDown={e => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Program opened in another tab</AlertDialogTitle>
          <AlertDialogDescription>
            Another tab opened a different program, so this tab stopped saving to keep the two programs apart. Reload to continue with the program that is open now.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => window.location.reload()}>Reload</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
