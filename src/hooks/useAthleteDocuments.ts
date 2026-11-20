/**
 * useAthleteDocuments
 *
 * Documents (and folders) of one athlete. The files are in Supabase Storage:
 *   documents/athlete-docs/<athleteId>/<id>_<safeName>
 *
 * The list (names, folders) is stored in Supabase, one row per athlete (coach_records, store
 * "athlete_documents", id "a:<athleteId>") — so every coach who reaches the athlete (owners, the
 * assigned coaches) sees it, on every device. Members of an organization work in the
 * organization's list (lib/dataScope), like tests and events.
 *
 * Before 2026-11-20 the list was kept only in the uploading browser (localStorage
 * "athleteDocuments"). That copy is taken over once per item — only items the shared list doesn't
 * have yet, only for athletes this login reaches — and stays in the browser untouched as a backup.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { uploadFile, deleteFile, getSignedUrl } from "@/lib/storage";
import { createRecordStore, useRecordStore } from "@/lib/recordStore";
import { joinMap, splitMap } from "@/lib/recordSplit";
import { athleteStore } from "@/hooks/useAthletes";

// ─── Constants ─────────────────────────────────────────────────────────────────

/** The old browser-only list (only read, for taking it over) */
const LEGACY_KEY = "athleteDocuments";
/** Ids (folders and documents) already taken over from the old list in this browser */
const IMPORTED_KEY = "athleteDocuments_imported";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DocFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface AthleteDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  /** Path inside the Supabase "documents" bucket */
  storagePath: string;
  /** null = root level */
  folderId: string | null;
}

interface AthleteIndex {
  folders: DocFolder[];
  documents: AthleteDoc[];
}

type StorageIndex = Record<string, AthleteIndex>;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY: AthleteIndex = { folders: [], documents: [] };

/** Any stored shape → the current one (very old lists were a plain array of documents) */
function normalizeEntry(val: unknown): AthleteIndex {
  if (Array.isArray(val)) {
    return { folders: [], documents: (val as AthleteDoc[]).map(d => ({ ...d, folderId: d.folderId ?? null })) };
  }
  if (val && typeof val === "object") {
    const v = val as Partial<AthleteIndex>;
    return {
      folders: Array.isArray(v.folders) ? v.folders : [],
      documents: Array.isArray(v.documents) ? v.documents.map(d => ({ ...d, folderId: d.folderId ?? null })) : [],
    };
  }
  return EMPTY;
}

function normalizeIndex(raw: unknown): StorageIndex {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: StorageIndex = {};
  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) result[id] = normalizeEntry(val);
  return result;
}

