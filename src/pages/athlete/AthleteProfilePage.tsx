import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Dumbbell, Flame, CheckCircle2, Pencil, X, Check, MessageCircle } from 'lucide-react';
import { AthleteProgressTab } from '@/components/athlete-app/AthleteProgressTab';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useAuth } from '@/hooks/useAuth';
import { useAthleteSettings } from '@/hooks/useAthleteSettings';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionLog {
  id: string;
  date: string;
  sessionName: string;
  borgRating: number | null;
  completedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatLogDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function calcStreak(logs: SessionLog[]): number {
  if (logs.length === 0) return 0;
  const days = new Set(logs.map(l => l.date));
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  let streak = 0;
  let cursor = today;
  while (days.has(cursor)) {
    streak++;
    const d = new Date(cursor + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return streak;
}

const BORG_LABELS: Record<number, string> = {
  0: 'Rest', 1: 'Very, Very Easy', 2: 'Easy', 3: 'Moderate',
  4: 'Somewhat Hard', 5: 'Hard', 7: 'Very Hard', 10: 'Maximal',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly active',
  moderately_active: 'Moderately active',
  very_active: 'Very active',
  extremely_active: 'Extremely active',
};

const SEX_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ value, label, icon }: { value: string | number; label: string; icon: React.ReactNode }) {
  return (
    <Card className="flex-1">
      <CardContent className="flex flex-col items-center justify-center py-4 gap-1">
        <div className="text-muted-foreground mb-0.5">{icon}</div>
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground text-center">{label}</span>
      </CardContent>
    </Card>
  );
}

function SessionLogRow({ log }: { log: SessionLog }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <CheckCircle2 className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{log.sessionName}</p>
        <p className="text-xs text-muted-foreground">{formatLogDate(log.date)}</p>
      </div>
      {log.borgRating !== null && (
        <span className="text-xs text-muted-foreground shrink-0">
          RPE {log.borgRating}{BORG_LABELS[log.borgRating] ? ` · ${BORG_LABELS[log.borgRating]}` : ''}
        </span>
      )}
    </div>
  );
}

// ── Profile edit form ─────────────────────────────────────────────────────────

interface ProfileFormState {
  sport: string;
  team: string;
  occupation: string;
  dailyActivityLevel: string;
}

function ProfileCard() {
  const { connection, updateProfile } = useAthleteApp();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileFormState>({
    sport: '',
    team: '',
    occupation: '',
    dailyActivityLevel: '',
  });

  // Sync editable fields from connection profileData
  useEffect(() => {
    if (!connection) return;
    const p = connection.profileData;
    setForm({
      sport: p.sports?.[0] ?? '',
      team: p.team ?? '',
      occupation: p.occupation ?? '',
      dailyActivityLevel: p.dailyActivityLevel ?? '',
    });
  }, [connection]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        sports: form.sport.trim() ? [form.sport.trim()] : [],
        team: form.team.trim() || null,
        occupation: form.occupation.trim() || null,
        dailyActivityLevel: form.dailyActivityLevel || null,
      });
      setEditing(false);
    } catch (e) {
      console.error('Profile save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (connection) {
      const p = connection.profileData;
      setForm({
        sport: p.sports?.[0] ?? '',
        team: p.team ?? '',
        occupation: p.occupation ?? '',
        dailyActivityLevel: p.dailyActivityLevel ?? '',
      });
    }
    setEditing(false);
  };

  const p = connection?.profileData ?? {};

  const displayRow = (label: string, value: string | null | undefined) => (
    <div className="flex justify-between items-baseline py-1.5 border-b last:border-0">
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-sm text-right">{value || <span className="text-muted-foreground/50 text-xs">Not set</span>}</span>
    </div>
  );

  // Identity fields are always read-only (set during sign-up / by coach)
  const identitySection = (
    <div className="mb-3">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1.5">
        Identity · set during sign-up
      </p>
      {displayRow('First name', p.firstName)}
      {displayRow('Last name', p.lastName)}
      {displayRow('Date of birth', p.birthday)}
      {displayRow('Sex', p.sex ? SEX_LABELS[p.sex] ?? p.sex : null)}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Profile Information</CardTitle>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-7 gap-1 text-xs">
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleCancel} className="h-7 w-7 p-0">
              <X className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 gap-1 text-xs">
              <Check className="h-3 w-3" /> {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {!editing ? (
          <div>
            {identitySection}
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1.5">Sport & context</p>
            {displayRow('Sport', p.sports?.[0])}
            {displayRow('Team / Club', p.team)}
            {displayRow('Occupation', p.occupation)}
            {displayRow('Activity level', p.dailyActivityLevel ? ACTIVITY_LABELS[p.dailyActivityLevel] ?? p.dailyActivityLevel : null)}
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {/* Identity fields — read-only in edit mode too */}
            {identitySection}
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Sport & context</p>
            <div className="space-y-1">
              <Label className="text-xs">Sport</Label>
              <Input value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value }))} placeholder="e.g. 100m Sprint" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Team / Club</Label>
              <Input value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))} placeholder="e.g. National Team" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Occupation</Label>
              <Input value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))} placeholder="e.g. Student" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Daily activity level</Label>
              <Select value={form.dailyActivityLevel} onValueChange={v => setForm(f => ({ ...f, dailyActivityLevel: v }))}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary</SelectItem>
                  <SelectItem value="lightly_active">Lightly active</SelectItem>
                  <SelectItem value="moderately_active">Moderately active</SelectItem>
                  <SelectItem value="very_active">Very active</SelectItem>
                  <SelectItem value="extremely_active">Extremely active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ProfileTab = 'overview' | 'progress';

