import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Save, Trash2, TrendingUp, X, Calendar, User } from 'lucide-react';
import {
  Athlete,
  AthleteGroup,
  AthleteParameter,
  DailyActivityLevel,
  ParameterDefinition,
  Sex,
  ACTIVITY_LEVEL_LABELS,
  SEX_LABELS,
  getAthleteDisplayName,
} from '@/types/athlete';
import { ParameterSection } from './ParameterSection';
import { ParameterValueHistory } from './ParameterValueHistory';
import { AthleteCalendarView } from './AthleteCalendarView';
import { useAthletes } from '@/hooks/useAthletes';

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

  // Height/Weight state
  const [showHeightHistory, setShowHeightHistory] = useState(false);
  const [showWeightHistory, setShowWeightHistory] = useState(false);
  const [showAddHeightValue, setShowAddHeightValue] = useState(false);
  const [showAddWeightValue, setShowAddWeightValue] = useState(false);
  const [newHeightValue, setNewHeightValue] = useState('');
  const [newWeightValue, setNewWeightValue] = useState('');

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

  // Get Height and Weight parameters
  const athleteParams = athleteData.getAthleteParameters(athlete.id);
  const heightDef = athleteData.parameterDefinitions.find(d => d.name === 'Height');
  const weightDef = athleteData.parameterDefinitions.find(d => d.name === 'Weight');
  const heightParam = athleteParams.find(ap => ap.parameterDefinitionId === heightDef?.id);
  const weightParam = athleteParams.find(ap => ap.parameterDefinitionId === weightDef?.id);

  const getLatestValue = (ap: AthleteParameter | undefined) => {
    if (!ap || ap.values.length === 0) return null;
    return ap.values.reduce((latest, v) =>
      new Date(v.recordedAt) > new Date(latest.recordedAt) ? v : latest
    );
  };

  const latestHeight = getLatestValue(heightParam);
  const latestWeight = getLatestValue(weightParam);

  const handleAddHeightValue = () => {
    if (!heightParam || !newHeightValue.trim()) return;
    athleteData.addParameterValue(heightParam.id, newHeightValue.trim());
    setNewHeightValue('');
    setShowAddHeightValue(false);
  };

  const handleAddWeightValue = () => {
    if (!weightParam || !newWeightValue.trim()) return;
    athleteData.addParameterValue(weightParam.id, newWeightValue.trim());
    setNewWeightValue('');
    setShowAddWeightValue(false);
  };

  const renderMetricField = (
    label: string,
    param: AthleteParameter | undefined,
    def: ParameterDefinition | undefined,
    latestValue: { value: string; recordedAt: string } | null,
    onShowHistory: () => void,
    onShowAddValue: () => void
  ) => {
    if (!param || !def) return null;

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="flex items-center gap-2">
          {latestValue ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <div className="cursor-pointer flex-1">
                  <span className="text-lg font-semibold">{latestValue.value}</span>
                  <span className="text-muted-foreground ml-1">{def.unit}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {format(new Date(latestValue.recordedAt), 'MMM d')}
                  </Badge>
                </div>
              </HoverCardTrigger>
              <HoverCardContent className="w-72" align="start">
                <div className="space-y-2">
                  <h4 className="font-medium">Recent Values</h4>
                  <div className="space-y-1">
                    {param.values
                      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
                      .slice(0, 5)
                      .map((v) => (
                        <div key={v.id} className="flex justify-between text-sm">
                          <span>{v.value} {def.unit}</span>
                          <span className="text-muted-foreground">
                            {format(new Date(v.recordedAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                      ))}
                  </div>
                  {param.values.length > 5 && (
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto"
                      onClick={onShowHistory}
                    >
                      View all {param.values.length} values
                    </Button>
                  )}
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            <span className="text-muted-foreground flex-1">Not set</span>
          )}
          <div className="flex gap-1">
            {param.values.length > 1 && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onShowHistory}>
                <TrendingUp className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onShowAddValue}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="profile" className="flex-1 flex flex-col">
        <TabsList className="mx-1 mt-1 w-fit">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
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

            {/* Height */}
            {renderMetricField(
              'Height',
              heightParam,
              heightDef,
              latestHeight,
              () => setShowHeightHistory(true),
              () => setShowAddHeightValue(true)
            )}

            {/* Weight */}
            {renderMetricField(
              'Weight',
              weightParam,
              weightDef,
              latestWeight,
              () => setShowWeightHistory(true),
              () => setShowAddWeightValue(true)
            )}

            <div className="space-y-2">
              <Label>Sport</Label>
              {isEditing ? (
                <Input
                  value={displayValue('sport') || ''}
                  onChange={(e) => updateField('sport', e.target.value || null)}
                  placeholder="e.g., Athletics, Swimming"
                />
              ) : (
                <p className="text-sm">
                  {athlete.sport || (
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

        {/* Parameters */}
        <ParameterSection 
          athlete={athlete} 
          athleteData={athleteData} 
          allAthletes={athleteData.athletes}
          allAthleteParameters={athleteData.athleteParameters}
        />

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

        {/* Height History Dialog */}
        {showHeightHistory && heightParam && heightDef && (
          <ParameterValueHistory
            open={showHeightHistory}
            onOpenChange={setShowHeightHistory}
            athleteParameter={heightParam}
            definition={heightDef}
            onAddValue={(value) => athleteData.addParameterValue(heightParam.id, value)}
            onDeleteValue={(valueId) => athleteData.deleteParameterValue(heightParam.id, valueId)}
            allAthletes={athleteData.athletes}
            allAthleteParameters={athleteData.athleteParameters}
            currentAthlete={athlete}
          />
        )}

        {/* Weight History Dialog */}
        {showWeightHistory && weightParam && weightDef && (
          <ParameterValueHistory
            open={showWeightHistory}
            onOpenChange={setShowWeightHistory}
            athleteParameter={weightParam}
            definition={weightDef}
            onAddValue={(value) => athleteData.addParameterValue(weightParam.id, value)}
            onDeleteValue={(valueId) => athleteData.deleteParameterValue(weightParam.id, valueId)}
            allAthletes={athleteData.athletes}
            allAthleteParameters={athleteData.athleteParameters}
            currentAthlete={athlete}
          />
        )}

        {/* Add Height Value Dialog */}
        <Dialog open={showAddHeightValue} onOpenChange={setShowAddHeightValue}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Height Value</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Value</Label>
                <div className="flex gap-2">
                  <Input
                    value={newHeightValue}
                    onChange={(e) => setNewHeightValue(e.target.value)}
                    placeholder="Enter value"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddHeightValue()}
                  />
                  <span className="flex items-center text-muted-foreground">cm</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddHeightValue(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddHeightValue} disabled={!newHeightValue.trim()}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Weight Value Dialog */}
        <Dialog open={showAddWeightValue} onOpenChange={setShowAddWeightValue}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Weight Value</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Value</Label>
                <div className="flex gap-2">
                  <Input
                    value={newWeightValue}
                    onChange={(e) => setNewWeightValue(e.target.value)}
                    placeholder="Enter value"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddWeightValue()}
                  />
                  <span className="flex items-center text-muted-foreground">kg</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddWeightValue(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddWeightValue} disabled={!newWeightValue.trim()}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="calendar" className="flex-1 mt-0 px-1">
          <AthleteCalendarView athlete={athlete} />
        </TabsContent>
      </Tabs>
    </div>
  );
}