-- SQL Script for Supabase (PostgreSQL)
-- This is provided for reference if you choose to use Supabase instead of Firebase.
-- Updated to support Daily Auto Picks feature

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing table if needed (comment out for production)
-- DROP TABLE IF EXISTS predictions;

CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Match Information
  match_name TEXT NOT NULL,
  home_team TEXT,
  away_team TEXT,
  date DATE,
  kickoff TIMESTAMPTZ,
  
  -- Sport & League
  sport TEXT DEFAULT 'football',
  league TEXT,
  
  -- Prediction Details
  best_market TEXT,
  market TEXT,              -- Market type (1X2, Over/Under, etc.)
  selection TEXT,           -- The actual bet selection
  bookmaker TEXT,
  odds DECIMAL,
  
  -- Analysis Metrics
  estimated_prob DECIMAL,   -- Model's estimated probability
  implied_prob DECIMAL,     -- Market's implied probability
  edge_percent DECIMAL,     -- Edge percentage
  confidence INT CHECK (confidence >= 1 AND confidence <= 10),
  
  -- Quality Classification
  quality_tier TEXT CHECK (quality_tier IN ('A_PLUS', 'B', 'REJECTED')),
  
  -- Analysis Content
  analysis_text TEXT,
  risk_factors TEXT[],      -- Array of risk factors
  
  -- Additional Context
  user_context TEXT,
  is_official BOOLEAN DEFAULT FALSE,
  
  -- Status Tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'void')),
  
  -- Source Tracking (NEW)
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'daily_auto', 'scanner')),
  
  -- Odds Shopping (Optional)
  all_odds JSONB,           -- Array of {bookmaker, odds} objects
  best_bookmaker TEXT,
  best_odd DECIMAL,
  
  -- Line Movement (Optional)
  opening_odd DECIMAL,
  opening_odd_timestamp TIMESTAMPTZ,
  current_odd DECIMAL,
  current_odd_timestamp TIMESTAMPTZ,
  line_movement_percent DECIMAL,
  line_movement_direction TEXT CHECK (line_movement_direction IN ('up', 'down', 'stable')),
  
  -- Results Tracking
  result_home_score INT,
  result_away_score INT,
  result_notes TEXT,
  settled_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_predictions_date ON predictions(date);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_source ON predictions(source);
CREATE INDEX IF NOT EXISTS idx_predictions_quality_tier ON predictions(quality_tier);
CREATE INDEX IF NOT EXISTS idx_predictions_sport ON predictions(sport);
CREATE INDEX IF NOT EXISTS idx_predictions_league ON predictions(league);

-- RLS Policies
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own predictions
CREATE POLICY "Users can view their own predictions"
  ON predictions FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own predictions
CREATE POLICY "Users can insert their own predictions"
  ON predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own predictions
CREATE POLICY "Users can update their own predictions"
  ON predictions FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all predictions (for daily auto picks)
CREATE POLICY "Service role can manage all predictions"
  ON predictions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- API Request Counter Table (for tracking daily limits)
-- =====================================================

CREATE TABLE IF NOT EXISTS api_request_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  requests_used INT DEFAULT 0,
  max_requests INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick date lookup
CREATE INDEX IF NOT EXISTS idx_api_counters_date ON api_request_counters(date);

-- =====================================================
-- Standings Cache Table (24h TTL)
-- =====================================================

CREATE TABLE IF NOT EXISTS standings_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id INT NOT NULL,
  season INT NOT NULL,
  standings_data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  UNIQUE(league_id, season)
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_standings_cache_lookup ON standings_cache(league_id, season);
CREATE INDEX IF NOT EXISTS idx_standings_cache_expires ON standings_cache(expires_at);

-- =====================================================
-- Daily Picks History Table
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_picks_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  picks_generated INT DEFAULT 0,
  picks JSONB NOT NULL DEFAULT '[]',
  api_requests_used INT DEFAULT 0,
  execution_time_ms INT DEFAULT 0,
  picks_insuficientes BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date)
);

-- Index for date lookups
CREATE INDEX IF NOT EXISTS idx_daily_picks_date ON daily_picks_history(date);

