import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Calendar, MessageCircle, User, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAthleteApp } from '@/hooks/useAthleteApp';
import { useChat } from '@/hooks/useChat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, parseISO } from 'date-fns';

const NAV_PATHS = [
  { label: 'Today', icon: Home, path: '/athlete/today' },
  { label: 'Plan', icon: Calendar, path: '/athlete/plan' },
  { label: 'Messages', icon: MessageCircle, path: '/athlete/messages' },
  { label: 'Profile', icon: User, path: '/athlete/profile' },
];

export function AthleteAppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connection, loading } = useAthleteApp();

  const { messages, unreadCount, markRead } = useChat({
    connectionId: connection?.id ?? null,
    callerRole: 'athlete',
  });

  // Unread messages for the notification bell dropdown
  const unreadMessages = messages.filter(
    (m) => m.senderRole === 'coach' && !m.readByAthleteAt
  ).slice(-5).reverse();

  const handleBellClick = () => {
    // Mark read and navigate to messages
    markRead();
    navigate('/athlete/messages');
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-[480px] mx-auto bg-background relative">
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
          {/* Notification bell */}
          <DropdownMenu>
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
              {unreadMessages.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              ) : (
                unreadMessages.map((msg) => (
                  <DropdownMenuItem
                    key={msg.id}
                    onClick={handleBellClick}
                    className="flex flex-col items-start gap-0.5 py-2"
                  >
                    <span className="text-xs font-medium">Coach</span>
                    <span className="text-xs text-muted-foreground line-clamp-2">{msg.content}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(parseISO(msg.createdAt), 'HH:mm')}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>

      {/* Bottom navigation */}
      <nav className="shrink-0 border-t bg-background/95 backdrop-blur-sm">
        <div className="flex items-stretch">
          {NAV_PATHS.map(({ label, icon: Icon, path }) => {
            const isActive = location.pathname === path || location.pathname.startsWith(path + '/');
            const showBadge = path === '/athlete/messages' && unreadCount > 0;
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
                  <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-[9px] text-white flex items-center justify-center font-medium">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
