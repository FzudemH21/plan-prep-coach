import { supabase } from '@/lib/supabase';

/**
 * "Export all data": every row the coach's login can read from the app's tables, as one JSON file
 * to keep as an own backup. Only reads. Uploaded files (documents, attachments) are not included,
 * only their records. A table that can't be read is noted in the file and skipped.
 */

const TABLES = [
  // Programs: one row each (since 2026-11-08); the old shared row is kept as a backup
  'program_records',
  // Athletes: one row each (since 2026-11-08); the old shared row is kept as a backup
  'athlete_records',
  // One row per coach holding a whole store
  'training_programs', 'athlete_database', 'custom_libraries', 'toolbox_data', 'parameters_database',
  'programming_templates', 'session_library', 'calendar_events',
  // Program versions and assigned plans
  'program_versions', 'athlete_assignment_plans', 'plan_memory',
  // Athletes' side
  'athlete_connections', 'athlete_schedule', 'athlete_session_logs', 'athlete_daily_checkins',
  'athlete_test_results', 'athlete_anamneses', 'anamnesis_templates', 'anamnesis_change_log',
  'exercise_progressions', 'exercise_param_tags', 'coach_session_remarks', 'coach_privacy_notices',
  'chat_messages', 'documents',
] as const;

const PAGE = 1000;

async function readTable(table: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export interface DataExport {
  exportedAt: string;
  app: 'plan-prep-coach';
  tables: Record<string, unknown[]>;
  errors: Record<string, string>;
}

export async function exportAllData(onProgress?: (table: string) => void): Promise<DataExport> {
  const result: DataExport = { exportedAt: new Date().toISOString(), app: 'plan-prep-coach', tables: {}, errors: {} };
  for (const table of TABLES) {
    onProgress?.(table);
    try {
      result.tables[table] = await readTable(table);
    } catch (err) {
      result.errors[table] = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
    }
  }
  return result;
}

export function downloadJson(data: unknown, fileName: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
