export interface OddOption {
  bookmaker: string;
  odds: number;
}

// xG Stats from Understat
export interface XGTeamStats {
  team: string;
  team_id: string;
  league: string;
  avg_xg: number;
  avg_xga: number;
  avg_home_xg: number;
  avg_away_xg: number;
  avg_home_xga: number;
  avg_away_xga: number;
  npxg: number;
  npxga: number;
  xg_last5: number[];
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_scored: number;
  goals_conceded: number;
  points: number;
  xg_performance: number;
  source: string;
  fetched_at: string;
}

export interface XGMatchStats {
  home: XGTeamStats;
  away: XGTeamStats;
  cached?: boolean;
}

export interface DebatePro {
  summary: string;
  details: string;
}

export interface DebateContra {
  summary: string;
  details: string;
}

export interface DebateConclusion {
  summary: string;
  recommendation: 'mantener' | 'evitar' | 'stake reducido';
  confidence_adjusted?: number;
}

export interface DebateResult {
  pro: DebatePro;
  contra: DebateContra;
  conclusion: DebateConclusion;
}

// V2 Pipeline Market Analysis Types
export interface MercadoResultado {
  seleccion: string;
  prob_estimada: number;
  prob_implicita_normalizada?: number;
  odds: number;
  edge_percentage: number;
  value_bet: boolean;
  confidence_score: number;
  analisis: string;
}

export interface MercadoTotal {
  xg_o_pts_estimado?: number;
  xg_estimado?: number;
  seleccion: 'over' | 'under';
  linea: number;
  odds: number | null;
  edge_percentage: number | null;
  value_bet: boolean;
  confidence_score: number;
  analisis: string;
}

export interface MercadoBTTS {
  aplica: boolean;
  seleccion: 'yes' | 'no';
  prob_btts_estimada: number;
  odds: number | null;
  edge_percentage: number | null;
  value_bet: boolean;
  confidence_score: number;
  analisis: string;
}

export interface MercadoCorners {
  aplica: boolean;
  total_estimado: number;
  tendencia: 'alta' | 'media' | 'baja';
  linea: number | null;
  seleccion: 'over' | 'under' | 'sin_cuota';
  odds: number | null;
  edge_percentage: number | null;
  value_bet: boolean;
  confidence_score: number;
  analisis: string;
}

export interface MercadoHandicap {
  aplica: boolean;
  linea: number | null;
  seleccion: 'home' | 'away' | null;
  odds: number | null;
  edge_percentage: number | null;
  value_bet: boolean;
  confidence_score: number;
  analisis: string;
}

export interface ProyeccionFinal {
  resultado_probable: string;
  marcador_estimado: string;
  rango_total: string;
  btts_probable: boolean;
  banker_double_viable: boolean;
  banker_double_cuota_minima: number | null;
  resumen: string;
  mejor_pick_resumen?: {
    market: string;
    selection: string;
    odds: number;
    edge_percentage: number;
    kelly_stake_units: number;
  };
}

export interface MercadosCompletos {
  resultado: MercadoResultado;
  total: MercadoTotal;
  ambos_anotan: MercadoBTTS;
  corners: MercadoCorners;
  handicap: MercadoHandicap;
  proyeccion_final: ProyeccionFinal;
}

export interface ValuePick {
  market: string;
  selection: string;
  odds: number;
  edge_percentage: number;
  confidence_score: number;
  tier: 'A+' | 'B';
}

export interface BestPickAnalysis {
  pros: string[];
  cons: string[];
  conclusion: string;
}

export interface StatsHighlights {
  metric_1: string;
  metric_2: string;
  metric_3: string;
}

export interface BestPick {
  market: string;
  selection: string;
  odds: number;
  edge_percentage: number;
  confidence_score: number;
  tier: 'A+' | 'B';
  kelly_stake_units: number;
  value_bet: boolean;
  analysis: BestPickAnalysis;
  stats_highlights?: StatsHighlights;
}

