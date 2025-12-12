/**
 * Clear all app-related localStorage data
 * Useful for debugging and resetting state when data becomes corrupted
 */
export const clearAllAppCache = (): void => {
  const keysToRemove: string[] = [];
  
  // Find all app-related keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isAppKey(key)) {
      keysToRemove.push(key);
    }
  }
  
  // Remove all found keys
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  console.log(`[clearCache] Cleared ${keysToRemove.length} app cache keys:`, keysToRemove);
};

/**
 * Check if a localStorage key belongs to our app
 */
const isAppKey = (key: string): boolean => {
  const appPrefixes = [
    'workoutSections_',
    'workoutSessions_',
    'microcyclePlanningState',
    'exerciseDistribution',
    'dailyIntensityData',
    'trainingDays',
    'sessionIntensities_',
    'daySplitStates',
    'sessionNames_',
    'parameterValues',
    'mesocycle',
    'macrocycle',
    'toolbox',
    'athleticism',
    'plyometrics',
    'exercises_',
    'custom_libraries',
  ];
  
  return appPrefixes.some(prefix => key.startsWith(prefix) || key.includes(prefix));
};

/**
 * Clear cache and reload the page
 */
export const clearCacheAndReload = (): void => {
  clearAllAppCache();
  window.location.reload();
};
