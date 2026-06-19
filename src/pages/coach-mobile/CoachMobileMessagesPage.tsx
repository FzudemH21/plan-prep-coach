import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { useUnreadCounts } from '@/hooks/useChat';

export default function CoachMobileMessagesPage() {
  const navigate = useNavigate();
  const { connections, loading: connLoading } = useAthleteConnections();

  // Only athletes who have signed in to the athlete app can be messaged
  const connected = useMemo(
    () => connections.filter((c) => c.athleteAuthUserId),
    [connections]
  );

  const connectionIds = useMemo(() => connected.map((c) => c.id), [connected]);
  const { counts } = useUnreadCounts(connectionIds, 'coach');

  if (connLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <h1 className="text-lg font-semibold mb-4">Messages</h1>

      {connected.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <MessageCircle className="h-7 w-7 text-primary" />
          </div>
          <p className="text-base font-semibold mb-1">No connected athletes</p>
          <p className="text-sm text-muted-foreground">
            Once an athlete connects via the athlete app, you can message them here.
          </p>
        </div>
      )}

      {connected.length > 0 && (
        <div className="space-y-1">
          {connected.map((conn) => {
            const unread = counts.get(conn.id) ?? 0;
            return (
              <button
                key={conn.id}
                onClick={() => navigate(`/coach-mobile/athletes/${conn.athleteLocalId}/chat`)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-accent active:bg-accent/80 transition-colors text-left"
              >
                {/* Avatar */}
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-base">
                  {conn.athleteName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{conn.athleteName}</p>
                  {conn.athleteEmail && (
                    <p className="text-xs text-muted-foreground truncate">{conn.athleteEmail}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!conn.chatEnabled && (
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 dark:bg-amber-900/40 dark:text-amber-400">
                      Off
                    </span>
                  )}
                  {unread > 0 && (
                    <Badge variant="destructive" className="text-xs min-w-[20px] justify-center">
                      {unread}
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Also show athletes who haven't connected yet */}
      {connections.filter((c) => !c.athleteAuthUserId).length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Not yet connected
          </p>
          <div className="space-y-1">
            {connections
              .filter((c) => !c.athleteAuthUserId)
              .map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-left opacity-50"
                >
                  <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center shrink-0 font-semibold text-base text-muted-foreground">
                    {conn.athleteName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conn.athleteName}</p>
                    <p className="text-xs text-muted-foreground">Hasn't joined the athlete app yet</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
