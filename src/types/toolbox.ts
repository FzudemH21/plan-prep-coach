export interface ToolboxEntry {
  id: string;
  category: string;
  subCategory: string;
  // Primary parameter name (required)
  parameterName: string;
  parameterType: 'qualitative' | 'quantitative';
  options: string[];
  // Exercise selection categories
  exerciseCategories?: string[];
  // Training frequency indicator
  isFrequencyParameter?: boolean;
  // Set parameter indicator (determines number of rows in exercise detail view)
  isSetParameter?: boolean;
  // Whether to show this parameter in the grid by default (defaults to true)
  showInGridByDefault?: boolean;
  // Whether to show this parameter in the athlete app session grid (defaults to false for safety)
  showInAthleteApp?: boolean;
  // Calculated parameter support
  isCalculated?: boolean;           // Flag to mark as calculated
  formula?: string;                 // Formula expression, e.g., "Sets * Ground Contacts"
  sourceParameterIds?: string[];    // IDs of parameters used in the formula
}

export interface ToolboxDatabase {
  entries: ToolboxEntry[];
  lastUpdated: string;
}