/**
 * useCoachDocuments
 *
 * Folder metadata + document metadata → localStorage key: "coachDocuments"
 * File binaries → Supabase Storage (documents bucket)
 *
 * Migration: if old base64 blobs are found under "coachDocData_<id>" they are
 * silently dropped (metadata is kept, files must be re-uploaded).  The old
 * per-file keys are also cleaned up so they stop wasting localStorage space.
 *
 * API surface is identical to the previous localStorage-only version so that
 * no UI component needs to change.
 */

import { useState, useCallback, useEffect } from "react";
import { uploadFile, deleteFile, getSignedUrl } from "@/lib/storage";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const INDEX_KEY = "coachDocuments";
/** Legacy per-file base64 key prefix – used only during migration cleanup */
const LEGACY_DATA_PREFIX = "coachDocData_";
const VERSION = "2.0.0";

/**
 * Custom event dispatched whenever any hook instance commits a change.
 * This allows multiple instances on the same page (e.g. DocumentsSection +
 * TrainingPlanEnricher) to stay in sync without a full context refactor.
 */
const SYNC_EVENT = "coachDocuments:updated";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DocFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface CoachDocument {
  id: string;
  name: string;
  /** MIME type */
  type: string;
  /** File size in bytes */
  size: number;
  folderId: string | null;
  uploadedAt: string;
  /** Storage path inside the Supabase documents bucket */
  storagePath: string;
}

interface StorageIndex {
  version: string;
  folders: DocFolder[];
  documents: CoachDocument[];
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Load and migrate the stored index.
 *
 * v1 → v2 migration:
 *   - documents gain a `storagePath` field (set to "" for pre-existing entries
 *     whose actual binary was stored as base64; those files are unrecoverable
 *     without a re-upload).
 *   - Old base64 blobs (`coachDocData_<id>`) are removed from localStorage.
 */
function loadIndex(): StorageIndex {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return { version: VERSION, folders: [], documents: [] };

    const p = JSON.parse(raw) as Partial<StorageIndex> & {
      documents?: Array<Partial<CoachDocument>>;
    };

    const folders: DocFolder[] = Array.isArray(p.folders) ? p.folders : [];
    const rawDocs: Array<Partial<CoachDocument>> = Array.isArray(p.documents)
      ? p.documents
      : [];

    // v1 → v2: add storagePath where missing, clean up legacy base64 blobs
    const documents: CoachDocument[] = rawDocs.map((d) => {
      const id = d.id ?? genId();
      // Drop legacy base64 blob if it still exists
      if (localStorage.getItem(`${LEGACY_DATA_PREFIX}${id}`)) {
        localStorage.removeItem(`${LEGACY_DATA_PREFIX}${id}`);
      }
      return {
        id,
        name: d.name ?? "untitled",
        type: d.type ?? "application/octet-stream",
        size: d.size ?? 0,
        folderId: d.folderId ?? null,
        uploadedAt: d.uploadedAt ?? new Date().toISOString(),
        // Existing entries from v1 have no storagePath; keep as "" so the UI
        // can detect "needs re-upload" if desired in the future.
        storagePath: d.storagePath ?? "",
      };
    });

    return { version: VERSION, folders, documents };
  } catch {
    return { version: VERSION, folders: [], documents: [] };
  }
}

