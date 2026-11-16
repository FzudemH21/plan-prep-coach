/**
 * Changing the password (coach settings, athlete app profile, the prompt after a login with a weak
 * password). With requireCurrent the current password is checked first.
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { noteWeakPassword, passwordOk, weakPasswordKey } from '@/lib/passwordPolicy';
import { NewPasswordFields } from './NewPasswordFields';

export function ChangePasswordForm({ requireCurrent = true, onDone, submitLabel }: {
  requireCurrent?: boolean;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!passwordOk(password)) { setError(t('auth.pw.tooWeak')); return; }
    if (password !== repeat) { setError(t('auth.pw.mismatch')); return; }
    setBusy(true);
    try {
      if (requireCurrent) {
        const { data } = await supabase.auth.getUser();
        const email = data.user?.email;
        if (!email) throw new Error('no email');
        const { error: wrong } = await supabase.auth.signInWithPassword({ email, password: current });
        if (wrong) { setError(t('auth.pw.wrongCurrent')); return; }
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        const key = weakPasswordKey(updateErr);
        setError(key ? t(key) : updateErr.message || t('auth.pw.error'));
        return;
      }
      noteWeakPassword(false);
      setCurrent(''); setPassword(''); setRepeat('');
      toast({ title: t('auth.pw.changed') });
      onDone?.();
    } catch {
      setError(t('auth.pw.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {requireCurrent && (
        <div className="space-y-1.5">
          <Label htmlFor="current-password">{t('auth.pw.current')}</Label>
          <Input id="current-password" type="password" autoComplete="current-password" value={current}
            onChange={(e) => setCurrent(e.target.value)} required />
        </div>
      )}
      <NewPasswordFields password={password} repeat={repeat} onPassword={setPassword} onRepeat={setRepeat} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="min-h-[40px]">
        {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {submitLabel ?? t('auth.pw.changeSubmit')}
      </Button>
    </form>
  );
}
