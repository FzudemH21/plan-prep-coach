// Per-athlete info + settings tab for the coach-mobile athlete profile.
// Two sub-sections: Profile (athlete info) and Settings (connection, calendar, features).

import { useState } from 'react';
import { CalendarRange, CalendarDays, MessageCircle, Activity, Copy, Check, User, Pencil, X, Settings } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import type { AthleteConnection } from '@/hooks/useAthleteConnections';
import { useAthletes } from '@/hooks/useAthletes';
import { useTranslation } from 'react-i18next';

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

type SubSection = 'profile' | 'settings';

interface Props {
  athleteId: string;
  connection: AthleteConnection;
}

export function CoachAthleteSettingsTab({ athleteId, connection }: Props) {
  const { t } = useTranslation();
  const { athletes, updateAthlete } = useAthletes();
  const {
    updateWeeksAhead,
    updateMonitoringEnabled,
    updateChatEnabled,
    updateAllowRearrangeWorkouts,
  } = useAthleteConnections();

  const [subSection, setSubSection] = useState<SubSection>('profile');

  const athlete = athletes.find(a => a.id === athleteId);
  const sports = athlete?.sports?.length ? athlete.sports : athlete?.sport ? [athlete.sport] : [];

  // ── Profile edit state ────────────────────────────────────────────────────
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ birthday: '', sex: '', team: '', sport: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  const handleProfileEdit = () => {
    if (!athlete) return;
    setProfileForm({
      birthday: athlete.birthday ?? '',
      sex: athlete.sex ?? '',
      team: athlete.team ?? '',
      sport: sports[0] ?? '',
    });
    setProfileEditing(true);
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      await updateAthlete(athleteId, {
        birthday: profileForm.birthday || undefined,
        sex: profileForm.sex || undefined,
        team: profileForm.team || undefined,
        sports: profileForm.sport ? [profileForm.sport] : [],
      });
      setProfileEditing(false);
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Connection settings ───────────────────────────────────────────────────
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

  if (!athlete) return null;

  return (
    <div className="space-y-3 py-2">

      {/* Sub-section strip */}
      <div className="flex border-b">
        {([
          { key: 'profile',  label: t('coachMobile.athleteSettings.profile'),  icon: <User className="h-3 w-3" />     },
          { key: 'settings', label: t('coachMobile.athleteSettings.settings'), icon: <Settings className="h-3 w-3" /> },
        ] as { key: SubSection; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setSubSection(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
              subSection === key
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
            )}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Profile sub-section ── */}
      {subSection === 'profile' && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t('coachMobile.athleteSettings.profileInformation')}
            </h3>
            {!profileEditing ? (
              <button
                onClick={handleProfileEdit}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-3 w-3" /> {t('coachMobile.athleteSettings.edit')}
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setProfileEditing(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="h-6 gap-1 text-xs text-primary px-2"
                >
                  <Check className="h-3 w-3" /> {profileSaving ? t('coachMobile.athleteSettings.saving') : t('coachMobile.athleteSettings.save')}
                </Button>
              </div>
            )}
          </div>

          {!profileEditing ? (
            <div className="space-y-0">
              {[
                { label: t('coachMobile.athleteSettings.birthday'), value: athlete.birthday ? format(parseISO(athlete.birthday + 'T12:00:00'), 'MMM d, yyyy') : '—' },
                { label: t('coachMobile.athleteSettings.sex'),      value: athlete.sex ?? '—' },
                { label: t('coachMobile.athleteSettings.team'),     value: athlete.team ?? '—' },
                { label: t('coachMobile.athleteSettings.sports'),   value: sports.length ? sports.join(', ') : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-1.5 border-b last:border-0">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium capitalize">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {[
                { label: t('coachMobile.athleteSettings.birthday'), key: 'birthday' as const, type: 'date', placeholder: t('coachMobile.athleteSettings.birthdayPlaceholder') },
                { label: t('coachMobile.athleteSettings.team'),     key: 'team'     as const, type: 'text', placeholder: t('coachMobile.athleteSettings.teamPlaceholder') },
                { label: t('coachMobile.athleteSettings.sport'),    key: 'sport'    as const, type: 'text', placeholder: t('coachMobile.athleteSettings.sportPlaceholder') },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
                  <Input
                    type={type}
                    value={profileForm[key]}
                    onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="h-8 text-sm flex-1"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16 shrink-0">{t('coachMobile.athleteSettings.sex')}</span>
                <select
                  value={profileForm.sex}
                  onChange={e => setProfileForm(f => ({ ...f, sex: e.target.value }))}
                  className="h-8 text-sm flex-1 rounded-md border bg-background px-2"
                >
                  <option value="">{t('coachMobile.athleteSettings.notSet')}</option>
                  <option value="male">{t('coachMobile.athleteSettings.male')}</option>
                  <option value="female">{t('coachMobile.athleteSettings.female')}</option>
                  <option value="other">{t('coachMobile.athleteSettings.other')}</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Settings sub-section ── */}
      {subSection === 'settings' && (
        <div className="space-y-4">

          {/* Athlete App connection */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t('coachMobile.athleteSettings.athleteApp')}
            </h3>
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full',
                isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
              )}>
                <Check className="h-3 w-3" />
                {isConnected ? t('coachMobile.athleteSettings.connected') : t('coachMobile.athleteSettings.invitePending')}
              </span>
            </div>
            {!isConnected && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('coachMobile.athleteSettings.inviteCode')}</p>
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
              <CalendarRange className="h-3.5 w-3.5" /> {t('coachMobile.athleteSettings.calendarAccess')}
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t('coachMobile.athleteSettings.weeksAhead')}</p>
                <p className="text-xs text-muted-foreground">{t('coachMobile.athleteSettings.weeksAheadDesc')}</p>
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
                    <SelectItem key={n} value={String(n)}>{t('coachMobile.athleteSettings.weeks', { count: n })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Access controls */}
          <div className="rounded-xl border bg-card px-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-3 pb-1 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> {t('coachMobile.athleteSettings.accessControls')}
            </h3>
            <ToggleRow
              label={t('coachMobile.athleteSettings.allowRearrange')}
              description={t('coachMobile.athleteSettings.allowRearrangeDesc')}
              checked={connection.allowRearrangeWorkouts}
              onChange={v => save('rearrange', () => updateAllowRearrangeWorkouts(connection.id, v))}
              disabled={saving === 'rearrange'}
            />
          </div>

          {/* Feature flags */}
          <div className="rounded-xl border bg-card px-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-3 pb-1 flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> {t('coachMobile.athleteSettings.features')}
            </h3>
            <ToggleRow
              label={t('coachMobile.athleteSettings.messagesFeature')}
              description={t('coachMobile.athleteSettings.messagesFeatureDesc')}
              checked={connection.chatEnabled}
              onChange={v => save('chat', () => updateChatEnabled(connection.id, v))}
              disabled={saving === 'chat'}
            />
          </div>

          {/* Daily monitoring */}
          <div className="rounded-xl border bg-card px-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-3 pb-1 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> {t('coachMobile.athleteSettings.dailyMonitoring')}
            </h3>
            <ToggleRow
              label={t('coachMobile.athleteSettings.enableCheckin')}
              description={t('coachMobile.athleteSettings.enableCheckinDesc')}
              checked={connection.monitoringEnabled}
              onChange={v => save('monitoring', () => updateMonitoringEnabled(connection.id, v))}
              disabled={saving === 'monitoring'}
            />
            {connection.monitoringEnabled && (connection.monitoringConfig?.blocks ?? []).filter(b => b.enabled).length > 0 && (
              <div className="pb-3 pt-1 space-y-0.5 pl-1">
                {(connection.monitoringConfig!.blocks).filter(b => b.enabled).map(b => (
                  <p key={b.id} className="text-xs text-muted-foreground">
                    · {b.type === 'wellbeing' ? t('coachMobile.athleteSettings.wellnessBlock') : b.type === 'ostrc' ? t('coachMobile.athleteSettings.ostrcBlock') : (b as { config?: { label?: string } }).config?.label ?? b.type}
                  </p>
                ))}
                <p className="text-[10px] text-muted-foreground/50 pt-1">
                  {t('coachMobile.athleteSettings.configureOnDesktop')}
                </p>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
