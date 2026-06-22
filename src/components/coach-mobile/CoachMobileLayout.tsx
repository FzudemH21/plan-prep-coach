import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Users, User, MessageCircle, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCoachProfile } from '@/hooks/useCoachProfile';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { useUnreadCounts } from '@/hooks/useChat';
import { useCoachActivityFeed } from '@/hooks/useCoachActivityFeed';
import { CoachNotificationSheet } from '@/components/coach-mobile/CoachNotificationSheet';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function CoachMobileLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useCoachProfile();

  const NAV = [
    { label: t('coachMobile.nav.athletes'), icon: Users, path: '/coach-mobile/athletes' },
    { label: t('coachMobile.nav.messages'), icon: MessageCircle, path: '/coach-mobile/messages' },
    { label: t('coachMobile.nav.profile'), icon: User, path: '/coach-mobile/profile' },
  ];
  const { connections } = useAthleteConnections();

  const connectionIds = useMemo(
    () => connections.filter((c) => c.athleteAuthUserId).map((c) => c.id),
    [connections]
  );
  const { totalUnread } = useUnreadCounts(connectionIds, 'coach');
  const { items: feedItems, loading: feedLoading, unseenCount, markSeen, markItemRead, readIds } =
    useCoachActivityFeed(connections);
  const [notifOpen, setNotifOpen] = useState(false);

  const handleBellClick = () => {
    setNotifOpen(true);
  };

  const initials = (profile?.name ?? 'C')
    .trim()
    .split(/\s+/)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-screen w-full max-w-[480px] mx-auto bg-background relative overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center gap-2 px-4 py-3 border-b bg-background/90 backdrop-blur-sm">
        <span className="flex-1 text-base font-semibold text-primary truncate">
          {profile?.branding?.businessName?.trim() || 'Plan Prep Coach'}
        </span>

        {/* Notification bell */}
        <button
          onClick={handleBellClick}
          className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
          aria-label={t('coachMobile.nav.activity')}
        >
          <Bell className="h-5 w-5" />
          {unseenCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center px-0.5 leading-none">
              {unseenCount > 9 ? '9+' : unseenCount}
            </span>
          )}
        </button>

        {/* Coach avatar → profile */}
        <button
          onClick={() => navigate('/coach-mobile/profile')}
          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0"
        >
          {profile?.avatarBase64 ? (
            <img
              src={profile.avatarBase64}
              alt="Coach"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <span className="text-xs font-semibold text-primary-foreground select-none">
              {initials}
            </span>
          )}
        </button>
      </header>

      <CoachNotificationSheet
        open={notifOpen}
        onClose={() => { setNotifOpen(false); markSeen(); }}
        onMarkAllRead={markSeen}
        onMarkItemRead={markItemRead}
        items={feedItems}
        loading={feedLoading}
        readIds={readIds}
      />

      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>

      {/* Bottom navigation */}
      <nav className="shrink-0 border-t bg-background/95 backdrop-blur-sm safe-area-bottom">
        <div className="flex items-stretch">
          {NAV.map(({ label, icon: Icon, path }) => {
            const active =
              location.pathname === path || location.pathname.startsWith(path + '/');
            const isMessages = path === '/coach-mobile/messages';
            const badge = isMessages && totalUnread > 0 ? totalUnread : 0;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 text-xs font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className="relative">
                  <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center px-0.5 leading-none">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
