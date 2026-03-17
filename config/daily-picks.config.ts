/**
 * Daily Picks Auto-Generation Configuration
 * 
 * This configuration controls the automatic generation of 5 high-quality
 * football picks daily using API-FOOTBALL and OpenRouter (DeepSeek).
 */

export const DAILY_PICKS_CONFIG = {
  // Maximum picks to generate per day
  MAX_PICKS_PER_DAY: 5,

  // Daily execution time in UTC (24h format)
  RUN_TIME_UTC: "09:00",

  // API-FOOTBALL Free plan limit (requests per day)
  MAX_API_REQUESTS: 100,

  // Active leagues with API-FOOTBALL IDs
  LEAGUES: [
    { id: 39, name: "Premier League", country: "England" },
    { id: 140, name: "La Liga", country: "Spain" },
    { id: 135, name: "Serie A", country: "Italy" },
    { id: 78, name: "Bundesliga", country: "Germany" },
    { id: 61, name: "Ligue 1", country: "France" }
  ],

  // Maximum matches to analyze with LLM (pre-filtered from all fixtures)
  CANDIDATE_LIMIT: 15,

  // Minimum confidence threshold (0-1 scale) to include a pick
  MIN_CONFIDENCE: 0.60,

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

  // Quality tier thresholds
  QUALITY_TIERS: {
    A_PLUS: { min_ev: 0.07, min_confidence: 0.75 },
    B: { min_ev: 0.04, min_confidence: 0.60 }
  },

  // Bookmakers for odds (Bet365 = bookmaker ID 8)
  DEFAULT_BOOKMAKER_ID: 8,
  BET_TYPE_1X2: 1
} as const;

// Type exports
export interface LeagueConfig {
  id: number;
  name: string;
  country: string;
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
    home: TableStats;
    away: TableStats;
  };
  recent_form: {
    home: RecentForm;
    away: RecentForm;
  };
  h2h: {
    results: H2HResult[];
    avg_goals: number;
  };
  odds: {
    '1': number;
    'X': number;
    '2': number;
  };
  implied_probs: {
    '1': number;
    'X': number;
    '2': number;
  };
  api_prediction?: {
    winner: string;
    under_over?: string;
    advice?: string;
  };
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

export interface DailyPicksResponse {
  date: string;
  picks_generated: number;
  picks: FinalPick[];
  api_requests_used: number;
  execution_time_ms: number;
  picks_insuficientes?: boolean;
}

export default DAILY_PICKS_CONFIG;
