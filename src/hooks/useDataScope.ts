import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { canEditIn, dataIdFor, resolveDataScope, type DataArea, type DataScope } from '@/lib/dataScope';

/** The logged-in person's data scope (lib/dataScope), null until known */
function useScope(): DataScope | null {
  const { user } = useAuth();
  const [scope, setScope] = useState<DataScope | null>(null);
  useEffect(() => {
    if (!user) { setScope(null); return; }
    let cancelled = false;
    void resolveDataScope(user.id).then((s) => { if (!cancelled) setScope(s); });
    return () => { cancelled = true; };
  }, [user]);
  return user && scope?.userId === user.id ? scope : null;
}

/**
 * The account whose data an area uses (the organization's for members, see lib/dataScope) and
 * whether the logged-in person may change it. dataId is null until known — load nothing before.
 */
export function useDataScope(area: DataArea): { dataId: string | null; canEdit: boolean } {
  const scope = useScope();
  return {
    dataId: scope ? dataIdFor(scope, area) : null,
    canEdit: scope ? canEditIn(scope, area) : false,
  };
}

/**
 * True when the logged-in person may only view an area (a member with the "view" right): screens
 * hide their add / edit / delete / copy controls. False while unknown and for everyone who may
 * edit — the database refuses changes anyway, this only keeps the screens honest.
 */
export function useReadOnly(area: DataArea): boolean {
  const scope = useScope();
  return !!scope && !canEditIn(scope, area);
}
