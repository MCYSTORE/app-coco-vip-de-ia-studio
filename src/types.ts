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
