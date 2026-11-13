/**
 * Cutting a store's data into records (one Supabase row each, see recordStore.ts) and putting it
 * back together — for the coach's libraries in `coach_records`.
 *
 * Lists keep their order in a small "_meta" record (the ids in order). Nothing can get lost on the
 * way: an item without an id, or with an id used twice, stays inside the order list as it is; a
 * stored item missing from the order list (e.g. added by another device in the meantime) is added
 * at the end.
 */

export type OrderEntry = string | { inline: unknown };

export const META_ID = '_meta';

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Puts every item of `items` into `records` (key: prefix + id) and returns their order */
export function splitList(items: readonly unknown[], prefix: string, records: Obj): OrderEntry[] {
  return items.map(item => {
    const id = isObj(item) ? item.id : undefined;
    const key = typeof id === 'string' || typeof id === 'number' ? prefix + String(id) : null;
    if (key === null || key in records) return { inline: item };
    records[key] = item;
    return String(id);
  });
}

/** The items of a list in their order — plus stored items of the list missing from the order */
export function joinList(order: unknown, prefix: string, records: Obj, used: Set<string>): unknown[] {
  const out: unknown[] = [];
  const add = (key: string) => {
    if (used.has(key) || !(key in records)) return;
    used.add(key);
    out.push(records[key]);
  };
  if (Array.isArray(order)) {
    order.forEach(entry => {
      if (typeof entry === 'string') add(prefix + entry);
      else if (isObj(entry) && 'inline' in entry) out.push(entry.inline);
    });
  }
  Object.keys(records).filter(key => key.startsWith(prefix)).sort().forEach(add);
  return out;
}

/**
 * An object with lists (e.g. { parameters: [...], interactions: [...], lastUpdated }): every list
 * item becomes a record (`lists`: field → key prefix), everything else goes into "_meta".
 */
export function splitFields<T extends object>(data: T, lists: Record<string, string>): Obj {
  const records: Obj = {};
  const meta: Obj = { ...(data as Obj) };
  const order: Record<string, OrderEntry[]> = {};
  Object.entries(lists).forEach(([field, prefix]) => {
    const value = (data as Obj)[field];
    if (!Array.isArray(value)) return; // not a list (e.g. unset): stays in "_meta" as it is
    delete meta[field];
    order[field] = splitList(value, prefix, records);
  });
  records[META_ID] = { ...meta, _order: order };
  return records;
}

export function joinFields<T extends object>(records: Obj, lists: Record<string, string>, base: T): T {
  const metaRecord = isObj(records[META_ID]) ? records[META_ID] as Obj : {};
  const { _order, ...meta } = metaRecord;
  const order = isObj(_order) ? _order : {};
  const result: Obj = { ...(base as Obj), ...meta };
  const used = new Set<string>();
  Object.entries(lists).forEach(([field, prefix]) => {
    const hasItems = Object.keys(records).some(key => key.startsWith(prefix));
    if (!(field in order) && !hasItems) return; // the list wasn't split (e.g. unset): as in "_meta"
    result[field] = joinList(order[field], prefix, records, used);
  });
  return result as T;
}

/** A map of lists (e.g. calendar events per athlete): one record per key */
export function splitMap(data: Obj, prefix: string): Obj {
  const records: Obj = {};
  Object.entries(data).forEach(([key, value]) => { records[prefix + key] = value; });
  return records;
}

export function joinMap(records: Obj, prefix: string): Obj {
  const result: Obj = {};
  Object.keys(records).sort().forEach(key => {
    if (key.startsWith(prefix)) result[key.slice(prefix.length)] = records[key];
  });
  return result;
}
