import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  CalendarRange,
  CalendarDays,
  Smartphone,
  Copy,
  Check,
  Link2,
  UserX,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Athlete } from '@/types/athlete';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';

// ── Sub-components ────────────────────────────────────────────────────────────

function FeatureToggle({
  label,
  description,
  checked,
  onCheckedChange,
  indent = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  indent?: boolean;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2', indent && 'pl-6')}>
      <div className="space-y-0.5">
        <Label className={cn('text-sm', indent && 'font-normal')}>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// ── Weeks-ahead selector (Supabase-backed) ────────────────────────────────────

function WeeksAheadSelect({ athlete }: { athlete: Athlete }) {
  const { getConnectionForAthlete, updateWeeksAhead } = useAthleteConnections();
  const connection = getConnectionForAthlete(athlete.id);
  const [saving, setSaving] = useState(false);

  if (!connection) {
    return (
      <p className="text-sm text-muted-foreground">
        Create an app account above to configure plan visibility.
      </p>
    );
  }

  const handleChange = async (val: string) => {
    setSaving(true);
    try {
      await updateWeeksAhead(connection.id, parseInt(val));
    } catch (e) {
      console.error('Failed to update weeks ahead', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select value={String(connection.weeksAhead)} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1">1 week ahead</SelectItem>
        <SelectItem value="2">2 weeks ahead</SelectItem>
        <SelectItem value="3">3 weeks ahead</SelectItem>
        <SelectItem value="4">4 weeks ahead</SelectItem>
        <SelectItem value="6">6 weeks ahead</SelectItem>
        <SelectItem value="8">8 weeks ahead</SelectItem>
        <SelectItem value="12">12 weeks ahead</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ── App Account Card ──────────────────────────────────────────────────────────

function AppAccountCard({ athlete }: { athlete: Athlete }) {
  const { getConnectionForAthlete, createConnection, revokeConnection, regenerateInviteCode, loading } = useAthleteConnections();
  const connection = getConnectionForAthlete(athlete.id);
  const { toast } = useToast();

  const [creating, setCreating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const inviteLink = `${window.location.origin}/athlete/connect?code=${inviteCode}`;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const profileData = {
        firstName: athlete.firstName,
        middleName: athlete.middleName,
        lastName: athlete.lastName,
        birthday: athlete.birthday,
        sex: athlete.sex,
        sports: athlete.sports ?? (athlete.sport ? [athlete.sport] : []),
        team: athlete.team,
        occupation: athlete.occupation,
        dailyActivityLevel: athlete.dailyActivityLevel,
      };
      const conn = await createConnection(
        athlete.id,
        `${athlete.firstName} ${athlete.lastName}`.trim(),
        athlete.email ?? undefined,
        profileData,
      );
      setInviteCode(conn.inviteCode);
      setShowInviteDialog(true);
    } catch (e) {
      console.error('Failed to create connection', e);
      toast({ title: 'Could not create the app account', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!connection) return;
    setRegenerating(true);
    try {
      const code = await regenerateInviteCode(connection.id);
      setInviteCode(code);
      setShowInviteDialog(true);
    } catch (e) {
      console.error('Failed to regenerate invite link', e);
      toast({ title: 'Could not create a new invite link', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!connection) return;
    setRevoking(true);
    try {
      await revokeConnection(connection.id);
    } catch (e) {
      console.error('Failed to revoke connection', e);
      toast({ title: 'Could not revoke access', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setRevoking(false);
      setShowRevokeConfirm(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Athlete App Account</CardTitle>
          </div>
          <CardDescription>
            Give this athlete access to the Plan Prep Coach athlete app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : connection ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  {connection.connectedAt ? 'Connected' : 'Invite sent'}
                </Badge>
                {connection.connectedAt && (
                  <span className="text-xs text-muted-foreground">
                    since {new Date(connection.connectedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {connection.athleteEmail && (
                <p className="text-sm text-muted-foreground">{connection.athleteEmail}</p>
              )}
              {!connection.connectedAt && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-mono truncate flex-1">
                    {window.location.origin}/athlete/connect?code={connection.inviteCode}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/athlete/connect?code=${connection.inviteCode}`
                      );
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {!connection.connectedAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    title="Replace the invite link — the old link stops working"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', regenerating && 'animate-spin')} />
                    {regenerating ? 'Creating…' : 'New Invite Link'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive gap-1.5"
                  onClick={() => setShowRevokeConfirm(true)}
                >
                  <UserX className="h-3.5 w-3.5" />
                  Revoke Access
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No app account yet. Create one to generate an invite link you can send to the athlete.
              </p>
              <Button size="sm" onClick={handleCreate} disabled={creating} className="gap-1.5">
                <Smartphone className="h-3.5 w-3.5" />
                {creating ? 'Creating…' : 'Create App Account'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>App Account Created</DialogTitle>
            <DialogDescription>
              Share this link with {athlete.firstName}. They'll open it to create their password and connect to the app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-mono truncate flex-1">{inviteLink}</span>
              <button
                onClick={handleCopy}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              The link contains a one-time invite code. It can only be used once to create the account.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleCopy} variant="outline" className="gap-1.5">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button onClick={() => setShowInviteDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm dialog */}
      <Dialog open={showRevokeConfirm} onOpenChange={setShowRevokeConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke App Access?</DialogTitle>
            <DialogDescription>
              {athlete.firstName} will immediately lose access to the athlete app. You can create a new account for them at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? 'Revoking…' : 'Revoke Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Session Rearranging Card ──────────────────────────────────────────────────

function RearrangeWorkoutsCard({ athlete }: { athlete: Athlete }) {
  const { getConnectionForAthlete, updateAllowRearrangeWorkouts } = useAthleteConnections();
  const connection = getConnectionForAthlete(athlete.id);
  const [saving, setSaving] = useState(false);

  if (!connection) return null;

  const handleToggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      await updateAllowRearrangeWorkouts(connection.id, enabled);
    } catch (e) {
      console.error('Failed to update rearrange workouts', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Session Rearranging</CardTitle>
        </div>
        <CardDescription>
          Allow the athlete to move sessions between days in the Plan tab of the athlete app.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y border rounded-lg">
        <FeatureToggle
          label="Allow rearranging workouts"
          description="Athlete can drag sessions to a different day within the visible week"
          checked={connection.allowRearrangeWorkouts}
          onCheckedChange={handleToggle}
        />
        {saving && <p className="text-xs text-muted-foreground px-1 py-2">Saving…</p>}
      </CardContent>
    </Card>
  );
}

// ── Messages Card ─────────────────────────────────────────────────────────────

function MessagesCard({ athlete }: { athlete: Athlete }) {
  const { getConnectionForAthlete, updateChatEnabled } = useAthleteConnections();
  const connection = getConnectionForAthlete(athlete.id);
  const [saving, setSaving] = useState(false);

  if (!connection) return null;

  const handleToggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      await updateChatEnabled(connection.id, enabled);
    } catch (e) {
      console.error('Failed to update chat enabled', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Messages</CardTitle>
        </div>
        <CardDescription>
          Control whether this athlete can use the Messages tab in the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y border rounded-lg">
        <FeatureToggle
          label="Enable Messages tab"
          description="When disabled, the Messages tab is hidden in the athlete app"
          checked={connection.chatEnabled}
          onCheckedChange={handleToggle}
        />
        {saving && <p className="text-xs text-muted-foreground px-1 py-2">Saving…</p>}
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AthleteSettingsTabProps {
  athlete: Athlete;
  onUpdateAthlete: (updates: Partial<Omit<Athlete, 'id' | 'createdAt'>>) => void;
}

export function AthleteSettingsTab({ athlete }: AthleteSettingsTabProps) {
  return (
    <div className="p-4 space-y-4 max-w-2xl" style={{ overflowAnchor: 'none' }}>

      {/* App Account */}
      <AppAccountCard athlete={athlete} />

      {/* Calendar Access */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Calendar Access</CardTitle>
          </div>
          <CardDescription>
            Choose how many weeks ahead the athlete can see in their app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Weeks visible in advance</Label>
          <WeeksAheadSelect athlete={athlete} />
        </CardContent>
      </Card>

      {/* Session Rearranging */}
      <RearrangeWorkoutsCard athlete={athlete} />

      {/* Messages */}
      <MessagesCard athlete={athlete} />

      {/* Daily monitoring is set up in the Monitoring tab ("Check-in setup") */}

    </div>
  );
}
