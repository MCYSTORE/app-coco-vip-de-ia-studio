/**
 * Daily Picks Auto-Generation Configuration
 * 
 * This configuration controls the automatic generation of high-quality
 * football picks daily using API-FOOTBALL and OpenRouter (DeepSeek).
 * 
 * QUALITY OVER QUANTITY: Maximum 3 picks per day, strict criteria.
 */

export const DAILY_PICKS_CONFIG = {
  // Maximum picks to generate per day (reduced from 5 to 3 for quality)
  MAX_PICKS_PER_DAY: 3,

  // Daily execution time in UTC (24h format)
  RUN_TIME_UTC: "09:00",

  // API-FOOTBALL Free plan limit (requests per day)
  MAX_API_REQUESTS: 100,

  // STRICT WHITELIST: Only these leagues are allowed (MEN'S FOOTBALL ONLY)
  // Any match from a league NOT in this list will be DISCARDED immediately
  ALLOWED_LEAGUES: [
    // TOP 5 EUROPEAN LEAGUES
    { id: 39, name: "Premier League", country: "England", tier: 1 },
    { id: 140, name: "La Liga", country: "Spain", tier: 1 },
    { id: 135, name: "Serie A", country: "Italy", tier: 1 },
    { id: 78, name: "Bundesliga", country: "Germany", tier: 1 },
    { id: 61, name: "Ligue 1", country: "France", tier: 1 },
    // EUROPEAN COMPETITIONS
    { id: 2, name: "UEFA Champions League", country: "Europe", tier: 1 },
    { id: 3, name: "UEFA Europa League", country: "Europe", tier: 1 },
    { id: 848, name: "UEFA Conference League", country: "Europe", tier: 2 },
    // SOUTH AMERICAN TOP LEAGUES
    { id: 71, name: "Brasileirao Serie A", country: "Brazil", tier: 2 },
    { id: 128, name: "Liga Profesional", country: "Argentina", tier: 2 }
  ] as const,

  // Quick lookup set for league validation
  get ALLOWED_LEAGUE_IDS(): number[] {
    return this.ALLOWED_LEAGUES.map(l => l.id);
  },

  // Maximum matches to analyze with LLM (pre-filtered from all fixtures)
  CANDIDATE_LIMIT: 15,

  // Minimum confidence threshold (0-1 scale) - RAISED to 0.65
  MIN_CONFIDENCE: 0.65,

  // Minimum expected value (4% = 0.04)
  MIN_EV: 0.04,

  // LLM Model to use via OpenRouter
  LLM_MODEL: "deepseek/deepseek-chat",

  // API request budget breakdown
  REQUESTS_BUDGET: {
    // Per match detailed analysis (5 requests each)
    PER_MATCH: 5,
    // Standings cache (1 per league, cached 24h)
    STANDINGS_PER_LEAGUE: 1,
    // Safety margin
    SAFETY_MARGIN: 10
  },

  // Cache TTL in milliseconds (24 hours)
  STANDINGS_CACHE_TTL: 24 * 60 * 60 * 1000,

  // Quality tier thresholds - RAISED thresholds
  QUALITY_TIERS: {
    A_PLUS: { min_ev: 0.08, min_confidence: 0.80 },
    B: { min_ev: 0.04, min_confidence: 0.65 }
  },

  // Bookmakers for odds (Bet365 = bookmaker ID 8)
  DEFAULT_BOOKMAKER_ID: 8,
  BET_TYPE_1X2: 1,

  // Minimum data blocks required before calling LLM (out of 6)
  MIN_DATA_BLOCKS_REQUIRED: 4,

  // Minimum matches for form data
  MIN_FORM_MATCHES: 3,

  // Minimum H2H matches
  MIN_H2H_MATCHES: 0 // Can still analyze without H2H, but should mention in analysis
} as const;

// Discard reasons for logging
export enum DiscardReason {
  LEAGUE_NOT_ALLOWED = "liga_no_permitida",
  FEMALE_FOOTBALL = "partido_femenino",
  INSUFFICIENT_DATA = "datos_insuficientes",
  LOW_CONFIDENCE = "confianza_baja",
  LOW_EV = "ev_insuficiente",
  NO_VALUE = "sin_value_bet"
}

// Type exports
export interface LeagueConfig {
  id: number;
  name: string;
  country: string;
  tier: number;
}

export interface MatchCandidate {
  fixture_id: number;
  league: LeagueConfig;
  home: {
    id: number;
    name: string;
    logo?: string;
  };
  away: {
    id: number;
    name: string;
    logo?: string;
  };
  kickoff_utc: string;
  interest_score: number;
  is_female?: boolean;
}

export interface TableStats {
  position: number;
  points: number;
  goals_for: number;
  goals_against: number;
  form?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
}

export interface RecentForm {
  last5: string;
  goals_for: number;
  goals_against: number;
  matches_count: number;
  home_record?: string;
  away_record?: string;
}

export interface H2HResult {
  date: string;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
}

export interface EnrichedMatch {
  league: LeagueConfig;
  match: {
    home: { id: number; name: string };
    away: { id: number; name: string };
    kickoff_utc: string;
    fixture_id: number;
  };
  table_stats: {
    home: TableStats | null;
    away: TableStats | null;
  };
  recent_form: {
    home: RecentForm | null;
    away: RecentForm | null;
  };
  h2h: {
    results: H2HResult[];
    avg_goals: number;
  };
  odds: {
    '1': number;
    'X': number;
    '2': number;
  } | null;
  implied_probs: {
    '1': number;
    'X': number;
    '2': number;
  } | null;
  api_prediction?: {
    winner: string;
    under_over?: string;
    advice?: string;
  } | null;
  data_quality_score: number; // 0-6 blocks with data
}

export interface LLMPickResult {
  pick: {
    market: '1X2' | 'over_under';
    selection: '1' | 'X' | '2' | 'over' | 'under';
    estimated_prob: number;
    bookmaker_odds: number;
    expected_value: number;
    value_bet: boolean;
  };
  analysis: string;
  confidence: number;
  risk_factors: string[];
  no_value_reason: string | null;
}

export interface FinalPick {
  fixture_id: number;
  league: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  market: string;
  selection: string;
  odds: number;
  estimated_prob: number;
  implied_prob: number;
  edge_percent: number;
  confidence: number;
  quality_tier: 'A_PLUS' | 'B';
  analysis: string;
  risk_factors: string[];
  source: 'daily_auto';
}

export interface DiscardedPick {
  id?: string;
  date: string;
  match_name: string;
  league: string;
  league_id: number;
  reason: DiscardReason;
  confidence_llm?: number;
  ev_llm?: number;
  data_blocks_available?: number;
  created_at?: string;
}

export interface DailyPicksResponse {
  date: string;
  picks_generated: number;
  picks: FinalPick[];
  discarded_count: number;
  api_requests_used: number;
  execution_time_ms: number;
  message?: string; // For "no quality picks today" message
}

export default DAILY_PICKS_CONFIG;
