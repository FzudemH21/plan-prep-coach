-- Document search (RAG): embeddings from Mistral mistral-embed (EU) instead of OpenAI.
--
-- mistral-embed vectors have 1024 dimensions (OpenAI's had 1536) and the two can't be compared,
-- so the old vectors are removed. The chunk texts stay: the app re-embeds every chunk without a
-- vector in the background after the next login (no re-upload of documents needed).
--
-- Run AFTER the MISTRAL_API_KEY secret is set and the ai-proxy edge function is deployed.

-- 1. Old vectors out, new 1024-dimension column in (texts, names, positions are kept)
drop index if exists public.document_chunks_embedding_idx;
alter table public.document_chunks drop column if exists embedding;
alter table public.document_chunks add column embedding vector(1024);

-- 2. Index for cosine-similarity search. HNSW works from the first row on (the old ivfflat index
--    was built on an empty table, which gives poor results).
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- 3. Similarity search for 1024-dimension queries (chunks still waiting for a vector are skipped)
drop function if exists public.match_document_chunks(vector, float, int, uuid);

create or replace function public.match_document_chunks(
  query_embedding  vector(1024),
  match_threshold  float,
  match_count      int,
  p_user_id        uuid
)
returns table (
  id            uuid,
  document_id   text,
  document_name text,
  chunk_index   int,
  content       text,
  similarity    float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.document_name,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where
    dc.user_id = p_user_id
    and dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
