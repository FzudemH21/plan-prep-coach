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
  // Rest/pause parameter indicator (used to drive the rest timer in athlete app)
  isRestParameter?: boolean;
  // Whether to show this parameter in the grid by default (also controls athlete app session grid visibility)
  showInGridByDefault?: boolean;
  // Calculated parameter support
  isCalculated?: boolean;           // Flag to mark as calculated
  formula?: string;                 // Formula expression, e.g., "Sets * Ground Contacts"
  sourceParameterIds?: string[];    // IDs of method parameters used in the formula
  athleteDataRefs?: string[];       // IDs of athlete data tokens used in the formula (biometric def IDs, perf param IDs, or 'e1RM')
}

export interface ToolboxDatabase {
  entries: ToolboxEntry[];
  lastUpdated: string;
}