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
  CalendarRange,
  CalendarDays,
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
  Pencil,
  BookmarkPlus,
  BookOpen,
  MessageCircle,
} from 'lucide-react';
import {
  Athlete,
  MonitoringConfig,
  MonitoringBlock,
  DEFAULT_MONITORING_CONFIG,
} from '@/types/athlete';
import type { CustomMetricBlockConfig } from '@/types/athlete';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useAthletes } from '@/hooks/useAthletes';

// ── Monitoring templates (localStorage) ──────────────────────────────────────

interface MonitoringTemplate {
  id: string;
  name: string;
  blocks: MonitoringBlock[];
  createdAt: string;
}

const TEMPLATE_KEY = 'monitoring_templates_v1';

function loadTemplates(): MonitoringTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY);
    return raw ? (JSON.parse(raw) as MonitoringTemplate[]) : [];
  } catch {
    return [];
  }
}

function persistTemplates(templates: MonitoringTemplate[]) {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
  } catch {
    // quota or private mode — ignore
  }
}

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

// ── Monitoring Card ───────────────────────────────────────────────────────────

function MonitoringCard({ athlete }: { athlete: Athlete }) {
  const { getConnectionForAthlete, updateMonitoringEnabled, updateMonitoringConfig } = useAthleteConnections();
  const { data: paramDb, addParameter } = useParametersDataV2();
  const athleteData = useAthletes();
  const connection = getConnectionForAthlete(athlete.id);
  const [saving, setSaving] = useState(false);

  // ── Add / edit block dialog ───────────────────────────────────────────────
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingBlock, setEditingBlock] = useState<MonitoringBlock | null>(null);
  const [addStep, setAddStep] = useState<'pick_param' | 'create_new' | 'configure'>('pick_param');
  const [selectedParam, setSelectedParam] = useState<{ id: string; name: string; unit?: string; source: 'biometric' | 'performance' } | null>(null);
  const [inputType, setInputType] = useState<'number' | 'scale'>('number');
  const [scaleMin, setScaleMin] = useState(0);
  const [scaleMax, setScaleMax] = useState(10);
  const [scaleMinLabel, setScaleMinLabel] = useState('');
  const [scaleMaxLabel, setScaleMaxLabel] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [paramSearch, setParamSearch] = useState('');
  // Create-new state
  const [createSource, setCreateSource] = useState<'biometric' | 'performance'>('biometric');
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Templates ─────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<MonitoringTemplate[]>(loadTemplates);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [showLoadTemplateDialog, setShowLoadTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const config: MonitoringConfig = useMemo(
    () => connection?.profileData?.monitoringConfig ?? DEFAULT_MONITORING_CONFIG,
    [connection?.profileData?.monitoringConfig],
  );

  if (!connection) return null;

  // ── Config helpers ────────────────────────────────────────────────────────

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

  // ── Add / edit dialog helpers ─────────────────────────────────────────────

  const closeAddDialog = () => {
    setShowAddDialog(false);
    setEditingBlock(null);
    setAddStep('pick_param');
    setSelectedParam(null);
    setInputType('number');
    setScaleMin(0); setScaleMax(10);
    setScaleMinLabel(''); setScaleMaxLabel('');
    setCustomLabel(''); setParamSearch('');
    setNewName(''); setNewUnit(''); setCreating(false);
    setCreateSource('biometric');
  };

  const openEditDialog = (block: MonitoringBlock) => {
    if (!block.config) return;
    const cfg = block.config;
    setEditingBlock(block);
    setSelectedParam({
      id: cfg.parameterId,
      name: cfg.parameterName,
      unit: cfg.parameterUnit ?? undefined,
      source: cfg.parameterSource,
    });
    setInputType(cfg.inputType);
    setScaleMin(cfg.scaleMin ?? 0);
    setScaleMax(cfg.scaleMax ?? 10);
    const minAnchor = cfg.scaleAnchors?.find(a => a.value === (cfg.scaleMin ?? 0));
    const maxAnchor = cfg.scaleAnchors?.find(a => a.value === (cfg.scaleMax ?? 10));
    setScaleMinLabel(minAnchor?.label ?? '');
    setScaleMaxLabel(maxAnchor?.label ?? '');
    setCustomLabel(cfg.label ?? '');
    setAddStep('configure');
    setShowAddDialog(true);
  };

  const handleSaveBlock = () => {
    if (!selectedParam) return;
    const blockConfig: CustomMetricBlockConfig = {
      parameterId: selectedParam.id,
      parameterSource: selectedParam.source,
      parameterName: selectedParam.name,
      parameterUnit: selectedParam.unit ?? null,
      inputType,
      label: customLabel.trim() || undefined,
      ...(inputType === 'scale' ? {
        scaleMin, scaleMax,
        scaleAnchors: [
          ...(scaleMinLabel.trim() ? [{ value: scaleMin, label: scaleMinLabel.trim() }] : []),
          ...(scaleMaxLabel.trim() ? [{ value: scaleMax, label: scaleMaxLabel.trim() }] : []),
        ],
      } : {}),
    };

    if (editingBlock) {
      saveConfig({ blocks: config.blocks.map(b => b.id === editingBlock.id ? { ...b, config: blockConfig } : b) });
    } else {
      const newBlock: MonitoringBlock = {
        id: String(Date.now()),
        type: 'custom_metric',
        enabled: true,
        config: blockConfig,
      };
      saveConfig({ blocks: [...config.blocks, newBlock] });
    }
    closeAddDialog();
  };

  const handleCreateNew = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      let id: string;
      if (createSource === 'biometric') {
        const created = await athleteData.createBiometricDefinition({
          name: newName.trim(),
          type: 'quantitative',
          unit: newUnit.trim() || null,
        });
        id = created.id;
      } else {
        const created = await addParameter({ name: newName.trim(), unit: newUnit.trim() || undefined });
        id = created.id;
      }
      setSelectedParam({ id, name: newName.trim(), unit: newUnit.trim() || undefined, source: createSource });
      setAddStep('configure');
    } catch (e) {
      console.error('Failed to create parameter', e);
    } finally {
      setCreating(false);
    }
  };

  // ── Template helpers ──────────────────────────────────────────────────────

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    const newTemplate: MonitoringTemplate = {
      id: String(Date.now()),
      name: templateName.trim(),
      blocks: config.blocks,
      createdAt: new Date().toISOString(),
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    persistTemplates(updated);
    setShowSaveTemplateDialog(false);
    setTemplateName('');
  };

  const handleDeleteTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    persistTemplates(updated);
  };

  const handleApplyTemplate = (template: MonitoringTemplate) => {
    // Re-assign IDs for custom_metric blocks to avoid collisions; keep wellbeing/ostrc IDs fixed
    const blocks = template.blocks.map(b =>
      b.id === 'wellbeing' || b.id === 'ostrc'
        ? b
        : { ...b, id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
    );
    saveConfig({ blocks });
    setShowLoadTemplateDialog(false);
  };

  // ── Labels ────────────────────────────────────────────────────────────────

  const blockLabel = (block: MonitoringBlock): string => {
    if (block.type === 'wellbeing') return 'Wellbeing Questionnaire';
    if (block.type === 'ostrc') return 'OSTRC-H / Body Map';
    return block.config?.label || block.config?.parameterName || 'Custom Metric';
  };

  const blockSubLabel = (block: MonitoringBlock): string => {
    if (block.type === 'wellbeing') return 'McLean 5-item scale';
    if (block.type === 'ostrc') return 'Pain & illness screening';
    const src = block.config?.parameterSource === 'biometric' ? 'Body metric' : 'Performance';
    const it = block.config?.inputType === 'scale' ? 'Scale' : 'Number';
    const unit = block.config?.parameterUnit ? ` · ${block.config.parameterUnit}` : '';
    return `${src} · ${it}${unit}`;
  };

  // ── Search ────────────────────────────────────────────────────────────────

  const query = paramSearch.toLowerCase();
  const biometricMatches = athleteData.biometricDefinitions.filter(b =>
    b.type === 'quantitative' && b.name.toLowerCase().includes(query)
  );
  const performanceMatches = (paramDb?.parameters ?? []).filter(p =>
    p.name.toLowerCase().includes(query)
  );
  const hasAny = biometricMatches.length > 0 || performanceMatches.length > 0;

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

          {/* Block list */}
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
                              <div {...drag.dragHandleProps} className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn('text-sm font-medium truncate', !block.enabled && 'text-muted-foreground')}>
                                  {blockLabel(block)}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{blockSubLabel(block)}</p>
                              </div>
                              <Switch
                                checked={block.enabled}
                                onCheckedChange={v => handleBlockToggle(block.id, v)}
                                className="shrink-0"
                              />
                              {block.type === 'custom_metric' && (
                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  <button
                                    onClick={() => openEditDialog(block)}
                                    className="text-muted-foreground/50 hover:text-foreground transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveBlock(block.id)}
                                    className="text-muted-foreground/50 hover:text-destructive transition-colors"
                                    title="Remove"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
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

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Metric Block
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowLoadTemplateDialog(true)}
                  title="Apply a saved template"
                >
                  <BookOpen className="h-3.5 w-3.5" /> Load Template
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => { setTemplateName(''); setShowSaveTemplateDialog(true); }}
                  title="Save current blocks as a template"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" /> Save as Template
                </Button>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>A free-text notes field is always shown at the end of every check-in.</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add / Edit metric block dialog ──────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={open => { if (!open) closeAddDialog(); }}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {editingBlock
                ? `Edit: ${blockLabel(editingBlock)}`
                : addStep === 'pick_param'
                  ? 'Add Metric Block'
                  : addStep === 'create_new'
                    ? 'Create New Metric'
                    : `Configure: ${selectedParam?.name}`}
            </DialogTitle>
            <DialogDescription>
              {editingBlock
                ? 'Update the input type or question label for this block.'
                : addStep === 'pick_param'
                  ? 'Choose a body metric or performance parameter — or create a new one.'
                  : addStep === 'create_new'
                    ? 'The new metric will be added to your database automatically.'
                    : 'Set the input type and an optional question label.'}
            </DialogDescription>
          </DialogHeader>

          {/* ── Pick param (new only) ── */}
          {!editingBlock && addStep === 'pick_param' && (
            <div className="flex flex-col gap-3 min-h-0 flex-1 py-1">
              <Input
                placeholder="Search metrics and parameters…"
                value={paramSearch}
                onChange={e => setParamSearch(e.target.value)}
                autoFocus
              />
              <ScrollArea className="flex-1 border rounded-lg min-h-0">
                {!hasAny ? (
                  <p className="text-sm text-muted-foreground text-center py-8 px-4">
                    {paramSearch ? 'No matches found.' : 'Your databases are empty. Create a new metric below.'}
                  </p>
                ) : (
                  <div>
                    {biometricMatches.length > 0 && (
                      <>
                        <p className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide sticky top-0 bg-background border-b">
                          Body Metrics
                        </p>
                        {biometricMatches.map(b => (
                          <button
                            key={b.id}
                            onClick={() => { setSelectedParam({ id: b.id, name: b.name, unit: b.unit ?? undefined, source: 'biometric' }); setAddStep('configure'); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 text-left transition-colors border-b last:border-b-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{b.name}</p>
                              {b.unit && <p className="text-xs text-muted-foreground">{b.unit}</p>}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </button>
                        ))}
                      </>
                    )}
                    {performanceMatches.length > 0 && (
                      <>
                        <p className="px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide sticky top-0 bg-background border-b">
                          Performance Parameters
                        </p>
                        {performanceMatches.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedParam({ id: p.id, name: p.name, unit: p.unit, source: 'performance' }); setAddStep('configure'); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 text-left transition-colors border-b last:border-b-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              {p.unit && <p className="text-xs text-muted-foreground">{p.unit}</p>}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </ScrollArea>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setAddStep('create_new')}>
                <Plus className="h-3.5 w-3.5" /> Create New Metric
              </Button>
            </div>
          )}

          {/* ── Create new (new only) ── */}
          {!editingBlock && addStep === 'create_new' && (
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label>Add to database</Label>
                <div className="flex rounded-md border overflow-hidden w-fit">
                  <button
                    onClick={() => setCreateSource('biometric')}
                    className={cn('px-4 py-2 text-sm transition-colors', createSource === 'biometric' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
                  >
                    Body Metrics
                  </button>
                  <button
                    onClick={() => setCreateSource('performance')}
                    className={cn('px-4 py-2 text-sm transition-colors border-l', createSource === 'performance' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
                  >
                    Performance Parameters
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="e.g. Resting Heart Rate" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Unit <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input placeholder="e.g. bpm, kg, %" value={newUnit} onChange={e => setNewUnit(e.target.value)} />
              </div>
            </div>
          )}

          {/* ── Configure (add & edit) ── */}
          {addStep === 'configure' && selectedParam && (
            <div className="space-y-4 py-1 overflow-y-auto">
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
                      <Label className="text-xs">Label for {scaleMin} (opt.)</Label>
                      <Input placeholder="e.g. None" value={scaleMinLabel} onChange={e => setScaleMinLabel(e.target.value)} className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label for {scaleMax} (opt.)</Label>
                      <Input placeholder="e.g. Severe" value={scaleMaxLabel} onChange={e => setScaleMaxLabel(e.target.value)} className="h-8" />
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Question label <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input
                  placeholder={`e.g. What is your ${selectedParam.name.toLowerCase()} today?`}
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Shown as heading in the check-in. Defaults to the parameter name.</p>
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0 pt-2">
            {/* Back button — shown for new blocks only, not when editing */}
            {!editingBlock && addStep !== 'pick_param' && (
              <Button variant="outline" onClick={() => setAddStep('pick_param')}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
            <Button variant="outline" onClick={closeAddDialog}>Cancel</Button>
            {!editingBlock && addStep === 'create_new' && (
              <Button onClick={handleCreateNew} disabled={!newName.trim() || creating}>
                {creating ? 'Creating…' : 'Create & Configure'}
              </Button>
            )}
            {addStep === 'configure' && (
              <Button onClick={handleSaveBlock} disabled={!selectedParam}>
                {editingBlock ? 'Update Block' : 'Add Block'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Save as Template dialog ──────────────────────────────────────────── */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save your current check-in block configuration as a reusable template.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label>Template name</Label>
            <Input
              placeholder="e.g. Standard Monitoring, Tendon Protocol…"
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && templateName.trim()) handleSaveTemplate(); }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {config.blocks.length} block{config.blocks.length !== 1 ? 's' : ''} will be saved.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim()}>
              <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" /> Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Load Template dialog ─────────────────────────────────────────────── */}
      <Dialog open={showLoadTemplateDialog} onOpenChange={setShowLoadTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Monitoring Templates</DialogTitle>
            <DialogDescription>
              Applying a template replaces all current check-in blocks.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1 min-h-[100px]">
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <BookOpen className="h-8 w-8 opacity-30" />
                <p className="text-sm">No templates saved yet.</p>
                <p className="text-xs">Save your current setup as a template to reuse it across athletes.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.blocks.length} block{t.blocks.length !== 1 ? 's' : ''} · {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleApplyTemplate(t)}>
                      Apply
                    </Button>
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="text-muted-foreground/50 hover:text-destructive transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadTemplateDialog(false)}>Close</Button>
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

      {/* Daily Monitoring */}
      <MonitoringCard athlete={athlete} />

    </div>
  );
}
