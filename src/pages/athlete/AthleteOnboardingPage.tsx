import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAthleteApp } from '@/hooks/useAthleteApp';
import { cn } from '@/lib/utils';

const TOTAL_STEPS = 3;

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary (little/no exercise)',
  lightly_active: 'Lightly active (1–3 days/week)',
  moderately_active: 'Moderately active (3–5 days/week)',
  very_active: 'Very active (6–7 days/week)',
  extremely_active: 'Extremely active (athlete/physical job)',
};

export default function AthleteOnboardingPage() {
  const navigate = useNavigate();
  const { connection, updateProfile, loading } = useAthleteApp();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 — Name
  const [firstName, setFirstName] = useState(
    connection?.profileData.firstName ?? connection?.athleteName.split(' ')[0] ?? ''
  );
  const [lastName, setLastName] = useState(
    connection?.profileData.lastName ??
    connection?.athleteName.split(' ').slice(1).join(' ') ?? ''
  );

  // Step 2 — Birthday + Sex
  const [birthday, setBirthday] = useState(connection?.profileData.birthday ?? '');
  const [sex, setSex] = useState(connection?.profileData.sex ?? '');

  // Step 3 — Sport + Team + Activity level
  const [sport, setSport] = useState(connection?.profileData.sports?.[0] ?? '');
  const [team, setTeam] = useState(connection?.profileData.team ?? '');
  const [activityLevel, setActivityLevel] = useState(
    connection?.profileData.dailyActivityLevel ?? ''
  );

  if (loading) return null;

  const handleNext = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthday: birthday || null,
        sex: sex || null,
        sports: sport.trim() ? [sport.trim()] : [],
        team: team.trim() || null,
        dailyActivityLevel: activityLevel || null,
      });
      navigate('/athlete/today', { replace: true });
    } catch (e) {
      console.error('Onboarding save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => navigate('/athlete/today', { replace: true });

  return (
    <div className="min-h-screen flex flex-col bg-background px-5 py-8 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="rounded-full bg-primary/10 p-2.5">
          <Dumbbell className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">Welcome{firstName ? `, ${firstName}` : ''}!</h1>
          <p className="text-xs text-muted-foreground">Let's set up your profile</p>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 rounded-full flex-1 transition-colors',
              i + 1 <= step ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Steps */}
      <div className="flex-1">

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold mb-1">Your name</h2>
              <p className="text-sm text-muted-foreground">Confirm how your coach should see you.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Last name"
                autoComplete="family-name"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold mb-1">About you</h2>
              <p className="text-sm text-muted-foreground">Helps your coach personalise your plan.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="birthday">Date of birth</Label>
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={e => setBirthday(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sex</Label>
              <Select value={sex} onValueChange={setSex}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other / prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold mb-1">Sport & activity</h2>
              <p className="text-sm text-muted-foreground">Your coach uses this for context.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sport">Sport</Label>
              <Input
                id="sport"
                value={sport}
                onChange={e => setSport(e.target.value)}
                placeholder="e.g. 100m Sprint, Football"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team">Team / Club</Label>
              <Input
                id="team"
                value={team}
                onChange={e => setTeam(e.target.value)}
                placeholder="e.g. National Team"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Daily activity level</Label>
              <Select value={activityLevel} onValueChange={setActivityLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVITY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 1 ? (
          <Button variant="outline" onClick={handleBack} className="flex-1 gap-1.5">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        ) : (
          <Button variant="ghost" onClick={handleSkip} className="flex-1 text-muted-foreground">
            Skip
          </Button>
        )}

        {step < TOTAL_STEPS ? (
          <Button onClick={handleNext} className="flex-1 gap-1.5">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleFinish} disabled={saving} className="flex-1">
            {saving ? 'Saving…' : 'Done'}
          </Button>
        )}
      </div>
    </div>
  );
}
