/**
 * Coach Profile → Organization: name, branding (owner), members with role and a rights grid,
 * invite links (owner), recent changes (who changed what, phase 4) and the deletion log.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Building2, Copy, Link2, Trash2, UserPlus, X, History, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { supabase } from '@/lib/supabase';
import { inviteLink, useOrganization, type OrgMember, type OrgRights, type OrgRole } from '@/hooks/useOrganization';

type InviteRole = Exclude<OrgRole, 'owner'>;

/** brandingCard: the organization's look (logo, name, colors) — edited by the owner, or by anyone
 *  without an organization */
export function OrganizationTab({ brandingCard }: { brandingCard?: ReactNode }) {
  const { t } = useTranslation();
  const org = useOrganization();

  if (org.status === 'loading') {
    return <p className="text-sm text-muted-foreground py-6">{t('common.loading')}</p>;
  }
  if (org.status === 'unavailable') {
    return (
      <div className="space-y-6">
        {brandingCard}
        <p className="text-sm text-muted-foreground">{t('organization.unavailable')}</p>
        <BackupCard />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <NameCard name={org.orgName} isOwner={org.isOwner} onRename={org.rename} />
      {org.isOwner && brandingCard}
      <MembersCard org={org} />
      {org.members.length > 1 && <ActivityCard members={org.members} />}
      <DeletionLogCard members={org.members} />
      <BackupCard />
    </div>
  );
}

// ── Name ────────────────────────────────────────────────────────────────────────────────────────

function NameCard({ name, isOwner, onRename }: { name: string; isOwner: boolean; onRename: (n: string) => Promise<unknown> }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(name), [name]);
  const changed = draft.trim() !== name && draft.trim().length > 0;

  const save = async () => {
    setSaving(true);
    try {
      await onRename(draft.trim());
      toast({ title: t('organization.name.saved') });
    } catch (e) {
      toast({ title: t(`organization.errors.${(e as Error).message}`, t('organization.errors.unknown')), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          {t('organization.name.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isOwner ? (
          <div className="flex gap-2">
            <Input value={draft} maxLength={100} onChange={(e) => setDraft(e.target.value)} />
            {changed && <Button onClick={save} disabled={saving}>{t('common.save')}</Button>}
          </div>
        ) : (
          <p className="text-sm font-medium">{name}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Members, rights and invites ─────────────────────────────────────────────────────────────────

/** The rights grid: programs ticked = may change every program (else only their own — every coach
 *  creates programs); libraries ticked = may change them (else view only); health ticked = may change
 *  the health data of their athletes (else view only); AI ticked = on. Athletes aren't in the grid:
 *  a coach reaches the athletes assigned to them, owners all. Owners always have everything. */
const GRID_RIGHTS = ['programs', 'libraries', 'health', 'ai'] as const;
type GridRight = typeof GRID_RIGHTS[number];
const isOn = (rights: OrgRights, k: GridRight): boolean =>
  k === 'health' || k === 'ai' ? rights[k] : rights[k] === 'edit';
const toggled = (rights: OrgRights, k: GridRight): OrgRights =>
  k === 'health' || k === 'ai'
    ? { ...rights, [k]: !rights[k] }
    : { ...rights, [k]: rights[k] === 'edit' ? 'view' : 'edit' };

const GRID_COLS = 'grid grid-cols-[minmax(0,1fr)_7rem_repeat(4,3.5rem)_2rem] items-center gap-x-1';

function MembersCard({ org }: { org: ReturnType<typeof useOrganization> }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<OrgMember | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fail = (e: unknown) =>
    toast({ title: t(`organization.errors.${(e as Error).message}`, t('organization.errors.unknown')), variant: 'destructive' });

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      toast({ title: t('organization.invite.copied') });
    } catch {
      toast({ title: inviteLink(code) });
    }
  };

  const changeRole = (m: OrgMember, role: OrgRole) => {
    if (role === m.role) return;
    org.setRole(m.userId, role).catch(fail);
  };

  const toggleRight = (m: OrgMember, k: GridRight) => {
    if (!m.rights || busy) return;
    setBusy(m.userId);
    org.setRights(m.userId, toggled(m.rights, k)).catch(fail).finally(() => setBusy(null));
  };

  const confirmRemove = () => {
    if (!removing) return;
    org.removeMember(removing.userId)
      .then(() => toast({ title: t('organization.members.removed', { name: removing.name || removing.email }) }))
      .catch(fail)
      .finally(() => setRemoving(null));
  };

  const hasRights = org.members.some((m) => m.rights);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t('organization.members.title')}</CardTitle>
        {org.isOwner && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" />
            {t('organization.invite.button')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {hasRights && (
          <div className={`${GRID_COLS} pb-2 border-b text-xs text-muted-foreground`}>
            <span />
            <span />
            {GRID_RIGHTS.map((k) => (
              <span key={k} className="text-center truncate" title={t(`organization.rights.${k}`)}>
                {t(`organization.rights.short.${k}`)}
              </span>
            ))}
            <span />
          </div>
        )}
        {org.members.map((m) => {
          const isMe = m.userId === user?.id;
          const canEditRow = org.isOwner && m.role !== 'owner' && !!m.rights;
          return (
            <div key={m.userId} className={`${GRID_COLS} py-2 border-b last:border-b-0`}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {m.name || m.email}
                  {isMe && <span className="text-muted-foreground font-normal"> · {t('organization.members.you')}</span>}
                </p>
                {m.name && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
              </div>
              <div>
                {org.isOwner && !isMe ? (
                  <Select value={m.role} onValueChange={(v) => changeRole(m, v as OrgRole)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(m.role === 'intern' ? ['owner', 'coach', 'intern'] as const : ['owner', 'coach'] as const).map((r) => (
                        <SelectItem key={r} value={r}>{t(`organization.roles.${r}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary">{t(`organization.roles.${m.role}`)}</Badge>
                )}
              </div>
              {GRID_RIGHTS.map((k) => (
                <div key={k} className="flex justify-center">
                  {m.rights && (
                    <Checkbox
                      checked={isOn(m.rights, k)}
                      disabled={!canEditRow || busy === m.userId}
                      onCheckedChange={() => toggleRight(m, k)}
                      aria-label={`${t(`organization.rights.${k}`)} — ${m.name || m.email}`}
                    />
                  )}
                </div>
              ))}
              <div>
                {org.isOwner && !isMe && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRemoving(m)}
                    aria-label={t('organization.members.remove')}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {hasRights && <p className="text-xs text-muted-foreground pt-2">{t('organization.rights.legend')}</p>}

        {org.isOwner && org.invites.length > 0 && (
          <div className="pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">{t('organization.invite.open')}</p>
            {org.invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 py-1.5">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('organization.invite.until', {
                      date: new Date(inv.expiresAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
                    })}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copy(inv.code)}
                  aria-label={t('organization.invite.copy')}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => org.revokeInvite(inv.id).catch(fail)}
                  aria-label={t('organization.invite.revoke')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} createInvite={org.createInvite} onCopy={copy} />

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('organization.members.removeTitle', { name: removing?.name || removing?.email })}</AlertDialogTitle>
            <AlertDialogDescription>{t('organization.members.removeDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>{t('organization.members.remove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Everyone joins as Coach with every right; the owner changes rights in the grid afterwards */
function InviteDialog({ open, onOpenChange, createInvite, onCopy }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  createInvite: (email: string, role: InviteRole) => Promise<string>;
  onCopy: (code: string) => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setEmail(''); setCode(null); setError(null); }
  }, [open]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      setCode(await createInvite(email, 'coach'));
    } catch (e) {
      setError(t(`organization.errors.${(e as Error).message}`, t('organization.errors.unknown')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('organization.invite.title')}</DialogTitle>
        </DialogHeader>
        {code ? (
          <div className="space-y-3">
            <p className="text-sm">{t('organization.invite.created', { email: email.trim() })}</p>
            <div className="flex gap-2">
              <Input readOnly value={inviteLink(code)} onFocus={(e) => e.target.select()} className="text-xs" />
              <Button variant="outline" size="icon" onClick={() => onCopy(code)} aria-label={t('organization.invite.copy')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{t('common.done')}</Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void create(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="org-invite-email">{t('auth.email')}</Label>
              <Input id="org-invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={busy || !email.trim()}>{t('organization.invite.create')}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Deletion log ────────────────────────────────────────────────────────────────────────────────

interface DeletionRow {
  id: number;
  table_name: string;
  record_id: string | null;
  label: string | null;
  athlete_connection_id: string | null;
  deleted_by: string | null;
  deleted_at: string;
}

const LOG_LIMIT = 100;

/** What was deleted, as a translation key */
function kindKey(row: { table_name: string; record_id: string | null }): string {
  if (row.table_name === 'coach_records') {
    const [store, id = ''] = (row.record_id ?? '').split('/');
    if (store === 'exercises') return id.startsWith('lib:') ? 'exerciseLibrary' : id.startsWith('ci:') ? 'circuit' : 'exercise';
    if (store === 'parameters') return id.startsWith('p:') ? 'parameter' : 'parameterLink';
    return ({ methods: 'method', templates: 'template', workouts: 'workout', calendar_events: 'testsEvents', athlete_documents: 'athleteDocuments', monitoring_templates: 'monitoringTemplate' } as Record<string, string>)[store] ?? 'other';
  }
  return ({
    athlete_session_logs: 'sessionLog', athlete_test_results: 'testResult', athlete_daily_checkins: 'checkin',
    athlete_anamneses: 'anamnesis', anamnesis_templates: 'anamnesisForm', athlete_connections: 'appConnection',
    chat_messages: 'chatMessage', coach_session_remarks: 'remark', athlete_assignment_plans: 'assignedPlan',
    program_versions: 'programVersion', program_records: 'program', athlete_records: 'athlete',
  } as Record<string, string>)[row.table_name] ?? 'other';
}

// ── Logs: the latest few, the rest in a dialog ────────────────────────────────────────────────

const PREVIEW_ROWS = 5;

function LogRows<T>({ title, rows, render }: { title: string; rows: T[]; render: (row: T) => ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="-mx-2">{rows.slice(0, PREVIEW_ROWS).map(render)}</div>
      {rows.length > PREVIEW_ROWS && (
        <Button variant="ghost" size="sm" className="mt-2 h-8 px-2 text-xs" onClick={() => setOpen(true)}>
          {t('organization.showAll', { count: rows.length })}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto px-2">{rows.map(render)}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Backup & restore (moved here from the program library) ─────────────────────────────────────

function BackupCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{t('organization.backup.title')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('organization.backup.text')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/restore-programs')}>{t('organization.backup.open')}</Button>
      </CardContent>
    </Card>
  );
}

// ── Recent changes (phase 4) ────────────────────────────────────────────────────────────────────

interface ActivityRow {
  id: number;
  actor: string;
  table_name: string;
  record_id: string;
  label: string | null;
  kind: 'create' | 'change' | 'restore';
  at: string;
}

/** Who created, changed or restored which program, athlete or library item — written by the
 *  database (activity_log), several changes of one item within 30 minutes are one entry */
function ActivityCard({ members }: { members: OrgMember[] }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('activity_log')
      .select('id, actor, table_name, record_id, label, kind, at')
      .order('at', { ascending: false })
      .limit(LOG_LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return;
        // Before the phase 4 SQL the table doesn't exist — the card just stays empty
        if (error) console.warn('[ActivityLog]', error.message);
        setRows((data ?? []) as ActivityRow[]);
      });
    return () => { cancelled = true; };
  }, []);

  const memberNames = useMemo(() => new Map(members.map((m) => [m.userId, m.name || m.email])), [members]);
  const byWhom = (actor: string) =>
    actor === user?.id ? t('organization.members.you') : memberNames.get(actor) ?? t('organization.deletionLog.someoneElse');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t('organization.activity.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('organization.activity.empty')}</p>
        ) : (
          <LogRows
            title={t('organization.activity.title')}
            rows={rows}
            render={(row) => (
              <div key={row.id} className="flex items-baseline gap-3 px-2 py-1.5 text-sm border-b last:border-b-0">
                <span className="text-xs text-muted-foreground w-28 shrink-0 tabular-nums">
                  {new Date(row.at).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted-foreground">
                    {t(`organization.activity.kinds.${row.kind}`)} · {t(`organization.deletionLog.kinds.${kindKey(row)}`)}
                  </span>
                  {row.label && <> · {row.label}</>}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{byWhom(row.actor)}</span>
              </div>
            )}
          />
        )}
      </CardContent>
    </Card>
  );
}

function DeletionLogCard({ members }: { members: OrgMember[] }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { connections } = useAthleteConnections();
  const [rows, setRows] = useState<DeletionRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('deletion_log')
      .select('id, table_name, record_id, label, athlete_connection_id, deleted_by, deleted_at')
      .order('deleted_at', { ascending: false })
      .limit(LOG_LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn('[DeletionLog]', error.message);
        setRows((data ?? []) as DeletionRow[]);
      });
    return () => { cancelled = true; };
  }, []);

  const athleteNames = useMemo(() => new Map(connections.map((c) => [c.id, c.athleteName])), [connections]);
  const memberNames = useMemo(() => new Map(members.map((m) => [m.userId, m.name || m.email])), [members]);

  const byWhom = (row: DeletionRow): string => {
    if (!row.deleted_by) return '—';
    if (row.deleted_by === user?.id) return t('organization.members.you');
    const member = memberNames.get(row.deleted_by);
    if (member) return member;
    const athlete = connections.find((c) => c.athleteAuthUserId === row.deleted_by);
    return athlete ? athlete.athleteName : t('organization.deletionLog.someoneElse');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          {t('organization.deletionLog.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('organization.deletionLog.empty')}</p>
        ) : (
          <LogRows
            title={t('organization.deletionLog.title')}
            rows={rows}
            render={(row) => {
              const athlete = row.athlete_connection_id ? athleteNames.get(row.athlete_connection_id) : undefined;
              return (
                <div key={row.id} className="flex items-baseline gap-3 px-2 py-1.5 text-sm border-b last:border-b-0">
                  <span className="text-xs text-muted-foreground w-28 shrink-0 tabular-nums">
                    {new Date(row.deleted_at).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-muted-foreground">{t(`organization.deletionLog.kinds.${kindKey(row)}`)}</span>
                    {row.label && <> · {row.label}</>}
                    {athlete && row.table_name !== 'athlete_connections' && <span className="text-muted-foreground"> · {athlete}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{byWhom(row)}</span>
                </div>
              );
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
