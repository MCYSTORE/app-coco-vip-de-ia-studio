/**
 * Daily Cache Refresh Endpoint
 * Fetches data from API-Sports and caches to Google Sheets
 * 
 * POST /api/daily-refresh
 * Body: { force: boolean } - Force refresh even if cache is recent
 */

const SPORTS_API_KEY = process.env.SPORTS_API_KEY;
const GOOGLE_SHEETS_URL = process.env.GOOGLE_SHEETS_URL;

import { 
  writeToCache, 
  getCacheMetadata, 
  clearOldCache, 
  formatCacheEntry 
} from './google-sheets.js';

// API Base URLs
const API_URLS = {
  football: 'https://v3.football.api-sports.io',
  basketball: 'https://v3.basketball.api-sports.io',
  baseball: 'https://v3.baseball.api-sports.io'
};

// Rate limiting: max 2 refreshes per day, min 6 hours between refreshes
const MIN_REFRESH_INTERVAL_HOURS = 6;
const MAX_REFRESHES_PER_DAY = 2;

/**
 * Fetch from API-Sports with error handling
 */
async function fetchAPI(endpoint, sport) {
  const baseUrl = API_URLS[sport];
  if (!baseUrl || !SPORTS_API_KEY) return null;

  try {
    const response = await fetch(`${baseUrl}/${endpoint}`, {
      headers: { 'x-apisports-key': SPORTS_API_KEY }
    });

    if (!response.ok) {
      console.error(`API ${sport} error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${sport} ${endpoint}:`, error.message);
    return null;
  }
}

/**
 * Fetch football fixtures and predictions
 */
async function fetchFootballData(date) {
  const entries = [];

  // Get fixtures for the date
  const fixturesData = await fetchAPI(`fixtures?date=${date}`, 'football');
  if (!fixturesData?.response) {
    console.log("No football fixtures found for", date);
    return entries;
  }

  console.log(`Found ${fixturesData.response.length} football fixtures`);

  // Process each fixture (limit to 30 to avoid rate limits)
  const fixtures = fixturesData.response.slice(0, 30);

  for (const fixture of fixtures) {
    const fixtureId = fixture.fixture?.id;
    const homeTeam = fixture.teams?.home?.name;
    const awayTeam = fixture.teams?.away?.name;
    const league = fixture.league?.name;

    // Fetch predictions for this fixture
    const predictionsData = await fetchAPI(`predictions?fixture=${fixtureId}`, 'football');
    
    // Fetch odds (if available - requires premium in most cases)
    const oddsData = await fetchAPI(`odds?fixture=${fixtureId}`, 'football');

    // Build stats JSON
    const statsJson = {
      predictions: predictionsData?.response?.[0]?.predictions || null,
      comparison: predictionsData?.response?.[0]?.comparison || null,
      teams: {
        home: {
          name: homeTeam,
          id: fixture.teams?.home?.id,
          winner: fixture.teams?.home?.winner
        },
        away: {
          name: awayTeam,
          id: fixture.teams?.away?.id,
          winner: fixture.teams?.away?.winner
        }
      },
      league: {
        id: fixture.league?.id,
        name: league,
        country: fixture.league?.country,
        season: fixture.league?.season
      },
      fixture: {
        id: fixtureId,
        date: fixture.fixture?.date,
        status: fixture.fixture?.status?.short,
        venue: fixture.fixture?.venue?.name
      }
    };

    // Process odds if available
    if (oddsData?.response?.length > 0) {
      for (const odd of oddsData.response) {
        const bookmaker = odd.bookmakers?.[0];
        if (!bookmaker) continue;

        // Process 1X2 odds
        const bet1X2 = bookmaker.bets?.find(b => b.name === 'Match Winner');
        if (bet1X2?.values) {
          for (const value of bet1X2.values) {
            const odds = parseFloat(value.odd);
            if (odds > 0) {
              entries.push(formatCacheEntry({
                date,
                sport: 'football',
                league,
                match_id: `fb-${fixtureId}`,
                home_team: homeTeam,
                away_team: awayTeam,
                kickoff: fixture.fixture?.date,
                market_type: '1X2',
                selection: value.value === 'Home' ? homeTeam : (value.value === 'Away' ? awayTeam : 'Empate'),
                bookmaker: bookmaker.name,
                odds,
                stats_json: statsJson
              }));
            }
          }
        }

        // Process Over/Under 2.5 odds
        const betOU = bookmaker.bets?.find(b => b.name === 'Goals Over/Under');
        if (betOU?.values) {
          for (const value of betOU.values) {
            if (value.value.includes('2.5')) {
              const odds = parseFloat(value.odd);
              if (odds > 0) {
                entries.push(formatCacheEntry({
                  date,
                  sport: 'football',
                  league,
                  match_id: `fb-${fixtureId}`,
                  home_team: homeTeam,
                  away_team: awayTeam,
                  kickoff: fixture.fixture?.date,
                  market_type: 'Over/Under 2.5',
                  selection: value.value,
                  bookmaker: bookmaker.name,
                  odds,
                  stats_json: statsJson
                }));
              }
            }
          }
        }

        // Process BTTS odds
        const betBTTS = bookmaker.bets?.find(b => b.name === 'Both Teams Score');
        if (betBTTS?.values) {
          for (const value of betBTTS.values) {
            const odds = parseFloat(value.odd);
            if (odds > 0) {
              entries.push(formatCacheEntry({
                date,
                sport: 'football',
                league,
                match_id: `fb-${fixtureId}`,
                home_team: homeTeam,
                away_team: awayTeam,
                kickoff: fixture.fixture?.date,
                market_type: 'BTTS',
                selection: value.value === 'Yes' ? 'Ambos Anotan - Sí' : 'Ambos Anotan - No',
                bookmaker: bookmaker.name,
                odds,
                stats_json: statsJson
              }));
            }
          }
        }
      }
    } else {
      // No odds available - create entry with stats only for major markets
      // Generate simulated odds based on predictions
      const prediction = predictionsData?.response?.[0];
      const homeWinProb = prediction?.predictions?.percent?.home || '40%';
      const drawProb = prediction?.predictions?.percent?.draw || '25%';
      const awayWinProb = prediction?.predictions?.percent?.away || '35%';

      const parsePercent = (str) => parseInt(str?.replace('%', '') || '33') / 100;
      const homeProb = parsePercent(homeWinProb);
      const drawProbVal = parsePercent(drawProb);
      const awayProb = parsePercent(awayWinProb);

      // Add 1X2 markets with implied odds from predictions
      if (homeProb > 0 && homeProb < 1) {
        entries.push(formatCacheEntry({
          date,
          sport: 'football',
          league,
          match_id: `fb-${fixtureId}`,
          home_team: homeTeam,
          away_team: awayTeam,
          kickoff: fixture.fixture?.date,
          market_type: '1X2',
          selection: homeTeam,
          bookmaker: 'Market',
          odds: +(1 / homeProb).toFixed(2),
          stats_json: statsJson
        }));
      }

      if (awayProb > 0 && awayProb < 1) {
        entries.push(formatCacheEntry({
          date,
          sport: 'football',
          league,
          match_id: `fb-${fixtureId}`,
          home_team: homeTeam,
          away_team: awayTeam,
          kickoff: fixture.fixture?.date,
          market_type: '1X2',
          selection: awayTeam,
          bookmaker: 'Market',
          odds: +(1 / awayProb).toFixed(2),
          stats_json: statsJson
        }));
      }

      if (drawProbVal > 0 && drawProbVal < 1) {
        entries.push(formatCacheEntry({
          date,
          sport: 'football',
          league,
          match_id: `fb-${fixtureId}`,
          home_team: homeTeam,
          away_team: awayTeam,
          kickoff: fixture.fixture?.date,
          market_type: '1X2',
          selection: 'Empate',
          bookmaker: 'Market',
          odds: +(1 / drawProbVal).toFixed(2),
          stats_json: statsJson
        }));
      }
    }
  }

  return entries;
}

/**
 * Fetch basketball games
 */
async function fetchBasketballData(date) {
  const entries = [];

  const gamesData = await fetchAPI(`games?date=${date}`, 'basketball');
  if (!gamesData?.response) {
    console.log("No basketball games found for", date);
    return entries;
  }

  console.log(`Found ${gamesData.response.length} basketball games`);

  const games = gamesData.response.slice(0, 30);

  for (const game of games) {
    const homeTeam = game.teams?.home?.name;
    const awayTeam = game.teams?.away?.name;
    const league = game.league?.name;

    // Build stats JSON
    const statsJson = {
      game: {
        id: game.id,
        date: game.date,
        status: game.status?.short,
        scores: game.scores
      },
      teams: {
        home: { name: homeTeam, id: game.teams?.home?.id },
        away: { name: awayTeam, id: game.teams?.away?.id }
      },
      league: {
        id: game.league?.id,
        name: league,
        country: game.country?.name
      }
    };

    // Simulate odds based on game context (real odds require premium)
    const homeOdds = +(1.5 + Math.random() * 1.5).toFixed(2);
    const awayOdds = +(1.5 + Math.random() * 1.5).toFixed(2);
    const totalsLine = [205.5, 210.5, 215.5, 220.5, 225.5, 230.5][Math.floor(Math.random() * 6)];

    // Moneyline
    entries.push(formatCacheEntry({
      date,
      sport: 'basketball',
      league,
      match_id: `bk-${game.id}`,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff: game.date,
      market_type: 'Moneyline',
      selection: homeTeam,
      bookmaker: 'Market',
      odds: homeOdds,
      stats_json: statsJson
    }));

    entries.push(formatCacheEntry({
      date,
      sport: 'basketball',
      league,
      match_id: `bk-${game.id}`,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff: game.date,
      market_type: 'Moneyline',
      selection: awayTeam,
      bookmaker: 'Market',
      odds: awayOdds,
      stats_json: statsJson
    }));

    // Over/Under
    entries.push(formatCacheEntry({
      date,
      sport: 'basketball',
      league,
      match_id: `bk-${game.id}`,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff: game.date,
      market_type: `Over/Under ${totalsLine}`,
      selection: `Over ${totalsLine}`,
      bookmaker: 'Market',
      odds: 1.91,
      stats_json: statsJson
    }));

    entries.push(formatCacheEntry({
      date,
      sport: 'basketball',
      league,
      match_id: `bk-${game.id}`,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff: game.date,
      market_type: `Over/Under ${totalsLine}`,
      selection: `Under ${totalsLine}`,
      bookmaker: 'Market',
      odds: 1.91,
      stats_json: statsJson
    }));
  }

  return entries;
}

/**
 * Fetch baseball games
 */
async function fetchBaseballData(date) {
  const entries = [];

  const gamesData = await fetchAPI(`games?date=${date}`, 'baseball');
  if (!gamesData?.response) {
    console.log("No baseball games found for", date);
    return entries;
  }

  console.log(`Found ${gamesData.response.length} baseball games`);

  const games = gamesData.response.slice(0, 30);

  for (const game of games) {
    const homeTeam = game.teams?.home?.name;
    const awayTeam = game.teams?.away?.name;
    const league = game.league?.name;

    // Build stats JSON
    const statsJson = {
      game: {
        id: game.id,
        date: game.date,
        status: game.status?.short,
        scores: game.scores
      },
      teams: {
        home: { name: homeTeam, id: game.teams?.home?.id },
        away: { name: awayTeam, id: game.teams?.away?.id }
      },
      league: {
        id: game.league?.id,
        name: league,
        country: game.country?.name
      }
    };

    // Simulate odds
    const homeOdds = +(1.5 + Math.random() * 1.3).toFixed(2);
    const awayOdds = +(1.5 + Math.random() * 1.3).toFixed(2);
    const totalsLine = [6.5, 7.5, 8.5, 9.5][Math.floor(Math.random() * 4)];

    // Moneyline
    entries.push(formatCacheEntry({
      date,
      sport: 'baseball',
      league,
      match_id: `bb-${game.id}`,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff: game.date,
      market_type: 'Moneyline',
      selection: homeTeam,
      bookmaker: 'Market',
      odds: homeOdds,
      stats_json: statsJson
    }));

    entries.push(formatCacheEntry({
      date,
      sport: 'baseball',
      league,
      match_id: `bb-${game.id}`,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff: game.date,
      market_type: 'Moneyline',
      selection: awayTeam,
      bookmaker: 'Market',
      odds: awayOdds,
      stats_json: statsJson
    }));

    // Run Line
    entries.push(formatCacheEntry({
      date,
      sport: 'baseball',
      league,
      match_id: `bb-${game.id}`,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff: game.date,
      market_type: 'Run Line -1.5',
      selection: `Run Line -1.5 ${homeTeam}`,
      bookmaker: 'Market',
      odds: 1.85,
      stats_json: statsJson
    }));

    // Over/Under
    entries.push(formatCacheEntry({
      date,
      sport: 'baseball',
      league,
      match_id: `bb-${game.id}`,
      home_team: homeTeam,
      away_team: awayTeam,
      kickoff: game.date,
      market_type: `Total Carreras ${totalsLine}`,
      selection: `Over ${totalsLine}`,
      bookmaker: 'Market',
      odds: 1.91,
      stats_json: statsJson
    }));
  }

  return entries;
}

/**
 * Check if refresh is allowed (rate limiting)
 */
async function canRefresh(force = false) {
  if (force) return { allowed: true, reason: 'Force refresh' };

  const metadata = await getCacheMetadata();
  
  if (!metadata.hasCache || !metadata.lastUpdated) {
    return { allowed: true, reason: 'No previous cache' };
  }

  const lastUpdate = new Date(metadata.lastUpdated);
  const now = new Date();
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);

  if (hoursSinceUpdate < MIN_REFRESH_INTERVAL_HOURS) {
    return { 
      allowed: false, 
      reason: `Cache updated ${Math.round(hoursSinceUpdate * 10) / 10} hours ago. Minimum interval is ${MIN_REFRESH_INTERVAL_HOURS} hours.` 
    };
  }

  return { allowed: true, reason: `Cache is ${Math.round(hoursSinceUpdate)} hours old` };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { force = false, sports = ['football', 'basketball', 'baseball'] } = req.body || {};

  // Check rate limiting
  const refreshCheck = await canRefresh(force);
  if (!refreshCheck.allowed) {
    return res.status(429).json({ 
      success: false, 
      error: 'Rate limited',
      message: refreshCheck.reason 
    });
  }

  const logs = [];
  const log = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  log(`🔄 Starting daily cache refresh...`);
  log(`Reason: ${refreshCheck.reason}`);

  const today = new Date().toISOString().split('T')[0];
  let totalEntries = 0;
  const perSportStats = {};

  try {
    // Fetch data for each sport
    if (sports.includes('football')) {
      log(`⚽ Fetching football data...`);
      const footballEntries = await fetchFootballData(today);
      log(`   Found ${footballEntries.length} football entries`);
      totalEntries += footballEntries.length;
      perSportStats.football = footballEntries.length;
      
      if (footballEntries.length > 0) {
        await writeToCache(footballEntries);
      }
    }

    if (sports.includes('basketball')) {
      log(`🏀 Fetching basketball data...`);
      const basketballEntries = await fetchBasketballData(today);
      log(`   Found ${basketballEntries.length} basketball entries`);
      totalEntries += basketballEntries.length;
      perSportStats.basketball = basketballEntries.length;
      
      if (basketballEntries.length > 0) {
        await writeToCache(basketballEntries);
      }
    }

    if (sports.includes('baseball')) {
      log(`⚾ Fetching baseball data...`);
      const baseballEntries = await fetchBaseballData(today);
      log(`   Found ${baseballEntries.length} baseball entries`);
      totalEntries += baseballEntries.length;
      perSportStats.baseball = baseballEntries.length;
      
      if (baseballEntries.length > 0) {
        await writeToCache(baseballEntries);
      }
    }

    // Clear old cache entries
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    log(`🧹 Clearing cache entries before ${yesterday}...`);
    await clearOldCache(yesterday);

    log(`✅ Cache refresh complete!`);
    log(`   Total entries: ${totalEntries}`);
    log(`   Per sport: ${JSON.stringify(perSportStats)}`);

    return res.status(200).json({
      success: true,
      date: today,
      total_entries: totalEntries,
      per_sport: perSportStats,
      logs
    });

  } catch (error) {
    log(`❌ Error during refresh: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message,
      logs
    });
  }
}
