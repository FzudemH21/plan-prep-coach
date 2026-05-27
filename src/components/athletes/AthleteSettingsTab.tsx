import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Scale,
  Globe,
  LayoutGrid,
  CalendarRange,
  Dumbbell,
} from 'lucide-react';
import { Athlete, AthleteSettings, DEFAULT_ATHLETE_SETTINGS } from '@/types/athlete';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mergeSettings(existing?: AthleteSettings): AthleteSettings {
  if (!existing) return DEFAULT_ATHLETE_SETTINGS;
  return {
    units: { ...DEFAULT_ATHLETE_SETTINGS.units, ...existing.units },
    timezone: existing.timezone ?? DEFAULT_ATHLETE_SETTINGS.timezone,
    dateFormat: existing.dateFormat ?? DEFAULT_ATHLETE_SETTINGS.dateFormat,
    features: { ...DEFAULT_ATHLETE_SETTINGS.features, ...existing.features },
    athleteApp: { ...DEFAULT_ATHLETE_SETTINGS.athleteApp, ...existing.athleteApp },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UnitToggle({
  label,
  metricLabel,
  imperialLabel,
  value,
  onChange,
}: {
  label: string;
  metricLabel: string;
  imperialLabel: string;
  value: 'metric' | 'imperial';
  onChange: (v: 'metric' | 'imperial') => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex rounded-md border overflow-hidden w-fit">
        <button
          onClick={() => onChange('metric')}
          className={cn(
            'px-3 py-1.5 text-sm transition-colors',
            value === 'metric'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background hover:bg-muted'
          )}
        >
          {metricLabel}
        </button>
        <button
          onClick={() => onChange('imperial')}
          className={cn(
            'px-3 py-1.5 text-sm transition-colors border-l',
            value === 'imperial'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background hover:bg-muted'
          )}
        >
          {imperialLabel}
        </button>
      </div>
    </div>
  );
}

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
        <Label className={cn('text-sm', indent && 'text-sm font-normal')}>{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AthleteSettingsTabProps {
  athlete: Athlete;
  onUpdateAthlete: (updates: Partial<Omit<Athlete, 'id' | 'createdAt'>>) => void;
}

export function AthleteSettingsTab({ athlete, onUpdateAthlete }: AthleteSettingsTabProps) {
  const settings = useMemo(() => mergeSettings(athlete.settings), [athlete.settings]);

  const update = (patch: Partial<AthleteSettings>) => {
    onUpdateAthlete({ settings: { ...settings, ...patch } });
  };

  const updateUnits = (patch: Partial<AthleteSettings['units']>) =>
    update({ units: { ...settings.units, ...patch } });

  const updateFeatures = (patch: Partial<AthleteSettings['features']>) =>
    update({ features: { ...settings.features, ...patch } });

  const updateAthleteApp = (patch: Partial<AthleteSettings['athleteApp']>) =>
    update({ athleteApp: { ...settings.athleteApp, ...patch } });

  const TIMEZONES = [
    'Europe/Berlin', 'Europe/London', 'Europe/Paris', 'Europe/Madrid',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai',
    'Australia/Sydney', 'Pacific/Auckland',
  ];

  const CALENDAR_RANGE_LABELS: Record<AthleteSettings['athleteApp']['calendarRange'], string> = {
    'current': 'Current week only',
    '+1week': 'Current + 1 week ahead',
    '+2weeks': 'Current + 2 weeks ahead',
    '+3weeks': 'Current + 3 weeks ahead',
    '+4weeks': 'Current + 4 weeks ahead',
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4 max-w-2xl">

        {/* Units */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Units</CardTitle>
            </div>
            <CardDescription>Measurement units used for this athlete's data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <UnitToggle
                label="Weight"
                metricLabel="kg"
                imperialLabel="lb"
                value={settings.units.weight}
                onChange={v => updateUnits({ weight: v })}
              />
              <UnitToggle
                label="Distance"
                metricLabel="km"
                imperialLabel="miles"
                value={settings.units.distance}
                onChange={v => updateUnits({ distance: v })}
              />
              <UnitToggle
                label="Length / Height"
                metricLabel="cm"
                imperialLabel="inch"
                value={settings.units.length}
                onChange={v => updateUnits({ length: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Timezone & Date Format */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Timezone & Date Format</CardTitle>
            </div>
            <CardDescription>Controls how dates and times are displayed for this athlete.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={settings.timezone} onValueChange={v => update({ timezone: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select
                value={settings.dateFormat}
                onValueChange={v => update({ dateFormat: v as AthleteSettings['dateFormat'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Athlete App Features */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Athlete App Features</CardTitle>
            </div>
            <CardDescription>
              Enable or disable features for this athlete's mobile app experience.
              Disabled features will not be visible in the athlete app.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <FeatureToggle
              label="Training"
              description="View assigned sessions and track training progress"
              checked={settings.features.training}
              onCheckedChange={v => updateFeatures({ training: v })}
            />
            {settings.features.training && (
              <>
                <FeatureToggle
                  label="Allow workout comments"
                  checked={settings.features.workoutComments}
                  onCheckedChange={v => updateFeatures({ workoutComments: v })}
                  indent
                />
                <FeatureToggle
                  label="Show rest day message"
                  checked={settings.features.restDayMessage}
                  onCheckedChange={v => updateFeatures({ restDayMessage: v })}
                  indent
                />
              </>
            )}
            <FeatureToggle
              label="Log Activities"
              description="Let the athlete add extra workouts or unassigned activities"
              checked={settings.features.logActivities}
              onCheckedChange={v => updateFeatures({ logActivities: v })}
            />
            {settings.features.logActivities && (
              <FeatureToggle
                label="Allow activity comments"
                checked={settings.features.activityComments}
                onCheckedChange={v => updateFeatures({ activityComments: v })}
                indent
              />
            )}
            <FeatureToggle
              label="Body Metrics"
              description="Let the athlete log anthropometric and biometric data"
              checked={settings.features.bodyMetrics}
              onCheckedChange={v => updateFeatures({ bodyMetrics: v })}
            />
          </CardContent>
        </Card>

        {/* Calendar Access */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Calendar Access</CardTitle>
            </div>
            <CardDescription>
              Choose how much of the training calendar the athlete can see in their app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Visible date range</Label>
              <Select
                value={settings.athleteApp.calendarRange}
                onValueChange={v => updateAthleteApp({ calendarRange: v as AthleteSettings['athleteApp']['calendarRange'] })}
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CALENDAR_RANGE_LABELS) as [AthleteSettings['athleteApp']['calendarRange'], string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="divide-y border rounded-lg">
              <FeatureToggle
                label="Allow athlete to rearrange workouts"
                description="Grant flexibility to move sessions within the visible range"
                checked={settings.athleteApp.allowRearrangeWorkouts}
                onCheckedChange={v => updateAthleteApp({ allowRearrangeWorkouts: v })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Workout Customization */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Workout Customization</CardTitle>
            </div>
            <CardDescription>
              Control how much the athlete can modify their own workouts.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y border rounded-lg">
            <FeatureToggle
              label="Allow athlete to create workouts"
              description="Athlete can create additional sessions with exercises from your library"
              checked={settings.athleteApp.allowCreateWorkouts}
              onCheckedChange={v => updateAthleteApp({ allowCreateWorkouts: v })}
            />
            <FeatureToggle
              label="Allow athlete to add or replace exercises"
              description="Athlete can swap exercises assigned in sessions with alternatives from your library"
              checked={settings.athleteApp.allowAddExercises}
              onCheckedChange={v => updateAthleteApp({ allowAddExercises: v })}
            />
          </CardContent>
        </Card>

      </div>
    </ScrollArea>
  );
}
