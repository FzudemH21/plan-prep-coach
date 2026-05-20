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
 * isAvailable: false when the OpenAI key is not configured or the user is not
 * authenticated — callers can use this to conditionally show a "RAG active" badge.
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { embedText } from '@/utils/ragPipeline';
import { useAuth } from '@/hooks/useAuth';

// ── Config ────────────────────────────────────────────────────────────────────

/** Minimum cosine similarity score to include a chunk (0–1). */
const MATCH_THRESHOLD = 0.35;

/** Maximum number of chunks to inject per query. */
const MATCH_COUNT = 5;

/** Maximum characters per chunk in the formatted output. */
const MAX_CHUNK_CHARS = 600;

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

  const isAvailable =
    !!user &&
    !!(import.meta.env.VITE_OPENAI_API_KEY as string | undefined);

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

        const chunks = (data as ChunkRow[] | null) ?? [];
        if (chunks.length === 0) return '';

        // 3. Format chunks into an injectable string block
        // Deduplicate by document so each source appears grouped
        const formatted = chunks
          .map((chunk) => {
            const preview = chunk.content.length > MAX_CHUNK_CHARS
              ? chunk.content.slice(0, MAX_CHUNK_CHARS) + '…'
              : chunk.content;
            return `Source: ${chunk.document_name}\n${preview}`;
          })
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
