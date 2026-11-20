import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Shown next to a page title when the person may only view this area (organization rights).
 *  label: what is view only (e.g. "health data"); title: the longer reason, as a tooltip */
export function ViewOnlyBadge({ show, label, title }: { show: boolean; label?: string; title?: string }) {
  if (!show) return null;
  return (
    <Badge variant="secondary" className="gap-1 font-normal align-middle" title={title}>
      <Eye className="h-3 w-3" />
      {label ? `View only · ${label}` : 'View only'}
    </Badge>
  );
}

/** Health data that may only be viewed: the Health tick in the organization's rights grid */
export const HEALTH_VIEW_ONLY_TITLE =
  "Your organization lets you view health data, but not change it (the Health tick under Coach Profile → Organization). It has nothing to do with someone else editing.";
