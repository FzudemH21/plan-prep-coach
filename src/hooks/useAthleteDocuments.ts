/**
 * useAthleteDocuments
 *
 * Manages documents that belong to a specific athlete.
 * Files are stored in Supabase Storage under:
 *   athlete-docs/<athleteId>/<id>_<safeName>
 *
 * Metadata is persisted in localStorage under the key
 * "athleteDocuments" as a map of athleteId → AthleteDoc[].
 *
 * When the Athlete App is built it can read from the same
 * Supabase Storage paths, giving athletes direct access to
 * their documents.
 */

import { useState, useCallback, useEffect } from "react";
import { uploadFile, deleteFile, getSignedUrl } from "@/lib/storage";

// ─── Constants ─────────────────────────────────────────────────────────────────

const INDEX_KEY = "athleteDocuments";
const SYNC_EVENT = "athleteDocuments:updated";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AthleteDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  /** Path inside the Supabase "documents" bucket */
  storagePath: string;
}

type StorageIndex = Record<string, AthleteDoc[]>;

// ─── localStorage helpers ──────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadIndex(): StorageIndex {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StorageIndex;
  } catch {
    return {};
  }
}

function persistIndex(index: StorageIndex): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAthleteDocuments(athleteId: string) {
  const [index, setIndex] = useState<StorageIndex>(loadIndex);

  // Re-sync from localStorage when another hook instance commits a change
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

  const docs: AthleteDoc[] = index[athleteId] ?? [];

  /** Upload a file and persist its metadata. Throws on upload failure. */
  const addDocument = useCallback(
    async (file: File) => {
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
      };

      const next = { ...index, [athleteId]: [...docs, doc] };
      commit(next);
    },
    [index, athleteId, docs, commit]
  );

  /** Delete a document from metadata (optimistic) and best-effort from storage. */
  const deleteDocument = useCallback(
    async (id: string) => {
      const doc = docs.find((d) => d.id === id);
      const next = { ...index, [athleteId]: docs.filter((d) => d.id !== id) };
      commit(next);
      if (doc?.storagePath) {
        deleteFile(doc.storagePath).catch(() => undefined);
      }
    },
    [index, athleteId, docs, commit]
  );

  /** Get a short-lived signed URL for viewing or downloading. */
  const getDocumentUrl = useCallback(
    async (id: string): Promise<string | null> => {
      const doc = docs.find((d) => d.id === id);
      if (!doc?.storagePath) return null;
      try {
        return await getSignedUrl(doc.storagePath, 3600);
      } catch {
        return null;
      }
    },
    [docs]
  );

  return { docs, addDocument, deleteDocument, getDocumentUrl };
}
