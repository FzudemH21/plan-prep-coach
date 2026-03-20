import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogOverlay,
  DialogPortal,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Trophy, Calendar, X, Plus } from 'lucide-react';
import { CalendarEvent } from '@/hooks/useCalendarEvents';
import { format, parseISO } from 'date-fns';

interface CalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string; // ISO date
  events: CalendarEvent[]; // events already on this day
  onAdd: (type: 'test' | 'event', title: string, notes?: string) => void;
  onDelete: (eventId: string) => void;
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  date,
  events,
  onAdd,
  onDelete,
}: CalendarEventDialogProps) {
  const [type, setType] = useState<'test' | 'event'>('test');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd(type, title.trim(), notes.trim() || undefined);
    setTitle('');
    setNotes('');
  };

  const handleClose = () => {
    onOpenChange(false);
    setTitle('');
    setNotes('');
    setType('test');
  };

  const tests = events.filter(e => e.type === 'test');
  const eventItems = events.filter(e => e.type === 'event');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogOverlay className="z-[150] bg-black/30" />
        <DialogContent
          className="sm:max-w-[460px] z-[160]"
          onClick={e => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>
              Tests & Events — {format(parseISO(date), 'PPP')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Currently scheduled */}
            {events.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Scheduled
                </Label>
                <div className="space-y-1.5">
                  {tests.map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-2 rounded-md border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-2"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <Trophy className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{ev.title}</p>
                          {ev.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5">{ev.notes}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(ev.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {eventItems.map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-2 rounded-md border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-2"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <Calendar className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{ev.title}</p>
                          {ev.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5">{ev.notes}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(ev.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add new */}
            <div className="space-y-3 pt-1 border-t">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Add New
              </Label>

              {/* Type selector */}
              <ToggleGroup
                type="single"
                value={type}
                onValueChange={v => {
                  if (v) setType(v as 'test' | 'event');
                }}
                className="justify-start"
              >
                <ToggleGroupItem value="test" className="flex-1">
                  <Trophy className="h-4 w-4 mr-2" />
                  Test
                </ToggleGroupItem>
                <ToggleGroupItem value="event" className="flex-1">
                  <Calendar className="h-4 w-4 mr-2" />
                  Event
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="cal-event-title">
                  {type === 'test' ? 'Test Name' : 'Event Name'}
                </Label>
                <Input
                  id="cal-event-title"
                  placeholder={
                    type === 'test' ? 'e.g., 1RM Back Squat' : 'e.g., Regional Competition'
                  }
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && title.trim()) handleAdd();
                  }}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="cal-event-notes">
                  Notes{' '}
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="cal-event-notes"
                  placeholder="Add notes or context..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>

              <Button
                onClick={handleAdd}
                disabled={!title.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {type === 'test' ? 'Test' : 'Event'}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