export interface Prediction {
  id: string;
  userId?: string;
  createdAt: string;
  matchName: string;
  date?: string;
  sport: string;
  bestMarket: string;
  selection: string;
  bookmaker: string;
  odds: number;
  edgePercent: number;
  confidence: number;
  analysisText: string;
  userContext?: string;
  status: 'pending' | 'won' | 'lost';
  league?: string;
  isLive?: boolean;
  hasRealStats?: boolean;
  // V2 Pipeline Fields
  dataQuality?: 'alta' | 'media' | 'baja';
  estimatedOdds?: boolean;
  kellyStake?: number;
  valueBet?: boolean;
  tier?: 'A+' | 'B';
  best_pick?: BestPick;
  mercados_completos?: MercadosCompletos;
  picks_con_value?: ValuePick[];
  researchContext?: string;
  oddsPayload?: any;
  fuentes_contexto?: string[];
  ajustes_aplicados?: string[];
  // Source tracking
  source?: 'manual' | 'daily_auto' | 'scanner';
  qualityTier?: 'A_PLUS' | 'B' | 'REJECTED';
  riskFactors?: string[];
  // Player Props Support
  pickType?: 'team' | 'player_prop';
  playerName?: string;
  playerTeam?: string;
  line?: number;
  // Odds Shopping
  allOdds?: OddOption[];
  bestBookmaker?: string;
  bestOdd?: number;
  // Line Movement
  openingOdd?: number;
  openingOddTimestamp?: string;
  currentOdd?: number;
  currentOddTimestamp?: string;
  lineMovementPercent?: number;
  lineMovementDirection?: 'up' | 'down' | 'stable';
  // Debate
  debate?: DebateResult;
  // xG Stats (football only)
  xgStats?: XGMatchStats;
  // V2 Pipeline Fields
  edge_detected?: boolean;
  quality_tier?: 'A_PLUS' | 'B' | 'REJECTED';
  implied_prob?: number;
  estimated_prob?: number;
  risk_factors?: string[];
  supporting_factors?: string[];
  recommendation?: 'apostar' | 'pasar' | 'reducir stake';
  valid?: boolean;
  reason?: string;
  autoContext?: string;
  dataQuality?: 'alta' | 'media' | 'baja';
  estimatedOdds?: boolean;
  kellyStake?: number;
  valueBet?: boolean;
  tier?: 'A+' | 'B';
  mercados_completos?: any;
  picks_con_value?: any[];
  fuentes_contexto?: string[];
  ajustes_aplicados?: string[];
}

// Helper function to find best odd from array
export function getBestOdd(oddsArray: OddOption[]): { bookmaker: string; odds: number } | null {
  if (!oddsArray || oddsArray.length === 0) return null;
  return oddsArray.reduce((best, current) => 
    current.odds > best.odds ? current : best
  , oddsArray[0]);
}

// Calculate extra edge percentage
export function calculateExtraEdge(bestOdd: number, baseOdd: number): number {
  if (!bestOdd || !baseOdd || bestOdd <= baseOdd) return 0;
  return ((bestOdd - baseOdd) / baseOdd) * 100;
}

// Calculate line movement percentage and direction
export function calculateLineMovement(currentOdd: number, openingOdd: number): { 
  percent: number; 
  direction: 'up' | 'down' | 'stable' 
} {
  if (!currentOdd || !openingOdd) {
    return { percent: 0, direction: 'stable' };
  }
  
  const percent = ((currentOdd - openingOdd) / openingOdd) * 100;
  
  if (Math.abs(percent) < 0.5) {
    return { percent: 0, direction: 'stable' };
  }
  
  return {
    percent: Math.round(percent * 100) / 100,
    direction: percent > 0 ? 'up' : 'down'
  };
}

// Kelly Criterion Calculator
export interface KellyResult {
  kellyFractionFull: number;      // Between 0 and 1 (or slightly above)
  kellyFractionHalf: number;      // Half Kelly for conservative approach
  stakeFull: number;              // Bankroll * kellyFractionFull
  stakeHalf: number;              // Bankroll * kellyFractionHalf
  hasPositiveEdge: boolean;       // True if Kelly > 0
  isHighRisk: boolean;            // True if Kelly > 25%
  warning?: string;               // Warning message if applicable
}

/**
 * Calculate Kelly Criterion stake recommendation
 * 
 * Formula: f* = (b * p - q) / b
 * Where:
 * - b = odds - 1 (net benefit per unit staked)
 * - p = estimated probability of winning
 * - q = 1 - p (probability of losing)
 * 
 * @param odds - Decimal odds (e.g., 2.00 for even money)
 * @param estimatedWinProb - Estimated probability of winning (0-1)
 * @param bankroll - Current bankroll in units
 * @returns KellyResult with fractions and stakes
 */
