import { useState, useCallback } from 'react';
import { useAthletes } from '@/hooks/useAthletes';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import type { AthleteProfileData } from '@/hooks/useAthleteConnections';
import { AthleteGroupSidebar } from '@/components/athletes/AthleteGroupSidebar';
import { AthleteProfileView } from '@/components/athletes/AthleteProfileView';
import { Button } from '@/components/ui/button';
import { Plus, Users } from 'lucide-react';
import type { Athlete } from '@/types/athlete';

export default function AthleteDatabase() {
  const athleteData = useAthletes();
  const { deleteEventsForAthlete } = useCalendarEvents();
  const { getConnectionForAthlete, syncProfileToConnection } = useAthleteConnections();

  const handleUpdateAthlete = useCallback(async (
    athlete: Athlete,
    updates: Partial<Omit<Athlete, 'id' | 'createdAt'>>,
  ) => {
    await athleteData.updateAthlete(athlete.id, updates);
    const connection = getConnectionForAthlete(athlete.id);
    if (connection) {
      // Only patch the fields that the coach actually changed — preserve any
      // athlete-set values (e.g. sex set during onboarding) for fields not in `updates`.
      const merged = { ...athlete, ...updates };
      const patch: Partial<AthleteProfileData> = {};
      if ('firstName' in updates) patch.firstName = merged.firstName ?? undefined;
      if ('middleName' in updates) patch.middleName = merged.middleName;
      if ('lastName' in updates) patch.lastName = merged.lastName ?? undefined;
      if ('birthday' in updates) patch.birthday = merged.birthday;
      if ('sex' in updates) patch.sex = merged.sex;
      if ('sports' in updates || 'sport' in updates) {
        patch.sports = merged.sports ?? (merged.sport ? [merged.sport] : []);
      }
      if ('team' in updates) patch.team = merged.team;
      if ('occupation' in updates) patch.occupation = merged.occupation;
      if ('dailyActivityLevel' in updates) patch.dailyActivityLevel = merged.dailyActivityLevel;

      if (Object.keys(patch).length > 0) {
        // Merge patch on top of what the athlete already set — never clobber unchanged fields
        const newProfileData: AthleteProfileData = { ...connection.profileData, ...patch };
        syncProfileToConnection(connection.id, newProfileData).catch(console.error);
      }
    }
  }, [athleteData, getConnectionForAthlete, syncProfileToConnection]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [isNewAthlete, setIsNewAthlete] = useState(false);
  const [selectedGroupForNew, setSelectedGroupForNew] = useState<string | null>(null);

  const selectedAthlete = selectedAthleteId
    ? athleteData.getAthlete(selectedAthleteId)
    : null;

  const handleCreateAthlete = (groupId?: string) => {
    const athlete = athleteData.createAthlete({
      firstName: '',
      middleName: null,
      lastName: '',
      birthday: null,
      sex: null,
      sport: null,
      team: null,
      occupation: null,
      dailyActivityLevel: null,
      groupIds: groupId ? [groupId] : [],
      isArchived: false,
    });
    setSelectedAthleteId(athlete.id);
    setIsNewAthlete(true);
    setSelectedGroupForNew(null);
  };

  const handleSelectAthlete = (athleteId: string) => {
    setSelectedAthleteId(athleteId);
    setIsNewAthlete(false);
  };

  const handleAddAthleteToGroup = (groupId: string) => {
    handleCreateAthlete(groupId);
  };

  const handleAssignAthleteToGroup = (athleteId: string, groupId: string) => {
    const athlete = athleteData.getAthlete(athleteId);
    if (athlete) {
      const currentGroups = athlete.groupIds;
      if (!currentGroups.includes(groupId)) {
        athleteData.updateAthlete(athleteId, { groupIds: [...currentGroups, groupId] });
      }
    }
  };

  const handleCancelNewAthlete = () => {
    // Delete the unsaved new athlete
    if (selectedAthleteId && isNewAthlete) {
      athleteData.deleteAthlete(selectedAthleteId);
    }
    setSelectedAthleteId(null);
    setIsNewAthlete(false);
  };

  const handleSaveNewAthlete = () => {
    setIsNewAthlete(false);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex gap-6">
      {/* Sidebar */}
      <div className="w-80 shrink-0">
        <AthleteGroupSidebar
          groups={athleteData.groups}
          athletes={athleteData.athletes}
          archivedAthletes={athleteData.getArchivedAthletes()}
          selectedAthleteId={selectedAthleteId}
          onSelectAthlete={handleSelectAthlete}
          onCreateGroup={athleteData.createGroup}
          onUpdateGroup={athleteData.updateGroup}
          onDeleteGroup={athleteData.deleteGroup}
          onAddAthleteToGroup={handleAddAthleteToGroup}
          onAssignAthleteToGroup={handleAssignAthleteToGroup}
          getAthletesByGroup={athleteData.getAthletesByGroup}
          getAthletesWithoutGroup={athleteData.getAthletesWithoutGroup}
          onCreateAthlete={() => handleCreateAthlete()}
          onDeleteAthlete={(athleteId) => {
            athleteData.deleteAthlete(athleteId);
            deleteEventsForAthlete(athleteId);
            if (selectedAthleteId === athleteId) {
              setSelectedAthleteId(null);
              setIsNewAthlete(false);
            }
          }}
          onArchiveAthlete={(athleteId) => {
            athleteData.archiveAthlete(athleteId);
            if (selectedAthleteId === athleteId) {
              setSelectedAthleteId(null);
              setIsNewAthlete(false);
            }
          }}
          onUnarchiveAthlete={(athleteId) => {
            athleteData.unarchiveAthlete(athleteId);
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {selectedAthlete ? (
          <AthleteProfileView
            athlete={selectedAthlete}
            onUpdateAthlete={(updates) => handleUpdateAthlete(selectedAthlete, updates)}
            onDeleteAthlete={() => {
              athleteData.deleteAthlete(selectedAthlete.id);
              deleteEventsForAthlete(selectedAthlete.id);
              setSelectedAthleteId(null);
              setIsNewAthlete(false);
            }}
            groups={athleteData.groups}
            athleteData={athleteData}
            isNewAthlete={isNewAthlete}
            onCancelNew={handleCancelNewAthlete}
            onSaveNew={handleSaveNewAthlete}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
            <Users className="h-16 w-16 mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Athlete Selected</h3>
            <p className="mb-4">Select an athlete from the sidebar or create a new one.</p>
            <Button onClick={() => handleCreateAthlete()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Athlete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}