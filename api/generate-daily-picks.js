/**
 * Daily Football Picks - Enhanced API-Football v3 Integration
 * 
 * POST /api/generate-daily-picks
 * Body: { date?: string }
 * 
 * Uses ALL relevant API-Football v3 endpoints for maximum context.
 * Request budget: 100/day (free plan)
 * 
 * Endpoints used:
 * 1. /fixtures?date= - Fixtures of the day
 * 2. /standings - League standings (cached 24h)
 * 3. /fixtures?team=&last=10 - Recent form
 * 4. /teams/statistics - Team season stats (cached 12h)
 * 5. /fixtures?h2h= - Head to head
 * 6. /odds - Pre-match odds (Bet365)
 * 7. /predictions - API predictions
 * 8. /injuries - Injuries/suspensions
 * 9. /players?fixture= - Key player stats
 * 10. /fixtures/lineups - Probable lineups
 */

const SPORTS_API_KEY = process.env.SPORTS_API_KEY;
const OPENROUTERFREE_API_KEY = process.env.OPENROUTERFREE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// =====================================================
// CONFIGURATION
// =====================================================

const CONFIG = {
  MAX_PICKS_PER_DAY: 3,
  MAX_API_REQUESTS: 100,
  
  // Allowed leagues (men's football only)
  ALLOWED_LEAGUES: [
    { id: 39, name: "Premier League", country: "England", tier: 1 },
    { id: 140, name: "La Liga", country: "Spain", tier: 1 },
    { id: 135, name: "Serie A", country: "Italy", tier: 1 },
    { id: 78, name: "Bundesliga", country: "Germany", tier: 1 },
    { id: 61, name: "Ligue 1", country: "France", tier: 1 },
    { id: 2, name: "UEFA Champions League", country: "Europe", tier: 1 },
    { id: 3, name: "UEFA Europa League", country: "Europe", tier: 1 },
    { id: 848, name: "UEFA Conference League", country: "Europe", tier: 2 },
    { id: 71, name: "Brasileirao Serie A", country: "Brazil", tier: 2 },
    { id: 128, name: "Liga Profesional", country: "Argentina", tier: 2 }
  ],
  
  MIN_CONFIDENCE: 0.65,
  MIN_EV: 0.04,
  LLM_MODEL: "deepseek/deepseek-chat",
  
  // Bet365 bookmaker ID
  BOOKMAKER_ID: 8,
  
  // Bet type IDs
  BET_TYPES: {
    MATCH_WINNER: 1,      // 1X2
    OVER_UNDER_25: 5,     // Over/Under 2.5 Goals
    BTTS: 12,             // Both Teams To Score
    DOUBLE_CHANCE: 6      // 1X, 12, X2
  },
  
  // Cache TTLs
  STANDINGS_CACHE_TTL: 24 * 60 * 60 * 1000,    // 24 hours
  TEAM_STATS_CACHE_TTL: 12 * 60 * 60 * 1000,   // 12 hours
  
  // Minimum data requirements for LLM
  MIN_STANDINGS: true,
  MIN_FORM_MATCHES: 5,
  MIN_H2H_MATCHES: 3,
  MIN_DATA_VALIDATION: 4,  // Must have 4+ data categories
  
  QUALITY_TIERS: {
    A_PLUS: { min_ev: 0.08, min_confidence: 0.80 },
    B: { min_ev: 0.04, min_confidence: 0.65 }
  }
};

// Discard reasons
const DISCARD_REASONS = {
  LEAGUE_NOT_ALLOWED: "liga_no_permitida",
  INSUFFICIENT_DATA: "datos_insuficientes",
  LOW_CONFIDENCE: "confianza_baja",
  LOW_EV: "ev_insuficiente",
  NO_VALUE: "sin_value_bet"
};

// =====================================================
// IN-MEMORY CACHES
// =====================================================

const standingsCache = new Map();
const teamStatsCache = new Map();
let requestCountToday = 0;
let lastResetDate = new Date().toISOString().split('T')[0];
let discardedPicks = [];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function checkAndResetCounter() {
  const today = new Date().toISOString().split('T')[0];
  if (today !== lastResetDate) {
    requestCountToday = 0;
    lastResetDate = today;
    standingsCache.clear();
    teamStatsCache.clear();
  }
}

function isLeagueAllowed(leagueId) {
  return CONFIG.ALLOWED_LEAGUES.some(l => l.id === leagueId);
}

function getLeagueConfig(leagueId) {
  return CONFIG.ALLOWED_LEAGUES.find(l => l.id === leagueId);
}

