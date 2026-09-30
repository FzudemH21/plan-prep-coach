/**
 * AnamnesisChangeHistory — who changed what and when in an anamnesis (collapsed by default).
 * Entries come from the append-only table anamnesis_change_log.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, History, Loader2 } from 'lucide-react';
import { useAnamnesisChangeLog } from '@/utils/anamnesisChangeLog';

function stamp(iso: string): string {
  try { return format(parseISO(iso), 'd MMM yyyy, HH:mm'); } catch { return iso; }
}

export function AnamnesisChangeHistory({ anamnesisId }: { anamnesisId: string }) {
  const { entries, loading } = useAnamnesisChangeLog(anamnesisId);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <History className="h-3.5 w-3.5" />
        Change history
        {!loading && <span className="text-xs font-normal text-muted-foreground">({entries.length})</span>}
      </button>
      {open && (
        loading ? (
          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground pl-5">No changes recorded yet. Changes are recorded from now on.</p>
        ) : (
          <ol className="space-y-2 pl-5">
            {entries.map(e => (
              <li key={e.id} className="text-xs border-l-2 pl-2.5 py-0.5">
                <p>
                  <span className="font-medium">{e.summary}</span>
                  <span className="text-muted-foreground"> · {stamp(e.changedAt)}{e.changedByName ? ` · ${e.changedByName}` : ''}</span>
                </p>
                {e.changes.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {e.changes.map((c, i) => (
                      <li key={i} className="text-muted-foreground">
                        <span className="text-foreground">{c.what}:</span>{' '}
                        <span className="line-through decoration-muted-foreground/50 whitespace-pre-wrap">{c.from}</span>
                        {' → '}
                        <span className="text-foreground whitespace-pre-wrap">{c.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )
      )}
    </div>
  );
}
