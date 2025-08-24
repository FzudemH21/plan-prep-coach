export interface AthleticismEntry {
  id: string;
  overarchingGoal: string;
  subGoal: string;
  quality: string;
  mappedMethods: string[];
  loadingRecommendations: Record<string, any>;
}

export interface AthleticismDatabase {
  entries: AthleticismEntry[];
  lastUpdated: string;
}