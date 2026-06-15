import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { CheckCircle2, Activity, AlertTriangle, Bell, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/hooks/useCoachActivityFeed';
import type { AthleteScheduleEntry } from '@/hooks/useAthleteApp';

function FeedIcon({ item }: { item: FeedItem }) {
  if (item.flag === 'illness' || item.flag === 'low_wellness') {
    return (
      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
        <AlertTriangle className="h-4 w-4 text-red-600" />
      </div>
    );
  }
  if (item.flag === 'pain') {
    return (
      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      </div>
    );
  }
  if (item.type === 'session_complete') {
    return (
      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
      <Activity className="h-4 w-4 text-blue-600" />
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  onMarkItemRead: (id: string) => void;
  items: FeedItem[];
  loading: boolean;
  readIds: Set<string>;
}

export function CoachNotificationSheet({ open, onClose, onMarkAllRead, onMarkItemRead, items, loading, readIds }: Props) {
  const navigate = useNavigate();

  const handleItemClick = async (item: FeedItem) => {
    onMarkItemRead(item.id);
    onClose();

    if (item.type === 'session_complete' && item.date && item.sessionId) {
      const { data } = await supabase
        .from('athlete_schedule')
        .select('*')
        .eq('athlete_connection_id', item.connectionId)
        .eq('date', item.date)
        .maybeSingle();

      if (data) {
        const entry = {
          id: data.id as string,
          date: data.date as string,
          intensity: data.intensity as string | null,
          sessions: (data.sessions as AthleteScheduleEntry['sessions']) || [],
          events: (data.events as AthleteScheduleEntry['events']) || [],
          programName: data.program_name as string | null,
          mesocycleName: data.mesocycle_name as string | null,
          microcycleName: data.microcycle_name as string | null,
        };
        const sessionIdx = Math.max(0, entry.sessions.findIndex((s) => s.id === item.sessionId));
        navigate(`/coach-mobile/athletes/${item.athleteLocalId}/session`, {
          state: {
            entry,
            sessionIdx,
            connectionId: item.connectionId,
            returnPath: `/coach-mobile/athletes/${item.athleteLocalId}`,
          },
        });
        return;
      }
    }

    navigate(`/coach-mobile/athletes/${item.athleteLocalId}`, { state: { tab: 'overview' } });
  };

  const hasUnread = items.some(i => !readIds.has(i.id));

  return (
    <>
      {/* Backdrop — only blocks pointer events when open */}
      <div
        className={cn(
          'absolute inset-0 z-40 bg-black/25 transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          'absolute top-0 right-0 bottom-0 z-50 w-4/5 max-w-[320px] bg-background shadow-xl flex flex-col transition-transform duration-250 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Bell className="h-4 w-4" />
            Activity
          </div>
          <div className="flex items-center gap-1">
            {hasUnread && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 px-2"
                onClick={onMarkAllRead}
              >
                Mark all read
              </Button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center px-4">
              <Bell className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No activity in the last 7 days.</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="py-2">
              {items.map((item) => {
                const isUnread = !readIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors active:bg-accent/80',
                      isUnread ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-accent'
                    )}
                  >
                    <FeedIcon item={item} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold truncate">{item.athleteName}</p>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className={cn(
                        'text-xs mt-0.5 leading-snug',
                        item.flag === 'illness' || item.flag === 'low_wellness'
                          ? 'text-red-600 font-medium'
                          : item.flag === 'pain'
                          ? 'text-amber-600 font-medium'
                          : 'text-muted-foreground'
                      )}>
                        {item.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(parseISO(item.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
