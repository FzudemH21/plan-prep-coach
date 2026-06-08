import { useState, useMemo } from 'react';
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Athlete, AthleteGroup, getAthleteDisplayName } from '@/types/athlete';

// ── Props ─────────────────────────────────────────────────────────────────────

interface AthleteGroupSidebarProps {
  groups: AthleteGroup[];
  athletes: Athlete[];
  archivedAthletes: Athlete[];
  selectedAthleteId: string | null;
  onSelectAthlete: (athleteId: string) => void;
  onCreateGroup: (name: string) => void;
  onUpdateGroup: (id: string, name: string) => void;
  onDeleteGroup: (id: string) => void;
  onAddAthleteToGroup: (groupId: string) => void;
  onAssignAthleteToGroup: (athleteId: string, groupId: string) => void;
  getAthletesByGroup: (groupId: string) => Athlete[];
  getAthletesWithoutGroup: () => Athlete[];
  onCreateAthlete: () => void;
  onDeleteAthlete: (athleteId: string) => void;
  onArchiveAthlete: (athleteId: string) => void;
  onUnarchiveAthlete: (athleteId: string) => void;
  /** @deprecated squad view shows automatically — kept for back-compat */
  onShowSquad?: () => void;
  /** Currently-highlighted group in the squad view (lifted from AthleteDatabase). */
  selectedGroupId?: string | null;
  /** Called when the user clicks a group name to navigate to its squad view. */
  onSelectGroup?: (groupId: string) => void;
}

// ── Athlete row (shared between both tabs) ────────────────────────────────────

interface AthleteRowProps {
  athlete: Athlete;
  groups: AthleteGroup[];
  selectedAthleteId: string | null;
  onSelectAthlete: (id: string) => void;
  onAssignAthleteToGroup: (athleteId: string, groupId: string) => void;
  onArchiveAthlete: (id: string) => void;
  onDeleteAthlete: (id: string) => void;
  compact?: boolean;
}

