/**
 * Two-step login (optional for coaches): a 6-digit code from an authenticator app in addition to
 * the password — Supabase MFA (TOTP). The database only gives an account that set it up its data
 * once the code was entered (supabase/migrations/20261116_mfa_when_enrolled.sql); MfaGate asks for
 * the code before the app opens.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

const cleanCode = (v: string) => v.replace(/\D/g, '').slice(0, 6);

function CodeInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Input id={id} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={6}
      className="tracking-[0.3em] text-center text-lg w-40" value={value} onChange={(e) => onChange(cleanCode(e.target.value))} />
  );
}

/** Coach settings: switch two-step login on or off */
export function TwoStepLoginCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactorId(data?.totp?.[0]?.id ?? null);
    setLoaded(true);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const start = async () => {
    setError(null); setBusy(true);
    try {
      // A setup that was started but never finished is removed first
      const { data: all } = await supabase.auth.mfa.listFactors();
      for (const f of all?.all ?? []) {
        if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Plan Prep Coach' });
      if (err || !data) throw err ?? new Error('enroll');
      setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode('');
    } catch {
      setError(t('auth.pw.error'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!setup || code.length !== 6) return;
    setError(null); setBusy(true);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.id, code });
    setBusy(false);
    if (err) { setError(t('auth.mfa.wrongCode')); return; }
    setSetup(null);
    toast({ title: t('auth.mfa.enabled') });
    void load();
  };

  const cancel = async () => {
    if (setup) await supabase.auth.mfa.unenroll({ factorId: setup.id }).catch(() => undefined);
    setSetup(null); setError(null);
  };

  const turnOff = async () => {
    if (!factorId) return;
    setBusy(true);
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (err) { setError(t('auth.pw.error')); return; }
    toast({ title: t('auth.mfa.disabled') });
    void load();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{t('auth.mfa.title')}</CardTitle>
        <CardDescription>{t('auth.mfa.text')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!loaded ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : setup ? (
          <form onSubmit={confirm} className="space-y-3">
            <p className="text-sm">{t('auth.mfa.scan')}</p>
            <img src={setup.qr} alt="QR code" className="h-44 w-44 rounded border bg-white p-2" />
            <p className="text-xs text-muted-foreground">{t('auth.mfa.secret')} <code className="select-all break-all">{setup.secret}</code></p>
            <div className="space-y-1.5">
              <Label htmlFor="mfa-setup-code">{t('auth.mfa.code')}</Label>
              <CodeInput id="mfa-setup-code" value={code} onChange={setCode} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('auth.mfa.confirm')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void cancel()}>{t('auth.mfa.cancel')}</Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{factorId ? t('auth.mfa.on') : t('auth.mfa.off')}</p>
            {factorId ? (
              <Button variant="outline" size="sm" onClick={() => void turnOff()} disabled={busy}>{t('auth.mfa.turnOff')}</Button>
            ) : (
              <Button size="sm" onClick={() => void start()} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('auth.mfa.setUp')}
              </Button>
            )}
          </div>
        )}
        {error && !setup && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

/** Before the app opens: the code, when this account has two-step login set up */
export function MfaGate({ token, children }: { token: string | undefined; children: ReactNode }) {
  const { t } = useTranslation();
  const [needed, setNeeded] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!cancelled) setNeeded(!!data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2');
    });
    return () => { cancelled = true; };
  }, [token]);

  if (needed === null) return null;
  if (!needed) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setError(null); setBusy(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const factorId = data?.totp?.[0]?.id;
    const { error: err } = factorId
      ? await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      : { error: new Error('no factor') };
    setBusy(false);
    if (err) { setError(t('auth.mfa.wrongCode')); setCode(''); return; }
    setNeeded(false); // the new session (aal2) follows through the auth listener
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{t('auth.mfa.gateTitle')}</CardTitle>
          <CardDescription>{t('auth.mfa.gateText')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="flex justify-center">
              <CodeInput id="mfa-code" value={code} onChange={setCode} />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('auth.mfa.gateSubmit')}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => void supabase.auth.signOut()}>
              {t('auth.mfa.signOut')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
