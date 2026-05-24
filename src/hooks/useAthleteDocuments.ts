/**
 * useAthleteDocuments
 *
 * Manages documents (and folders) for a specific athlete.
 * Files are stored in Supabase Storage under:
 *   athlete-docs/<athleteId>/<id>_<safeName>
 *
 * Metadata is persisted in localStorage under the key
 * "athleteDocuments" as a map of athleteId → { folders, documents }.
 */

import { useState, useCallback, useEffect } from "react";
import { uploadFile, deleteFile, getSignedUrl } from "@/lib/storage";

// ─── Constants ─────────────────────────────────────────────────────────────────

const INDEX_KEY = "athleteDocuments";
const SYNC_EVENT = "athleteDocuments:updated";

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

function loadIndex(): StorageIndex {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Migrate: if any athleteId entry is a plain array (old format), convert it
    const migrated: StorageIndex = {};
    for (const [id, val] of Object.entries(parsed)) {
      if (Array.isArray(val)) {
        migrated[id] = {
          folders: [],
          documents: (val as AthleteDoc[]).map(d => ({ ...d, folderId: d.folderId ?? null })),
        };
      } else {
        migrated[id] = val as AthleteIndex;
      }
    }
    return migrated;
  } catch {
    return {};
  }
}

function persistIndex(index: StorageIndex): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function getAthleteEntry(index: StorageIndex, athleteId: string): AthleteIndex {
  return index[athleteId] ?? { folders: [], documents: [] };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAthleteDocuments(athleteId: string) {
  const [index, setIndex] = useState<StorageIndex>(loadIndex);

  useEffect(() => {
    const handler = () => setIndex(loadIndex());
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  const commit = useCallback((next: StorageIndex) => {
    persistIndex(next);
    setIndex(next);
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  }, []);

  const entry = getAthleteEntry(index, athleteId);
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
      while (current) {
        path.unshift(current);
        current = current.parentId ? folders.find(f => f.id === current!.parentId) : undefined;
      }
      return path;
    },
    [folders]
  );

  /** Create a new folder */
  const addFolder = useCallback(
    (name: string, parentId: string | null = null) => {
      const folder: DocFolder = {
        id: genId(),
        name: name.trim(),
        parentId,
        createdAt: new Date().toISOString(),
      };
      const next = {
        ...index,
        [athleteId]: { folders: [...folders, folder], documents },
      };
      commit(next);
    },
    [index, athleteId, folders, documents, commit]
  );

  /** Delete a folder and all its descendants + their documents (cascading) */
  const deleteFolder = useCallback(
    (folderId: string) => {
      // Collect all descendant folder IDs
      const toDelete = new Set<string>([folderId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const f of folders) {
          if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
            toDelete.add(f.id);
            changed = true;
          }
        }
      }
      // Remove docs in those folders from storage (best-effort)
      const docsToRemove = documents.filter(d => d.folderId && toDelete.has(d.folderId));
      docsToRemove.forEach(d => deleteFile(d.storagePath).catch(() => undefined));

      const next = {
        ...index,
        [athleteId]: {
          folders: folders.filter(f => !toDelete.has(f.id)),
          documents: documents.filter(d => !(d.folderId && toDelete.has(d.folderId))),
        },
      };
      commit(next);
    },
    [index, athleteId, folders, documents, commit]
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

      const next = {
        ...index,
        [athleteId]: { folders, documents: [...documents, doc] },
      };
      commit(next);
    },
    [index, athleteId, folders, documents, commit]
  );

  /** Delete a document (optimistic) */
  const deleteDocument = useCallback(
    async (id: string) => {
      const doc = documents.find(d => d.id === id);
      const next = {
        ...index,
        [athleteId]: { folders, documents: documents.filter(d => d.id !== id) },
      };
      commit(next);
      if (doc?.storagePath) {
        deleteFile(doc.storagePath).catch(() => undefined);
      }
    },
    [index, athleteId, folders, documents, commit]
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