function AthleteRow({
  athlete, groups, selectedAthleteId,
  onSelectAthlete, onAssignAthleteToGroup, onArchiveAthlete, onDeleteAthlete,
  compact = false,
}: AthleteRowProps) {
  const availableGroups = groups.filter(g => !athlete.groupIds.includes(g.id));
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'flex-1 justify-start gap-2 h-8',
          selectedAthleteId === athlete.id && 'bg-accent',
          compact && 'ml-6',
        )}
        onClick={() => onSelectAthlete(athlete.id)}
      >
        <User className="h-3 w-3 shrink-0" />
        <span className="truncate">{getAthleteDisplayName(athlete)}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableGroups.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign to Group
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {availableGroups.map(g => (
                  <DropdownMenuItem key={g.id} onClick={() => onAssignAthleteToGroup(athlete.id, g.id)}>
                    {g.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuItem disabled>
              <UserPlus className="h-4 w-4 mr-2" />
              Already in all groups
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onArchiveAthlete(athlete.id)}>
            <Archive className="h-4 w-4 mr-2" />
            Archive Athlete
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDeleteAthlete(athlete.id)} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Athlete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Archive section (shared) ──────────────────────────────────────────────────

interface ArchiveSectionProps {
  archivedAthletes: Athlete[];
  selectedAthleteId: string | null;
  onSelectAthlete: (id: string) => void;
  onUnarchiveAthlete: (id: string) => void;
  onDeleteAthlete: (id: string) => void;
}

function ArchiveSection({
  archivedAthletes, selectedAthleteId, onSelectAthlete, onUnarchiveAthlete, onDeleteAthlete,
}: ArchiveSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="pt-3 border-t mt-3">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-9 text-muted-foreground hover:text-foreground">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Archive className="h-4 w-4" />
            <span>Archive</span>
            <span className="ml-auto text-xs">({archivedAthletes.length})</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-6 space-y-1 mt-1">
            {archivedAthletes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 px-2">No archived athletes</p>
            ) : (
              archivedAthletes.map(athlete => (
                <div key={athlete.id} className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'flex-1 justify-start gap-2 h-8 text-muted-foreground',
                      selectedAthleteId === athlete.id && 'bg-accent text-accent-foreground',
                    )}
                    onClick={() => onSelectAthlete(athlete.id)}
                  >
                    <User className="h-3 w-3" />
                    <span className="truncate">{getAthleteDisplayName(athlete)}</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onUnarchiveAthlete(athlete.id)}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restore Athlete
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDeleteAthlete(athlete.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Permanently
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AthleteGroupSidebar({
  groups,
  athletes,
  archivedAthletes,
  selectedAthleteId,
  onSelectAthlete,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddAthleteToGroup,
  onAssignAthleteToGroup,
  getAthletesByGroup,
  getAthletesWithoutGroup,
  onCreateAthlete,
  onDeleteAthlete,
  onArchiveAthlete,
  onUnarchiveAthlete,
  selectedGroupId,
  onSelectGroup,
}: AthleteGroupSidebarProps) {
  const [sidebarTab, setSidebarTab] = useState<'athletes' | 'groups'>('athletes');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroup, setEditingGroup] = useState<AthleteGroup | null>(null);
  const [editName, setEditName] = useState('');

  const ungroupedAthletes = getAthletesWithoutGroup();

  // Flat alphabetical list for the Athletes tab
  const sortedActiveAthletes = useMemo(
    () => athletes
      .filter(a => !a.isArchived)
      .slice()
      .sort((a, b) => getAthleteDisplayName(a).localeCompare(getAthleteDisplayName(b))),
    [athletes],
  );

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
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

  const sharedRowProps = {
    groups,
    selectedAthleteId,
    onSelectAthlete,
    onAssignAthleteToGroup,
    onArchiveAthlete,
    onDeleteAthlete,
  };

  return (
    <div className="h-full border rounded-lg bg-card flex flex-col">

      {/* ── Header ── */}
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <h2 className="font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" />
          Athletes
        </h2>
        <div className="flex items-center gap-1">
          {sidebarTab === 'athletes' && (
            <Button variant="ghost" size="icon" onClick={onCreateAthlete} title="Create Athlete">
              <UserPlus className="h-4 w-4" />
            </Button>
          )}
          {sidebarTab === 'groups' && (
            <Button variant="ghost" size="icon" onClick={() => setShowCreateGroup(true)} title="Create Group">
              <FolderPlus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex rounded-md bg-muted p-0.5 text-sm">
          {(['athletes', 'groups'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={cn(
                'flex-1 py-1.5 rounded-sm font-medium transition-colors capitalize',
                sidebarTab === tab
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'athletes' ? 'Athletes' : 'Groups'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">

          {/* ── ATHLETES TAB ── */}
          {sidebarTab === 'athletes' && (
            <>
              {sortedActiveAthletes.length === 0 && archivedAthletes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No athletes yet</p>
                  <p className="text-xs mt-1">Click + to add your first athlete</p>
                </div>
              ) : (
                <>
                  {sortedActiveAthletes.map(athlete => (
                    <AthleteRow key={athlete.id} athlete={athlete} {...sharedRowProps} />
                  ))}
                  <ArchiveSection
                    archivedAthletes={archivedAthletes}
                    selectedAthleteId={selectedAthleteId}
                    onSelectAthlete={onSelectAthlete}
                    onUnarchiveAthlete={onUnarchiveAthlete}
                    onDeleteAthlete={onDeleteAthlete}
                  />
                </>
              )}
            </>
          )}

          {/* ── GROUPS TAB ── */}
          {sidebarTab === 'groups' && (
            <>
              {groups.length === 0 && ungroupedAthletes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No groups yet</p>
                  <p className="text-xs mt-1">Click the folder icon to create one</p>
                </div>
              ) : (
                <>
                  {/* Named groups */}
                  {groups.map(group => {
                    const groupAthletes = getAthletesByGroup(group.id);
                    const isExpanded = expandedGroups.has(group.id);
                    return (
                      <Collapsible
                        key={group.id}
                        open={isExpanded}
                        onOpenChange={() => toggleGroup(group.id)}
                      >
                        <div className="flex items-center gap-0">
                          {/* Chevron — toggles expand/collapse only */}
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-9 w-8 p-0 shrink-0">
                              {isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5" />
                                : <ChevronRight className="h-3.5 w-3.5" />}
                            </Button>
                          </CollapsibleTrigger>
                          {/* Group name — navigates to squad view for this group */}
                          <button
                            onClick={() => onSelectGroup?.(group.id)}
                            className={cn(
                              'flex-1 text-left text-sm py-2 px-1.5 rounded-md transition-colors hover:bg-accent',
                              'h-9 flex items-center justify-between gap-1 min-w-0',
                              selectedGroupId === group.id && 'bg-accent font-medium',
                            )}
                          >
                            <span className="truncate">{group.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">({groupAthletes.length})</span>
                          </button>
                          {/* Group actions */}
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
                              <DropdownMenuItem onClick={() => { setEditingGroup(group); setEditName(group.name); }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDeleteGroup(group.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <CollapsibleContent>
                          <div className="ml-6 space-y-1 mt-1">
                            {groupAthletes.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2 px-2">No athletes in this group</p>
                            ) : (
                              groupAthletes.map(athlete => (
                                <AthleteRow key={athlete.id} athlete={athlete} {...sharedRowProps} />
                              ))
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}

                </>
              )}
            </>
          )}

        </div>
      </ScrollArea>

      {/* ── Create Group Dialog ── */}
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
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGroup(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Group Dialog ── */}
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
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEditGroup()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>Cancel</Button>
            <Button onClick={handleEditGroup} disabled={!editName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
