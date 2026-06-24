/**
 * ragPipeline.ts
 *
 * Ingestion pipeline for RAG (Retrieval-Augmented Generation).
 *
 * Flow per document:
 *   1. Fetch file from Supabase Storage → base64 / arraybuffer
 *   2. Extract plain text (PDF → pdfjs-dist, plain text → direct)
 *   3. Chunk text into overlapping segments
 *   4. Embed each chunk via OpenAI text-embedding-3-small
 *   5. Upsert chunks + vectors into the document_chunks Supabase table
 *
 * Supports: PDF, plain text (.txt, .md)
 * Non-supported types are silently skipped (no error thrown).
 */

import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/lib/supabase';

// ── pdfjs worker ──────────────────────────────────────────────────────────────
// Use the bundled worker via import.meta.url so Vite resolves it correctly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ── Config ────────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = 'text-embedding-3-small';
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

/** Embed a single string via OpenAI text-embedding-3-small (proxied server-side). */
export async function embedText(text: string): Promise<number[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': ANON_KEY,
      'x-target': 'openai',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // safety trim — model supports up to 8192 tokens
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding proxy error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[] }>;
  };

  return data.data[0].embedding;
}

/** Embed multiple texts in parallel (batched to avoid rate limits). */
async function embedBatch(texts: string[], batchSize = 10): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map(embedText));
    results.push(...embeddings);
  }

  return results;
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
    const BATCH = 10;
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const batchEmbeddings = await Promise.all(batch.map(embedText));
      embeddings.push(...batchEmbeddings);
      const pct = 40 + Math.round(((i + BATCH) / chunks.length) * 50);
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