export default function AthleteProfilePage() {
  const navigate = useNavigate();
  const { connection } = useAthleteApp();
  const { signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    if (!connection) return;
    supabase
      .from('athlete_session_logs')
      .select('id, date, session_name, borg_rating, completed_at')
      .eq('athlete_connection_id', connection.id)
      .order('completed_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLogs(
          (data ?? []).map(r => ({
            id: r.id as string,
            date: r.date as string,
            sessionName: r.session_name as string,
            borgRating: r.borg_rating as number | null,
            completedAt: r.completed_at as string,
          }))
        );
        setLogsLoading(false);
      });
  }, [connection]);

  const { chatEnabled, update: updateSettings } = useAthleteSettings();

  const handleSignOut = async () => {
    await signOut();
    navigate('/athlete/login');
  };

  const displayName = connection
    ? [connection.profileData.firstName, connection.profileData.lastName]
        .filter(Boolean).join(' ') || connection.athleteName
    : 'Athlete';
  const initials = getInitials(displayName);
  const email = connection?.athleteEmail;
  const streak = calcStreak(logs);
  const totalSessions = logs.length;

  return (
    <div className="pb-8">

        {/* Avatar + name — always visible regardless of tab */}
        <div className="flex flex-col items-center text-center pt-4 pb-2 px-4">
          <div className="w-[72px] h-[72px] rounded-full bg-primary flex items-center justify-center mb-3">
            <span className="text-2xl font-bold text-primary-foreground">{initials}</span>
          </div>
          <h1 className="text-xl font-bold">{displayName}</h1>
          {email && <p className="text-sm text-muted-foreground mt-0.5">{email}</p>}
        </div>

        {/* Tab strip */}
        <div className="flex border-b mx-4 mb-4">
          {(['overview', 'progress'] as ProfileTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2.5 text-sm font-medium capitalize transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'overview' ? 'Overview' : 'Progress'}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="px-4 space-y-4">
            {/* Stats */}
            <div className="flex gap-3">
              <StatCard
                value={logsLoading ? '–' : totalSessions}
                label="Sessions completed"
                icon={<Dumbbell className="h-4 w-4" />}
              />
              <StatCard
                value={logsLoading ? '–' : streak}
                label="Day streak"
                icon={<Flame className={cn('h-4 w-4', streak > 0 && 'text-orange-500')} />}
              />
            </div>

            {/* Profile info */}
            <ProfileCard />

            {/* Recent sessions */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-3">Recent Sessions</p>
                {logsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : logs.slice(0, 10).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sessions logged yet.</p>
                ) : (
                  logs.slice(0, 10).map(log => <SessionLogRow key={log.id} log={log} />)
                )}
              </CardContent>
            </Card>

            {/* Settings */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Settings</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-0">
                <div className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-2.5">
                    <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Messages &amp; Comments</p>
                      <p className="text-xs text-muted-foreground">Show chat tab, notifications, and exercise comment buttons</p>
                    </div>
                  </div>
                  <Switch
                    checked={chatEnabled}
                    onCheckedChange={v => updateSettings({ chatEnabled: v })}
                    className="ml-3 shrink-0"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sign out */}
            <Button
              variant="outline"
              className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        )}

        {/* Progress tab */}
        {activeTab === 'progress' && connection && (
          <div className="px-4">
            <AthleteProgressTab connection={connection} />
          </div>
        )}

      </div>
  );
}
