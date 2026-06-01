import { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Save, Trash2, X, Calendar, User, Mic, MicOff, Clock, Files, TrendingUp, Settings, BarChart2 } from 'lucide-react';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import {
  Athlete,
  AthleteGroup,
  AthleteNote,
  DailyActivityLevel,
  Sex,
  ACTIVITY_LEVEL_LABELS,
  SEX_LABELS,
  getAthleteDisplayName,
} from '@/types/athlete';
import { AthleteCalendarView } from './AthleteCalendarView';
import { AthleteDocumentsTab } from './AthleteDocumentsTab';
import { AthletePerformanceTab } from './AthletePerformanceTab';
import { AthleteSettingsTab } from './AthleteSettingsTab';
import { AthleteAnalysisTab } from './AthleteAnalysisTab';
import { useAthletes } from '@/hooks/useAthletes';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';

// ── Sport tag input ───────────────────────────────────────────────────────────

function SportTagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [inputVal, setInputVal] = useState('');

  const addSport = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || value.includes(trimmed)) { setInputVal(''); return; }
    onChange([...value, trimmed]);
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSport(inputVal); }
    if (e.key === 'Backspace' && !inputVal && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap gap-1 border rounded-md px-2 py-1.5 min-h-9 bg-background focus-within:ring-1 focus-within:ring-ring">
      {value.map((sport) => (
        <Badge key={sport} variant="secondary" className="text-xs gap-1 pr-1">
          {sport}
          <button type="button" onClick={() => onChange(value.filter((s) => s !== sport))} className="hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addSport(inputVal)}
        placeholder={value.length === 0 ? 'Type sport and press Enter…' : ''}
        className="flex-1 min-w-20 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface AthleteProfileViewProps {
  athlete: Athlete;
  onUpdateAthlete: (updates: Partial<Omit<Athlete, 'id' | 'createdAt'>>) => void;
  onDeleteAthlete: () => void;
  groups: AthleteGroup[];
  athleteData: ReturnType<typeof useAthletes>;
  isNewAthlete?: boolean;
  onCancelNew?: () => void;
  onSaveNew?: () => void;
}

export function AthleteProfileView({
  athlete,
  onUpdateAthlete,
  onDeleteAthlete,
  groups,
  athleteData,
  isNewAthlete = false,
  onCancelNew,
  onSaveNew,
}: AthleteProfileViewProps) {
  const [isEditing, setIsEditing] = useState(isNewAthlete);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editedAthlete, setEditedAthlete] = useState<Partial<Athlete>>({});

  // Notes state
  const [newNoteText, setNewNoteText] = useState('');

  // Voice input for notes
  const handleVoiceNoteResult = useCallback(
    (text: string) => setNewNoteText((prev) => (prev ? `${prev} ${text}` : text)),
    []
  );
  const { isListening: isListeningNote, toggle: toggleNoteMic, isSupported: noteMicSupported } =
    useSpeechInput(handleVoiceNoteResult);

  const { data: parametersData } = useParametersDataV2();

  // Derive all notes (newest-first), migrating legacy `notes` string if needed
  const allNotes = useMemo<AthleteNote[]>(() => {
    const history = athlete.notesHistory ?? [];
    if (history.length === 0 && athlete.notes) {
      return [{ id: '__migrated__', text: athlete.notes, timestamp: athlete.createdAt }];
    }
    return history;
  }, [athlete.notesHistory, athlete.notes, athlete.createdAt]);

  const handleAddNote = () => {
    const text = newNoteText.trim();
    if (!text) return;
    const newEntry: AthleteNote = {
      id: `note-${Date.now()}`,
      text,
      timestamp: new Date().toISOString(),
    };
    onUpdateAthlete({ notesHistory: [newEntry, ...(athlete.notesHistory ?? [])] });
    setNewNoteText('');
  };

  // Start in edit mode if it's a new athlete
  useEffect(() => {
    if (isNewAthlete) {
      setEditedAthlete({ ...athlete });
      setIsEditing(true);
    }
  }, [isNewAthlete, athlete.id]);

  const startEditing = () => {
    setEditedAthlete({ ...athlete });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (isNewAthlete && onCancelNew) {
      onCancelNew();
    } else {
      setEditedAthlete({});
      setIsEditing(false);
    }
  };

  const saveChanges = () => {
    onUpdateAthlete(editedAthlete);
    setIsEditing(false);
    setEditedAthlete({});
    if (isNewAthlete && onSaveNew) {
      onSaveNew();
    }
  };

  const updateField = <K extends keyof Athlete>(field: K, value: Athlete[K]) => {
    setEditedAthlete((prev) => ({ ...prev, [field]: value }));
  };

  const addToGroup = (groupId: string) => {
    const currentGroups = athlete.groupIds;
    if (!currentGroups.includes(groupId)) {
      onUpdateAthlete({ groupIds: [...currentGroups, groupId] });
    }
  };

  const removeFromGroup = (groupId: string) => {
    const currentGroups = athlete.groupIds;
    onUpdateAthlete({ groupIds: currentGroups.filter((id) => id !== groupId) });
  };

  const displayValue = <K extends keyof Athlete>(field: K): Athlete[K] =>
    isEditing ? ((editedAthlete[field] !== undefined ? editedAthlete[field] : athlete[field]) as Athlete[K]) : athlete[field];

  const assignedGroups = groups.filter(g => athlete.groupIds.includes(g.id));
  const availableGroups = groups.filter(g => !athlete.groupIds.includes(g.id));

  const athleteAge = athlete.birthday
    ? Math.floor(
        (new Date().getTime() - new Date(athlete.birthday).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : null;

  const displayName = getAthleteDisplayName(athlete);

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="profile" className="flex-1 flex flex-col">
        <TabsList className="mx-1 mt-1 w-fit">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <Files className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2">
            <BarChart2 className="h-4 w-4" />
            Analysis
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="space-y-6 p-1 pr-4">
        {/* Core Profile */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Profile Information</CardTitle>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEditing}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveChanges}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={startEditing}>
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name Fields */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                {isEditing ? (
                  <Input
                    placeholder="First Name"
                    value={displayValue('firstName')}
                    onChange={(e) => updateField('firstName', e.target.value)}
                  />
                ) : (
                  <p className="text-sm">
                    {athlete.firstName || <span className="text-muted-foreground">Not set</span>}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Middle Name</Label>
                {isEditing ? (
                  <Input
                    placeholder="Middle Name (optional)"
                    value={displayValue('middleName') || ''}
                    onChange={(e) => updateField('middleName', e.target.value || null)}
                  />
                ) : (
                  <p className="text-sm">
                    {athlete.middleName || <span className="text-muted-foreground">-</span>}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                {isEditing ? (
                  <Input
                    placeholder="Last Name"
                    value={displayValue('lastName')}
                    onChange={(e) => updateField('lastName', e.target.value)}
                  />
                ) : (
                  <p className="text-sm">
                    {athlete.lastName || <span className="text-muted-foreground">Not set</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Other Profile Fields */}
            <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Birthday</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={displayValue('birthday') || ''}
                  onChange={(e) => updateField('birthday', e.target.value || null)}
                />
              ) : (
                <p className="text-sm">
                  {athlete.birthday ? (
                    <>
                      {format(new Date(athlete.birthday), 'MMM d, yyyy')}
                      {athleteAge !== null && (
                        <span className="text-muted-foreground ml-2">
                          ({athleteAge} years old)
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Sex</Label>
              {isEditing ? (
                <Select
                  value={displayValue('sex') || ''}
                  onValueChange={(v) => updateField('sex', v as Sex)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEX_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">
                  {athlete.sex ? (
                    SEX_LABELS[athlete.sex]
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Sport(s)</Label>
              {isEditing ? (
                <SportTagInput
                  value={
                    (editedAthlete.sports !== undefined
                      ? editedAthlete.sports
                      : athlete.sports) ??
                    (athlete.sport ? [athlete.sport] : [])
                  }
                  onChange={(sports) => {
                    updateField('sports', sports);
                    // keep legacy field in sync
                    updateField('sport', sports[0] ?? null);
                  }}
                />
              ) : (
                <p className="text-sm">
                  {(athlete.sports?.length
                    ? athlete.sports
                    : athlete.sport
                      ? [athlete.sport]
                      : []
                  ).join(', ') || (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Team</Label>
              {isEditing ? (
                <Input
                  value={displayValue('team') || ''}
                  onChange={(e) => updateField('team', e.target.value || null)}
                  placeholder="e.g., National Junior Squad"
                />
              ) : (
                <p className="text-sm">
                  {athlete.team || (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Occupation</Label>
              {isEditing ? (
                <Input
                  value={displayValue('occupation') || ''}
                  onChange={(e) => updateField('occupation', e.target.value || null)}
                  placeholder="e.g., Student, Professional"
                />
              ) : (
                <p className="text-sm">
                  {athlete.occupation || (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Daily Activity Level</Label>
              {isEditing ? (
                <Select
                  value={displayValue('dailyActivityLevel') || ''}
                  onValueChange={(v) =>
                    updateField('dailyActivityLevel', v as DailyActivityLevel)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select activity level" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTIVITY_LEVEL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">
                  {athlete.dailyActivityLevel ? (
                    ACTIVITY_LEVEL_LABELS[athlete.dailyActivityLevel]
                  ) : (
                    <span className="text-muted-foreground">Not set</span>
                  )}
                </p>
              )}
            </div>
            </div>

            {/* Notes */}
            <div className="space-y-3 pt-4 border-t">
              <Label>Notes</Label>

              {/* Add new note — always visible */}
              <div className="space-y-2">
                <Textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder={isListeningNote ? 'Recording…' : 'Add a note…'}
                  className="min-h-[80px] resize-y"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleAddNote(); }
                  }}
                />
                <div className="flex items-center gap-2 justify-end">
                  {noteMicSupported && (
                    <Button
                      type="button"
                      size="sm"
                      variant={isListeningNote ? 'destructive' : 'outline'}
                      onClick={toggleNoteMic}
                      className={cn('h-8', isListeningNote && 'animate-pulse')}
                      title={isListeningNote ? 'Stop recording' : 'Voice input'}
                    >
                      {isListeningNote
                        ? <><MicOff className="h-3.5 w-3.5 mr-1.5" />Recording…</>
                        : <><Mic className="h-3.5 w-3.5 mr-1.5" />Voice</>
                      }
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={!newNoteText.trim()}
                    className="h-8"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Save note
                  </Button>
                </div>
              </div>

              {/* Notes history */}
              {allNotes.length > 0 ? (
                <div className="space-y-2">
                  {allNotes.map((note) => (
                    <div key={note.id} className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        {format(new Date(note.timestamp), 'MMM d, yyyy · HH:mm')}
                        {note.id === '__migrated__' && (
                          <span className="ml-1 italic">(imported)</span>
                        )}
                      </p>
                      <p className="whitespace-pre-wrap leading-snug">{note.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              )}
            </div>

            {/* Groups - At Bottom */}
            <div className="space-y-2 pt-4 border-t">
              <Label>Groups</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {assignedGroups.length > 0 ? (
                  assignedGroups.map((group) => (
                    <Badge key={group.id} variant="secondary" className="flex items-center gap-1">
                      {group.name}
                      <button
                        onClick={() => removeFromGroup(group.id)}
                        className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No groups</span>
                )}
                {availableGroups.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 w-6 p-0 rounded-full">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" align="start">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Add to group</p>
                        {availableGroups.map((group) => (
                          <Button
                            key={group.id}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-sm h-8"
                            onClick={() => addToGroup(group.id)}
                          >
                            {group.name}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Athlete</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {displayName}? This action
                cannot be undone and will remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDeleteAthlete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="performance" className="flex-1 mt-0 min-h-0">
          <AthletePerformanceTab athlete={athlete} athleteData={athleteData} />
        </TabsContent>

        <TabsContent value="calendar" className="flex-1 mt-0 px-1">
          <AthleteCalendarView athlete={athlete} />
        </TabsContent>

        <TabsContent value="documents" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <AthleteDocumentsTab athleteId={athlete.id} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="analysis" className="flex-1 mt-0 min-h-0">
          <AthleteAnalysisTab
            athleteId={athlete.id}
            connectionId=""
            performanceParameters={athleteData.athletePerformanceParameters.filter(p => p.athleteId === athlete.id)}
            parametersV2={parametersData.parameters}
          />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 mt-0 min-h-0">
          <AthleteSettingsTab athlete={athlete} onUpdateAthlete={onUpdateAthlete} />
        </TabsContent>
      </Tabs>
    </div>
  );
}