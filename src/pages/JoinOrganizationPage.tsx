/**
 * /join?code=… — joining an organization through an invite link (phase 3 of the organization
 * layer). The invited person creates their coach account (or logs in with the invited email) and
 * joins; the database checks the code, the email and that the account isn't a connected athlete.
 */
import { FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dumbbell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { orgErrorKey } from '@/hooks/useOrganization';

interface InviteInfo {
  org_name: string;
  email: string;
  role: 'coach' | 'intern';
  invited_by_name: string | null;
  status: 'open' | 'used' | 'expired' | 'revoked';
}

export default function JoinOrganizationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const code = params.get('code') ?? '';
  const { session, user, loading, signOut } = useAuth();

  const [invite, setInvite] = useState<InviteInfo | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  useEffect(() => {
    if (!code) { setInvite(null); return; }
    supabase.rpc('get_org_invite', { p_code: code }).then(({ data, error: err }) => {
      if (err) console.warn('[JoinOrganization]', err.message);
      const row = (Array.isArray(data) ? data[0] : data) as InviteInfo | undefined;
      setInvite(row ?? null);
    });
  }, [code]);

  const errorText = (key: string) => t(`organization.errors.${key}`, t('organization.errors.unknown'));

  /** Joins with the current session; coach accounts land in the coach app */
  const accept = async () => {
    const { error: err } = await supabase.rpc('accept_org_invite', { p_code: code });
    if (err) throw new Error(orgErrorKey(err));
    // An account once tagged as athlete would be sent to the athlete app — it's a coach now (the
    // database refused the invite if it is still connected as an athlete)
    const { data } = await supabase.auth.getUser();
    if (data.user?.user_metadata?.role === 'athlete') await supabase.auth.updateUser({ data: { role: 'coach' } });
    navigate('/', { replace: true });
  };

  const joinSignedIn = async () => {
    setBusy(true);
    setError(null);
    try { await accept(); } catch (e) { setError(errorText((e as Error).message)); } finally { setBusy(false); }
  };

  const signUpAndJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setError(null);
    if (password.length < 8) { setError(t('organization.join.passwordTooShort')); return; }
    if (password !== confirm) { setError(t('auth.signup.passwordMismatch')); return; }
    setBusy(true);
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: { emailRedirectTo: window.location.href },
      });
      const alreadyRegistered = !!signUpErr && (/already (registered|exists)/i.test(signUpErr.message) || signUpErr.status === 422);
      if (signUpErr && !alreadyRegistered) throw signUpErr;
      if (alreadyRegistered || !data.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: invite.email, password });
        if (signInErr) {
          if (/confirm/i.test(signInErr.message)) { setConfirmEmail(true); return; }
          throw new Error(alreadyRegistered ? t('organization.join.wrongPassword') : signInErr.message);
        }
      }
      await accept();
    } catch (err) {
      const key = orgErrorKey(err);
      setError(key === 'unknown' ? (err as Error).message : errorText(key));
    } finally {
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2">
          <Dumbbell className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-primary">Plan Prep Coach</span>
        </div>
        <Card>{children}</Card>
      </div>
    </div>
  );

  if (invite === undefined || loading) {
    return shell(<CardContent className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent>);
  }

  if (!invite || invite.status !== 'open') {
    const key = invite ? invite.status : 'invalid';
    return shell(
      <CardHeader>
        <CardTitle className="text-xl">{t('organization.join.unavailableTitle')}</CardTitle>
        <CardDescription>{t(`organization.join.status.${key}`)}</CardDescription>
      </CardHeader>,
    );
  }

  const title = t('organization.join.title', { org: invite.org_name });
  const desc = t('organization.join.desc', {
    name: invite.invited_by_name ?? '',
    role: t(`organization.roles.${invite.role}`),
  });

  if (confirmEmail) {
    return shell(
      <CardHeader>
        <CardTitle className="text-xl">{t('auth.signup.checkEmail.title')}</CardTitle>
        <CardDescription>{t('organization.join.confirmEmail', { email: invite.email })}</CardDescription>
      </CardHeader>,
    );
  }

  // Logged in already: join with this account — or switch if it's another email
  if (session && user) {
    const sameEmail = (user.email ?? '').toLowerCase() === invite.email.toLowerCase();
    return shell(
      <>
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!sameEmail && (
            <p className="text-sm">{t('organization.join.otherAccount', { current: user.email, invited: invite.email })}</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter>
          {sameEmail ? (
            <Button className="w-full" onClick={joinSignedIn} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t('organization.join.join')}
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => void signOut()}>{t('organization.join.signOut')}</Button>
          )}
        </CardFooter>
      </>,
    );
  }

  return shell(
    <form onSubmit={signUpAndJoin}>
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t('auth.email')}</Label>
          <Input value={invite.email} readOnly disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="join-password">{t('auth.password')}</Label>
          <Input id="join-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="join-confirm">{t('auth.signup.confirmPassword')}</Label>
          <Input id="join-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">{t('organization.join.existingHint')}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {t('organization.join.join')}
        </Button>
      </CardFooter>
    </form>,
  );
}
