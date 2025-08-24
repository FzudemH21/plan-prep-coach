export interface ToolboxEntry {
  id: string;
  category: string;
  subCategory: string;
  parameter: string;
}

export interface ToolboxDatabase {
  entries: ToolboxEntry[];
  lastUpdated: string;
}