-- =====================================================
-- Discarded Picks Log Table (FIX 5: Transparency)
-- =====================================================

CREATE TABLE IF NOT EXISTS picks_discarded (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  match_name TEXT NOT NULL,
  league TEXT,
  league_id INT,
  reason TEXT NOT NULL CHECK (reason IN (
    'liga_no_permitida',
    'partido_femenino',
    'datos_insuficientes',
    'confianza_baja',
    'ev_insuficiente',
    'sin_value_bet'
  )),
  confidence_llm DECIMAL,
  ev_llm DECIMAL,
  data_blocks_available INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for discarded picks analysis
CREATE INDEX IF NOT EXISTS idx_discarded_date ON picks_discarded(date);
CREATE INDEX IF NOT EXISTS idx_discarded_reason ON picks_discarded(reason);
CREATE INDEX IF NOT EXISTS idx_discarded_league ON picks_discarded(league_id);

-- View for discard analysis
CREATE OR REPLACE VIEW discard_analysis AS
SELECT 
  reason,
  COUNT(*) as total_discarded,
  COUNT(*) FILTER (WHERE date = CURRENT_DATE) as discarded_today,
  ROUND(AVG(confidence_llm), 2) as avg_confidence,
  ROUND(AVG(ev_llm), 3) as avg_ev
FROM picks_discarded
GROUP BY reason
ORDER BY total_discarded DESC;

-- =====================================================
-- Useful Views
-- =====================================================

-- View for today's picks
CREATE OR REPLACE VIEW today_picks AS
SELECT * FROM predictions
WHERE date = CURRENT_DATE
  AND status = 'pending'
ORDER BY 
  CASE quality_tier 
    WHEN 'A_PLUS' THEN 1 
    WHEN 'B' THEN 2 
    ELSE 3 
  END,
  confidence DESC,
  edge_percent DESC;

-- View for picks by source
CREATE OR REPLACE VIEW picks_by_source AS
SELECT 
  source,
  COUNT(*) as total_picks,
  COUNT(*) FILTER (WHERE status = 'won') as won,
  COUNT(*) FILTER (WHERE status = 'lost') as lost,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'won') / 
    NULLIF(COUNT(*) FILTER (WHERE status IN ('won', 'lost')), 0),
    1
  ) as win_rate
FROM predictions
GROUP BY source;

-- =====================================================
-- Functions
-- =====================================================

-- Function to increment API counter
CREATE OR REPLACE FUNCTION increment_api_counter(p_date DATE DEFAULT CURRENT_DATE)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO api_request_counters (date, requests_used)
  VALUES (p_date, 1)
  ON CONFLICT (date) 
  DO UPDATE SET 
    requests_used = api_request_counters.requests_used + 1,
    updated_at = NOW()
  RETURNING requests_used INTO v_count;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get remaining API requests
CREATE OR REPLACE FUNCTION get_remaining_api_requests(p_date DATE DEFAULT CURRENT_DATE)
RETURNS INT AS $$
DECLARE
  v_used INT;
  v_max INT := 100;
BEGIN
  SELECT requests_used INTO v_used
  FROM api_request_counters
  WHERE date = p_date;
  
  RETURN v_max - COALESCE(v_used, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired standings cache
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM standings_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Sample Data (for testing)
-- =====================================================

-- Insert a sample prediction
-- INSERT INTO predictions (
--   match_name, home_team, away_team, date, sport, league,
--   best_market, selection, bookmaker, odds,
--   estimated_prob, implied_prob, edge_percent, confidence,
--   quality_tier, analysis_text, source
-- ) VALUES (
--   'Arsenal vs Chelsea', 'Arsenal', 'Chelsea', CURRENT_DATE, 'football', 'Premier League',
--   'Over/Under 2.5', 'Over 2.5', 'Bet365', 1.95,
--   0.58, 0.513, 13.0, 8,
--   'A_PLUS', 'Ambos equipos con alto promedio de goles. Arsenal promedia 2.1 xG en casa.', 'daily_auto'
-- );
