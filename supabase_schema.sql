-- SQL Script for Supabase (PostgreSQL)
-- This is provided for reference if you choose to use Supabase instead of Firebase.

CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  match_name TEXT NOT NULL,
  date DATE,
  sport TEXT,
  best_market TEXT,
  selection TEXT,
  bookmaker TEXT,
  odds DECIMAL,
  edge_percent DECIMAL,
  confidence INT CHECK (confidence >= 1 AND confidence <= 10),
  analysis_text TEXT,
  user_context TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost'))
);

-- RLS Policies
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own predictions"
  ON predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own predictions"
  ON predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
