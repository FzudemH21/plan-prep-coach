-- Add attachments column to athlete_anamneses
-- Stores an array of { name, type, mimeType, path, size } objects
-- Files are stored in the documents bucket under anamnesis/{coachUserId}/{athleteLocalId}/

ALTER TABLE athlete_anamneses
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';
