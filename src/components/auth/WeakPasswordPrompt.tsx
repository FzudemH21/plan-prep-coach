/**
 * Right after a login whose password no longer meets the rule (Supabase reports it at sign-in —
 * lib/passwordPolicy): a one-time request to set a new one, before going on.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { hasWeakPassword } from '@/lib/passwordPolicy';
import { ChangePasswordForm } from './ChangePasswordForm';

export function WeakPasswordPrompt() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(hasWeakPassword);
  if (!open) return null;
  return (
    <Dialog open onOpenChange={() => { /* stays until a new password is set */ }}>
      <DialogContent className="sm:max-w-md [&>button[data-dialog-close]]:hidden" onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('auth.pw.weakTitle')}</DialogTitle>
          <DialogDescription>{t('auth.pw.weakText')}</DialogDescription>
        </DialogHeader>
        <ChangePasswordForm requireCurrent={false} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
