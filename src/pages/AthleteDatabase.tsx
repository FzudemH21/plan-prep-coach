import { useState } from 'react';
import { useAthletes } from '@/hooks/useAthletes';
import { AthleteGroupSidebar } from '@/components/athletes/AthleteGroupSidebar';
import { AthleteProfileView } from '@/components/athletes/AthleteProfileView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Users } from 'lucide-react';
import { Athlete, Sex, DailyActivityLevel } from '@/types/athlete';

export default function AthleteDatabase() {
  const athleteData = useAthletes();
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [showCreateAthlete, setShowCreateAthlete] = useState(false);
  const [newAthleteName, setNewAthleteName] = useState('');
  const [selectedGroupForNew, setSelectedGroupForNew] = useState<string | null>(null);

  const selectedAthlete = selectedAthleteId
    ? athleteData.getAthlete(selectedAthleteId)
    : null;

  const handleCreateAthlete = () => {
    if (!newAthleteName.trim()) return;
    const athlete = athleteData.createAthlete({
      fullName: newAthleteName.trim(),
      birthday: null,
      sex: null,
      sport: null,
      occupation: null,
      dailyActivityLevel: null,
      groupIds: selectedGroupForNew ? [selectedGroupForNew] : [],
    });
    setSelectedAthleteId(athlete.id);
    setShowCreateAthlete(false);
    setNewAthleteName('');
    setSelectedGroupForNew(null);
  };

  const handleSelectAthlete = (athleteId: string) => {
    setSelectedAthleteId(athleteId);
  };

  const handleAddAthleteToGroup = (groupId: string) => {
    setSelectedGroupForNew(groupId);
    setShowCreateAthlete(true);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex gap-6">
      {/* Sidebar */}
      <div className="w-80 shrink-0">
        <AthleteGroupSidebar
          groups={athleteData.groups}
          athletes={athleteData.athletes}
          selectedAthleteId={selectedAthleteId}
          onSelectAthlete={handleSelectAthlete}
          onCreateGroup={athleteData.createGroup}
          onUpdateGroup={athleteData.updateGroup}
          onDeleteGroup={athleteData.deleteGroup}
          onAddAthleteToGroup={handleAddAthleteToGroup}
          getAthletesByGroup={athleteData.getAthletesByGroup}
          getAthletesWithoutGroup={athleteData.getAthletesWithoutGroup}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {selectedAthlete ? (
          <AthleteProfileView
            athlete={selectedAthlete}
            onUpdateAthlete={(updates) => athleteData.updateAthlete(selectedAthlete.id, updates)}
            onDeleteAthlete={() => {
              athleteData.deleteAthlete(selectedAthlete.id);
              setSelectedAthleteId(null);
            }}
            groups={athleteData.groups}
            athleteData={athleteData}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <Users className="h-16 w-16 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Athlete Selected</h3>
            <p className="mb-4">Select an athlete from the sidebar or create a new one.</p>
            <Button onClick={() => setShowCreateAthlete(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Athlete
            </Button>
          </div>
        )}
      </div>

      {/* Create Athlete Dialog */}
      <Dialog open={showCreateAthlete} onOpenChange={setShowCreateAthlete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Athlete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="athlete-name">Full Name</Label>
              <Input
                id="athlete-name"
                placeholder="Enter athlete's full name"
                value={newAthleteName}
                onChange={(e) => setNewAthleteName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAthlete()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAthlete(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAthlete} disabled={!newAthleteName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
