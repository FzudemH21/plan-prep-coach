-- chat_messages: 1:1 coach↔athlete messaging tied to athlete_connections
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.athlete_connections(id) ON DELETE CASCADE,
  sender_role   TEXT NOT NULL CHECK (sender_role IN ('coach', 'athlete')),
  sender_auth_user_id UUID NOT NULL REFERENCES auth.users(id),
  content       TEXT NOT NULL,
  message_type  TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'exercise_comment')),
  -- For exercise_comment messages: JSON with { exerciseName, sectionName, sessionName, date }
  reference     JSONB,
  read_by_coach_at    TIMESTAMPTZ,
  read_by_athlete_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Coach: full access on their own connections
CREATE POLICY "coach_chat_all"
  ON public.chat_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_connections ac
      WHERE ac.id = chat_messages.connection_id
        AND ac.coach_user_id = auth.uid()
    )
  );

-- Athlete: read + insert on their own connection
CREATE POLICY "athlete_chat_select"
  ON public.chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_connections ac
      WHERE ac.id = chat_messages.connection_id
        AND ac.athlete_auth_user_id = auth.uid()
    )
  );

CREATE POLICY "athlete_chat_insert"
  ON public.chat_messages
  FOR INSERT
  WITH CHECK (
    sender_role = 'athlete'
    AND EXISTS (
      SELECT 1 FROM public.athlete_connections ac
      WHERE ac.id = chat_messages.connection_id
        AND ac.athlete_auth_user_id = auth.uid()
    )
  );

-- Athlete: update own rows to mark read
CREATE POLICY "athlete_chat_update"
  ON public.chat_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_connections ac
      WHERE ac.id = chat_messages.connection_id
        AND ac.athlete_auth_user_id = auth.uid()
    )
  );

-- Enable Realtime for live message delivery
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
