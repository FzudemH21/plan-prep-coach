/**
 * useRAGRetrieval
 *
 * Retrieves the most semantically relevant document chunks from the
 * document_chunks Supabase table for a given query string.
 *
 * Usage:
 *   const { retrieve, isAvailable } = useRAGRetrieval();
 *   const ragContext = await retrieve("how should I structure sprint periodization?");
 *   // Pass ragContext to WizardAIAssistant as the ragContext prop
 *
 * isAvailable: false when the user is not authenticated — callers can use this to
 * conditionally show a "RAG active" badge.
 *
 * Embeddings: Mistral mistral-embed (see ragPipeline.embedTexts).
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { embedText } from '@/utils/ragPipeline';
import { useAuth } from '@/hooks/useAuth';

// ── Config ────────────────────────────────────────────────────────────────────

/**
 * Minimum cosine similarity score to include a chunk (0–1).
 * mistral-embed scores run high overall (unrelated text of the same language often lands well
 * above 0.5), so a fixed floor alone doesn't separate "relevant" from "same topic area". Two
 * filters: an absolute floor, and only chunks close to the best match (RELATIVE_WINDOW) — so a
 * clearly matching protocol doesn't get loosely related chunks from other documents mixed in
 * (e.g. patella tendon rehab bleeding into a hamstring tendinopathy answer).
 * Tuned by looking at the "[useRAGRetrieval] similarities" debug log on real questions.
 */
const MATCH_THRESHOLD = 0.6;
const RELATIVE_WINDOW = 0.12;

/** Maximum number of chunks to inject per query. */
const MATCH_COUNT = 15;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChunkRow {
  id: string;
  document_id: string;
  document_name: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRAGRetrieval() {
  const { user } = useAuth();

  const isAvailable = !!user;

  /**
   * Embed the query, run similarity search, and return a formatted string
   * ready to inject as `ragContext` into WizardAIAssistant.
   *
   * Returns an empty string if RAG is unavailable, no chunks match, or an
   * error occurs — so callers can always pass the result unconditionally.
   */
  const retrieve = useCallback(
    async (query: string): Promise<string> => {
      if (!isAvailable || !query.trim()) return '';

      try {
        // 1. Embed the query
        const queryEmbedding = await embedText(query);

        // 2. Similarity search via Supabase RPC
        const { data, error } = await supabase.rpc('match_document_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: MATCH_THRESHOLD,
          match_count: MATCH_COUNT,
          p_user_id: user!.id,
        });

        if (error) {
          console.error('[useRAGRetrieval] RPC error:', error);
          return '';
        }

        const matches = (data as ChunkRow[] | null) ?? [];
        if (matches.length === 0) return '';
        const best = Math.max(...matches.map(c => c.similarity));
        const chunks = matches.filter(c => c.similarity >= best - RELATIVE_WINDOW);
        console.debug('[useRAGRetrieval] similarities', matches.map(c => `${c.document_name} ${c.similarity.toFixed(3)}`), `kept ${chunks.length}`);

        // 3. Format chunks into an injectable string block. The "=== SOURCE DOCUMENT"
        // header is deliberately loud and repeated per chunk (even for consecutive
        // chunks from the same document) so document boundaries stay unmistakable
        // when several different protocols are retrieved for the same query.
        const formatted = chunks
          .map((chunk) => `=== SOURCE DOCUMENT: "${chunk.document_name}" ===\n${chunk.content}`)
          .join('\n\n---\n\n');

        return formatted;
      } catch (err) {
        console.error('[useRAGRetrieval] Retrieval failed:', err);
        return '';
      }
    },
    [isAvailable, user],
  );

  return { retrieve, isAvailable };
}
