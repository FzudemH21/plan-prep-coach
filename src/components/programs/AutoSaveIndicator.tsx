import { Check, Loader2, AlertCircle } from 'lucide-react';
import type { AutoSaveStatus } from '@/hooks/useWizardAutoSave';

export function AutoSaveIndicator({ status }: { status: AutoSaveStatus }) {
  if (status === 'idle') return null;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground select-none">
      {status === 'saving' && (
        <><Loader2 className="h-3 w-3 animate-spin" />Saving…</>
      )}
      {status === 'saved' && (
        <><Check className="h-3 w-3 text-emerald-500" />Saved</>
      )}
      {status === 'error' && (
        <><AlertCircle className="h-3 w-3 text-destructive" />Save failed</>
      )}
    </span>
  );
}