function persistIndex(index: StorageIndex): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useCoachDocuments() {
  const [index, setIndex] = useState<StorageIndex>(loadIndex);

  /** Commit updated index to React state + localStorage, then notify siblings. */
  const commit = useCallback((next: StorageIndex) => {
    persistIndex(next);
    setIndex(next);
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  }, []);

  /**
   * Re-read from localStorage whenever another hook instance on the same page
   * commits a change (e.g. TrainingPlanEnricher adding a doc while
   * DocumentsSection is mounted).
   */
  useEffect(() => {
    const handler = () => setIndex(loadIndex());
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  // ── Folders ─────────────────────────────────────────────────────────────────

  /** All folders, optionally filtered by parentId (default: root-level) */
  const getFolders = useCallback(
    (parentId: string | null = null) =>
      index.folders.filter((f) => f.parentId === parentId),
    [index.folders]
  );

  /** Resolve full ancestor path for a folder (root → folder) */
  const getFolderPath = useCallback(
    (folderId: string | null): DocFolder[] => {
      const path: DocFolder[] = [];
      let current = folderId;
      while (current) {
        const folder = index.folders.find((f) => f.id === current);
        if (!folder) break;
        path.unshift(folder);
        current = folder.parentId;
      }
      return path;
    },
    [index.folders]
  );

  const addFolder = useCallback(
    (name: string, parentId: string | null = null) => {
      const folder: DocFolder = {
        id: genId(),
        name: name.trim(),
        parentId,
        createdAt: new Date().toISOString(),
      };
      commit({ ...index, folders: [...index.folders, folder] });
    },
    [index, commit]
  );

  const renameFolder = useCallback(
    (id: string, name: string) => {
      commit({
        ...index,
        folders: index.folders.map((f) =>
          f.id === id ? { ...f, name: name.trim() } : f
        ),
      });
    },
    [index, commit]
  );

  /**
   * Deletes a folder and all descendant folders + their documents.
   * Best-effort remote delete for each document's storage file.
   */
  const deleteFolder = useCallback(
    (id: string) => {
      // Collect all folder IDs to remove (BFS)
      const toDelete = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const f of index.folders) {
          if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
            toDelete.add(f.id);
            changed = true;
          }
        }
      }

      // Best-effort: delete files from Supabase Storage (fire-and-forget)
      index.documents
        .filter((d) => d.folderId && toDelete.has(d.folderId) && d.storagePath)
        .forEach((d) => deleteFile(d.storagePath).catch(() => undefined));

      commit({
        ...index,
        folders: index.folders.filter((f) => !toDelete.has(f.id)),
        documents: index.documents.filter(
          (d) => !d.folderId || !toDelete.has(d.folderId)
        ),
      });
    },
    [index, commit]
  );

  // ── Documents ────────────────────────────────────────────────────────────────

  /** Documents in the given folder (null = root) */
  const getDocuments = useCallback(
    (folderId: string | null = null) =>
      index.documents.filter((d) => d.folderId === folderId),
    [index.documents]
  );

  /**
   * Upload a File to Supabase Storage, then persist metadata to localStorage.
   * Throws if the remote upload fails so the caller can show an error.
   */
  const addDocument = useCallback(
    async (file: File, folderId: string | null = null): Promise<CoachDocument> => {
      const id = genId();
      const ext = file.name.includes(".")
        ? file.name.split(".").pop()
        : undefined;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${id}${ext ? `.${ext}` : ""}_${safeName}`;

      // Upload first — if this throws the metadata is never written
      await uploadFile(storagePath, file);

      const doc: CoachDocument = {
        id,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        folderId,
        uploadedAt: new Date().toISOString(),
        storagePath,
      };

      commit({ ...index, documents: [...index.documents, doc] });
      return doc;
    },
    [index, commit]
  );

  /**
   * Delete a document: optimistically removes from local metadata immediately
   * so the UI updates without waiting, then best-effort deletes from Supabase
   * Storage in the background.
   *
   * Kept async so callers that do `await deleteDocument(id)` still work, but
   * callers that fire-and-forget also see an instant UI update.
   */
  const deleteDocument = useCallback(
    async (id: string) => {
      const doc = index.documents.find((d) => d.id === id);
      if (!doc) return;

      // Optimistic local removal first — UI updates immediately
      commit({
        ...index,
        documents: index.documents.filter((d) => d.id !== id),
      });

      // Background: best-effort remote delete (never throws to caller)
      if (doc.storagePath) {
        deleteFile(doc.storagePath).catch(() => undefined);
      }
    },
    [index, commit]
  );

  const moveDocument = useCallback(
    (id: string, folderId: string | null) => {
      commit({
        ...index,
        documents: index.documents.map((d) =>
          d.id === id ? { ...d, folderId } : d
        ),
      });
    },
    [index, commit]
  );

  /**
   * Trigger a browser download via a Supabase signed URL.
   * Falls back silently if the document has no storagePath (migrated v1 entry).
   */
  const downloadDocument = useCallback(
    async (id: string) => {
      const doc = index.documents.find((d) => d.id === id);
      if (!doc || !doc.storagePath) return;

      try {
        const url = await getSignedUrl(doc.storagePath, 60); // 60s expiry
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.name;
        a.click();
      } catch (err) {
        console.error("[useCoachDocuments] downloadDocument failed:", err);
      }
    },
    [index.documents]
  );

  /**
   * Get a short-lived signed URL for in-browser preview (PDF, images).
   * Returns null if the document has no storagePath.
   */
  const getDocumentUrl = useCallback(
    async (id: string): Promise<string | null> => {
      const doc = index.documents.find((d) => d.id === id);
      if (!doc || !doc.storagePath) return null;
      try {
        return await getSignedUrl(doc.storagePath, 3600);
      } catch {
        return null;
      }
    },
    [index.documents]
  );

  return {
    folders: index.folders,
    documents: index.documents,
    getFolders,
    getFolderPath,
    getDocuments,
    addFolder,
    renameFolder,
    deleteFolder,
    addDocument,
    deleteDocument,
    moveDocument,
    downloadDocument,
    /** Extra helper for in-browser preview — not required by existing UI */
    getDocumentUrl,
  };
}
