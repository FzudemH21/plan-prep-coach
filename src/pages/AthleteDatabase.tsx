import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAthletes } from '@/hooks/useAthletes';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useAthleteConnections } from '@/hooks/useAthleteConnections';
import type { AthleteProfileData } from '@/hooks/useAthleteConnections';
import { AthleteGroupSidebar } from '@/components/athletes/AthleteGroupSidebar';
import { AthleteProfileView } from '@/components/athletes/AthleteProfileView';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { Athlete } from '@/types/athlete';
import { SquadDashboard } from '@/components/athletes/SquadDashboard';

interface NavState {
  openAthleteId?: string;
  defaultTab?: string;
  defaultCalendarDate?: string;
  defaultCalendarSessionName?: string;
}

export default function AthleteDatabase() {
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state as NavState) ?? {};

  // Clear one-time session-reference state so revisiting /athletes doesn't
  // re-trigger the auto-open on every subsequent mount.
  useEffect(() => {
    if (navState.defaultCalendarDate || navState.defaultCalendarSessionName || navState.defaultTab) {
      navigate('.', {
        replace: true,
        state: {
          ...navState,
          defaultCalendarDate: undefined,
          defaultCalendarSessionName: undefined,
          defaultTab: undefined,
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const athleteData = useAthletes();
  const { deleteEventsForAthlete } = useCalendarEvents();
  const { connections, loading: connectionsLoading, getConnectionForAthlete, syncProfileToConnection } = useAthleteConnections();

  // ── Load-time sync: pull athlete-edited profile_data back into the coach blob ──
  // Runs once per session after both data sources are ready.
  // This ensures athlete changes (sport, team, etc.) are visible in the coach app
  // and prevents stale coach-blob values from being saved back to profile_data.
  const syncedConnIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (athleteData.isLoading || connectionsLoading) return;
    for (const conn of connections) {
      if (syncedConnIds.current.has(conn.id)) continue;
      syncedConnIds.current.add(conn.id);

      const pd = conn.profileData;
      if (!pd || Object.keys(pd).length === 0) continue;

      const athlete = athleteData.getAthlete(conn.athleteLocalId);
      if (!athlete) continue;

      // Build a patch of only the fields that differ — avoids unnecessary writes
      const patch: Partial<Omit<Athlete, 'id' | 'createdAt'>> = {};
      if (pd.firstName !== undefined && pd.firstName !== athlete.firstName)
        patch.firstName = pd.firstName;
      if (pd.lastName !== undefined && pd.lastName !== athlete.lastName)
        patch.lastName = pd.lastName;
      if (pd.birthday !== undefined && pd.birthday !== athlete.birthday)
        patch.birthday = pd.birthday ?? null;
      if (pd.sex !== undefined && pd.sex !== athlete.sex)
        patch.sex = pd.sex ?? null;
      const pdSport = pd.sports?.[0] ?? null;
      if (pdSport !== athlete.sport) patch.sport = pdSport;
      if (pd.team !== undefined && pd.team !== athlete.team)
        patch.team = pd.team ?? null;
      if (pd.occupation !== undefined && pd.occupation !== athlete.occupation)
        patch.occupation = pd.occupation ?? null;
      if (pd.dailyActivityLevel !== undefined && pd.dailyActivityLevel !== athlete.dailyActivityLevel)
        patch.dailyActivityLevel = pd.dailyActivityLevel ?? null;

      if (Object.keys(patch).length > 0) {
        // Call updateAthlete directly — bypass handleUpdateAthlete to avoid
        // re-syncing the freshly-read profile_data back to Supabase.
        athleteData.updateAthlete(athlete.id, patch);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteData.isLoading, connectionsLoading, connections]);

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
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(navState.openAthleteId ?? null);
  const [isNewAthlete, setIsNewAthlete] = useState(false);
  const [selectedGroupForNew, setSelectedGroupForNew] = useState<string | null>(null);
  const [squadViewMode, setSquadViewMode] = useState<'list' | 'card'>('card');
  /** Which group the squad dashboard is filtering to. null = all athletes. */
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

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
    <div className="h-full flex gap-6">
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
          onShowSquad={() => { setSelectedAthleteId(null); setSelectedGroupId(null); }}
          selectedGroupId={selectedGroupId}
          onSelectGroup={(groupId) => { setSelectedGroupId(groupId); setSelectedAthleteId(null); }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
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
            defaultTab={navState.defaultTab}
            defaultCalendarDate={navState.defaultCalendarDate}
            defaultCalendarSessionName={navState.defaultCalendarSessionName}
          />
        ) : (
          <SquadDashboard
            athletes={athleteData.athletes.filter(a => !a.isArchived)}
            groups={athleteData.groups}
            connections={connections}
            viewMode={squadViewMode}
            onViewModeChange={setSquadViewMode}
            onSelectAthlete={handleSelectAthlete}
            selectedGroupId={selectedGroupId}
            onGroupChange={setSelectedGroupId}
          />
        )}
      </div>
    </div>
  );
}