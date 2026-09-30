/**
 * ragPipeline.ts
 *
 * Ingestion pipeline for RAG (Retrieval-Augmented Generation).
 *
 * Flow per document:
 *   1. Fetch file from Supabase Storage → base64 / arraybuffer
 *   2. Extract plain text (PDF → pdfjs-dist, plain text → direct)
 *   3. Chunk text into overlapping segments
 *   4. Embed the chunks via Mistral mistral-embed (EU provider; several chunks per request)
 *   5. Upsert chunks + vectors into the document_chunks Supabase table
 *
 * Supports: PDF, plain text (.txt, .md)
 * Non-supported types are silently skipped (no error thrown).
 */

import * as pdfjsLib from 'pdfjs-dist';
import { ensureAthleteNamesLoaded, pseudonymizeText } from '@/utils/pseudonymize';
import { supabase } from '@/lib/supabase';

// ── pdfjs worker ──────────────────────────────────────────────────────────────
// Use the bundled worker via import.meta.url so Vite resolves it correctly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ── Config ────────────────────────────────────────────────────────────────────

/** Mistral's embedding model — 1024 dimensions (migration 20261008 sized the vector column to it) */
const EMBEDDING_MODEL = 'mistral-embed';
/** Chunks per embedding request (~400 words each — well within the request limit) */
const EMBED_BATCH = 8;
const CHUNK_SIZE = 400;    // target words per chunk
const CHUNK_OVERLAP = 50;  // words of overlap between consecutive chunks

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/ai-proxy`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ── Text extraction ───────────────────────────────────────────────────────────

/** Extract plain text from a PDF ArrayBuffer using pdfjs-dist. */
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n');
}

/** Fetch a file from Supabase Storage and extract its text content. */
async function extractTextFromStorageFile(
  storagePath: string,
  mimeType: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('documents')
    .download(storagePath);

  if (error || !data) {
    console.error('[ragPipeline] Storage download error:', error);
    return null;
  }

  const lower = mimeType.toLowerCase();

  if (lower === 'application/pdf' || storagePath.toLowerCase().endsWith('.pdf')) {
    const buffer = await data.arrayBuffer();
    return extractTextFromPDF(buffer);
  }

  if (
    lower.startsWith('text/') ||
    storagePath.toLowerCase().endsWith('.txt') ||
    storagePath.toLowerCase().endsWith('.md')
  ) {
    return data.text();
  }

  // Unsupported type — skip silently
  return null;
}

// ── Chunking ──────────────────────────────────────────────────────────────────

/**
 * Split text into overlapping word-based chunks.
 * Returns an empty array if the text is blank.
 */
export function chunkText(
  text: string,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) break;
    start += chunkSize - overlap;
  }

  return chunks;
}

// ── Embedding ─────────────────────────────────────────────────────────────────

/**
 * Embed several strings in one request via Mistral mistral-embed (proxied server-side, key never in
 * the browser). Retries with a growing pause when the rate limit is hit.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  // No athlete names to the embedding provider either
  await ensureAthleteNamesLoaded();

  const body = JSON.stringify({
    model: EMBEDDING_MODEL,
    input: texts.map(t => pseudonymizeText(t).slice(0, 8000)), // safety trim — model limit is 8k tokens
  });

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': ANON_KEY,
        'x-target': 'mistral-embed',
      },
      body,
    });

    if (response.status === 429 && attempt < 4) {
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Embedding proxy error ${response.status}: ${err}`);
    }

    const data = await response.json() as { data: Array<{ embedding: number[]; index?: number }> };
    return [...data.data]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map(d => d.embedding);
  }
}

/** Embed a single string (e.g. a search query) */
export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

/**
 * Re-embeds this coach's stored chunks that have no embedding yet — after the switch to Mistral
 * (migration 20261008 emptied the old OpenAI vectors; the chunk texts stayed). Chunks are
 * processed in small batches; returns how many were embedded. Safe to run again.
 */
