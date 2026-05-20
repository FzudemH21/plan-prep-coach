-- RAG: document chunks with pgvector
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Enable the pgvector extension
create extension if not exists vector;

-- 2. Document chunks table
create table if not exists document_chunks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  document_id   text not null,        -- Supabase Storage object key (path)
  document_name text not null,        -- Human-readable filename
  chunk_index   int  not null,        -- Position of this chunk within the document
  content       text not null,        -- Raw chunk text
  embedding     vector(1536),         -- OpenAI text-embedding-3-small dimensions
  metadata      jsonb,                -- Optional: page number, section, etc.
  created_at    timestamptz default now()
);

-- 3. Index for fast cosine-similarity search
create index if not exists document_chunks_embedding_idx
  on document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 4. Index for fast per-user + per-document lookups
create index if not exists document_chunks_user_doc_idx
  on document_chunks (user_id, document_id);

-- 5. RLS
alter table document_chunks enable row level security;

create policy "Users can manage their own chunks"
  on document_chunks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. Similarity search RPC function
-- Returns the top `match_count` chunks whose embedding is closest to `query_embedding`
create or replace function match_document_chunks(
  query_embedding  vector(1536),
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
  from document_chunks dc
  where
    dc.user_id = p_user_id
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
