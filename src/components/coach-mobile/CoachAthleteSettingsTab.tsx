// Per-athlete settings for the coach-mobile athlete profile.
// Mirrors the desktop AthleteSettingsTab, simplified for mobile.

import { useState } from 'react';
import { CalendarRange, CalendarDays, MessageCircle, Activity, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import type { AthleteConnection } from '@/hooks/useAthleteConnections';

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  icon, label, description, checked, onChange, disabled = false,
}: {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      {icon && <div className="text-muted-foreground shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="shrink-0 ml-2" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  connection: AthleteConnection;
}

export function CoachAthleteSettingsTab({ connection }: Props) {
  const {
    updateWeeksAhead,
    updateMonitoringEnabled,
    updateChatEnabled,
    updateAllowRearrangeWorkouts,
  } = useAthleteConnections();

  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function save(key: string, fn: () => Promise<void>) {
    setSaving(key);
    try { await fn(); }
    catch (e) { console.error(e); }
    finally { setSaving(null); }
  }

  const isConnected = !!connection.connectedAt;

  const handleCopy = () => {
    navigator.clipboard.writeText(connection.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 py-2">

      {/* Athlete App connection */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Athlete App
        </h3>
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full',
            isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
          )}>
            <Check className="h-3 w-3" />
            {isConnected ? 'Connected' : 'Invite pending'}
          </span>
        </div>
        {!isConnected && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Invite code</p>
            <div className="flex items-center gap-3">
              <code className="text-lg font-mono font-bold tracking-widest">{connection.inviteCode}</code>
              <button
                onClick={handleCopy}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                {copied
                  ? <Check className="h-4 w-4 text-emerald-600" />
                  : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Calendar access */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5" /> Calendar Access
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Weeks visible in advance</p>
            <p className="text-xs text-muted-foreground">How far ahead the athlete can see their plan</p>
          </div>
          <Select
            value={String(connection.weeksAhead)}
            onValueChange={v => save('weeks', () => updateWeeksAhead(connection.id, parseInt(v)))}
            disabled={saving === 'weeks'}
          >
            <SelectTrigger className="w-28 h-8 text-xs shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 6, 8, 12].map(n => (
                <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'week' : 'weeks'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Access controls */}
      <div className="rounded-xl border bg-card px-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-3 pb-1 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> Access Controls
        </h3>
        <ToggleRow
          label="Allow workout rearranging"
          description="Athlete can move sessions between days in the Plan tab"
          checked={connection.allowRearrangeWorkouts}
          onChange={v => save('rearrange', () => updateAllowRearrangeWorkouts(connection.id, v))}
          disabled={saving === 'rearrange'}
        />
      </div>

      {/* Feature flags */}
      <div className="rounded-xl border bg-card px-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-3 pb-1 flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5" /> Features
        </h3>
        <ToggleRow
          label="Messages & Comments"
          description="Show the Messages tab and exercise comment buttons in the athlete app"
          checked={connection.chatEnabled}
          onChange={v => save('chat', () => updateChatEnabled(connection.id, v))}
          disabled={saving === 'chat'}
        />
      </div>

      {/* Daily monitoring */}
      <div className="rounded-xl border bg-card px-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-3 pb-1 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Daily Monitoring
        </h3>
        <ToggleRow
          label="Enable daily check-in"
          description="Show wellness + injury pop-up on first app open each day"
          checked={connection.monitoringEnabled}
          onChange={v => save('monitoring', () => updateMonitoringEnabled(connection.id, v))}
          disabled={saving === 'monitoring'}
        />
        {connection.monitoringEnabled && (connection.monitoringConfig?.blocks ?? []).filter(b => b.enabled).length > 0 && (
          <div className="pb-3 pt-1 space-y-0.5 pl-1">
            {(connection.monitoringConfig!.blocks).filter(b => b.enabled).map(b => (
              <p key={b.id} className="text-xs text-muted-foreground">
                · {b.type === 'wellbeing' ? 'Wellness (5-item)' : b.type === 'ostrc' ? 'Pain & Illness (OSTRC-H)' : (b as { config?: { label?: string } }).config?.label ?? b.type}
              </p>
            ))}
            <p className="text-[10px] text-muted-foreground/50 pt-1">
              Configure blocks on the desktop app.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