function logDiscardedPick(match, leagueId, reason, extra = {}) {
  const entry = {
    date: new Date().toISOString().split('T')[0],
    match_name: `${match.home?.name || 'Home'} vs ${match.away?.name || 'Away'}`,
    league: getLeagueConfig(leagueId)?.name || `League ${leagueId}`,
    league_id: leagueId,
    reason,
    ...extra,
    created_at: new Date().toISOString()
  };
  discardedPicks.push(entry);
  console.log(`   ❌ DISCARDED: ${entry.match_name} - ${reason}`);
  return entry;
}

async function saveDiscardedPicksToSupabase(discarded) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || discarded.length === 0) return;
  
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/picks_discarded`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(discarded)
    });
  } catch (error) {
    console.error("Error saving discarded picks:", error.message);
  }
}

// =====================================================
// API FOOTBALL v3 - CORE FETCH FUNCTION
// =====================================================

async function fetchAPI(endpoint) {
  if (!SPORTS_API_KEY) {
    throw new Error('SPORTS_API_KEY not configured');
  }
  
  // Check request budget
  if (requestCountToday >= CONFIG.MAX_API_REQUESTS) {
    throw new Error(`API request limit reached: ${requestCountToday}/${CONFIG.MAX_API_REQUESTS}`);
  }
  
  const url = `https://v3.football.api-sports.io/${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'x-apisports-key': SPORTS_API_KEY
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error ${response.status}: ${errorText.slice(0, 200)}`);
      return null;
    }
    
    requestCountToday++;
    return response.json();
  } catch (error) {
    console.error(`API fetch error: ${error.message}`);
    return null;
  }
}

// =====================================================
// ENDPOINT 1: FIXTURES DEL DÍA
// =====================================================

async function getFixtures(date) {
  const data = await fetchAPI(`fixtures?date=${date}&timezone=UTC`);
  
  if (!data?.response) return [];
  
  return data.response
    .filter(f => f.fixture.status.short === 'NS')  // Not started only
    .filter(f => isLeagueAllowed(f.league.id))
    .map(f => ({
      fixture_id: f.fixture.id,
      league: {
        id: f.league.id,
        name: f.league.name,
        country: f.league.country
      },
      home: {
        id: f.teams.home.id,
        name: f.teams.home.name,
        logo: f.teams.home.logo
      },
      away: {
        id: f.teams.away.id,
        name: f.teams.away.name,
        logo: f.teams.away.logo
      },
      kickoff_utc: f.fixture.date,
      status: f.fixture.status.short
    }));
}

// =====================================================
// ENDPOINT 2: STANDINGS (cached 24h)
// =====================================================

async function getStandings(leagueId, season) {
  const cacheKey = `${leagueId}-${season}`;
  const cached = standingsCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CONFIG.STANDINGS_CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchAPI(`standings?league=${leagueId}&season=${season}`);
  
  if (!data?.response?.[0]?.league?.standings?.[0]) return [];
  
  const standings = data.response[0].league.standings[0].map(team => ({
    team_id: team.team.id,
    team_name: team.team.name,
    rank: team.rank,
    points: team.points,
    goals_for: team.all.goals.for,
    goals_against: team.all.goals.against,
    goals_diff: team.goalsDiff,
    played: team.all.played,
    win: team.all.win,
    draw: team.all.draw,
    lose: team.all.lose,
    form: team.form,
    description: team.description || null,
    // Home/Away records
    home: {
      played: team.home.played,
      win: team.home.win,
      draw: team.home.draw,
      lose: team.home.lose,
      goals_for: team.home.goals.for,
      goals_against: team.home.goals.against
    },
    away: {
      played: team.away.played,
      win: team.away.win,
      draw: team.away.draw,
      lose: team.away.lose,
      goals_for: team.away.goals.for,
      goals_against: team.away.goals.against
    }
  }));
  
  standingsCache.set(cacheKey, { data: standings, timestamp: Date.now() });
  return standings;
}

// =====================================================
// ENDPOINT 3: FORMA RECIENTE (últimos 10 partidos)
// =====================================================

async function getRecentForm(teamId, teamName) {
  const data = await fetchAPI(`fixtures?team=${teamId}&last=10&timezone=UTC`);
  
  if (!data?.response) return null;
  
  const matches = data.response.map(f => {
    const isHome = f.teams.home.id === teamId;
    const teamGoals = isHome ? f.goals.home : f.goals.away;
    const oppGoals = isHome ? f.goals.away : f.goals.home;
    
    let result = 'D';
    if (teamGoals > oppGoals) result = 'W';
    else if (teamGoals < oppGoals) result = 'L';
    
    return {
      date: f.fixture.date,
      opponent: isHome ? f.teams.away.name : f.teams.home.name,
      was_home: isHome,
      goals_for: teamGoals,
      goals_against: oppGoals,
      result
    };
  });
  
  // Calculate stats
  const wins = matches.filter(m => m.result === 'W').length;
  const draws = matches.filter(m => m.result === 'D').length;
  const losses = matches.filter(m => m.result === 'L').length;
  const totalGF = matches.reduce((sum, m) => sum + m.goals_for, 0);
  const totalGA = matches.reduce((sum, m) => sum + m.goals_against, 0);
  
  // Home/Away breakdown
  const homeMatches = matches.filter(m => m.was_home);
  const awayMatches = matches.filter(m => !m.was_home);
  
  // Current streak
  let streak = '';
  for (const m of matches) {
    if (streak === '' || streak[0] === m.result) {
      streak = m.result + streak;
    } else {
      break;
    }
  }
  
  return {
    last10: matches,
    form_string: matches.map(m => m.result).join(''),
    avg_gf: totalGF / matches.length,
    avg_ga: totalGA / matches.length,
    wins, draws, losses,
    home_record: {
      wins: homeMatches.filter(m => m.result === 'W').length,
      draws: homeMatches.filter(m => m.result === 'D').length,
      losses: homeMatches.filter(m => m.result === 'L').length
    },
    away_record: {
      wins: awayMatches.filter(m => m.result === 'W').length,
      draws: awayMatches.filter(m => m.result === 'D').length,
      losses: awayMatches.filter(m => m.result === 'L').length
    },
    streak,
    matches_count: matches.length
  };
}

// =====================================================
// ENDPOINT 4: TEAM STATISTICS (cached 12h)
// =====================================================

async function getTeamStatistics(leagueId, season, teamId) {
  const cacheKey = `${leagueId}-${season}-${teamId}`;
  const cached = teamStatsCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CONFIG.TEAM_STATS_CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchAPI(`teams/statistics?league=${leagueId}&season=${season}&team=${teamId}`);
  
  if (!data?.response) return null;
  
  const stats = data.response;
  
  const result = {
    // Fixtures
    fixtures: {
      played: stats.fixtures?.played || 0,
      wins: stats.fixtures?.wins || 0,
      draws: stats.fixtures?.draws || 0,
      loses: stats.fixtures?.loses || 0
    },
    // Goals
    goals: {
      for: {
        total: stats.goals?.for?.total || 0,
        average: {
          total: stats.goals?.for?.average?.total || '0',
          home: stats.goals?.for?.average?.home || '0',
          away: stats.goals?.for?.average?.away || '0'
        }
      },
      against: {
        total: stats.goals?.against?.total || 0,
        average: {
          total: stats.goals?.against?.average?.total || '0',
          home: stats.goals?.against?.average?.home || '0',
          away: stats.goals?.against?.average?.away || '0'
        }
      }
    },
    // Biggest
    biggest: {
      wins_streak: stats.biggest?.wins_streak || 0,
      loses_streak: stats.biggest?.loses_streak || 0
    },
    // Clean sheets
    clean_sheet: {
      total: stats.clean_sheet?.total || 0,
      home: stats.clean_sheet?.home || 0,
      away: stats.clean_sheet?.away || 0
    },
    // Failed to score
    failed_to_score: {
      total: stats.failed_to_score?.total || 0,
      home: stats.failed_to_score?.home || 0,
      away: stats.failed_to_score?.away || 0
    },
    // Lineups (most used formation)
    top_formation: stats.lineups?.[0]?.formation || 'Unknown'
  };
  
  teamStatsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

// =====================================================
// ENDPOINT 5: HEAD TO HEAD
// =====================================================

async function getHeadToHead(homeId, awayId) {
  const data = await fetchAPI(`fixtures?h2h=${homeId}-${awayId}&last=10`);
  
  if (!data?.response) return null;
  
  const matches = data.response.map(f => ({
    date: f.fixture.date,
    home_team: f.teams.home.name,
    away_team: f.teams.away.name,
    home_goals: f.goals.home,
    away_goals: f.goals.away,
    total_goals: (f.goals.home || 0) + (f.goals.away || 0)
  }));
  
  // Calculate H2H stats
  let homeWins = 0, awayWins = 0, draws = 0;
  let over25 = 0;
  
  for (const m of matches) {
    const homeTeamIsFirstTeam = m.home_team === data.response[0]?.teams?.home?.name;
    
    if (m.home_goals > m.away_goals) {
      homeWins++;
    } else if (m.home_goals < m.away_goals) {
      awayWins++;
    } else {
      draws++;
    }
    
    if (m.total_goals > 2.5) over25++;
  }
  
  const avgTotalGoals = matches.length > 0
    ? matches.reduce((sum, m) => sum + m.total_goals, 0) / matches.length
    : 0;
  
  return {
    last10: matches,
    avg_total_goals: Math.round(avgTotalGoals * 100) / 100,
    home_wins: homeWins,
    away_wins: awayWins,
    draws,
    over25_pct: matches.length > 0 ? Math.round((over25 / matches.length) * 100) : 0
  };
}

// =====================================================
// ENDPOINT 6: ODDS (Bet365)
// =====================================================

async function getOdds(fixtureId) {
  const result = {
    '1x2': null,
    'over25': null,
    'btts': null,
    implied_probs_normalized: null
  };
  
  // 1X2 Odds
  try {
    const data1x2 = await fetchAPI(`odds?fixture=${fixtureId}&bookmaker=${CONFIG.BOOKMAKER_ID}&bet=${CONFIG.BET_TYPES.MATCH_WINNER}`);
    
    if (data1x2?.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
      const values = data1x2.response[0].bookmakers[0].bets[0].values;
      
      result['1x2'] = {
        '1': parseFloat(values.find(v => v.value === 'Home')?.odd || '0'),
        'X': parseFloat(values.find(v => v.value === 'Draw')?.odd || '0'),
        '2': parseFloat(values.find(v => v.value === 'Away')?.odd || '0')
      };
    }
  } catch (e) {
    console.log(`   ⚠️ 1X2 odds not available`);
  }
  
  // Over/Under 2.5 Odds
  try {
    const dataOu = await fetchAPI(`odds?fixture=${fixtureId}&bookmaker=${CONFIG.BOOKMAKER_ID}&bet=${CONFIG.BET_TYPES.OVER_UNDER_25}`);
    
    if (dataOu?.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
      const values = dataOu.response[0].bookmakers[0].bets[0].values;
      
      result['over25'] = {
        over: parseFloat(values.find(v => v.value === 'Over')?.odd || '0'),
        under: parseFloat(values.find(v => v.value === 'Under')?.odd || '0')
      };
    }
  } catch (e) {
    console.log(`   ⚠️ Over/Under odds not available`);
  }
  
  // BTTS Odds
  try {
    const dataBtts = await fetchAPI(`odds?fixture=${fixtureId}&bookmaker=${CONFIG.BOOKMAKER_ID}&bet=${CONFIG.BET_TYPES.BTTS}`);
    
    if (dataBtts?.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
      const values = dataBtts.response[0].bookmakers[0].bets[0].values;
      
      result['btts'] = {
        yes: parseFloat(values.find(v => v.value === 'Yes')?.odd || '0'),
        no: parseFloat(values.find(v => v.value === 'No')?.odd || '0')
      };
    }
  } catch (e) {
    console.log(`   ⚠️ BTTS odds not available`);
  }
  
  // Normalize implied probabilities (remove overround)
  if (result['1x2'] && result['1x2']['1'] > 0) {
    const raw1 = 1 / result['1x2']['1'];
    const rawX = 1 / result['1x2']['X'];
    const raw2 = 1 / result['1x2']['2'];
    const sum = raw1 + rawX + raw2;
    
    result.implied_probs_normalized = {
      home_win: Math.round((raw1 / sum) * 1000) / 1000,
      draw: Math.round((rawX / sum) * 1000) / 1000,
      away_win: Math.round((raw2 / sum) * 1000) / 1000
    };
  }
  
  return result;
}

// =====================================================
// ENDPOINT 7: API PREDICTIONS
// =====================================================

async function getPredictions(fixtureId) {
  const data = await fetchAPI(`predictions?fixture=${fixtureId}`);
  
  if (!data?.response?.[0]) return null;
  
  const pred = data.response[0];
  
  return {
    winner: pred.predictions?.winner?.name || null,
    winner_comment: pred.predictions?.winner?.comment || null,
    win_or_draw: pred.predictions?.win_or_draw || null,
    under_over: pred.predictions?.under_over || null,
    goals: {
      home: pred.predictions?.goals?.home || null,
      away: pred.predictions?.goals?.away || null
    },
    advice: pred.predictions?.advice || null,
    comparison: pred.comparison ? {
      form: {
        home: pred.comparison.form?.home || null,
        away: pred.comparison.form?.away || null
      },
      attack: {
        home: pred.comparison.att?.home || null,
        away: pred.comparison.att?.away || null
      },
      defense: {
        home: pred.comparison.def?.home || null,
        away: pred.comparison.def?.away || null
      },
      poisson: {
        home: pred.comparison.poisson_distribution?.home || null,
        away: pred.comparison.poisson_distribution?.away || null
      },
      h2h: {
        home: pred.comparison.h2h?.home || null,
        away: pred.comparison.h2h?.away || null
      },
      total: {
        home: pred.comparison.total?.home || null,
        away: pred.comparison.total?.away || null
      }
    } : null
  };
}

// =====================================================
// ENDPOINT 8: INJURIES & SUSPENSIONS
// =====================================================

async function getInjuries(fixtureId, homeId, awayId) {
  const data = await fetchAPI(`injuries?fixture=${fixtureId}`);
  
  if (!data?.response) return { home: [], away: [] };
  
  const homeInjuries = [];
  const awayInjuries = [];
  
  for (const injury of data.response) {
    const entry = {
      name: injury.player?.name || 'Unknown',
      reason: injury.player?.reason || 'Unknown',
      type: injury.player?.reason?.toLowerCase().includes('suspend') ? 'suspended' : 'injured'
    };
    
    if (injury.team?.id === homeId) {
      homeInjuries.push(entry);
    } else if (injury.team?.id === awayId) {
      awayInjuries.push(entry);
    }
  }
  
  return {
    home: homeInjuries,
    away: awayInjuries
  };
}

// =====================================================
// ENDPOINT 9: KEY PLAYERS STATS
// =====================================================

async function getKeyPlayers(teamId, teamName) {
  // Get team's last fixture
  const fixturesData = await fetchAPI(`fixtures?team=${teamId}&last=1`);
  
  if (!fixturesData?.response?.[0]) return [];
  
  const lastFixture = fixturesData.response[0];
  const fixtureId = lastFixture.fixture.id;
  
  // Get player stats from that fixture
  const playersData = await fetchAPI(`players?fixture=${fixtureId}&team=${teamId}`);
  
  if (!playersData?.response) return [];
  
  // Sort by minutes played, take top 3
  const topPlayers = playersData.response
    .filter(p => p.statistics?.[0]?.games?.minutes > 0)
    .sort((a, b) => (b.statistics?.[0]?.games?.minutes || 0) - (a.statistics?.[0]?.games?.minutes || 0))
    .slice(0, 3);
  
  return topPlayers.map(p => ({
    name: p.player?.name || 'Unknown',
    position: p.player?.position || 'Unknown',
    rating: p.statistics?.[0]?.games?.rating || null,
    minutes: p.statistics?.[0]?.games?.minutes || 0,
    captain: p.statistics?.[0]?.games?.captain || false,
    goals: p.statistics?.[0]?.goals?.total || 0,
    assists: p.statistics?.[0]?.goals?.assists || 0,
    shots: p.statistics?.[0]?.shots?.total || 0,
    shots_on: p.statistics?.[0]?.shots?.on || 0,
    key_passes: p.statistics?.[0]?.passes?.key || 0,
    pass_accuracy: p.statistics?.[0]?.passes?.accuracy || null,
    dribbles_success: p.statistics?.[0]?.dribbles?.success || 0,
    tackles: p.statistics?.[0]?.tackles?.total || 0
  }));
}

// =====================================================
// ENDPOINT 10: LINEUPS
// =====================================================

async function getLineups(fixtureId) {
  const data = await fetchAPI(`fixtures/lineups?fixture=${fixtureId}`);
  
  if (!data?.response || data.response.length < 2) {
    return {
      home: { formation: null, available: false },
      away: { formation: null, available: false }
    };
  }
  
  return {
    home: {
      formation: data.response[0]?.formation || null,
      coach: data.response[0]?.coach?.name || null,
      startXI: data.response[0]?.startXI?.map(p => p.player?.name) || [],
      available: !!(data.response[0]?.startXI?.length > 0)
    },
    away: {
      formation: data.response[1]?.formation || null,
      coach: data.response[1]?.coach?.name || null,
      startXI: data.response[1]?.startXI?.map(p => p.player?.name) || [],
      available: !!(data.response[1]?.startXI?.length > 0)
    }
  };
}

// =====================================================
// BUILD COMPLETE MATCH CONTEXT
// =====================================================

async function buildMatchContext(fixture, season) {
  console.log(`   📊 Building context: ${fixture.home.name} vs ${fixture.away.name}`);
  
  const context = {
    fixture_id: fixture.fixture_id,
    league: fixture.league,
    match: {
      home: fixture.home.name,
      away: fixture.away.name,
      kickoff_utc: fixture.kickoff_utc
    }
  };
  
  // 1. Standings
  const standings = await getStandings(fixture.league.id, season);
  context.standings = {
    home: standings.find(t => t.team_id === fixture.home.id) || null,
    away: standings.find(t => t.team_id === fixture.away.id) || null
  };
  
  // 2. Team Statistics
  const [homeStats, awayStats] = await Promise.all([
    getTeamStatistics(fixture.league.id, season, fixture.home.id),
    getTeamStatistics(fixture.league.id, season, fixture.away.id)
  ]);
  
  context.team_stats = {
    home: homeStats,
    away: awayStats
  };
  
  // 3. Recent Form
  const [homeForm, awayForm] = await Promise.all([
    getRecentForm(fixture.home.id, fixture.home.name),
    getRecentForm(fixture.away.id, fixture.away.name)
  ]);
  
  context.recent_form = {
    home: homeForm,
    away: awayForm
  };
  
  // 4. H2H
  context.h2h = await getHeadToHead(fixture.home.id, fixture.away.id);
  
  // 5. Odds
  context.odds = await getOdds(fixture.fixture_id);
  
  // 6. API Prediction
  context.api_prediction = await getPredictions(fixture.fixture_id);
  
  // 7. Injuries (only if budget allows)
  if (requestCountToday < CONFIG.MAX_API_REQUESTS - 20) {
    context.injuries = await getInjuries(fixture.fixture_id, fixture.home.id, fixture.away.id);
  } else {
    context.injuries = { home: [], away: [] };
  }
  
  // 8. Key Players (only if budget allows)
  if (requestCountToday < CONFIG.MAX_API_REQUESTS - 10) {
    const [homePlayers, awayPlayers] = await Promise.all([
      getKeyPlayers(fixture.home.id, fixture.home.name),
      getKeyPlayers(fixture.away.id, fixture.away.name)
    ]);
    context.key_players = {
      home: homePlayers,
      away: awayPlayers
    };
  } else {
    context.key_players = { home: [], away: [] };
  }
  
  // 9. Lineups (only if budget allows and close to kickoff)
  const hoursToKickoff = (new Date(fixture.kickoff_utc) - new Date()) / (1000 * 60 * 60);
  if (requestCountToday < CONFIG.MAX_API_REQUESTS - 5 && hoursToKickoff < 3) {
    context.lineups = await getLineups(fixture.fixture_id);
  } else {
    // Use top formation from team stats as fallback
    context.lineups = {
      home: { formation: homeStats?.top_formation || null, available: false },
      away: { formation: awayStats?.top_formation || null, available: false }
    };
  }
  
  return context;
}

// =====================================================
// VALIDATE MINIMUM DATA FOR LLM
// =====================================================

function validateMinimumData(context) {
  let score = 0;
  const issues = [];
  
  // Check standings
  if (context.standings?.home?.rank && context.standings?.away?.rank) {
    score++;
  } else {
    issues.push('standings_missing');
  }
  
  // Check recent form (min 5 matches)
  if (context.recent_form?.home?.matches_count >= CONFIG.MIN_FORM_MATCHES) {
    score++;
  } else {
    issues.push('home_form_insufficient');
  }
  
  if (context.recent_form?.away?.matches_count >= CONFIG.MIN_FORM_MATCHES) {
    score++;
  } else {
    issues.push('away_form_insufficient');
  }
  
  // Check odds
  if (context.odds?.['1x2']?.['1'] > 0) {
    score++;
  } else {
    issues.push('odds_missing');
  }
  
  // Check API prediction
  if (context.api_prediction?.winner) {
    score++;
  } else {
    issues.push('prediction_missing');
  }
  
  // Check H2H (min 3 matches)
  if (context.h2h?.last10?.length >= CONFIG.MIN_H2H_MATCHES) {
    score++;
  } else {
    issues.push('h2h_insufficient');
  }
  
  return {
    valid: score >= CONFIG.MIN_DATA_VALIDATION,
    score,
    max_score: 6,
    issues
  };
}

// =====================================================
// LLM ANALYSIS
// =====================================================

async function analyzeWithLLM(context) {
  if (!OPENROUTERFREE_API_KEY) return null;
  
  const SYSTEM_PROMPT = `Eres un analista experto en apuestas deportivas con criterio EXTREMADAMENTE CONSERVADOR.
