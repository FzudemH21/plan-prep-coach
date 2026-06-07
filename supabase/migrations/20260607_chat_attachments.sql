-- Add attachments column to chat_messages for media upload support
-- Stores an array of attachment metadata: [{ name, type, mimeType, path, size }]
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;

-- Allow empty string content so attachment-only messages work
-- (content TEXT NOT NULL already allows '' in PostgreSQL)
-- No constraint change needed.
