/**
 * Google Sheets Cache Service
 * Handles reading/writing cached sports data to Google Sheets
 */

const GOOGLE_SHEETS_URL = process.env.GOOGLE_SHEETS_URL;

/**
 * Fetch cached data from Google Sheets
 * @param {Object} options - Query options
 * @param {string} options.date - Date to filter (YYYY-MM-DD)
 * @param {string} options.sport - Sport to filter (football/basketball/baseball)
 * @param {string} options.match_id - Specific match ID
 * @returns {Promise<Array>} Array of cached entries
 */
export async function fetchFromCache(options = {}) {
  if (!GOOGLE_SHEETS_URL) {
    console.log("No GOOGLE_SHEETS_URL configured");
    return [];
  }

  try {
    const params = new URLSearchParams();
    params.append('action', 'getCache');
    if (options.date) params.append('date', options.date);
    if (options.sport) params.append('sport', options.sport);
    if (options.match_id) params.append('match_id', options.match_id);

    const url = `${GOOGLE_SHEETS_URL}?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    const text = await response.text();
    
    try {
      const data = JSON.parse(text);
      return data.results || [];
    } catch {
      console.error("Google Sheets response not JSON:", text.substring(0, 200));
      return [];
    }
  } catch (error) {
    console.error("Error fetching from cache:", error);
    return [];
  }
}

/**
 * Write cached data to Google Sheets
 * @param {Array} entries - Array of cache entries to write
 * @returns {Promise<Object>} Result of write operation
 */
export async function writeToCache(entries) {
  if (!GOOGLE_SHEETS_URL || !entries || entries.length === 0) {
    return { success: false, reason: 'No URL or no entries' };
  }

  try {
    const encodedData = encodeURIComponent(JSON.stringify(entries));
    const url = `${GOOGLE_SHEETS_URL}?action=writeCache&data=${encodedData}`;
    
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    const text = await response.text();
    
    try {
      const data = JSON.parse(text);
      console.log("Cache write response:", data);
      return data;
    } catch {
      console.error("Cache write response not JSON:", text.substring(0, 200));
      return { success: false, error: 'Invalid response' };
    }
  } catch (error) {
    console.error("Error writing to cache:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get cache metadata (last update time, entry counts)
 * @returns {Promise<Object>} Cache metadata
 */
export async function getCacheMetadata() {
  if (!GOOGLE_SHEETS_URL) {
    return { hasCache: false };
  }

  try {
    const url = `${GOOGLE_SHEETS_URL}?action=getMetadata`;
    
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    const text = await response.text();
    
    try {
      const data = JSON.parse(text);
      return {
        hasCache: true,
        lastUpdated: data.last_updated || null,
        totalEntries: data.total_entries || 0,
        todayEntries: data.today_entries || 0,
        sportsBreakdown: data.sports_breakdown || {}
      };
    } catch {
      return { hasCache: false };
    }
  } catch (error) {
    console.error("Error getting cache metadata:", error);
    return { hasCache: false, error: error.message };
  }
}

/**
 * Clear old cache entries (before specified date)
 * @param {string} beforeDate - Clear entries before this date (YYYY-MM-DD)
 * @returns {Promise<Object>} Result of clear operation
 */
export async function clearOldCache(beforeDate) {
  if (!GOOGLE_SHEETS_URL) {
    return { success: false, reason: 'No URL configured' };
  }

  try {
    const url = `${GOOGLE_SHEETS_URL}?action=clearOldCache&before_date=${beforeDate}`;
    
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    const text = await response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: 'Invalid response' };
    }
  } catch (error) {
    console.error("Error clearing old cache:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Format a cache entry for storage
 */
export function formatCacheEntry(data) {
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  
  return {
    date: data.date || today,
    sport: data.sport || 'football',
    league: data.league || '',
    match_id: data.match_id || data.id || `match-${Date.now()}`,
    home_team: data.home_team || data.homeTeam || '',
    away_team: data.away_team || data.awayTeam || '',
    kickoff: data.kickoff || data.date || now,
    market_type: data.market_type || data.market || data.bestMarket || '',
    selection: data.selection || '',
    bookmaker: data.bookmaker || '',
    odds: data.odds || 0,
    implied_prob: data.implied_prob || (data.odds ? 1 / data.odds : 0),
    stats_json: typeof data.stats_json === 'object' ? JSON.stringify(data.stats_json) : (data.stats_json || ''),
    last_updated: now
  };
}

/**
 * Parse a cached entry back to usable format
 */
export function parseCacheEntry(entry) {
  let statsJson = {};
  try {
    if (entry.stats_json) {
      statsJson = typeof entry.stats_json === 'string' 
        ? JSON.parse(entry.stats_json) 
        : entry.stats_json;
    }
  } catch {
    statsJson = {};
  }

  return {
    id: entry.match_id,
    matchName: `${entry.home_team} vs ${entry.away_team}`,
    homeTeam: entry.home_team,
    awayTeam: entry.away_team,
    sport: entry.sport,
    league: entry.league,
    date: entry.date,
    kickoff: entry.kickoff,
    market: entry.market_type,
    selection: entry.selection,
    bookmaker: entry.bookmaker,
    odds: entry.odds,
    implied_prob: entry.implied_prob,
    stats: statsJson,
    lastUpdated: entry.last_updated
  };
}