Analizas partidos de fútbol con datos completos de API-Football.
RESPONDE SIEMPRE EN ESPAÑOL Y EN JSON VÁLIDO.

DATOS RECIBIDOS:
- Standings: posición, puntos, forma, goles
- Team Stats: promedios de goles, clean sheets, formación
- Recent Form: últimos 10 partidos con resultados
- H2H: historial de enfrentamientos
- Odds: cuotas 1X2, Over/Under 2.5, BTTS
- API Prediction: predicción oficial de la API
- Injuries: lesionados y suspendidos
- Key Players: estadísticas de jugadores clave
- Lineups: formaciones probables

TU TAREA:
1. Estimar probabilidad real de cada resultado
2. Comparar con probabilidades implícitas normalizadas
3. Calcular EV = (prob_estimada * cuota) - 1
4. Indicar si hay value bet (EV > 0.04)

╔══════════════════════════════════════════════════════════════╗
║  ESCALA DE CONFIANZA (NO NEGOCIABLE):                        ║
╠══════════════════════════════════════════════════════════════╣
║  confidence >= 0.80: 4+ factores sólidos, EV >= 8%           ║
║  confidence 0.65-0.79: 2-3 factores, EV 4-8%                 ║
║  confidence < 0.65: NO proponer pick                         ║
╚══════════════════════════════════════════════════════════════╝

