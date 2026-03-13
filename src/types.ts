export interface Prediction {
  id: string;
  userId: string;
  createdAt: string;
  matchName: string;
  date: string;
  sport: string;
  bestMarket: string;
  selection: string;
  bookmaker: string;
  odds: number;
  edgePercent: number;
  confidence: number;
  analysisText: string;
  userContext: string;
  status: 'pending' | 'won' | 'lost';
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
}
