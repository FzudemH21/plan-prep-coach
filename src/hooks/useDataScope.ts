import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { canEditIn, dataIdFor, resolveDataScope, type DataArea, type DataScope } from '@/lib/dataScope';

/**
 * The account whose data an area uses (the organization's for members, see lib/dataScope) and
 * whether the logged-in person may change it. dataId is null until known — load nothing before.
 */
export function useDataScope(area: DataArea): { dataId: string | null; canEdit: boolean } {
  const { user } = useAuth();
  const [scope, setScope] = useState<DataScope | null>(null);
  useEffect(() => {
    if (!user) { setScope(null); return; }
    let cancelled = false;
    void resolveDataScope(user.id).then((s) => { if (!cancelled) setScope(s); });
    return () => { cancelled = true; };
  }, [user]);
  const current = user && scope?.userId === user.id ? scope : null;
  return {
    dataId: current ? dataIdFor(current, area) : null,
    canEdit: current ? canEditIn(current, area) : false,
  };
}