function readLegacy(): StorageIndex {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? normalizeIndex(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function readImported(): Set<string> {
  try {
    const raw = localStorage.getItem(IMPORTED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeImported(ids: Set<string>): void {
  try {
    localStorage.setItem(IMPORTED_KEY, JSON.stringify([...ids]));
  } catch {
    /* taken over again next time: only items still missing, harmless */
  }
}

// ─── Store ─────────────────────────────────────────────────────────────────────

/** One row per athlete (coach_records, store "athlete_documents") */
export const athleteDocumentsStore = createRecordStore<StorageIndex>({
  table: "coach_records",
  store: "athlete_documents",
  label: "athlete documents",
  // Athlete data: the organization's for members; may be empty (no documents yet)
  area: "athletes",
  sharedMayBeEmpty: true,
  defaultValue: () => ({}),
  migrate: normalizeIndex,
  split: data => splitMap(data, "a:"),
  join: records => normalizeIndex(joinMap(records, "a:")),
  // The app never removes an athlete's list — at most one per save, just in case
  guardedPrefix: id => id.startsWith("a:"),
  maxRemovalsPerSave: 1,
  cacheKey: "coach_records_athlete_documents_sb_cache",
});

/** The newest list (not a render's snapshot): several uploads at once each add to it */
function latest(): StorageIndex {
  return athleteDocumentsStore.getState().data;
}

function loaded(): boolean {
  return athleteDocumentsStore.getState().status === "loaded";
}

/** Change one athlete's list, on top of what others stored meanwhile */
async function updateAthlete(athleteId: string, update: (entry: AthleteIndex) => AthleteIndex): Promise<void> {
  await athleteDocumentsStore.refresh().catch(() => false);
  const current = latest();
  const entry = current[athleteId] ?? EMPTY;
  const next = update(entry);
  if (next === entry) return;
  await athleteDocumentsStore.save({ ...current, [athleteId]: next });
}

let importRunning = false;

/**
 * The old browser-only lists → the shared list: items it doesn't have yet, for athletes this login
 * reaches (the loaded athletes). Never removes anything; marks the taken-over ids in this browser
 * (an item deleted later by someone else is not brought back).
 */
export async function takeOverLegacy(): Promise<void> {
  if (importRunning || !loaded()) return;
  const legacy = readLegacy();
  if (Object.keys(legacy).length === 0) return;
  const athletes = athleteStore.getState();
  if (athletes.status !== "loaded" || athletes.userId !== athleteDocumentsStore.getState().userId) return;
  const reachable = new Set(athletes.data.athletes.map(a => a.id));
  const imported = readImported();

  importRunning = true;
  try {
    const current = latest();
    const next: StorageIndex = { ...current };
    const taken: string[] = [];
    for (const [athleteId, old] of Object.entries(legacy)) {
      if (!reachable.has(athleteId)) continue;
      const entry = next[athleteId] ?? EMPTY;
      const folderIds = new Set(entry.folders.map(f => f.id));
      const docIds = new Set(entry.documents.map(d => d.id));
      const folders = old.folders.filter(f => !folderIds.has(f.id) && !imported.has(f.id));
      const documents = old.documents.filter(d => !docIds.has(d.id) && !imported.has(d.id));
      if (folders.length === 0 && documents.length === 0) continue;
      next[athleteId] = { folders: [...entry.folders, ...folders], documents: [...entry.documents, ...documents] };
      taken.push(...folders.map(f => f.id), ...documents.map(d => d.id));
    }
    if (taken.length === 0) return;
    await athleteDocumentsStore.save(next);
    taken.forEach(id => imported.add(id));
    writeImported(imported);
    console.info(`[athleteDocuments] took over ${taken.length} item(s) from this browser's old list`);
  } catch (err) {
    console.warn("[athleteDocuments] taking over the old list failed — tried again next time", err);
  } finally {
    importRunning = false;
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAthleteDocuments(athleteId: string) {
  const [index, , isLoading] = useRecordStore(athleteDocumentsStore);
  const athletes = useSyncExternalStore(athleteStore.subscribe, athleteStore.getState);

  // The old browser-only list, once both lists are there
  useEffect(() => {
    if (!isLoading) void takeOverLegacy();
  }, [isLoading, athletes.status, athletes.userId]);

  const entry = index[athleteId] ?? EMPTY;
  const { folders, documents } = entry;

  // ── Folder helpers ──────────────────────────────────────────────────────────

  /** All folders whose parentId matches (null = root) */
  const getFolders = useCallback(
    (parentId: string | null = null): DocFolder[] =>
      folders.filter(f => f.parentId === parentId),
    [folders]
  );

  /** Resolve breadcrumb path for a folder */
  const getFolderPath = useCallback(
    (folderId: string | null): DocFolder[] => {
      if (!folderId) return [];
      const path: DocFolder[] = [];
      let current: DocFolder | undefined = folders.find(f => f.id === folderId);
      while (current && !path.includes(current)) {
        path.unshift(current);
        const parentId: string | null = current.parentId;
        current = parentId ? folders.find(f => f.id === parentId) : undefined;
      }
      return path;
    },
    [folders]
  );

  /** Create a new folder */
  const addFolder = useCallback(
    async (name: string, parentId: string | null = null) => {
      const folder: DocFolder = {
        id: genId(),
        name: name.trim(),
        parentId,
        createdAt: new Date().toISOString(),
      };
      await updateAthlete(athleteId, e => ({ ...e, folders: [...e.folders, folder] }));
    },
    [athleteId]
  );

  /** Delete a folder and all its descendants + their documents (cascading) */
  const deleteFolder = useCallback(
    async (folderId: string) => {
      let removedPaths: string[] = [];
      await updateAthlete(athleteId, e => {
        const toDelete = new Set<string>([folderId]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const f of e.folders) {
            if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
              toDelete.add(f.id);
              changed = true;
            }
          }
        }
        removedPaths = e.documents.filter(d => d.folderId && toDelete.has(d.folderId)).map(d => d.storagePath);
        return {
          folders: e.folders.filter(f => !toDelete.has(f.id)),
          documents: e.documents.filter(d => !(d.folderId && toDelete.has(d.folderId))),
        };
      });
      // The files only once the list no longer shows them (best-effort)
      removedPaths.forEach(path => deleteFile(path).catch(() => undefined));
    },
    [athleteId]
  );

  // ── Document helpers ────────────────────────────────────────────────────────

  /** Documents in a specific folder (null = root) */
  const getDocuments = useCallback(
    (folderId: string | null = null): AthleteDoc[] =>
      documents.filter(d => d.folderId === folderId),
    [documents]
  );

  /** Upload a file into the given folder (null = root) */
  const addDocument = useCallback(
    async (file: File, folderId: string | null = null) => {
      // Not before the list has loaded — the file would end up in nobody's list
      if (!loaded()) throw new Error("The documents have not been loaded yet");
      const id = genId();
      const ext = file.name.includes(".") ? file.name.split(".").pop() : undefined;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `athlete-docs/${athleteId}/${id}${ext ? `.${ext}` : ""}_${safeName}`;

      await uploadFile(storagePath, file);

      const doc: AthleteDoc = {
        id,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: new Date().toISOString(),
        storagePath,
        folderId,
      };
      try {
        await updateAthlete(athleteId, e => ({ ...e, documents: [...e.documents, doc] }));
      } catch (err) {
        // Not in the list (not loaded / no right to change): the file goes again
        await deleteFile(storagePath).catch(() => undefined);
        throw err;
      }
    },
    [athleteId]
  );

  /** Delete a document */
  const deleteDocument = useCallback(
    async (id: string) => {
      let path: string | undefined;
      await updateAthlete(athleteId, e => {
        const doc = e.documents.find(d => d.id === id);
        if (!doc) return e;
        path = doc.storagePath;
        return { ...e, documents: e.documents.filter(d => d.id !== id) };
      });
      if (path) deleteFile(path).catch(() => undefined);
    },
    [athleteId]
  );

  /** Get a signed URL for viewing / downloading */
  const getDocumentUrl = useCallback(
    async (id: string): Promise<string | null> => {
      const doc = documents.find(d => d.id === id);
      if (!doc?.storagePath) return null;
      try {
        return await getSignedUrl(doc.storagePath, 3600);
      } catch {
        return null;
      }
    },
    [documents]
  );

  return {
    folders,
    documents,
    isLoading,
    getFolders,
    getFolderPath,
    addFolder,
    deleteFolder,
    getDocuments,
    addDocument,
    deleteDocument,
    getDocumentUrl,
    /** @deprecated use getDocuments(null) for root-level docs */
    docs: documents,
  };
}
