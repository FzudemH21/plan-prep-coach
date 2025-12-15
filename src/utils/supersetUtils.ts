import { SupersetMapping } from '@/types/microcycle-planning';

export interface ToggleSupersetResult {
  newSupersets: SupersetMapping;
  action: 'created' | 'linked' | 'unlinked' | 'merged';
  message: string;
}

/**
 * Shared utility for toggling superset connections between exercises.
 * Handles all edge cases: creating, linking, unlinking, merging, and splitting supersets.
 */
export function toggleSuperset(
  currentSupersets: SupersetMapping | undefined,
  dayDate: string,
  sessionIndex: number,
  exerciseId1: string,
  exerciseId2: string,
  sectionId?: string
): ToggleSupersetResult {
  const sectionKey = sectionId || '__unsectioned__';
  
  // Deep clone the current supersets or start fresh
  const newSupersets: SupersetMapping = currentSupersets 
    ? JSON.parse(JSON.stringify(currentSupersets))
    : {};
  
  // Ensure structure exists
  if (!newSupersets[dayDate]) {
    newSupersets[dayDate] = {};
  }
  if (!newSupersets[dayDate][sessionIndex]) {
    newSupersets[dayDate][sessionIndex] = {};
  }
  if (!newSupersets[dayDate][sessionIndex][sectionKey]) {
    newSupersets[dayDate][sessionIndex][sectionKey] = {};
  }
  
  const sectionSupersets = newSupersets[dayDate][sessionIndex][sectionKey];
  
  // Find if exercises are in any superset
  let superset1: string | null = null;
  let superset2: string | null = null;
  
  for (const [supersetId, exerciseIds] of Object.entries(sectionSupersets)) {
    if (exerciseIds.includes(exerciseId1)) superset1 = supersetId;
    if (exerciseIds.includes(exerciseId2)) superset2 = supersetId;
  }
  
  // Helper to get next superset ID
  const getNextSupersetId = (): string => {
    const existingSupersetIds = Object.keys(sectionSupersets).map(id => {
      const match = id.match(/superset-(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });
    const nextId = existingSupersetIds.length > 0 ? Math.max(...existingSupersetIds) + 1 : 1;
    return `superset-${nextId}`;
  };
  
  if (superset1 && superset1 === superset2) {
    // UNLINK: split the superset at this connection point
    const currentIds = sectionSupersets[superset1];
    const index1 = currentIds.indexOf(exerciseId1);
    const index2 = currentIds.indexOf(exerciseId2);
    
    // Only unlink if they are adjacent in the array
    if (Math.abs(index1 - index2) === 1) {
      const splitPoint = Math.min(index1, index2) + 1;
      const firstGroup = currentIds.slice(0, splitPoint);
      const secondGroup = currentIds.slice(splitPoint);
      
      // Keep first group in original superset (if 2+ exercises)
      if (firstGroup.length >= 2) {
        sectionSupersets[superset1] = firstGroup;
      } else {
        delete sectionSupersets[superset1];
      }
      
      // Create new superset for second group (if 2+ exercises)
      if (secondGroup.length >= 2) {
        const newSupersetId = getNextSupersetId();
        sectionSupersets[newSupersetId] = secondGroup;
      }
      
      return { newSupersets, action: 'unlinked', message: 'Connection removed' };
    } else {
      // Not adjacent - remove exerciseId2 from the superset
      const updatedIds = currentIds.filter(id => id !== exerciseId2);
      if (updatedIds.length >= 2) {
        sectionSupersets[superset1] = updatedIds;
      } else {
        delete sectionSupersets[superset1];
      }
      return { newSupersets, action: 'unlinked', message: 'Exercise removed from superset' };
    }
  } else if (superset1 && superset2 && superset1 !== superset2) {
    // MERGE two different supersets
    const merged = Array.from(new Set([
      ...(sectionSupersets[superset1] || []),
      ...(sectionSupersets[superset2] || [])
    ]));
    sectionSupersets[superset1] = merged;
    delete sectionSupersets[superset2];
    return { newSupersets, action: 'merged', message: 'Supersets merged' };
  } else if (superset1 && !superset2) {
    // Add exercise2 to superset1
    sectionSupersets[superset1] = Array.from(new Set([
      ...(sectionSupersets[superset1] || []),
      exerciseId2
    ]));
    return { newSupersets, action: 'linked', message: 'Added to superset' };
  } else if (!superset1 && superset2) {
    // Add exercise1 to superset2
    sectionSupersets[superset2] = Array.from(new Set([
      ...(sectionSupersets[superset2] || []),
      exerciseId1
    ]));
    return { newSupersets, action: 'linked', message: 'Added to superset' };
  } else {
    // Create new superset
    const newSupersetId = getNextSupersetId();
    sectionSupersets[newSupersetId] = [exerciseId1, exerciseId2];
    return { newSupersets, action: 'created', message: 'Superset created' };
  }
}

/**
 * Get a consistent superset label (A1, A2, B1, B2, etc.) for an exercise.
 * Returns null if the exercise is not in a superset.
 */
export function getSupersetLabelFromMapping(
  supersets: SupersetMapping | undefined,
  dayDate: string,
  sessionIndex: number,
  exerciseId: string,
  sectionId?: string
): string | null {
  if (!supersets) return null;
  
  const sessionSupersets = supersets[dayDate]?.[sessionIndex];
  if (!sessionSupersets) return null;
  
  // Check all sections if no specific section provided
  const sectionsToCheck = sectionId 
    ? [sectionId] 
    : Object.keys(sessionSupersets);
  
  // Collect all supersets from all relevant sections
  const allSupersets: Array<{ supersetId: string; exerciseIds: string[] }> = [];
  
  for (const section of sectionsToCheck) {
    const sectionSupersets = sessionSupersets[section];
    if (!sectionSupersets) continue;
    
    for (const [supersetId, exerciseIds] of Object.entries(sectionSupersets)) {
      allSupersets.push({ supersetId, exerciseIds });
    }
  }
  
  // Sort supersets by their ID for consistent labeling
  allSupersets.sort((a, b) => a.supersetId.localeCompare(b.supersetId));
  
  // Find the exercise and return its label
  for (let groupIndex = 0; groupIndex < allSupersets.length; groupIndex++) {
    const { exerciseIds } = allSupersets[groupIndex];
    const exercisePosition = exerciseIds.indexOf(exerciseId);
    
    if (exercisePosition !== -1) {
      // A = 0, B = 1, C = 2, etc.
      const groupLetter = String.fromCharCode(65 + groupIndex);
      const positionNumber = exercisePosition + 1;
      return `${groupLetter}${positionNumber}`;
    }
  }
  
  return null;
}
