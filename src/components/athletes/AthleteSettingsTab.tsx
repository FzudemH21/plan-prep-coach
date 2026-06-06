import { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Scale,
  Globe,
  LayoutGrid,
  CalendarRange,
  CalendarDays,
  Dumbbell,
  Smartphone,
  Copy,
  Check,
  Link2,
  UserX,
  Activity,
  GripVertical,
  Plus,
  Trash2,
  Info,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import {
  Athlete,
  AthleteSettings,
  DEFAULT_ATHLETE_SETTINGS,
  MonitoringConfig,
  MonitoringBlock,
  DEFAULT_MONITORING_CONFIG,
} from '@/types/athlete';
import type { CustomMetricBlockConfig } from '@/types/athlete';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';

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

// ── Weeks-ahead selector (Supabase-backed) ───────────────────────────────────

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
  const { getConnectionForAthlete, createConnection, revokeConnection, loading } = useAthleteConnections();
  const connection = getConnectionForAthlete(athlete.id);

  const [creating, setCreating] = useState(false);
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
    } finally {
      setCreating(false);
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

// ── Monitoring card ───────────────────────────────────────────────────────────

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

function MonitoringCard({ athlete }: { athlete: Athlete }) {
  const { getConnectionForAthlete, updateMonitoringEnabled, updateMonitoringConfig } = useAthleteConnections();
  const { data: paramDb } = useParametersDataV2();
  const connection = getConnectionForAthlete(athlete.id);
  const [saving, setSaving] = useState(false);

  // Add-block dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addStep, setAddStep] = useState<'pick_param' | 'configure'>('pick_param');
  const [selectedParam, setSelectedParam] = useState<{ id: string; name: string; unit?: string } | null>(null);
  const [inputType, setInputType] = useState<'number' | 'scale'>('number');
  const [scaleMin, setScaleMin] = useState(0);
  const [scaleMax, setScaleMax] = useState(10);
  const [scaleMinLabel, setScaleMinLabel] = useState('');
  const [scaleMaxLabel, setScaleMaxLabel] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [paramSearch, setParamSearch] = useState('');

  const config: MonitoringConfig = useMemo(
    () => connection?.profileData?.monitoringConfig ?? DEFAULT_MONITORING_CONFIG,
    [connection?.profileData?.monitoringConfig],
  );

  if (!connection) return null;

  const saveConfig = async (newConfig: MonitoringConfig) => {
    setSaving(true);
    try {
      await updateMonitoringConfig(connection.id, newConfig);
    } catch (e) {
      console.error('Failed to save monitoring config', e);
    } finally {
      setSaving(false);
    }
  };

  const handleMasterToggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      await updateMonitoringEnabled(connection.id, enabled);
    } catch (e) {
      console.error('Failed to update monitoring', e);
    } finally {
      setSaving(false);
    }
  };

  const handleBlockToggle = (blockId: string, enabled: boolean) => {
    saveConfig({ blocks: config.blocks.map(b => b.id === blockId ? { ...b, enabled } : b) });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const blocks = [...config.blocks];
    const [moved] = blocks.splice(result.source.index, 1);
    blocks.splice(result.destination.index, 0, moved);
    saveConfig({ blocks });
  };

  const handleRemoveBlock = (blockId: string) => {
    saveConfig({ blocks: config.blocks.filter(b => b.id !== blockId) });
  };

  const closeAddDialog = () => {
    setShowAddDialog(false);
    setAddStep('pick_param');
    setSelectedParam(null);
    setInputType('number');
    setScaleMin(0);
    setScaleMax(10);
    setScaleMinLabel('');
    setScaleMaxLabel('');
    setCustomLabel('');
    setParamSearch('');
  };

  const handleAddBlock = () => {
    if (!selectedParam) return;
    const blockConfig: CustomMetricBlockConfig = {
      parameterId: selectedParam.id,
      parameterName: selectedParam.name,
      parameterUnit: selectedParam.unit ?? null,
      inputType,
      label: customLabel.trim() || undefined,
      ...(inputType === 'scale' ? {
        scaleMin,
        scaleMax,
        scaleAnchors: [
          ...(scaleMinLabel.trim() ? [{ value: scaleMin, label: scaleMinLabel.trim() }] : []),
          ...(scaleMaxLabel.trim() ? [{ value: scaleMax, label: scaleMaxLabel.trim() }] : []),
        ],
      } : {}),
    };
    const newBlock: MonitoringBlock = {
      id: String(Date.now()), // step name in DailyCheckinSheet = `custom_${id}`
      type: 'custom_metric',
      enabled: true,
      config: blockConfig,
    };
    saveConfig({ blocks: [...config.blocks, newBlock] });
    closeAddDialog();
  };

  const filteredParams = (paramDb?.parameters ?? []).filter(p =>
    p.name.toLowerCase().includes(paramSearch.toLowerCase())
  );

  const blockLabel = (block: MonitoringBlock): string => {
    if (block.type === 'wellbeing') return 'Wellbeing Questionnaire';
    if (block.type === 'ostrc') return 'OSTRC-H / Body Map';
    return block.config?.parameterName ?? 'Custom Metric';
  };

  const blockSubLabel = (block: MonitoringBlock): string => {
    if (block.type === 'wellbeing') return 'McLean 5-item scale';
    if (block.type === 'ostrc') return 'Pain & illness screening';
    const it = block.config?.inputType === 'scale' ? 'Scale' : 'Number';
    const unit = block.config?.parameterUnit ? ` · ${block.config.parameterUnit}` : '';
    return `${it}${unit}`;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Daily Monitoring</CardTitle>
          </div>
          <CardDescription>
            Configure which check-in blocks the athlete sees each morning. Drag to reorder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Master toggle */}
          <div className="divide-y border rounded-lg">
            <FeatureToggle
              label="Daily check-in"
              description="Athlete is prompted with a check-in on first app open each day"
              checked={connection.monitoringEnabled}
              onCheckedChange={handleMasterToggle}
            />
            {saving && <p className="text-xs text-muted-foreground px-3 py-2">Saving…</p>}
          </div>

          {/* Block list — only visible when master toggle is on */}
          {connection.monitoringEnabled && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Check-in Blocks</p>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="monitoring-blocks">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                      {config.blocks.map((block, index) => (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                          {(drag, snapshot) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              className={cn(
                                'flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 transition-shadow',
                                snapshot.isDragging && 'shadow-md ring-1 ring-primary/20',
                              )}
                            >
                              <div
                                {...drag.dragHandleProps}
                                className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className={cn('text-sm font-medium truncate', !block.enabled && 'text-muted-foreground')}>
                                  {blockLabel(block)}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {blockSubLabel(block)}
                                </p>
                              </div>

                              <Switch
                                checked={block.enabled}
                                onCheckedChange={v => handleBlockToggle(block.id, v)}
                                className="shrink-0"
                              />

                              {block.type === 'custom_metric' && (
                                <button
                                  onClick={() => handleRemoveBlock(block.id)}
                                  className="shrink-0 ml-1 text-muted-foreground/50 hover:text-destructive transition-colors"
                                  title="Remove block"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Metric Block
              </Button>

              <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  A free-text notes field is always shown at the end of every check-in, regardless of which blocks are active.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add metric block dialog ───────────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={open => { if (!open) closeAddDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addStep === 'pick_param' ? 'Add Metric Block' : `Configure: ${selectedParam?.name}`}
            </DialogTitle>
            <DialogDescription>
              {addStep === 'pick_param'
                ? 'Choose a performance parameter from your database.'
                : 'Set the input type and an optional label for this metric.'}
            </DialogDescription>
          </DialogHeader>

          {addStep === 'pick_param' && (
            <div className="space-y-3 py-1">
              <Input
                placeholder="Search parameters…"
                value={paramSearch}
                onChange={e => setParamSearch(e.target.value)}
                autoFocus
              />
              <ScrollArea className="h-56 border rounded-lg">
                {filteredParams.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    {paramDb?.parameters.length === 0
                      ? 'No parameters yet. Add them in the Parameter Database first.'
                      : 'No matches found.'}
                  </p>
                ) : (
                  <div className="divide-y">
                    {filteredParams.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedParam(p); setAddStep('configure'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 text-left transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          {p.unit && <p className="text-xs text-muted-foreground">{p.unit}</p>}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {addStep === 'configure' && selectedParam && (
            <div className="space-y-4 py-1">
              {/* Input type toggle */}
              <div className="space-y-1.5">
                <Label>Input type</Label>
                <div className="flex rounded-md border overflow-hidden w-fit">
                  <button
                    onClick={() => setInputType('number')}
                    className={cn('px-4 py-2 text-sm transition-colors', inputType === 'number' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
                  >
                    Number{selectedParam.unit ? ` (${selectedParam.unit})` : ''}
                  </button>
                  <button
                    onClick={() => setInputType('scale')}
                    className={cn('px-4 py-2 text-sm transition-colors border-l', inputType === 'scale' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
                  >
                    Scale
                  </button>
                </div>
              </div>

              {/* Scale config */}
              {inputType === 'scale' && (
                <div className="rounded-lg bg-muted/30 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Min value</Label>
                      <Input type="number" value={scaleMin} onChange={e => setScaleMin(Number(e.target.value))} className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max value</Label>
                      <Input type="number" value={scaleMax} onChange={e => setScaleMax(Number(e.target.value))} className="h-8" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label for {scaleMin} (optional)</Label>
                      <Input placeholder="e.g. None" value={scaleMinLabel} onChange={e => setScaleMinLabel(e.target.value)} className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label for {scaleMax} (optional)</Label>
                      <Input placeholder="e.g. Severe" value={scaleMaxLabel} onChange={e => setScaleMaxLabel(e.target.value)} className="h-8" />
                    </div>
                  </div>
                </div>
              )}

              {/* Custom label */}
              <div className="space-y-1.5">
                <Label className="text-xs">Question label (optional)</Label>
                <Input
                  placeholder={`e.g. What is your ${selectedParam.name.toLowerCase()} today?`}
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Shown as the heading in the check-in. Defaults to the parameter name.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            {addStep === 'configure' && (
              <Button variant="outline" onClick={() => setAddStep('pick_param')}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            <Button variant="outline" onClick={closeAddDialog}>Cancel</Button>
            {addStep === 'configure' && (
              <Button onClick={handleAddBlock} disabled={!selectedParam}>
                Add Block
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

  return (
    <div className="p-4 space-y-4 max-w-2xl" style={{ overflowAnchor: 'none' }}>

        {/* App Account */}
        <AppAccountCard athlete={athlete} />

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
              Choose how many weeks ahead the athlete can see in their app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Weeks visible in advance</Label>
              <WeeksAheadSelect athlete={athlete} />
            </div>
          </CardContent>
        </Card>

        {/* Session rearranging */}
        <RearrangeWorkoutsCard athlete={athlete} />

        {/* Monitoring */}
        <MonitoringCard athlete={athlete} />

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
  );
}
