/**
 * "Forgot password?" — for coaches and athletes. Without a link: enter the email, Supabase sends a
 * link back to this page. With the link (recovery session): set a new password (lib/passwordPolicy),
 * then into the app. ?app=athlete: the athlete app's sign-in and home.
 *
 * The page's address must be allowed in Supabase (Authentication → URL Configuration → Redirect URLs).
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Dumbbell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const athleteApp = params.get('app') === 'athlete';
  const loginPath = athleteApp ? '/athlete/login' : '/login';
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const linkError = /error_description=/.test(hash) || !!params.get('error_description');
  const [mode, setMode] = useState<'request' | 'set'>(/type=recovery/.test(hash) || params.has('code') ? 'set' : 'request');
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setMode('set');
      if (session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const request = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    const redirectTo = `${window.location.origin}/reset-password${athleteApp ? '?app=athlete' : ''}`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setBusy(false);
    if (err) { setError(err.message || t('auth.pw.error')); return; }
    setSent(true);
  };

  const done = async () => {
    const { data } = await supabase.auth.getUser();
    navigate(data.user?.user_metadata?.role === 'athlete' ? '/athlete' : '/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2">
          <Dumbbell className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold text-primary">Plan Prep Coach</span>
        </div>
        <Card>
          {mode === 'set' ? (
            <>
              <CardHeader>
                <CardTitle className="text-xl">{t('auth.pw.resetTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {linkError ? (
                  <p className="text-sm text-destructive">{t('auth.pw.resetInvalid')}</p>
                ) : !ready ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <ChangePasswordForm requireCurrent={false} submitLabel={t('auth.pw.resetSubmit')} onDone={() => void done()} />
                )}
                <Link to={loginPath} className="block text-sm text-muted-foreground hover:text-foreground">{t('auth.pw.back')}</Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-xl">{t('auth.pw.forgotTitle')}</CardTitle>
                <CardDescription>{t('auth.pw.forgotText')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {linkError && <p className="text-sm text-destructive">{t('auth.pw.resetInvalid')}</p>}
                {sent ? (
                  <p className="text-sm">{t('auth.pw.forgotSent')}</p>
                ) : (
                  <form onSubmit={request} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email">{t('auth.email')}</Label>
                      <Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('auth.pw.forgotSubmit')}
                    </Button>
                  </form>
                )}
                <Link to={loginPath} className="block text-sm text-muted-foreground hover:text-foreground">{t('auth.pw.back')}</Link>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
