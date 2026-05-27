import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAthleteApp } from '@/hooks/useAthleteApp';

const NAV_ITEMS = [
  { label: 'Today', icon: Home, path: '/athlete/today' },
  { label: 'Plan', icon: Calendar, path: '/athlete/plan' },
  { label: 'Messages', icon: MessageCircle, path: '/athlete/messages' },
  { label: 'Profile', icon: User, path: '/athlete/profile' },
];

export function AthleteAppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connection, loading } = useAthleteApp();

  return (
    <div className="flex flex-col h-screen w-full max-w-[480px] mx-auto bg-background relative">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm shrink-0">
        <span className="text-sm font-medium text-foreground">
          Plan Prep Coach
        </span>
        {!loading && connection && (
          <span className="text-xs text-muted-foreground truncate max-w-[180px]">
            {connection.athleteName}
          </span>
        )}
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>

      {/* Bottom navigation */}
      <nav className="shrink-0 border-t bg-background/95 backdrop-blur-sm">
        <div className="flex items-stretch">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
            const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
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
                <Icon
                  className={cn('h-5 w-5', isActive && 'stroke-[2.5]')}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
