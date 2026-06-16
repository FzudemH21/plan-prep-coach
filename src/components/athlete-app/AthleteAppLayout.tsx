import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, MessageCircle, User, Bell, Lock, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAthleteApp } from '@/hooks/useAthleteApp';
import { useDailyCheckin } from '@/hooks/useDailyCheckin';
import { DailyCheckinSheet } from '@/components/athlete-app/DailyCheckinSheet';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, parseISO } from 'date-fns';

const NAV_PATHS = [
  { labelKey: 'athlete.nav.today' as const, icon: Home, path: '/athlete/today' },
  { labelKey: 'athlete.nav.plan' as const, icon: Calendar, path: '/athlete/plan' },
  { labelKey: 'athlete.nav.messages' as const, icon: MessageCircle, path: '/athlete/messages' },
  { labelKey: 'athlete.nav.profile' as const, icon: User, path: '/athlete/profile' },
];

interface UnreadPreview {
  id: string;
  content: string;
  createdAt: string;
}

/** Lightweight hook — polls for unread messages without a Realtime channel.
 *  Avoids channel conflict with the full useChat used in AthleteMessagesPage. */
function useAthleteUnread(connectionId: string | null) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [previews, setPreviews] = useState<UnreadPreview[]>([]);

  const load = useCallback(async () => {
    if (!connectionId || !user) return;
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, content, created_at')
      .eq('connection_id', connectionId)
      .eq('sender_role', 'coach')
      .is('read_by_athlete_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) return; // table may not exist yet — fail silently
    const rows = data ?? [];
    setUnreadCount(rows.length);
    setPreviews(
      rows.slice(0, 5).map((r) => ({
        id: r.id as string,
        content: r.content as string,
        createdAt: r.created_at as string,
      }))
    );
  }, [connectionId, user]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const markRead = useCallback(async () => {
    if (!connectionId || !user) return;
    await supabase
      .from('chat_messages')
      .update({ read_by_athlete_at: new Date().toISOString() })
      .eq('connection_id', connectionId)
      .eq('sender_role', 'coach')
      .is('read_by_athlete_at', null);
    setUnreadCount(0);
    setPreviews([]);
  }, [connectionId, user]);

  return { unreadCount, previews, markRead, reload: load };
}

async function signOutAthlete() {
  await supabase.auth.signOut();
}

// ── Splash screen helpers ────────────────────────────────────────────────────

interface SplashBranding {
  logoBase64?: string;
  welcomeMessage?: string;
}

function readSplashCache(): SplashBranding {
  try {
    const raw = localStorage.getItem('ppc-athlete-splash');
    return raw ? (JSON.parse(raw) as SplashBranding) : {};
  } catch {
    return {};
  }
}

function AthleteSplashScreen() {
  const { t } = useTranslation();
  const branding = readSplashCache();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen max-w-[480px] mx-auto px-10 gap-8 text-center">
      {branding.logoBase64 ? (
        <img
          src={branding.logoBase64}
          alt="Coach logo"
          className="max-h-48 max-w-[300px] object-contain"
        />
      ) : (
        <span className="text-3xl font-bold text-primary">Plan Prep Coach</span>
      )}
      <p className="text-xl font-medium text-foreground leading-relaxed max-w-[320px]">
        {branding.welcomeMessage || t('athlete.splash.defaultMessage')}
      </p>
      {/* Loading indicator */}
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export function AthleteAppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { connection, loading } = useAthleteApp();
  const { todayCheckin, saveCheckin } = useDailyCheckin(connection?.id ?? null);
  const [checkinOpen, setCheckinOpen] = useState(false);

  // Open check-in sheet once per day if not yet completed and monitoring is enabled —
  // lives in the shell layout (not a single tab page) so it pops up regardless of
  // which tab the athlete lands on first.
  useEffect(() => {
    if (!loading && todayCheckin === null && connection?.monitoringEnabled !== false) {
      const t = setTimeout(() => setCheckinOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [loading, todayCheckin, connection?.monitoringEnabled]);

  // ── Access gates ────────────────────────────────────────────────────────────
  // Suspended: coach archived the athlete — show soft-block screen.
  if (!loading && connection?.isSuspended) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen max-w-[480px] mx-auto px-6 text-center gap-6">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <Lock className="h-8 w-8 text-amber-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{t('athlete.suspended.title')}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('athlete.suspended.desc')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={signOutAthlete}>
          {t('athlete.signOut')}
        </Button>
      </div>
    );
  }

  // Removed: connection row was deleted — athlete is logged in but has no account.
  if (!loading && !connection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen max-w-[480px] mx-auto px-6 text-center gap-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <UserX className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{t('athlete.removed.title')}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('athlete.removed.desc')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={signOutAthlete}>
          {t('athlete.signOut')}
        </Button>
      </div>
    );
  }

  const chatEnabled = connection?.chatEnabled ?? true;

  const { unreadCount, previews, markRead } = useAthleteUnread(
    chatEnabled ? (connection?.id ?? null) : null
  );

  // Show branded splash while data loads — placed after all hook calls
  if (loading) return <AthleteSplashScreen />;

  const handleBellClick = () => {
    markRead();
    navigate('/athlete/messages');
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-[480px] mx-auto bg-background relative">
      <DailyCheckinSheet
        open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        onSave={saveCheckin}
        athleteName={connection?.athleteName}
        monitoringConfig={connection?.profileData?.monitoringConfig ?? undefined}
      />

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
        <span className="text-sm font-medium text-foreground">
          Plan Prep Coach
        </span>
        <div className="flex items-center gap-2">
          {!loading && connection && (
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
              {connection.athleteName}
            </span>
          )}
          {/* Notification bell — hidden when chat is disabled */}
          {chatEnabled && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative h-8 w-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-72 sm:w-[320px] sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
            >
              {previews.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              ) : (
                previews.map((msg) => (
                  <DropdownMenuItem
                    key={msg.id}
                    onClick={handleBellClick}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="text-xs font-medium">Coach</span>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {msg.content}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(parseISO(msg.createdAt), 'HH:mm')}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>

      {/* Bottom navigation */}
      <nav className="shrink-0 border-t bg-background/95 backdrop-blur-sm">
        <div className="flex items-stretch">
          {NAV_PATHS.filter(({ path }) => path !== '/athlete/messages' || chatEnabled).map(({ labelKey, icon: Icon, path }) => {
            const isActive =
              location.pathname === path ||
              location.pathname.startsWith(path + '/');
            const showBadge =
              path === '/athlete/messages' && unreadCount > 0;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="relative">
                  <Icon
                    className={cn('h-5 w-5', isActive && 'stroke-[2.5]')}
                  />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-[9px] text-white flex items-center justify-center font-medium">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span>{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
