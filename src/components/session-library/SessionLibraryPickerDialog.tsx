/**
 * SessionLibraryPickerDialog — pick a session from the Session Library, e.g. to add it to a day in
 * the athlete calendar. Searchable by session name, section and exercise names.
 */
import { useMemo, useState } from 'react';
import { Library, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSessionLibrary } from '@/hooks/useSessionLibrary';
import type { SessionLibraryEntry } from '@/types/sessionLibrary';

interface SessionLibraryPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown in the description, e.g. "Mon, 5 Oct" */
  dayLabel?: string;
  onPick: (entry: SessionLibraryEntry) => void;
}

export function SessionLibraryPickerDialog({ open, onOpenChange, dayLabel, onPick }: SessionLibraryPickerDialogProps) {
  const { entries } = useSessionLibrary();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(e =>
      e.name.toLowerCase().includes(q)
      || e.sections.some(s => s.name.toLowerCase().includes(q))
      || e.exercises.some(ex => ex.exerciseName.toLowerCase().includes(q)),
    );
  }, [entries, query]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setQuery(''); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-4 w-4" />
            Add from session library
          </DialogTitle>
          <DialogDescription>
            {dayLabel ? `The session is added to ${dayLabel} as a new session. ` : ''}
            Its exercises and planned values are copied — changes here don't affect the library.
          </DialogDescription>
        </DialogHeader>

        {entries.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search sessions or exercises…"
              className="pl-8 h-9"
            />
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-1.5">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Your session library is empty. Save a session to the library from the session view first.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sessions match "{query}".</p>
          ) : filtered.map(entry => {
            const exerciseNames = [...entry.exercises]
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map(ex => ex.exerciseName);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => { setQuery(''); onPick(entry); }}
                className="w-full text-left rounded-md border px-3 py-2.5 hover:bg-accent hover:border-primary/40 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate">{entry.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {entry.exercises.length} exercise{entry.exercises.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {exerciseNames.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{exerciseNames.join(' · ')}</p>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