MERCADOS DISPONIBLES:
- 1X2 (Match Winner)
- Over/Under 2.5 Goals

FORMATO RESPUESTA:
{
  "pick": {
    "market": "1X2" | "over_under",
    "selection": "1" | "X" | "2" | "over" | "under",
    "estimated_prob": 0.0-1.0,
    "bookmaker_odds": number,
    "expected_value": number,
    "value_bet": boolean
  },
  "analysis": "120-180 palabras con: forma, tabla, H2H, valor de cuota, riesgos",
  "confidence": 0.0-1.0,
  "risk_factors": ["factor1", "factor2"],
  "no_value_reason": "string o null"
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTERFREE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Football Picks'
      },
      body: JSON.stringify({
        model: CONFIG.LLM_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analiza este partido:\n\n${JSON.stringify(context, null, 2)}` }
        ],
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '{}';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(content);
  } catch (error) {
    console.error("LLM Error:", error.message);
    return null;
  }
}

// =====================================================
// SELECT BEST PICKS
// =====================================================

function selectBestPicks(llmResults, contexts) {
  const validPicks = [];
  
  for (let i = 0; i < llmResults.length; i++) {
    const result = llmResults[i];
    const ctx = contexts[i];
    
    if (!result?.pick?.value_bet) {
      logDiscardedPick(
        { home: { name: ctx.match.home }, away: { name: ctx.match.away } },
        ctx.league.id,
        DISCARD_REASONS.NO_VALUE,
        { confidence: result?.confidence, ev: result?.pick?.expected_value }
      );
      continue;
    }
    
    if (result.confidence < CONFIG.MIN_CONFIDENCE) {
      logDiscardedPick(
        { home: { name: ctx.match.home }, away: { name: ctx.match.away } },
        ctx.league.id,
        DISCARD_REASONS.LOW_CONFIDENCE,
        { confidence: result.confidence }
      );
      continue;
    }
    
    if (result.pick.expected_value < CONFIG.MIN_EV) {
      logDiscardedPick(
        { home: { name: ctx.match.home }, away: { name: ctx.match.away } },
        ctx.league.id,
        DISCARD_REASONS.LOW_EV,
        { ev: result.pick.expected_value }
      );
      continue;
    }
    
    // Determine quality tier
    let qualityTier = 'B';
    if (result.pick.expected_value >= CONFIG.QUALITY_TIERS.A_PLUS.min_ev &&
        result.confidence >= CONFIG.QUALITY_TIERS.A_PLUS.min_confidence) {
      qualityTier = 'A_PLUS';
    }
    
    // Get odds
    let odds = ctx.odds?.['1x2']?.['1'] || 2.0;
    if (result.pick.selection === 'X') {
      odds = ctx.odds?.['1x2']?.['X'] || 3.3;
    } else if (result.pick.selection === '2') {
      odds = ctx.odds?.['1x2']?.['2'] || 3.5;
    } else if (result.pick.market === 'over_under') {
      odds = result.pick.selection === 'over' 
        ? (ctx.odds?.over25?.over || 1.9)
        : (ctx.odds?.over25?.under || 1.9);
    }
    
    // Selection name
    const selectionName = result.pick.selection === '1' ? ctx.match.home :
                         result.pick.selection === '2' ? ctx.match.away :
                         result.pick.selection === 'X' ? 'Empate' :
                         result.pick.selection === 'over' ? 'Over 2.5' : 'Under 2.5';
    
    validPicks.push({
      fixture_id: ctx.fixture_id,
      league: ctx.league.name,
      home_team: ctx.match.home,
      away_team: ctx.match.away,
      kickoff: ctx.match.kickoff_utc,
      market: result.pick.market === '1X2' ? '1X2' : 'Over/Under 2.5',
      selection: selectionName,
      odds,
      estimated_prob: result.pick.estimated_prob,
      implied_prob: ctx.odds?.implied_probs_normalized?.home_win || 0.33,
      edge_percent: Math.round(result.pick.expected_value * 100),
      confidence: Math.round(result.confidence * 10),
      quality_tier: qualityTier,
      analysis: result.analysis,
      risk_factors: result.risk_factors || [],
      source: 'daily_auto',
      sport: 'football'
    });
  }
  
  // Sort by confidence * edge
  validPicks.sort((a, b) => (b.confidence * b.edge_percent) - (a.confidence * a.edge_percent));
  
  return validPicks.slice(0, CONFIG.MAX_PICKS_PER_DAY);
}

// =====================================================
// SAVE TO SUPABASE
// =====================================================

async function savePicksToSupabase(picks) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || picks.length === 0) return;
  
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(picks.map(p => ({
        sport: 'football',
        match_name: `${p.home_team} vs ${p.away_team}`,
        date: p.kickoff.split('T')[0],
        league: p.league,
        home_team: p.home_team,
        away_team: p.away_team,
        kickoff: p.kickoff,
        market: p.market,
        selection: p.selection,
        odds: p.odds,
        estimated_prob: p.estimated_prob,
        implied_prob: p.implied_prob,
        edge_percent: p.edge_percent,
        confidence: p.confidence,
        quality_tier: p.quality_tier,
        analysis_text: p.analysis,
        risk_factors: p.risk_factors,
        is_official: true,
        status: 'pending',
        source: 'daily_auto'
      })))
    });
    
    console.log(`✅ Saved ${picks.length} picks to Supabase`);
  } catch (error) {
    console.error("Save error:", error.message);
  }
}

// =====================================================
// MAIN HANDLER
// =====================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();
  discardedPicks = [];
  
  try {
    const { date } = req.body || {};
    const targetDate = date || new Date().toISOString().split('T')[0];
    const season = new Date(targetDate).getFullYear();
    
    console.log(`\n🚀 Football Picks Generation - ${targetDate}`);
    console.log(`📊 Season: ${season}`);
    console.log(`🎯 Max picks: ${CONFIG.MAX_PICKS_PER_DAY}`);
    
    checkAndResetCounter();
    
    // STEP 1: Get fixtures
    console.log("\n📅 STEP 1: Fetching fixtures...");
    const fixtures = await getFixtures(targetDate);
    console.log(`   Found ${fixtures.length} fixtures from allowed leagues`);
    
    if (fixtures.length === 0) {
      return res.status(200).json({
        date: targetDate,
        picks_generated: 0,
        picks: [],
        discarded_count: 0,
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: "No fixtures found from allowed leagues"
      });
    }
    
    // STEP 2: Build context for each fixture (with budget check)
    console.log("\n📊 STEP 2: Building rich context...");
    const contexts = [];
    
    for (const fixture of fixtures) {
      // Check remaining budget
      const remaining = CONFIG.MAX_API_REQUESTS - requestCountToday;
      if (remaining < 15) {
        console.log(`   ⚠️ API budget low (${remaining} remaining), stopping context building`);
        break;
      }
      
      const context = await buildMatchContext(fixture, season);
      
      // Validate minimum data
      const validation = validateMinimumData(context);
      if (validation.valid) {
        contexts.push(context);
        console.log(`   ✅ ${fixture.home.name} vs ${fixture.away.name} (${validation.score}/6 data)`);
      } else {
        logDiscardedPick(
          { home: fixture.home, away: fixture.away },
          fixture.league.id,
          DISCARD_REASONS.INSUFFICIENT_DATA,
          { validation_score: validation.score, issues: validation.issues.join(', ') }
        );
      }
    }
    
    console.log(`   ${contexts.length} fixtures with sufficient data`);
    
    if (contexts.length === 0) {
      await saveDiscardedPicksToSupabase(discardedPicks);
      return res.status(200).json({
        date: targetDate,
        picks_generated: 0,
        picks: [],
        discarded_count: discardedPicks.length,
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: "No fixtures with sufficient data quality"
      });
    }
    
    // STEP 3: LLM Analysis
    console.log("\n🤖 STEP 3: LLM Analysis...");
    const llmResults = [];
    
    for (const ctx of contexts) {
      console.log(`   Analyzing: ${ctx.match.home} vs ${ctx.match.away}`);
      const analysis = await analyzeWithLLM(ctx);
      llmResults.push(analysis);
    }
    
    // STEP 4: Select best picks
    console.log("\n✅ STEP 4: Selecting picks...");
    const picks = selectBestPicks(llmResults, contexts);
    console.log(`   Selected ${picks.length} picks`);
    
    // STEP 5: Save
    if (picks.length > 0) {
      console.log("\n💾 STEP 5: Saving to Supabase...");
      await savePicksToSupabase(picks);
    }
    
    await saveDiscardedPicksToSupabase(discardedPicks);
    
    const executionTime = Date.now() - startTime;
    console.log(`\n🎉 Complete! ${picks.length} picks, ${requestCountToday} API calls, ${executionTime}ms`);
    
    return res.status(200).json({
      date: targetDate,
      picks_generated: picks.length,
      picks,
      discarded_count: discardedPicks.length,
      api_requests_used: requestCountToday,
      execution_time_ms: executionTime,
      message: picks.length === 0 ? "No quality picks found today" : undefined
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
    await saveDiscardedPicksToSupabase(discardedPicks);
    
    return res.status(500).json({
      error: "Failed to generate picks",
      message: error.message,
      api_requests_used: requestCountToday,
      execution_time_ms: Date.now() - startTime
    });
  }
}
