import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { Calendar, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import {
  Athlete,
  AthleteGroup,
  DailyActivityLevel,
  Sex,
  ACTIVITY_LEVEL_LABELS,
  SEX_LABELS,
} from '@/types/athlete';
import { ParameterSection } from './ParameterSection';
import { useAthletes } from '@/hooks/useAthletes';

interface AthleteProfileViewProps {
  athlete: Athlete;
  onUpdateAthlete: (updates: Partial<Omit<Athlete, 'id' | 'createdAt'>>) => void;
  onDeleteAthlete: () => void;
  groups: AthleteGroup[];
  athleteData: ReturnType<typeof useAthletes>;
}

export function AthleteProfileView({
  athlete,
  onUpdateAthlete,
  onDeleteAthlete,
  groups,
  athleteData,
}: AthleteProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editedAthlete, setEditedAthlete] = useState<Partial<Athlete>>({});

  const startEditing = () => {
    setEditedAthlete({ ...athlete });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditedAthlete({});
    setIsEditing(false);
  };

  const saveChanges = () => {
    onUpdateAthlete(editedAthlete);
    setIsEditing(false);
    setEditedAthlete({});
  };

  const updateField = <K extends keyof Athlete>(field: K, value: Athlete[K]) => {
    setEditedAthlete((prev) => ({ ...prev, [field]: value }));
  };

  const toggleGroup = (groupId: string) => {
    const currentGroups = editedAthlete.groupIds ?? athlete.groupIds;
    const newGroups = currentGroups.includes(groupId)
      ? currentGroups.filter((id) => id !== groupId)
      : [...currentGroups, groupId];
    updateField('groupIds', newGroups);
  };

  const displayValue = <K extends keyof Athlete>(field: K): Athlete[K] =>
    isEditing ? ((editedAthlete[field] !== undefined ? editedAthlete[field] : athlete[field]) as Athlete[K]) : athlete[field];

  const athleteAge = athlete.birthday
    ? Math.floor(
        (new Date().getTime() - new Date(athlete.birthday).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : null;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-1 pr-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            {isEditing ? (
              <Input
                className="text-2xl font-bold h-auto py-1 px-2"
                value={displayValue('fullName')}
                onChange={(e) => updateField('fullName', e.target.value)}
              />
            ) : (
              <h1 className="text-2xl font-bold">{athlete.fullName}</h1>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              Created {format(new Date(athlete.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
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
                  <Pencil className="h-4 w-4 mr-1" />
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
        </div>

        {/* Core Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
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
          </CardContent>
        </Card>

        {/* Groups */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Groups</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                {groups.map((group) => {
                  const isInGroup = (
                    displayValue('groupIds') as string[]
                  ).includes(group.id);
                  return (
                    <Badge
                      key={group.id}
                      variant={isInGroup ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleGroup(group.id)}
                    >
                      {group.name}
                      {isInGroup && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
                {groups.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No groups created yet
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {athlete.groupIds.length > 0 ? (
                  athlete.groupIds.map((groupId) => {
                    const group = groups.find((g) => g.id === groupId);
                    return group ? (
                      <Badge key={groupId}>{group.name}</Badge>
                    ) : null;
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No groups assigned</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Parameters */}
        <ParameterSection athlete={athlete} athleteData={athleteData} />

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Athlete</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {athlete.fullName}? This action
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
  );
}
