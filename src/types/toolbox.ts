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
  // Training frequency indicator
  isFrequencyParameter?: boolean;
  // Set parameter indicator (determines number of rows in exercise detail view)
  isSetParameter?: boolean;
  // Whether to show this parameter in the grid by default (defaults to true)
  showInGridByDefault?: boolean;
}

export interface ToolboxDatabase {
  entries: ToolboxEntry[];
  lastUpdated: string;
}