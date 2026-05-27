import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dumbbell, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'loading' | 'invalid' | 'form' | 'success';

export default function AthleteConnectPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') ?? '';

  const [step, setStep] = useState<Step>('loading');
  const [athleteName, setAthleteName] = useState('');
  const [connectionId, setConnectionId] = useState('');

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Validate invite code on mount
  useEffect(() => {
    if (!code) { setStep('invalid'); return; }
    supabase
      .from('athlete_connections')
      .select('id, athlete_name, athlete_email, athlete_auth_user_id')
      .eq('invite_code', code)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setStep('invalid'); return; }
        if (data.athlete_auth_user_id) { setStep('invalid'); return; } // already used
        setConnectionId(data.id as string);
        setAthleteName(data.athlete_name as string);
        if (data.athlete_email) setEmail(data.athlete_email as string);
        setStep('form');
      });
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setSubmitting(true);
    try {
      let userId: string | undefined;

      // 1. Try to create a new account; if the email is already registered, sign in instead.
      const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });

      if (signUpError) {
        // "User already registered" — try signing in with the provided credentials
        const alreadyRegistered =
          signUpError.message.toLowerCase().includes('already registered') ||
          signUpError.message.toLowerCase().includes('already exists') ||
          signUpError.status === 422;

        if (!alreadyRegistered) throw signUpError;

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error('This email is already registered. Please use the correct password, or contact your coach for a new invite link.');
        userId = signInData.user?.id;
      } else {
        userId = authData.user?.id;

        // Ensure active session (email confirmation path)
        if (!authData.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) {
            setStep('success');
            setError('confirm-email');
            return;
          }
        }
      }

      if (!userId) throw new Error('Could not determine user ID — please try again.');

      // 2. Tag user as athlete in metadata
      await supabase.auth.updateUser({ data: { role: 'athlete' } });

      // 3. Link the connection row (requires the athlete_claim_connection RLS policy)
      const { error: linkError } = await supabase
        .from('athlete_connections')
        .update({
          athlete_auth_user_id: userId,
          athlete_email: email,
          connected_at: new Date().toISOString(),
        })
        .eq('id', connectionId);
      if (linkError) throw new Error(`Could not link account: ${linkError.message}`);

      setStep('success');
      setTimeout(() => navigate('/athlete/today'), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-full bg-primary/10 p-3">
            <Dumbbell className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Plan Prep Coach</h1>
        </div>

        {/* Loading */}
        {step === 'loading' && (
          <Card>
            <CardContent className="py-8 flex justify-center">
              <p className="text-sm text-muted-foreground">Verifying invite…</p>
            </CardContent>
          </Card>
        )}

        {/* Invalid */}
        {step === 'invalid' && (
          <Card>
            <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="font-medium">Invalid or expired invite link</p>
              <p className="text-sm text-muted-foreground">
                This link has already been used or is no longer valid. Ask your coach to send a new one.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        {step === 'form' && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Welcome, {athleteName}!</CardTitle>
              <CardDescription>
                Create your account to access your training plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    autoComplete="new-password"
                    className={cn(
                      confirmPassword && confirmPassword !== password && 'border-destructive focus-visible:ring-destructive'
                    )}
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Creating account…' : 'Create Account & Sign In'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Success */}
        {step === 'success' && (
          <Card>
            <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
              {error === 'confirm-email' ? (
                <>
                  <CheckCircle2 className="h-8 w-8 text-blue-500" />
                  <p className="font-medium">Check your email</p>
                  <p className="text-sm text-muted-foreground">
                    We sent a confirmation link to <strong>{email}</strong>.
                    Click it, then sign in at{' '}
                    <a href="/athlete/login" className="underline text-primary">athlete login</a>.
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <p className="font-medium">Account created!</p>
                  <p className="text-sm text-muted-foreground">
                    Taking you to your training plan…
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
