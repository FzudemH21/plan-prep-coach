import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Athlete, AthleteGroup, getAthleteDisplayName } from '@/types/athlete';

interface AthleteGroupSidebarProps {
  groups: AthleteGroup[];
  athletes: Athlete[];
  selectedAthleteId: string | null;
  onSelectAthlete: (athleteId: string) => void;
  onCreateGroup: (name: string) => void;
  onUpdateGroup: (id: string, name: string) => void;
  onDeleteGroup: (id: string) => void;
  onAddAthleteToGroup: (groupId: string) => void;
  getAthletesByGroup: (groupId: string) => Athlete[];
  getAthletesWithoutGroup: () => Athlete[];
}

export function AthleteGroupSidebar({
  groups,
  athletes,
  selectedAthleteId,
  onSelectAthlete,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddAthleteToGroup,
  getAthletesByGroup,
  getAthletesWithoutGroup,
}: AthleteGroupSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroup, setEditingGroup] = useState<AthleteGroup | null>(null);
  const [editName, setEditName] = useState('');

  const ungroupedAthletes = getAthletesWithoutGroup();

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    onCreateGroup(newGroupName.trim());
    setNewGroupName('');
    setShowCreateGroup(false);
  };

  const handleEditGroup = () => {
    if (!editingGroup || !editName.trim()) return;
    onUpdateGroup(editingGroup.id, editName.trim());
    setEditingGroup(null);
    setEditName('');
  };

  const startEditGroup = (group: AthleteGroup) => {
    setEditingGroup(group);
    setEditName(group.name);
  };

  return (
    <div className="h-full border rounded-lg bg-card flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Athletes
        </h2>
        <Button variant="ghost" size="icon" onClick={() => setShowCreateGroup(true)}>
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Groups */}
          {groups.map((group) => {
            const groupAthletes = getAthletesByGroup(group.id);
            const isExpanded = expandedGroups.has(group.id);

            return (
              <Collapsible
                key={group.id}
                open={isExpanded}
                onOpenChange={() => toggleGroup(group.id)}
              >
                <div className="flex items-center gap-1">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 justify-start gap-2 h-9"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="truncate">{group.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        ({groupAthletes.length})
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onAddAthleteToGroup(group.id)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Athlete
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => startEditGroup(group)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDeleteGroup(group.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <CollapsibleContent>
                  <div className="ml-6 space-y-1 mt-1">
                    {groupAthletes.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 px-2">
                        No athletes in this group
                      </p>
                    ) : (
                      groupAthletes.map((athlete) => (
                        <Button
                          key={athlete.id}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'w-full justify-start gap-2 h-8',
                            selectedAthleteId === athlete.id && 'bg-accent'
                          )}
                          onClick={() => onSelectAthlete(athlete.id)}
                        >
                          <User className="h-3 w-3" />
                          <span className="truncate">{getAthleteDisplayName(athlete)}</span>
                        </Button>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {/* Ungrouped Athletes */}
          {ungroupedAthletes.length > 0 && (
            <div className="pt-2 border-t mt-2">
              <p className="text-xs text-muted-foreground px-2 py-1">Ungrouped</p>
              {ungroupedAthletes.map((athlete) => (
                <Button
                  key={athlete.id}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2 h-8',
                    selectedAthleteId === athlete.id && 'bg-accent'
                  )}
                  onClick={() => onSelectAthlete(athlete.id)}
                >
                  <User className="h-3 w-3" />
                  <span className="truncate">{getAthleteDisplayName(athlete)}</span>
                </Button>
              ))}
            </div>
          )}

          {groups.length === 0 && ungroupedAthletes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No athletes yet</p>
              <p className="text-xs mt-1">Create a group to get started</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create Group Dialog */}
      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="e.g., Sprint Team, U18s"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGroup(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-group-name">Group Name</Label>
              <Input
                id="edit-group-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEditGroup()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditGroup} disabled={!editName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
