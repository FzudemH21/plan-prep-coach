/**
 * useCoachDocuments
 *
 * Local document & folder management stored in localStorage.
 * Index (metadata) → key: "coachDocuments"
 * File data (base64) → key: "coachDocData_<id>"  (split to avoid huge entries)
 */

import { useState, useCallback } from "react";

const INDEX_KEY = "coachDocuments";
const DATA_PREFIX = "coachDocData_";
const VERSION = "1.0.0";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

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
}

interface StorageIndex {
  version: string;
  folders: DocFolder[];
  documents: CoachDocument[];
}

// ─────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────

function loadIndex(): StorageIndex {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return { version: VERSION, folders: [], documents: [] };
    const p = JSON.parse(raw) as Partial<StorageIndex>;
    // Migration fallback: ensure required fields always exist
    return {
      version: p.version ?? VERSION,
      folders: Array.isArray(p.folders) ? p.folders : [],
      documents: Array.isArray(p.documents) ? p.documents : [],
    };
  } catch {
    return { version: VERSION, folders: [], documents: [] };
  }
}

function persistIndex(index: StorageIndex): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function loadData(id: string): string | null {
  return localStorage.getItem(`${DATA_PREFIX}${id}`);
}

function persistData(id: string, dataUrl: string): void {
  localStorage.setItem(`${DATA_PREFIX}${id}`, dataUrl);
}

function removeData(id: string): void {
  localStorage.removeItem(`${DATA_PREFIX}${id}`);
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useCoachDocuments() {
  const [index, setIndex] = useState<StorageIndex>(loadIndex);

  /** Commit updated index to state + localStorage */
  const commit = useCallback((next: StorageIndex) => {
    persistIndex(next);
    setIndex(next);
  }, []);

  // ── Folders ───────────────────────────────────────────────────────────────

  /** All folders, optionally filtered by parentId */
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

  /** Deletes a folder + all descendant folders + their documents */
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
      // Remove data blobs for affected documents
      index.documents
        .filter((d) => d.folderId && toDelete.has(d.folderId))
        .forEach((d) => removeData(d.id));

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

  // ── Documents ─────────────────────────────────────────────────────────────

  /** Documents in the given folder (null = root) */
  const getDocuments = useCallback(
    (folderId: string | null = null) =>
      index.documents.filter((d) => d.folderId === folderId),
    [index.documents]
  );

  /** Upload a File, convert to base64 data URL, store */
  const addDocument = useCallback(
    async (file: File, folderId: string | null = null) => {
      const dataUrl = await fileToDataUrl(file);
      const doc: CoachDocument = {
        id: genId(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        folderId,
        uploadedAt: new Date().toISOString(),
      };
      persistData(doc.id, dataUrl);
      commit({ ...index, documents: [...index.documents, doc] });
    },
    [index, commit]
  );

  const deleteDocument = useCallback(
    (id: string) => {
      removeData(id);
      commit({
        ...index,
        documents: index.documents.filter((d) => d.id !== id),
      });
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

  /** Trigger browser download of a stored document */
  const downloadDocument = useCallback(
    (id: string) => {
      const doc = index.documents.find((d) => d.id === id);
      if (!doc) return;
      const dataUrl = loadData(id);
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = doc.name;
      a.click();
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
  };
}
