import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCoachProfile } from '@/hooks/useCoachProfile';

const NAV = [
  { label: 'Athletes', icon: Users, path: '/coach-mobile/athletes' },
  { label: 'Profile', icon: User, path: '/coach-mobile/profile' },
];

export function CoachMobileLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useCoachProfile();

  const initials = (profile?.name ?? 'C')
    .trim()
    .split(/\s+/)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col h-screen w-full max-w-[480px] mx-auto bg-background">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b bg-background/90 backdrop-blur-sm">
        <span className="text-base font-semibold text-primary">
          {profile?.branding?.businessName?.trim() || 'Plan Prep Coach'}
        </span>
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

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>

      {/* Bottom navigation */}
      <nav className="shrink-0 border-t bg-background/95 backdrop-blur-sm safe-area-bottom">
        <div className="flex items-stretch">
          {NAV.map(({ label, icon: Icon, path }) => {
            const active =
              location.pathname === path || location.pathname.startsWith(path + '/');
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 text-xs font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
