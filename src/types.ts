export interface OddOption {
  bookmaker: string;
  odds: number;
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
  // Odds Shopping
  allOdds?: OddOption[];
  bestBookmaker?: string;
  bestOdd?: number;
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
