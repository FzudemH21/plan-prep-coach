import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Shown next to a page title when the person may only view this area (organization rights) */
export function ViewOnlyBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Badge variant="secondary" className="gap-1 font-normal align-middle">
      <Eye className="h-3 w-3" />
      View only
    </Badge>
  );
}
