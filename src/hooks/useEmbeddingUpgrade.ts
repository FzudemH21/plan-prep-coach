/**
 * useEmbeddingUpgrade — after the switch of document search to Mistral embeddings (migration
 * 20261008), re-embeds the coach's stored document chunks that have no vector yet, once per page
 * load, in the background. Nothing to do (and no API call) when every chunk has its vector.
 * Mounted in the coach layout. Failures are logged and retried on the next page load.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { embedMissingChunks } from '@/utils/ragPipeline';

export function useEmbeddingUpgrade() {
  const { user } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (!user || started.current) return;
    started.current = true;
    embedMissingChunks(user.id)
      .then(n => { if (n > 0) console.info(`[documents] ${n} document sections re-indexed for search (Mistral)`); })
      .catch(err => console.error('[documents] re-indexing for search failed — retried on next load', err));
  }, [user]);
}
