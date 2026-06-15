import { cn } from '@/lib/utils';
import { migrateLegacyIntensity } from '@/utils/intensityScale';

export const INTENSITY_CONFIG: Record<string, { label: string; color: string }> = {
  // Borg CR10
  '0':  { label: '0 – Rest',           color: 'bg-slate-100 text-slate-600' },
  '1':  { label: '1 – Very Easy',       color: 'bg-green-100 text-green-700' },
  '2':  { label: '2 – Easy',            color: 'bg-green-200 text-green-800' },
  '3':  { label: '3 – Moderate',        color: 'bg-yellow-100 text-yellow-700' },
  '4':  { label: '4 – Somewhat Hard',   color: 'bg-yellow-200 text-yellow-800' },
  '5':  { label: '5 – Hard',            color: 'bg-orange-200 text-orange-800' },
  '6':  { label: '6 – Hard+',           color: 'bg-orange-300 text-orange-900' },
  '7':  { label: '7 – Very Hard',       color: 'bg-red-200 text-red-800' },
  '8':  { label: '8 – Very Hard+',      color: 'bg-red-300 text-red-900' },
  '9':  { label: '9 – Extremely Hard',  color: 'bg-red-400 text-red-950' },
  '10': { label: '10 – Maximal',        color: 'bg-red-600 text-white' },
  // Legacy 8-level
  off:              { label: 'Off',            color: 'bg-slate-100 text-slate-600' },
  deload:           { label: 'Deload',         color: 'bg-blue-100 text-blue-700' },
  easy:             { label: 'Easy',           color: 'bg-green-100 text-green-700' },
  'easy-moderate':  { label: 'Easy-Moderate',  color: 'bg-green-200 text-green-800' },
  moderate:         { label: 'Moderate',       color: 'bg-yellow-100 text-yellow-700' },
  'moderate-hard':  { label: 'Moderate-Hard',  color: 'bg-orange-200 text-orange-800' },
  hard:             { label: 'Hard',           color: 'bg-red-200 text-red-800' },
  'extremely-hard': { label: 'Extremely Hard', color: 'bg-red-500 text-white' },
};

export function getDotColor(intensity: string | null): string {
  if (!intensity) return 'bg-slate-300';
  const num = parseInt(migrateLegacyIntensity(intensity));
  if (num <= 2) return 'bg-green-400';
  if (num <= 4) return 'bg-yellow-400';
  if (num <= 6) return 'bg-orange-400';
  return 'bg-red-500';
}

export function IntensityBadge({ intensity }: { intensity: string | null }) {
  if (!intensity) return null;
  const borgLevel = migrateLegacyIntensity(intensity);
  const config = INTENSITY_CONFIG[borgLevel] ?? { label: borgLevel, color: 'bg-slate-100 text-slate-600' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-sm font-medium', config.color)}>
      {config.label}
    </span>
  );
}
