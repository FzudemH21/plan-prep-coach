import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, UserPlus, Dumbbell, BedDouble, Heart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAthletes } from '@/hooks/useAthletes';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { supabase } from '@/lib/supabase';
import { wellnessComposite, type AthleteCheckin } from '@/hooks/useAthleteCheckins';
import { DEFAULT_MONITORING_CONFIG } from '@/types/athlete';

// ── helpers ──────────────────────────────────────────────────────────────────

const PALETTE = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-rose-500', 'bg-indigo-500',
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function wellnessColor(composite: number | null): string {
  if (composite === null) return 'text-muted-foreground/40';
  if (composite < 2.5) return 'text-red-500';
  if (composite < 3.5) return 'text-amber-500';
  return 'text-emerald-500';
}

function fromCheckinRow(r: Record<string, unknown>): AthleteCheckin {
  return {
    id:               r.id as string,
    date:             r.date as string,
    wellnessFatigue:  (r.wellness_fatigue  as number) ?? null,
    wellnessSleep:    (r.wellness_sleep    as number) ?? null,
    wellnessSoreness: (r.wellness_soreness as number) ?? null,
    wellnessStress:   (r.wellness_stress   as number) ?? null,
    wellnessMood:     (r.wellness_mood     as number) ?? null,
    hasPain:     (r.has_pain    as boolean) ?? false,
    painAreas:   (r.pain_areas  as AthleteCheckin['painAreas']) ?? [],
    hasIllness:  (r.has_illness as boolean) ?? false,
    illnessSymptoms:     (r.illness_symptoms      as string[]) ?? [],
    illnessSymptomOther: (r.illness_symptom_other as string)  ?? '',
    illnessNrs:          (r.illness_nrs           as number)  ?? null,
    notes:    (r.notes     as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

// ── component ─────────────────────────────────────────────────────────────────

export default function CoachMobileAthletesPage() {
  const navigate  = useNavigate();
  const { athletes, groups, isLoading } = useAthletes();
  const { connections } = useAthleteConnections();
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const today = getToday();

  const active  = athletes.filter(a => !a.isArchived);
  const connMap = useMemo(
    () => new Map(connections.map(c => [c.athleteLocalId, c])),
    [connections],
  );

  const connected = connections.filter(c => c.connectedAt).length;
  const pending   = connections.filter(c => !c.connectedAt).length;

  // ── check-ins: today only for wellness dot + illness/pain flags ──────────
  // connectionId → today's checkin
  const [checkinMap, setCheckinMap] = useState<Map<string, AthleteCheckin>>(new Map());
  // connectionId → first session name | null (rest day)
  const [sessionMap, setSessionMap] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    const connectedIds = connections.filter(c => c.connectedAt).map(c => c.id);
    if (connectedIds.length === 0) return;

    supabase
      .from('athlete_daily_checkins')
      .select('*')
      .in('athlete_connection_id', connectedIds)
      .eq('date', today)
      .then(({ data }) => {
        const map = new Map<string, AthleteCheckin>();
        for (const row of (data ?? []) as Record<string, unknown>[]) {
          map.set(row.athlete_connection_id as string, fromCheckinRow(row));
        }
        setCheckinMap(map);
      });

    supabase
      .from('athlete_schedule')
      .select('athlete_connection_id, sessions')
      .eq('date', today)
      .in('athlete_connection_id', connectedIds)
      .then(({ data }) => {
        const map = new Map<string, string | null>();
        for (const row of (data ?? []) as Record<string, unknown>[]) {
          const sessions = (row.sessions as Array<{ name?: string }>) ?? [];
          const name = sessions.length > 0 ? (sessions[0].name || 'Session') : null;
          map.set(row.athlete_connection_id as string, name);
          if (sessions.length > 1) {
            map.set(row.athlete_connection_id as string, `${sessions.length} sessions`);
          }
        }
        setSessionMap(map);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections.length, today]);

  // ── filtered list ──────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return active.filter(a => {
      const matchesSearch = !q || `${a.firstName} ${a.lastName}`.toLowerCase().includes(q);
      const matchesGroup  = !selectedGroup || a.groupIds.includes(selectedGroup);
      return matchesSearch && matchesGroup;
    });
  }, [active, search, selectedGroup]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">
          Today, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
        <h1 className="text-2xl font-bold">Athletes</h1>
      </div>

      {/* Stats */}
      <div className="px-4 pb-3 flex gap-2">
        {[
          { label: 'Connected', value: connected, emoji: '💪' },
          { label: 'Pending',   value: pending,   emoji: '⏳' },
          { label: 'Total',     value: active.length, emoji: '👥' },
        ].map(({ label, value, emoji }) => (
          <div
            key={label}
            className="shrink-0 flex-1 rounded-xl border bg-card px-3 py-2.5 text-center"
          >
            <div className="text-xl font-bold leading-none">{emoji} {value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Group selector */}
      {groups.length > 0 && (
        <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedGroup(null)}
            className={cn(
              'shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              selectedGroup === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGroup(g.id === selectedGroup ? null : g.id)}
              className={cn(
                'shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                selectedGroup === g.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground hover:text-foreground',
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-xl bg-muted border-0 h-10"
            placeholder="Search athletes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setSearch('')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Section label */}
      <div className="px-4 pb-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          {selectedGroup
            ? `${groups.find(g => g.id === selectedGroup)?.name ?? 'Group'} (${displayed.length})`
            : `All athletes (${displayed.length})`}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 px-4 divide-y divide-border">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <UserPlus className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No athletes yet</p>
          </div>
        ) : (
          displayed.map(athlete => {
            const conn        = connMap.get(athlete.id);
            const fullName    = `${athlete.firstName} ${athlete.lastName}`;
            const bg          = avatarColor(fullName);
            const isConnected = !!conn?.connectedAt;
            const isPending   = conn && !conn.connectedAt;

            // Monitoring
            const monConfig    = conn?.monitoringConfig ?? DEFAULT_MONITORING_CONFIG;
            const monEnabled   = conn?.monitoringEnabled ?? false;
            const enabledTypes = monEnabled
              ? (monConfig.blocks ?? []).filter(b => b.enabled).map(b => b.type)
              : [];
            const hasWellbeing = enabledTypes.includes('wellbeing');
            const hasOstrc     = enabledTypes.includes('ostrc');

            const checkin   = conn ? checkinMap.get(conn.id) : undefined;
            const composite = checkin ? wellnessComposite(checkin) : null;
            const showWellness = isConnected && hasWellbeing;
            const showIllness  = isConnected && hasOstrc && (checkin?.hasIllness ?? false);
            const showPain     = isConnected && hasOstrc && (checkin?.hasPain ?? false);

            // Today's session
            const sessionName = conn ? sessionMap.get(conn.id) : undefined;
            const hasSession  = sessionName !== undefined && sessionName !== null;

            return (
              <button
                key={athlete.id}
                className="w-full flex items-center gap-3 py-3 text-left active:bg-accent/50 transition-colors"
                onClick={() => navigate(`/coach-mobile/athletes/${athlete.id}`)}
              >
                {/* Avatar */}
                <div className={`shrink-0 w-11 h-11 rounded-full ${bg} flex items-center justify-center`}>
                  <span className="text-sm font-semibold text-white">
                    {initials(athlete.firstName, athlete.lastName)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold truncate">{fullName}</p>
                    {showIllness && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
                        Ill
                      </span>
                    )}
                    {showPain && !showIllness && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                        Pain
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5">
                    {hasSession ? (
                      <>
                        <Dumbbell className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">{sessionName}</span>
                      </>
                    ) : isConnected ? (
                      <>
                        <BedDouble className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                        <span className="text-xs text-muted-foreground/50">Rest day</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {isPending ? 'Invite pending' : 'Not invited yet'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: wellness value */}
                {showWellness && (
                  <div className={cn('shrink-0 text-right flex flex-col items-center gap-0.5', wellnessColor(composite))}>
                    <Heart className="h-3 w-3" />
                    <span className="text-sm font-semibold tabular-nums leading-none">
                      {composite !== null ? composite.toFixed(1) : '–'}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-none">/ 5</span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="h-4" />
    </div>
  );
}
