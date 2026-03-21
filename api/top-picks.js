/**
 * Top Picks API - Fetches picks from Google Sheets
 * 
 * GET /api/top-picks
 * Returns the best picks stored in Google Sheets
 */

import { fetchFromCache, parseCacheEntry } from './google-sheets.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('📊 Fetching top picks from Google Sheets...');

  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch from Google Sheets cache
    const cachedEntries = await fetchFromCache({ date: today });
    
    if (cachedEntries && cachedEntries.length > 0) {
      // Parse and format picks
      const picks = cachedEntries.map(entry => {
        const parsed = parseCacheEntry(entry);
        return {
          id: parsed.id || `pick-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          matchName: parsed.matchName,
          sport: parsed.sport || 'Football',
          bestMarket: parsed.market || 'Análisis',
          selection: parsed.selection || '',
          bookmaker: parsed.bookmaker || 'General',
          odds: parsed.odds || 1.85,
          edgePercent: Math.round((1 / parsed.odds - 0.5) * 100) / 10 || 5.0,
          confidence: 7,
          analysisText: `Pick desde Google Sheets - ${parsed.market}`,
          status: 'pending',
          createdAt: parsed.lastUpdated || new Date().toISOString(),
          league: parsed.league || '',
          isLive: false
        };
      });

      console.log(`✅ Found ${picks.length} picks in Google Sheets`);
      return res.json(picks);
    }

    // No picks in Google Sheets - return empty array
    console.log('⚠️ No picks found in Google Sheets for today');
    return res.json([]);

  } catch (error) {
    console.error('❌ Error fetching top picks:', error);
    
    // Return empty array on error - don't break the UI
    return res.json([]);
  }
}
