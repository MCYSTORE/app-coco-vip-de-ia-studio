/**
 * xG Scraper for Understat
 * Fetches Expected Goals data for football teams
 * 
 * GET /api/xg-scraper?league=Premier-League&team=Arsenal
 * 
 * Leagues supported:
 * - Premier-League (EPL)
 * - La_liga
 * - Serie-A
 * - Bundesliga
 * - Ligue_1
 * - RFPL (Russian Premier League)
 */

const CACHE_DURATION_HOURS = 24;

// In-memory cache for xG data
const xgCache = new Map();

/**
 * Get cached xG data if still valid
 */
function getCachedData(key) {
  const cached = xgCache.get(key);
  if (!cached) return null;

  const now = Date.now();
  const cacheAge = now - cached.timestamp;
  const maxAge = CACHE_DURATION_HOURS * 60 * 60 * 1000;

  if (cacheAge > maxAge) {
    xgCache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Set cache entry
 */
function setCache(key, data) {
  xgCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * League ID mapping for Understat
 */
const LEAGUE_IDS = {
  'Premier-League': 'EPL',
  'EPL': 'EPL',
  'La_liga': 'La_liga',
  'La-Liga': 'La_liga',
  'Serie-A': 'Serie_A',
  'Serie_A': 'Serie_A',
  'Bundesliga': 'Bundesliga',
  'Ligue_1': 'Ligue_1',
  'Ligue-1': 'Ligue_1',
  'RFPL': 'RFPL'
};

/**
 * Parse Understat's JavaScript data format
 * The site embeds data like: var datesData = JSON.parse('...');
 */
function parseUnderstatJS(jsString, varName) {
  try {
    // Pattern: var varName = JSON.parse('escaped-json');
    const regex = new RegExp(`var\\s+${varName}\\s*=\\s*JSON\\.parse\\s*\\(\\s*['"]([^'"]+)['"]\\s*\\)`);
    const match = jsString.match(regex);
    
    if (match && match[1]) {
      // Unescape the JSON string
      let escapedJson = match[1];
      // Handle escape sequences
      escapedJson = escapedJson
        .replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      
      return JSON.parse(escapedJson);
    }
    return null;
  } catch (error) {
    console.error(`Error parsing ${varName}:`, error.message);
    return null;
  }
}

/**
 * Fetch team data from Understat
 */
async function fetchTeamData(league, teamName) {
  const leagueId = LEAGUE_IDS[league];
  if (!leagueId) {
    throw new Error(`League not supported: ${league}. Supported: ${Object.keys(LEAGUE_IDS).join(', ')}`);
  }

  const url = `https://understat.com/league/${leagueId}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Understat returned ${response.status}`);
    }

    const html = await response.text();

    // Parse teams data
    const teamsData = parseUnderstatJS(html, 'teamsData');
    
    if (!teamsData) {
      throw new Error('Could not parse teams data from Understat');
    }

    // Find the team by name (case-insensitive, partial match)
    const teamNameLower = teamName.toLowerCase().trim();
    let foundTeam = null;
    let foundTeamId = null;

    for (const [id, team] of Object.entries(teamsData)) {
      const teamTitle = (team.title || team.name || '').toLowerCase();
      if (teamTitle.includes(teamNameLower) || teamNameLower.includes(teamTitle)) {
        foundTeam = team;
        foundTeamId = id;
        break;
      }
    }

    if (!foundTeam) {
      // Try to find by common name variations
      const nameVariations = {
        'manchester united': ['man utd', 'manchester united', 'man united'],
        'manchester city': ['man city', 'manchester city'],
        'tottenham': ['tottenham', 'spurs', 'tottenham hotspur'],
        'arsenal': ['arsenal'],
        'chelsea': ['chelsea'],
        'liverpool': ['liverpool'],
        'real madrid': ['real madrid', 'real'],
        'barcelona': ['barcelona', 'barca'],
        'atletico madrid': ['atletico', 'atletico madrid'],
        'bayern munich': ['bayern', 'bayern munich'],
        'borussia dortmund': ['dortmund', 'borussia dortmund', 'bvb'],
        'juventus': ['juventus', 'juve'],
        'ac milan': ['milan', 'ac milan'],
        'inter milan': ['inter', 'inter milan'],
        'napoli': ['napoli'],
        'psg': ['psg', 'paris saint-germain', 'paris']
      };

      for (const [standardName, variations] of Object.entries(nameVariations)) {
        if (variations.some(v => teamNameLower.includes(v) || v.includes(teamNameLower))) {
          for (const [id, team] of Object.entries(teamsData)) {
            const teamTitle = (team.title || team.name || '').toLowerCase();
            if (variations.some(v => teamTitle.includes(v))) {
              foundTeam = team;
              foundTeamId = id;
              break;
            }
          }
          if (foundTeam) break;
        }
      }
    }

    if (!foundTeam) {
      // Return available teams for debugging
      const availableTeams = Object.values(teamsData).map(t => t.title || t.name).slice(0, 20);
      throw new Error(`Team "${teamName}" not found. Available teams: ${availableTeams.join(', ')}`);
    }

    // Parse matches data for xG calculations
    const matchesData = parseUnderstatJS(html, 'datesData');
    
    // Calculate xG stats from matches
    const xGStats = calculateXGStats(foundTeam, foundTeamId, matchesData, teamsData);

    return {
      team: foundTeam.title || foundTeam.name,
      team_id: foundTeamId,
      league: league,
      ...xGStats,
      source: 'Understat',
      fetched_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('Understat fetch error:', error.message);
    throw error;
  }
}

/**
 * Calculate xG statistics from matches data
 */
function calculateXGStats(team, teamId, matchesData, teamsData) {
  const teamName = (team.title || team.name || '').toLowerCase();
  
  // Get last 5-10 matches for the team
  const teamMatches = [];
  
  if (matchesData && Array.isArray(matchesData)) {
    for (const match of matchesData) {
      const homeTeam = (match.home || match.h || '').toLowerCase();
      const awayTeam = (match.away || match.a || '').toLowerCase();
      
      if (homeTeam.includes(teamName) || awayTeam.includes(teamName) ||
          teamName.includes(homeTeam) || teamName.includes(awayTeam)) {
        teamMatches.push(match);
      }
      
      if (teamMatches.length >= 10) break;
    }
  }

  // Calculate stats from matches
  const homeXG = [];
  const awayXG = [];
  const homeXGA = [];
  const awayXGA = [];
  const xGForm = [];

  for (const match of teamMatches.slice(0, 5)) {
    const homeTeam = (match.home || match.h || '').toLowerCase();
    const isHome = homeTeam.includes(teamName) || teamName.includes(homeTeam);
    
    const matchXG = parseFloat(match.xG || match.xg || match.home_xG) || 0;
    const matchXGA = parseFloat(match.xGA || match.xga || match.away_xG) || 0;
    const homeXgValue = parseFloat(match.home_xG || match.h_xG || 0) || 0;
    const awayXgValue = parseFloat(match.away_xG || match.a_xG || 0) || 0;

    if (isHome) {
      homeXG.push(homeXgValue || matchXG);
      homeXGA.push(awayXgValue || matchXGA);
      xGForm.push(homeXgValue || matchXG);
    } else {
      awayXG.push(awayXgValue || matchXG);
      awayXGA.push(homeXgValue || matchXGA);
      xGForm.push(awayXgValue || matchXG);
    }
  }

  // Calculate averages
  const avgHomeXG = homeXG.length > 0 ? homeXG.reduce((a, b) => a + b, 0) / homeXG.length : 0;
  const avgAwayXG = awayXG.length > 0 ? awayXG.reduce((a, b) => a + b, 0) / awayXG.length : 0;
  const avgHomeXGA = homeXGA.length > 0 ? homeXGA.reduce((a, b) => a + b, 0) / homeXGA.length : 0;
  const avgAwayXGA = awayXGA.length > 0 ? awayXGA.reduce((a, b) => a + b, 0) / awayXGA.length : 0;
  const avgXG = (avgHomeXG + avgAwayXG) / 2 || avgHomeXG || avgAwayXG;
  const avgXGA = (avgHomeXGA + avgAwayXGA) / 2 || avgHomeXGA || avgAwayXGA;

  // Use team's overall stats if available
  const teamOverallXG = parseFloat(team.xG || 0) || avgXG;
  const teamOverallXGA = parseFloat(team.xGA || 0) || avgXGA;
  const teamNPXG = parseFloat(team.npxG || 0) || teamOverallXG * 0.85; // Estimate npxG
  const teamNPXGA = parseFloat(team.npxGA || 0) || teamOverallXGA * 0.85;

  return {
    // Averages
    avg_xg: Math.round((teamOverallXG || avgXG) * 100) / 100,
    avg_xga: Math.round((teamOverallXGA || avgXGA) * 100) / 100,
    avg_home_xg: Math.round(avgHomeXG * 100) / 100,
    avg_away_xg: Math.round(avgAwayXG * 100) / 100,
    avg_home_xga: Math.round(avgHomeXGA * 100) / 100,
    avg_away_xga: Math.round(avgAwayXGA * 100) / 100,
    
    // Non-penalty xG
    npxg: Math.round(teamNPXG * 100) / 100,
    npxga: Math.round(teamNPXGA * 100) / 100,
    
    // Last 5 matches xG form
    xg_last5: xGForm.slice(0, 5).map(x => Math.round(x * 100) / 100),
    
    // Team info
    games_played: team.games || teamMatches.length || 0,
    wins: team.wins || 0,
    draws: team.draws || 0,
    losses: team.losses || 0,
    
    // Goals
    goals_scored: team.scored || team.goals || 0,
    goals_conceded: team.conceded || 0,
    
    // Points
    points: team.pts || team.points || 0,
    
    // Form indicator (positive = overperforming, negative = underperforming)
    xg_performance: Math.round(((teamOverallXG || avgXG) - (teamOverallXGA || avgXGA)) * 100) / 100
  };
}

/**
 * Generate mock xG data when scraping fails
 */
function generateMockXGData(teamName, league) {
  const baseXG = 1.2 + Math.random() * 0.8;
  const baseXGA = 1.0 + Math.random() * 0.6;
  
  const xGLast5 = [];
  for (let i = 0; i < 5; i++) {
    xGLast5.push(Math.round((baseXG - 0.3 + Math.random() * 0.6) * 100) / 100);
  }

  return {
    team: teamName,
    team_id: 'mock',
    league: league,
    avg_xg: Math.round(baseXG * 100) / 100,
    avg_xga: Math.round(baseXGA * 100) / 100,
    avg_home_xg: Math.round((baseXG + 0.2) * 100) / 100,
    avg_away_xg: Math.round((baseXG - 0.2) * 100) / 100,
    avg_home_xga: Math.round(baseXGA * 100) / 100,
    avg_away_xga: Math.round((baseXGA + 0.1) * 100) / 100,
    npxg: Math.round(baseXG * 0.85 * 100) / 100,
    npxga: Math.round(baseXGA * 0.85 * 100) / 100,
    xg_last5: xGLast5,
    games_played: Math.floor(15 + Math.random() * 15),
    wins: Math.floor(5 + Math.random() * 10),
    draws: Math.floor(2 + Math.random() * 5),
    losses: Math.floor(2 + Math.random() * 8),
    goals_scored: Math.floor(20 + Math.random() * 20),
    goals_conceded: Math.floor(15 + Math.random() * 15),
    points: Math.floor(20 + Math.random() * 30),
    xg_performance: Math.round((baseXG - baseXGA) * 100) / 100,
    source: 'Mock Data',
    fetched_at: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { league, team, home_team, away_team } = req.query;

  // Support both single team and match context
  const teamName = team || home_team;
  const leagueName = league || 'Premier-League';

  if (!teamName && !home_team && !away_team) {
    return res.status(400).json({ 
      error: 'Missing team parameter',
      usage: '/api/xg-scraper?league=Premier-League&team=Arsenal'
    });
  }

  try {
    // If requesting both teams for a match
    if (home_team && away_team) {
      const cacheKey = `${leagueName}_${home_team}_vs_${away_team}`;
      const cached = getCachedData(cacheKey);
      
      if (cached) {
        return res.status(200).json({ 
          home: cached.home,
          away: cached.away,
          cached: true
        });
      }

      // Fetch both teams
      let homeData, awayData;
      
      try {
        homeData = await fetchTeamData(leagueName, home_team);
      } catch (e) {
        console.log(`Home team xG fetch failed, using mock: ${e.message}`);
        homeData = generateMockXGData(home_team, leagueName);
      }

      try {
        awayData = await fetchTeamData(leagueName, away_team);
      } catch (e) {
        console.log(`Away team xG fetch failed, using mock: ${e.message}`);
        awayData = generateMockXGData(away_team, leagueName);
      }

      const result = {
        home: homeData,
        away: awayData,
        cached: false
      };

      setCache(cacheKey, result);
      return res.status(200).json(result);
    }

    // Single team request
    const cacheKey = `${leagueName}_${teamName}`;
    const cached = getCachedData(cacheKey);
    
    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    let teamData;
    try {
      teamData = await fetchTeamData(leagueName, teamName);
    } catch (e) {
      console.log(`xG fetch failed, using mock: ${e.message}`);
      teamData = generateMockXGData(teamName, leagueName);
    }

    setCache(cacheKey, teamData);
    return res.status(200).json({ ...teamData, cached: false });

  } catch (error) {
    console.error('xG scraper error:', error.message);
    
    // Return mock data instead of error
    if (teamName) {
      const mockData = generateMockXGData(teamName, leagueName);
      return res.status(200).json({ 
        ...mockData, 
        cached: false,
        warning: 'Using mock data - ' + error.message 
      });
    }

    return res.status(500).json({ 
      error: 'Failed to fetch xG data',
      message: error.message 
    });
  }
}
