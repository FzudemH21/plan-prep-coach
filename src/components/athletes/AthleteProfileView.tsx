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
import { Plus, Save, Trash2, X, Calendar, User, Mic, MicOff, Clock, Files, TrendingUp, Settings, BarChart2, Activity, MessageCircle, Send, Loader2 } from 'lucide-react';
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
import { AthleteMonitoringTab } from './AthleteMonitoringTab';
import { useAthletes } from '@/hooks/useAthletes';
import { useParametersDataV2 } from '@/hooks/useParametersDataV2';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { parseISO, isToday, isYesterday } from 'date-fns';
import { useRef, useLayoutEffect } from 'react';

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
  /** Open the profile on a specific tab immediately (e.g. 'calendar'). */
  defaultTab?: string;
  /** Jump the calendar to this date's week immediately (yyyy-MM-dd). */
  defaultCalendarDate?: string;
  /** Auto-open a specific session by name when navigating to the calendar tab. */
  defaultCalendarSessionName?: string;
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
  defaultTab,
  defaultCalendarDate,
  defaultCalendarSessionName,
}: AthleteProfileViewProps) {
  const [isEditing, setIsEditing] = useState(isNewAthlete);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editedAthlete, setEditedAthlete] = useState<Partial<Athlete>>({});

  // Controlled tab state — Radix unmounts inactive panels so flex-1 layout is unaffected
  const [activeTab, setActiveTab] = useState(defaultTab ?? 'monitoring');
  const settingsScrollRef = useRef<HTMLDivElement>(null);
  const prevActiveTabRef = useRef(activeTab);
  useLayoutEffect(() => {
    const entering = activeTab === 'settings' && prevActiveTabRef.current !== 'settings';
    prevActiveTabRef.current = activeTab;
    if (entering && settingsScrollRef.current) {
      // Find the actual scroll viewport inside the ScrollArea
      const viewport = settingsScrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
      if (viewport) viewport.scrollTop = 0;
    }
  }, [activeTab]);
  // Calendar jump target — set when coach clicks a chat reference chip
  const [calendarJumpDate, setCalendarJumpDate] = useState<string | undefined>(defaultCalendarDate);
  // Auto-open session target — set when navigating from a reference chip
  const [calendarAutoOpenSession, setCalendarAutoOpenSession] = useState<{ date: string; sessionName?: string } | undefined>(
    defaultCalendarDate ? { date: defaultCalendarDate, sessionName: defaultCalendarSessionName } : undefined
  );

  // Chat
  const { connections } = useAthleteConnections();
  const { user: authUser } = useAuth();
  const athleteConnection = connections.find((c) => c.athleteLocalId === athlete.id);
  const { messages: chatMessages, loading: chatLoading, sendMessage: chatSend, markRead: chatMarkRead, unreadCount: chatUnread } = useChat({
    connectionId: athleteConnection?.id ?? null,
    callerRole: 'coach',
  });
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
        <TabsList className="mx-1 mt-1 w-fit">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="gap-2">
            <Activity className="h-4 w-4" />
            Monitoring
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
          <TabsTrigger value="chat" className="gap-2 relative">
            <MessageCircle className="h-4 w-4" />
            Chat
            {chatUnread > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] text-white font-medium">
                {chatUnread}
              </span>
            )}
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

        <TabsContent value="monitoring" className="flex-1 mt-0 min-h-0">
          <AthleteMonitoringTab athlete={athlete} />
        </TabsContent>

        <TabsContent value="performance" className="flex-1 mt-0 min-h-0">
          <AthletePerformanceTab athlete={athlete} athleteData={athleteData} />
        </TabsContent>

        <TabsContent value="calendar" className="flex-1 mt-0 px-1">
          <AthleteCalendarView athlete={athlete} initialDate={calendarJumpDate} autoOpenSession={calendarAutoOpenSession} />
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

        <TabsContent value="chat" className="flex-1 mt-0 min-h-0 flex flex-col" onFocus={() => chatMarkRead()}>
          {!athleteConnection ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">Not connected</p>
              <p className="text-xs text-muted-foreground">This athlete hasn't connected to the app yet. Share their invite code so they can join.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full min-h-0">
              <ScrollArea className="flex-1 px-4 py-2">
                {chatLoading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!chatLoading && chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageCircle className="h-7 w-7 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                  </div>
                )}
                <div className="space-y-1 py-2">
                  {chatMessages.map((msg) => {
                    const isOwn = msg.senderRole === 'coach';
                    return (
                      <div key={msg.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        {msg.messageType === 'exercise_comment' && msg.reference && (
                          <button
                            onClick={() => {
                              if (msg.reference?.date) {
                                setCalendarJumpDate(msg.reference.date);
                                setCalendarAutoOpenSession({ date: msg.reference.date, sessionName: msg.reference.sessionName });
                              }
                              setActiveTab('calendar');
                            }}
                            className={`text-xs px-2 py-0.5 rounded-full mb-0.5 max-w-[80%] text-left hover:opacity-80 active:opacity-60 transition-opacity underline-offset-2 hover:underline ${isOwn ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}
                          >
                            📎 {[msg.reference.exerciseName, msg.reference.sectionName, msg.reference.sessionName, msg.reference.date ? format(parseISO(msg.reference.date + 'T12:00:00'), 'd MMM yyyy') : undefined].filter(Boolean).join(' · ')}
                          </button>
                        )}
                        <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words ${isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                          {format(parseISO(msg.createdAt), isToday(parseISO(msg.createdAt)) ? 'HH:mm' : 'dd MMM, HH:mm')}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div ref={chatBottomRef} />
              </ScrollArea>
              <div className="shrink-0 border-t px-4 py-3 flex items-end gap-2">
                <Textarea
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!chatDraft.trim() || chatSending) return;
                      setChatSending(true);
                      chatSend(chatDraft).then(() => setChatDraft('')).finally(() => setChatSending(false));
                    }
                  }}
                  placeholder={`Message ${athlete.firstName ?? athlete.id}…`}
                  rows={1}
                  className="flex-1 resize-none min-h-[40px] max-h-[120px] text-sm py-2"
                />
                <Button
                  size="icon"
                  onClick={() => {
                    if (!chatDraft.trim() || chatSending) return;
                    setChatSending(true);
                    chatSend(chatDraft).then(() => setChatDraft('')).finally(() => setChatSending(false));
                  }}
                  disabled={!chatDraft.trim() || chatSending}
                  className="h-10 w-10 shrink-0"
                >
                  {chatSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" tabIndex={-1} className="flex-1 mt-0 min-h-0" ref={settingsScrollRef}>
          <ScrollArea className="h-full">
            <AthleteSettingsTab athlete={athlete} onUpdateAthlete={onUpdateAthlete} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}