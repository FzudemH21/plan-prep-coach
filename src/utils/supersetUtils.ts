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
      
      // Determine which group(s) should remain as supersets
      const firstGroupValid = firstGroup.length >= 2;
      const secondGroupValid = secondGroup.length >= 2;
      
      if (firstGroupValid && secondGroupValid) {
        // Both groups are valid - keep first in original, create new for second
        sectionSupersets[superset1] = firstGroup;
        const newSupersetId = getNextSupersetId();
        sectionSupersets[newSupersetId] = secondGroup;
      } else if (firstGroupValid) {
        // Only first group is valid - keep it in original superset
        sectionSupersets[superset1] = firstGroup;
      } else if (secondGroupValid) {
        // Only second group is valid - keep it in original superset (reuse ID)
        sectionSupersets[superset1] = secondGroup;
      } else {
        // Neither group is valid (both have < 2 exercises) - delete superset
        delete sectionSupersets[superset1];
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
  
  // Collect all supersets from all relevant sections (only those with 2+ exercises)
  const allSupersets: Array<{ supersetId: string; exerciseIds: string[] }> = [];
  
  for (const section of sectionsToCheck) {
    const sectionSupersets = sessionSupersets[section];
    if (!sectionSupersets) continue;
    
    for (const [supersetId, exerciseIds] of Object.entries(sectionSupersets)) {
      // Only include supersets with 2 or more exercises
      if (exerciseIds.length >= 2) {
        allSupersets.push({ supersetId, exerciseIds });
      }
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

/**
 * Cleanup supersets when an exercise is deleted.
 * Removes the exercise ID from all supersets and deletes supersets with fewer than 2 exercises.
 */
export function cleanupSupersetsOnExerciseDelete(
  currentSupersets: SupersetMapping | undefined,
  deletedExerciseId: string
): SupersetMapping {
  if (!currentSupersets) return {};
  
  // Deep clone
  const newSupersets: SupersetMapping = JSON.parse(JSON.stringify(currentSupersets));
  
  // Iterate through all days, sessions, sections, and supersets
  for (const dayDate of Object.keys(newSupersets)) {
    const daySupersets = newSupersets[dayDate];
    
    for (const sessionIndex of Object.keys(daySupersets)) {
      const sessionSupersets = daySupersets[parseInt(sessionIndex)];
      
      for (const sectionId of Object.keys(sessionSupersets)) {
        const sectionSupersets = sessionSupersets[sectionId];
        
        for (const supersetId of Object.keys(sectionSupersets)) {
          // Remove the deleted exercise from this superset
          const exerciseIds = sectionSupersets[supersetId].filter(id => id !== deletedExerciseId);
          
          if (exerciseIds.length >= 2) {
            // Keep the superset with remaining exercises
            sectionSupersets[supersetId] = exerciseIds;
          } else {
            // Delete the superset if fewer than 2 exercises remain
            delete sectionSupersets[supersetId];
          }
        }
        
        // Clean up empty section
        if (Object.keys(sectionSupersets).length === 0) {
          delete sessionSupersets[sectionId];
        }
      }
      
      // Clean up empty session
      if (Object.keys(sessionSupersets).length === 0) {
        delete daySupersets[parseInt(sessionIndex)];
      }
    }
    
    // Clean up empty day
    if (Object.keys(daySupersets).length === 0) {
      delete newSupersets[dayDate];
    }
  }
  
  return newSupersets;
}