export async function embedMissingChunks(userId: string): Promise<number> {
  let done = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('document_chunks')
      .select('id, content')
      .eq('user_id', userId)
      .is('embedding', null)
      .limit(EMBED_BATCH);
    if (error) throw new Error(`[ragPipeline] Reading chunks failed: ${error.message}`);
    const rows = (data ?? []) as Array<{ id: string; content: string }>;
    if (rows.length === 0) return done;
    const embeddings = await embedTexts(rows.map(r => r.content));
    for (let i = 0; i < rows.length; i++) {
      const { error: upErr } = await supabase
        .from('document_chunks')
        .update({ embedding: embeddings[i] })
        .eq('id', rows[i].id);
      if (upErr) throw new Error(`[ragPipeline] Saving embedding failed: ${upErr.message}`);
    }
    done += rows.length;
  }
}

// ── Supabase storage ──────────────────────────────────────────────────────────

/** Delete all existing chunks for a document (used before re-ingesting). */
async function deleteExistingChunks(documentId: string, userId: string): Promise<void> {
  await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId)
    .eq('user_id', userId);
}

/** Insert chunks with embeddings into document_chunks table. */
async function insertChunks(
  documentId: string,
  documentName: string,
  userId: string,
  chunks: string[],
  embeddings: number[][],
): Promise<void> {
  const rows = chunks.map((content, i) => ({
    user_id: userId,
    document_id: documentId,
    document_name: documentName,
    chunk_index: i,
    content,
    embedding: embeddings[i],
  }));

  const { error } = await supabase.from('document_chunks').insert(rows);
  if (error) throw new Error(`[ragPipeline] Insert error: ${error.message}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface IngestDocumentOptions {
  /** Supabase Storage path (e.g. "userId/folderId/file.pdf") */
  storagePath: string;
  /** Human-readable filename shown in citations */
  documentName: string;
  /** MIME type of the file */
  mimeType: string;
  /** Authenticated user ID */
  userId: string;
  /** Optional progress callback — called with 0–100 as ingestion proceeds */
  onProgress?: (pct: number) => void;
}

export type IngestResult =
  | { success: true; chunkCount: number }
  | { success: false; reason: 'unsupported_type' | 'extraction_failed' | 'error'; message?: string };

/**
 * Full ingestion pipeline for a single document.
 * Safe to call multiple times — existing chunks are replaced.
 */
export async function ingestDocument(opts: IngestDocumentOptions): Promise<IngestResult> {
  const { storagePath, documentName, mimeType, userId, onProgress } = opts;

  try {
    onProgress?.(5);

    // 1. Extract text
    const text = await extractTextFromStorageFile(storagePath, mimeType);
    if (text === null) return { success: false, reason: 'unsupported_type' };
    if (!text.trim()) return { success: false, reason: 'extraction_failed', message: 'No text found in document' };

    onProgress?.(25);

    // 2. Chunk
    const chunks = chunkText(text);
    if (chunks.length === 0) return { success: false, reason: 'extraction_failed', message: 'Document produced no chunks' };

    onProgress?.(35);

    // 3. Delete old chunks (re-ingest idempotency)
    await deleteExistingChunks(storagePath, userId);

    onProgress?.(40);

    // 4. Embed (with incremental progress)
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batchEmbeddings = await embedTexts(chunks.slice(i, i + EMBED_BATCH));
      embeddings.push(...batchEmbeddings);
      const pct = 40 + Math.round(((i + EMBED_BATCH) / chunks.length) * 50);
      onProgress?.(Math.min(pct, 90));
    }

    onProgress?.(92);

    // 5. Store
    await insertChunks(storagePath, documentName, userId, chunks, embeddings);

    onProgress?.(100);

    return { success: true, chunkCount: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ragPipeline] Ingestion failed:', message);
    return { success: false, reason: 'error', message };
  }
}

/** Check whether a document has already been ingested (has chunks in DB). */
export async function isDocumentIngested(storagePath: string, userId: string): Promise<boolean> {
  const { count } = await supabase
    .from('document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', storagePath)
    .eq('user_id', userId);

  return (count ?? 0) > 0;
}
