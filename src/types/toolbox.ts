export interface ToolboxEntry {
  id: string;
  category: string;
  subCategory: string;
  parameter: string;
  // Enhanced structure for new parameter system
  parameterName?: string;
  parameterType?: 'qualitative' | 'quantitative';
  options?: string[];
  // Exercise selection categories
  exerciseCategories?: string[];
}

export interface ToolboxDatabase {
  entries: ToolboxEntry[];
  lastUpdated: string;
}