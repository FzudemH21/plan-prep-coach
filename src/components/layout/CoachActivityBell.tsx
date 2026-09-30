/**
 * CoachActivityBell — the desktop coach app's notification bell: what athletes did in the last
 * 7 days (anamnesis forms filled in, sessions completed, daily check-ins), the same feed as the
 * coach mobile bell. Clicking an item opens that athlete on the matching tab.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { AlertTriangle, Bell, CheckCircle2, ClipboardList, HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useCoachActivityFeed, type FeedItem } from '@/hooks/useCoachActivityFeed';
import type { AthleteConnection } from '@/hooks/useAthleteConnections';

function ItemIcon({ item }: { item: FeedItem }) {
  if (item.type === 'anamnesis_submitted') {
    return <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><ClipboardList className="h-4 w-4 text-blue-600" /></span>;
  }
  if (item.flag) {
    return <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><AlertTriangle className="h-4 w-4 text-amber-600" /></span>;
  }
  if (item.type === 'session_complete') {
    return <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0"><CheckCircle2 className="h-4 w-4 text-green-600" /></span>;
  }
  return <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"><HeartPulse className="h-4 w-4 text-muted-foreground" /></span>;
}

/** The athlete profile tab an item belongs to */
const TAB_FOR: Record<FeedItem['type'], string> = {
  anamnesis_submitted: 'anamnesis',
  session_complete: 'calendar',
  checkin: 'monitoring',
};

export function CoachActivityBell({ connections }: { connections: AthleteConnection[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { items, loading, unseenCount, markSeen, markItemRead, readIds } = useCoachActivityFeed(connections);

  const openItem = (item: FeedItem) => {
    markItemRead(item.id);
    setOpen(false);
    navigate('/athletes', { state: { openAthleteId: item.athleteLocalId, defaultTab: TAB_FOR[item.type] } });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative h-9 w-9 p-0" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unseenCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-medium">
              {unseenCount > 9 ? '9+' : unseenCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          {unseenCount > 0 && (
            <button type="button" className="text-xs text-primary hover:underline" onClick={markSeen}>Mark all as read</button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nothing new in the last 7 days.</p>
          ) : items.map(item => {
            const unread = !readIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openItem(item)}
                className={cn('w-full flex items-start gap-3 px-4 py-3 text-left border-b last:border-0 hover:bg-accent/60 transition-colors', unread && 'bg-primary/5')}
              >
                <ItemIcon item={item} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm"><span className="font-medium">{item.athleteName}</span> {item.description.charAt(0).toLowerCase() + item.description.slice(1)}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true })}</span>
                </span>
                {unread && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" aria-label="Unread" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
