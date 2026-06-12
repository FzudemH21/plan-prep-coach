import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAthletes } from '@/hooks/useAthletes';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';

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

// ── component ─────────────────────────────────────────────────────────────────

export default function CoachMobileAthletesPage() {
  const navigate = useNavigate();
  const { athletes, isLoading } = useAthletes();
  const { connections } = useAthleteConnections();
  const [search, setSearch] = useState('');

  const active = athletes.filter(a => !a.isArchived);

  const connMap = useMemo(
    () => new Map(connections.map(c => [c.athleteLocalId, c])),
    [connections]
  );

  const connected = connections.filter(c => c.connectedAt).length;
  const pending   = connections.filter(c => !c.connectedAt).length;

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return active.filter(a => {
      const full = `${a.firstName} ${a.lastName}`.toLowerCase();
      return !q || full.includes(q);
    });
  }, [active, search]);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">
          Today, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
        <h1 className="text-2xl font-bold">All athletes</h1>
      </div>

      {/* Stats */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto">
        {[
          { label: 'Connected', value: connected, emoji: '💪' },
          { label: 'Pending',   value: pending,   emoji: '⏳' },
          { label: 'Total',     value: active.length, emoji: '👥' },
        ].map(({ label, value, emoji }) => (
          <div
            key={label}
            className="shrink-0 flex-1 min-w-[90px] rounded-xl border bg-card px-3 py-2.5 text-center"
          >
            <div className="text-xl font-bold leading-none">{emoji} {value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

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
          All athletes ({displayed.length})
        </p>
      </div>

      {/* List */}
      <div className="flex-1 px-4 space-y-0 divide-y divide-border">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <UserPlus className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No athletes yet</p>
          </div>
        ) : (
          displayed.map(athlete => {
            const conn = connMap.get(athlete.id);
            const fullName = `${athlete.firstName} ${athlete.lastName}`;
            const bg = avatarColor(fullName);
            const isConnected = conn?.connectedAt;
            const isPending = conn && !conn.connectedAt;

            return (
              <button
                key={athlete.id}
                className="w-full flex items-center gap-3 py-3 text-left active:bg-accent/50 transition-colors"
                onClick={() => navigate(`/coach-mobile/athletes/${athlete.id}`)}
              >
                {/* Avatar */}
                <div
                  className={`shrink-0 w-11 h-11 rounded-full ${bg} flex items-center justify-center`}
                >
                  <span className="text-sm font-semibold text-white">
                    {initials(athlete.firstName, athlete.lastName)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {isConnected
                      ? 'Connected'
                      : isPending
                      ? 'Invite pending'
                      : 'Not invited yet'}
                  </p>
                </div>

                {/* Status dot */}
                <div
                  className={`shrink-0 w-2 h-2 rounded-full ${
                    isConnected ? 'bg-emerald-500' : isPending ? 'bg-amber-400' : 'bg-muted-foreground/30'
                  }`}
                />
              </button>
            );
          })
        )}
      </div>

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  );
}
