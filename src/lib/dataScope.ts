/**
 * Whose data the app loads and saves (organizations, phase 3 step 2b).
 *
 * A member of an organization works in the organization's data space — the account of its data
 * owner (the owner who created it) — within their rights. Rolled out area by area: only the areas
 * in SHARED_AREAS are shared yet; everything else stays in the person's own account.
 *
 * Without an organization, before the SQL has run, or when the lookup fails: the own account —
 * exactly as before.
 */
import { supabase } from '@/lib/supabase';

export type DataArea = 'libraries' | 'programs' | 'athletes';

/** Areas members share with their organization so far */
const SHARED_AREAS: ReadonlySet<DataArea> = new Set<DataArea>(['libraries']);

export interface DataScope {
  /** The logged-in person */
  userId: string;
  /** The account holding the organization's data (= userId without an organization) */
  ownerId: string;
  /** The person's rights in the organization (null without one) */
  rights: Partial<Record<DataArea, 'view' | 'edit'>> | null;
}

let current: { userId: string; promise: Promise<DataScope> } | null = null;

const isMissingFunction = (err: { code?: string; message?: string }) =>
  err.code === 'PGRST202' || /could not find the function/i.test(err.message ?? '');

async function lookup(userId: string): Promise<DataScope> {
  for (let attempt = 1; ; attempt++) {
    const [owner, rights] = await Promise.all([supabase.rpc('my_data_owner'), supabase.rpc('my_org_rights')]);
    if (!owner.error) {
      return {
        userId,
        ownerId: typeof owner.data === 'string' && owner.data ? owner.data : userId,
        rights: rights.error ? null : (rights.data as DataScope['rights']) ?? null,
      };
    }
    if (isMissingFunction(owner.error) || attempt >= 2) {
      if (!isMissingFunction(owner.error)) console.warn('[dataScope] lookup failed — using the own account', owner.error);
      return { userId, ownerId: userId, rights: null };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** The data scope of the logged-in person (looked up once per login) */
export function resolveDataScope(userId: string): Promise<DataScope> {
  if (current?.userId !== userId) current = { userId, promise: lookup(userId) };
  return current.promise;
}

/** The account whose data this area uses */
export function dataIdFor(scope: DataScope, area: DataArea | undefined): string {
  return area && SHARED_AREAS.has(area) ? scope.ownerId : scope.userId;
}

/** Whether this person may change the area's data */
export function canEditIn(scope: DataScope, area: DataArea | undefined): boolean {
  return dataIdFor(scope, area) === scope.userId || scope.rights?.[area as DataArea] === 'edit';
}

/** Whether the area's data belongs to someone else's account (the organization's) */
export function isSharedIn(scope: DataScope, area: DataArea | undefined): boolean {
  return dataIdFor(scope, area) !== scope.userId;
}