export function calculateKellyStake(
  odds: number,
  estimatedWinProb: number,
  bankroll: number
): KellyResult {
  // Validate inputs
  if (!odds || odds <= 1 || !estimatedWinProb || estimatedWinProb <= 0 || !bankroll || bankroll <= 0) {
    return {
      kellyFractionFull: 0,
      kellyFractionHalf: 0,
      stakeFull: 0,
      stakeHalf: 0,
      hasPositiveEdge: false,
      isHighRisk: false,
      warning: 'Datos insuficientes para calcular Kelly'
    };
  }

  // Kelly formula
  const b = odds - 1;                    // Net benefit per unit
  const p = Math.min(1, Math.max(0, estimatedWinProb));  // Clamp to 0-1
  const q = 1 - p;                       // Probability of losing
  
  // Kelly fraction: f* = (b*p - q) / b
  let kellyFractionFull = (b * p - q) / b;
  
  // If Kelly is negative, no bet recommended
  const hasPositiveEdge = kellyFractionFull > 0;
  
  if (!hasPositiveEdge) {
    return {
      kellyFractionFull: 0,
      kellyFractionHalf: 0,
      stakeFull: 0,
      stakeHalf: 0,
      hasPositiveEdge: false,
      isHighRisk: false,
      warning: 'Kelly sugiere no apostar: edge insuficiente o negativo'
    };
  }
  
  // Cap Kelly at 1 (100% of bankroll) - extremely rare but mathematically possible
  kellyFractionFull = Math.min(kellyFractionFull, 1);
  
  // Calculate half Kelly
  const kellyFractionHalf = kellyFractionFull / 2;
  
  // Calculate stakes
  const stakeFull = Math.round(bankroll * kellyFractionFull * 100) / 100;
  const stakeHalf = Math.round(bankroll * kellyFractionHalf * 100) / 100;
  
  // Check if high risk (Kelly > 25%)
  const isHighRisk = kellyFractionFull > 0.25;
  
  let warning: string | undefined;
  if (isHighRisk) {
    warning = 'Kelly sugiere apostar más del 25% del bankroll. Considera usar 1/2 Kelly o 1/4 Kelly para limitar el riesgo.';
  }
  
  return {
    kellyFractionFull: Math.round(kellyFractionFull * 1000) / 1000,  // 3 decimal places
    kellyFractionHalf: Math.round(kellyFractionHalf * 1000) / 1000,
    stakeFull,
    stakeHalf,
    hasPositiveEdge: true,
    isHighRisk,
    warning
  };
}

/**
 * Derive estimated win probability from edge percentage
 * 
 * Edge = (True Probability - Implied Probability) / Implied Probability
 * So: True Probability = Implied Probability * (1 + Edge)
 * 
 * @param odds - Decimal odds
 * @param edgePercent - Edge percentage (e.g., 10 for 10%)
 * @returns Estimated probability of winning (0-1)
 */
export function deriveWinProbabilityFromEdge(odds: number, edgePercent: number): number {
  if (!odds || odds <= 1) return 0;
  
  const impliedProb = 1 / odds;  // What the market implies
  const edge = edgePercent / 100;  // Convert to decimal
  
  // True probability = implied * (1 + edge)
  const trueProb = impliedProb * (1 + edge);
  
  // Clamp to valid range
  return Math.min(1, Math.max(0, trueProb));
}

// Bankroll storage key
export const BANKROLL_STORAGE_KEY = 'coco_vip_bankroll';
export const DEFAULT_BANKROLL = 100;

/**
 * Get bankroll from localStorage
 */
export function getBankroll(): number {
  try {
    const stored = localStorage.getItem(BANKROLL_STORAGE_KEY);
    if (stored) {
      const value = parseFloat(stored);
      return isNaN(value) || value <= 0 ? DEFAULT_BANKROLL : value;
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_BANKROLL;
}

/**
 * Save bankroll to localStorage
 */
export function saveBankroll(bankroll: number): void {
  try {
    localStorage.setItem(BANKROLL_STORAGE_KEY, bankroll.toString());
  } catch {
    // Ignore errors
  }
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
}

export interface UserStats {
  totalPredictions: number;
  won: number;
  lost: number;
  pending: number;
  winRate: number;
  roi: number;
  profit: number;
  avgOdds: number;
  bestStreak: number;
}

export interface LiveMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  sport: string;
  league: string;
  score?: {
    home: number;
    away: number;
  };
  status: string;
  date: string;
}
