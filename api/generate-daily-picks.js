/**
 * Football Picks Generation API
 * 
 * POST /api/generate-daily-picks
 * Body: { date?: string }
 * 
 * Architecture:
 * 1. Data Layer: Fetch from API-Football v3
 * 2. Build clean match data object (EXACT structure)
 * 3. Validate minimum data (2+ missing = discard)
 * 4. Pass ONLY the object to LLM (no endpoints, URLs, or frontend code)
 */

const SPORTS_API_KEY = process.env.SPORTS_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENROUTERFREE_API_KEY;
const GOOGLE_SHEETS_URL = process.env.GOOGLE_SHEETS_URL;

// =====================================================
// CONFIGURATION
// =====================================================

const CONFIG = {
  MAX_PICKS_PER_DAY: 3,
  MAX_API_REQUESTS: 100,
  
  ALLOWED_LEAGUES: [
    // Top 5 European Leagues
    { id: 39, name: "Premier League", country: "England", tier: 1 },
    { id: 140, name: "La Liga", country: "Spain", tier: 1 },
    { id: 135, name: "Serie A", country: "Italy", tier: 1 },
    { id: 78, name: "Bundesliga", country: "Germany", tier: 1 },
    { id: 61, name: "Ligue 1", country: "France", tier: 1 },
    // European Competitions
    { id: 2, name: "UEFA Champions League", country: "Europe", tier: 1 },
    { id: 3, name: "UEFA Europa League", country: "Europe", tier: 1 },
    { id: 848, name: "UEFA Conference League", country: "Europe", tier: 2 },
    // Other European Leagues
    { id: 94, name: "Liga Portugal", country: "Portugal", tier: 2 },
    { id: 88, name: "Eredivisie", country: "Netherlands", tier: 2 },
    { id: 144, name: "Jupiler Pro League", country: "Belgium", tier: 2 },
    { id: 179, name: "Premiership", country: "Scotland", tier: 2 },
    { id: 203, name: "Süper Lig", country: "Turkey", tier: 2 },
    // Americas
    { id: 71, name: "Brasileirao Serie A", country: "Brazil", tier: 2 },
    { id: 128, name: "Liga Profesional", country: "Argentina", tier: 2 },
    { id: 262, name: "Liga MX", country: "Mexico", tier: 2 },
    { id: 253, name: "MLS", country: "USA", tier: 2 }
  ],
  
  MIN_CONFIDENCE: 0.65,
  MIN_EV: 0.04,
  LLM_MODEL: "deepseek/deepseek-chat",
  
  BOOKMAKER_ID: 8, // Bet365
  
  BET_TYPES: {
    MATCH_WINNER: 1,
    OVER_UNDER_15: 243,
    OVER_UNDER_25: 5,
    OVER_UNDER_35: 244,
    BTTS: 12,
    CORNERS: 17
  },
  
  STANDINGS_CACHE_TTL: 24 * 60 * 60 * 1000,
  TEAM_STATS_CACHE_TTL: 12 * 60 * 60 * 1000,
  
  // Validation thresholds
  MIN_FORM_MATCHES: 5,
  MIN_H2H_MATCHES: 3
};

const DISCARD_REASONS = {
  INSUFFICIENT_DATA: "datos_insuficientes",
  LOW_CONFIDENCE: "confianza_baja",
  LOW_EV: "ev_insuficiente",
  NO_VALUE: "sin_value_bet"
};

// =====================================================
// SEASON LOGIC
// =====================================================

// Ligas que usan temporada por año calendario (no cruzan años)
const CALENDAR_YEAR_LEAGUES = [
  71,   // Brasileirao
  128,  // Argentina Liga Profesional
  262,  // Liga MX
  253   // MLS
];

/**
 * Determina la temporada correcta según la liga y fecha
 * - Ligas europeas: temporada cruza años (ej: 2025-26 usa season=2025)
 * - Ligas América: temporada por año calendario (ej: 2026 usa season=2026)
 */
function getSeasonForLeague(leagueId, dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  
  // Ligas de América usan año calendario
  if (CALENDAR_YEAR_LEAGUES.includes(leagueId)) {
    return year;
  }
  
  // Ligas europeas cruzan años (agosto-mayo)
  // Si mes >= 8 (ago-dic): temporada empieza este año
  // Si mes < 8 (ene-jul): temporada empezó el año anterior
  if (month >= 8) {
    return year;
  } else {
    return year - 1;
  }
}

// =====================================================
// CACHES & STATE
// =====================================================

const standingsCache = new Map();
const teamStatsCache = new Map();
let requestCountToday = 0;
let lastResetDate = new Date().toISOString().split('T')[0];
let discardedPicks = [];

// =====================================================
// CORE API FETCH
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

async function fetchAPI(endpoint) {
  if (!SPORTS_API_KEY) throw new Error('SPORTS_API_KEY not configured');
  if (requestCountToday >= CONFIG.MAX_API_REQUESTS) {
    throw new Error(`API limit reached: ${requestCountToday}/${CONFIG.MAX_API_REQUESTS}`);
  }
  
  const url = `https://v3.football.api-sports.io/${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'x-apisports-key': SPORTS_API_KEY }
    });
    
    if (!response.ok) {
      console.error(`API error ${response.status}`);
      return null;
    }
    
    requestCountToday++;
    return response.json();
  } catch (error) {
    console.error(`Fetch error: ${error.message}`);
    return null;
  }
}

function logDiscarded(match, leagueId, reason, extra = {}) {
  const entry = {
    date: new Date().toISOString().split('T')[0],
    match_name: `${match.local || 'Home'} vs ${match.visitante || 'Away'}`,
    league: CONFIG.ALLOWED_LEAGUES.find(l => l.id === leagueId)?.name || `League ${leagueId}`,
    league_id: leagueId,
    reason,
    ...extra,
    created_at: new Date().toISOString()
  };
  discardedPicks.push(entry);
  console.log(`   ❌ DISCARDED: ${entry.match_name} - ${reason}`);
}

async function saveDiscarded() {
  // Save discarded picks to Google Sheets for logging
  if (discardedPicks.length > 0) {
    const entries = discardedPicks.map(p => ({
      date: p.date,
      sport: p.sport || 'football',
      match_id: p.match_id || `discarded-${Date.now()}`,
      league: p.league,
      reason: p.reason,
      details: JSON.stringify(p.extra || {}),
      created_at: new Date().toISOString()
    }));
    
    try {
      await writeToCache(entries);
      console.log(`   📝 Saved ${entries.length} discarded picks to Google Sheets`);
    } catch (e) {
      console.log(`   ⚠️ Could not save discarded picks to Google Sheets:`, e.message);
    }
  }
}

// =====================================================
// DATA FETCHING FUNCTIONS
// =====================================================

async function getFixtures(date) {
  console.log(`   🔍 Fetching fixtures for ${date}...`);
  const data = await fetchAPI(`fixtures?date=${date}&timezone=UTC`);
  
  if (!data?.response) {
    console.log(`   ⚠️ No response from API fixtures endpoint`);
    return [];
  }
  
  console.log(`   📊 API returned ${data.response.length} total fixtures`);
  
  // Log first few unique leagues
  const uniqueLeagues = [...new Set(data.response.map(f => f.league.id))];
  console.log(`   📋 Unique leagues found: ${uniqueLeagues.slice(0, 10).join(', ')}${uniqueLeagues.length > 10 ? '...' : ''}`);
  
  // Include upcoming and live match states
  const validStates = ['NS', 'TBD', 'PST', 'CANC', 'SUSP', 'INT', 'LIVE', '1H', '2H', 'HT'];
  
  const afterStatusFilter = data.response.filter(f => validStates.includes(f.fixture.status.short));
  console.log(`   📊 After status filter: ${afterStatusFilter.length}`);
  
  const afterLeagueFilter = afterStatusFilter.filter(f => CONFIG.ALLOWED_LEAGUES.some(l => l.id === f.league.id));
  console.log(`   📊 After league filter: ${afterLeagueFilter.length}`);
  
  // Debug: show which leagues matched
  const matchedLeagues = afterStatusFilter
    .filter(f => CONFIG.ALLOWED_LEAGUES.some(l => l.id === f.league.id))
    .map(f => f.league.id);
  const unmatchedLeagues = [...new Set(afterStatusFilter.filter(f => !CONFIG.ALLOWED_LEAGUES.some(l => l.id === f.league.id)).map(f => f.league.id))];
  console.log(`   📋 Matched leagues: ${[...new Set(matchedLeagues)].join(', ') || 'NONE'}`);
  console.log(`   📋 Unmatched leagues (sample): ${unmatchedLeagues.slice(0, 5).join(', ')}`);
  
  return afterLeagueFilter.map(f => ({
      fixture_id: f.fixture.id,
      league_id: f.league.id,
      league_name: f.league.name,
      country: f.league.country,
      home_id: f.teams.home.id,
      home_name: f.teams.home.name,
      away_id: f.teams.away.id,
      away_name: f.teams.away.name,
      kickoff_utc: f.fixture.date
    }));
}

async function getStandings(leagueId, season) {
  const cacheKey = `${leagueId}-${season}`;
  const cached = standingsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CONFIG.STANDINGS_CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchAPI(`standings?league=${leagueId}&season=${season}`);
  if (!data?.response?.[0]?.league?.standings?.[0]) return [];
  
  const standings = data.response[0].league.standings[0].map(t => ({
    team_id: t.team.id,
    posicion: t.rank,
    puntos: t.points,
    forma: t.form,
    goles_favor: t.all.goals.for,
    goles_contra: t.all.goals.against,
    record_casa: `${t.home.win}W-${t.home.draw}D-${t.home.lose}L`,
    record_fuera: `${t.away.win}W-${t.away.draw}D-${t.away.lose}L`,
    descripcion: t.description || null
  }));
  
  standingsCache.set(cacheKey, { data: standings, timestamp: Date.now() });
  return standings;
}

async function getTeamStatistics(leagueId, season, teamId) {
  const cacheKey = `${leagueId}-${season}-${teamId}`;
  const cached = teamStatsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CONFIG.TEAM_STATS_CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchAPI(`teams/statistics?league=${leagueId}&season=${season}&team=${teamId}`);
  if (!data?.response) return null;
  
  const s = data.response;
  
  const result = {
    promedio_goles_anotados_casa: parseFloat(s.goals?.for?.average?.home) || 0,
    promedio_goles_anotados_fuera: parseFloat(s.goals?.for?.average?.away) || 0,
    promedio_goles_recibidos_casa: parseFloat(s.goals?.against?.average?.home) || 0,
    promedio_goles_recibidos_fuera: parseFloat(s.goals?.against?.average?.away) || 0,
    partidos_sin_recibir_casa: s.clean_sheet?.home || 0,
    partidos_sin_recibir_fuera: s.clean_sheet?.away || 0,
    partidos_sin_anotar_casa: s.failed_to_score?.home || 0,
    partidos_sin_anotar_fuera: s.failed_to_score?.away || 0,
    formacion_habitual: s.lineups?.[0]?.formation || 'Unknown',
    promedio_corners_favor: (s.cards?.total || 0) / (s.fixtures?.played || 1) || 0
  };
  
  teamStatsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

async function getRecentForm(teamId) {
  const data = await fetchAPI(`fixtures?team=${teamId}&last=10&timezone=UTC`);
  if (!data?.response) return null;
  
  const matches = data.response.map(f => {
    const isHome = f.teams.home.id === teamId;
    const gf = isHome ? f.goals.home : f.goals.away;
    const ga = isHome ? f.goals.away : f.goals.home;
    
    let resultado = 'D';
    if (gf > ga) resultado = 'W';
    else if (gf < ga) resultado = 'L';
    
    return { resultado, gf, ga, fue_local: isHome };
  });
  
  let racha = '';
  for (const m of matches) {
    if (racha === '' || racha[0] === m.resultado) {
      racha = m.resultado + racha;
    } else break;
  }
  
  const totalGF = matches.reduce((sum, m) => sum + m.gf, 0);
  const totalGA = matches.reduce((sum, m) => sum + m.ga, 0);
  
  // Calculate % times scored as home/away
  const homeMatches = matches.filter(m => m.fue_local);
  const awayMatches = matches.filter(m => !m.fue_local);
  
  const scoredAsHome = homeMatches.filter(m => m.gf > 0).length;
  const scoredAsAway = awayMatches.filter(m => m.gf > 0).length;
  
  return {
    ultimos10: matches,
    promedio_gf: Math.round((totalGF / matches.length) * 100) / 100,
    promedio_ga: Math.round((totalGA / matches.length) * 100) / 100,
    racha_actual: racha || 'N/A',
    partidos_count: matches.length,
    porcentaje_anota_local: homeMatches.length > 0 ? Math.round((scoredAsHome / homeMatches.length) * 100) : 50,
    porcentaje_anota_visitante: awayMatches.length > 0 ? Math.round((scoredAsAway / awayMatches.length) * 100) : 50
  };
}

async function getH2H(homeId, awayId) {
  const data = await fetchAPI(`fixtures?h2h=${homeId}-${awayId}&last=10`);
  if (!data?.response) return null;
  
  const ultimos10 = data.response.map(f => {
    let ganador = 'empate';
    if (f.goals.home > f.goals.away) ganador = 'local';
    else if (f.goals.home < f.goals.away) ganador = 'visitante';
    
    return {
      ganador,
      goles_total: (f.goals.home || 0) + (f.goals.away || 0)
    };
  });
  
  let victorias_local = 0, victorias_visitante = 0, empates = 0, over25 = 0;
  
  for (const m of ultimos10) {
    if (m.ganador === 'local') victorias_local++;
    else if (m.ganador === 'visitante') victorias_visitante++;
    else empates++;
    if (m.goles_total > 2.5) over25++;
  }
  
  const avgGoals = ultimos10.length > 0 
    ? Math.round((ultimos10.reduce((s, m) => s + m.goles_total, 0) / ultimos10.length) * 100) / 100
    : 0;
  
  // Calculate BTTS percentage in H2H
  const bttsCount = ultimos10.filter(m => m.goles_total > 0 && 
    m.ganador !== 'empate' || (m.goles_total >= 2)).length;
  
  return {
    ultimos10,
    promedio_goles_total: avgGoals,
    victorias_local,
    victorias_visitante,
    empates,
    over25_porcentaje: ultimos10.length > 0 ? `${Math.round((over25 / ultimos10.length) * 100)}%` : '0%',
    btts_porcentaje: ultimos10.length > 0 ? `${Math.round((bttsCount / ultimos10.length) * 100)}%` : '50%'
  };
}

async function getOdds(fixtureId) {
  const cuotas = {
    resultado: null,
    over15: null,
    over25: null,
    over35: null,
    btts: null,
    corners: null
  };
  
  // 1X2
  try {
    const d = await fetchAPI(`odds?fixture=${fixtureId}&bookmaker=${CONFIG.BOOKMAKER_ID}&bet=${CONFIG.BET_TYPES.MATCH_WINNER}`);
    if (d?.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
      const v = d.response[0].bookmakers[0].bets[0].values;
      cuotas.resultado = {
        '1': parseFloat(v.find(x => x.value === 'Home')?.odd || '0'),
        'X': parseFloat(v.find(x => x.value === 'Draw')?.odd || '0'),
        '2': parseFloat(v.find(x => x.value === 'Away')?.odd || '0')
      };
    }
  } catch (e) {}
  
  // Over 1.5
  try {
    const d = await fetchAPI(`odds?fixture=${fixtureId}&bookmaker=${CONFIG.BOOKMAKER_ID}&bet=${CONFIG.BET_TYPES.OVER_UNDER_15}`);
    if (d?.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
      const v = d.response[0].bookmakers[0].bets[0].values;
      cuotas.over15 = {
        over: parseFloat(v.find(x => x.value === 'Over')?.odd || '0'),
        under: parseFloat(v.find(x => x.value === 'Under')?.odd || '0')
      };
    }
  } catch (e) {}
  
  // Over 2.5
  try {
    const d = await fetchAPI(`odds?fixture=${fixtureId}&bookmaker=${CONFIG.BOOKMAKER_ID}&bet=${CONFIG.BET_TYPES.OVER_UNDER_25}`);
    if (d?.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
      const v = d.response[0].bookmakers[0].bets[0].values;
      cuotas.over25 = {
        over: parseFloat(v.find(x => x.value === 'Over')?.odd || '0'),
        under: parseFloat(v.find(x => x.value === 'Under')?.odd || '0')
      };
    }
  } catch (e) {}
  
  // Over 3.5
  try {
    const d = await fetchAPI(`odds?fixture=${fixtureId}&bookmaker=${CONFIG.BOOKMAKER_ID}&bet=${CONFIG.BET_TYPES.OVER_UNDER_35}`);
    if (d?.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
      const v = d.response[0].bookmakers[0].bets[0].values;
      cuotas.over35 = {
        over: parseFloat(v.find(x => x.value === 'Over')?.odd || '0'),
        under: parseFloat(v.find(x => x.value === 'Under')?.odd || '0')
      };
    }
  } catch (e) {}
  
  // BTTS
  try {
    const d = await fetchAPI(`odds?fixture=${fixtureId}&bookmaker=${CONFIG.BOOKMAKER_ID}&bet=${CONFIG.BET_TYPES.BTTS}`);
    if (d?.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
      const v = d.response[0].bookmakers[0].bets[0].values;
      cuotas.btts = {
        yes: parseFloat(v.find(x => x.value === 'Yes')?.odd || '0'),
        no: parseFloat(v.find(x => x.value === 'No')?.odd || '0')
      };
    }
  } catch (e) {}
  
  // Corners
  try {
    const d = await fetchAPI(`odds?fixture=${fixtureId}&bookmaker=${CONFIG.BOOKMAKER_ID}&bet=${CONFIG.BET_TYPES.CORNERS}`);
    if (d?.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
      const b = d.response[0].bookmakers[0].bets[0];
      cuotas.corners = {
        linea: parseFloat(b.values?.[0]?.value?.replace('Over ', '')?.replace('.5', '.5')) || 9.5,
        over: parseFloat(b.values?.find(x => x.value.startsWith('Over'))?.odd || '1.85'),
        under: parseFloat(b.values?.find(x => x.value.startsWith('Under'))?.odd || '1.90')
      };
    }
  } catch (e) {}
  
  // Normalized probabilities
  let probabilidades_implicitas_normalizadas = null;
  if (cuotas.resultado && cuotas.resultado['1'] > 0) {
    const r1 = 1 / cuotas.resultado['1'];
    const rX = 1 / cuotas.resultado['X'];
    const r2 = 1 / cuotas.resultado['2'];
    const sum = r1 + rX + r2;
    
    probabilidades_implicitas_normalizadas = {
      victoria_local: Math.round((r1 / sum) * 1000) / 1000,
      empate: Math.round((rX / sum) * 1000) / 1000,
      victoria_visitante: Math.round((r2 / sum) * 1000) / 1000
    };
  }
  
  return { ...cuotas, probabilidades_implicitas_normalizadas };
}

async function getPrediction(fixtureId) {
  const data = await fetchAPI(`predictions?fixture=${fixtureId}`);
  if (!data?.response?.[0]) return null;
  
  const p = data.response[0];
  const c = p.comparison || {};
  
  return {
    ganador_sugerido: p.predictions?.winner?.name || null,
    under_over: p.predictions?.under_over || null,
    consejo: p.predictions?.advice || null,
    comparacion: {
      forma: {
        local: c.form?.home || null,
        visitante: c.form?.away || null
      },
      ataque: {
        local: c.att?.home || null,
        visitante: c.att?.away || null
      },
      defensa: {
        local: c.def?.home || null,
        visitante: c.def?.away || null
      },
      poisson_goles: {
        local: parseFloat(c.poisson_distribution?.home) || null,
        visitante: parseFloat(c.poisson_distribution?.away) || null
      }
    }
  };
}

async function getInjuries(fixtureId, homeId, awayId) {
  const data = await fetchAPI(`injuries?fixture=${fixtureId}`);
  if (!data?.response) return { local: [], visitante: [] };
  
  const result = { local: [], visitante: [] };
  
  for (const i of data.response) {
    const entry = {
      nombre: i.player?.name || 'Unknown',
      motivo: i.player?.reason || 'Unknown'
    };
    if (i.team?.id === homeId) result.local.push(entry);
    else if (i.team?.id === awayId) result.visitante.push(entry);
  }
  
  return result;
}

async function getKeyPlayers(teamId) {
  const fixturesData = await fetchAPI(`fixtures?team=${teamId}&last=5`);
  if (!fixturesData?.response || fixturesData.response.length === 0) return [];
  
  const allPlayers = new Map();
  
  for (const fixture of fixturesData.response) {
    const playersData = await fetchAPI(`players?fixture=${fixture.fixture.id}&team=${teamId}`);
    if (!playersData?.response) continue;
    
    for (const p of playersData.response) {
      const name = p.player?.name;
      if (!name) continue;
      
      if (!allPlayers.has(name)) {
        allPlayers.set(name, {
          nombre: name,
          posicion: p.player?.position || 'Unknown',
          matches: [],
          total_goles: 0,
          total_asistencias: 0,
          total_minutos: 0,
          total_rating: 0
        });
      }
      
      const stats = p.statistics?.[0] || {};
      const player = allPlayers.get(name);
      player.matches.push(1);
      player.total_goles += stats.goals?.total || 0;
      player.total_asistencias += stats.goals?.assists || 0;
      player.total_minutos += stats.games?.minutes || 0;
      player.total_rating += parseFloat(stats.games?.rating) || 0;
    }
  }
  
  return Array.from(allPlayers.values())
    .filter(p => p.total_minutos > 0)
    .map(p => ({
      nombre: p.nombre,
      posicion: p.posicion,
      ultimos5_promedio: {
        goles: Math.round((p.total_goles / p.matches.length) * 100) / 100,
        asistencias: Math.round((p.total_asistencias / p.matches.length) * 100) / 100,
        minutos: Math.round(p.total_minutos / p.matches.length),
        rating: Math.round((p.total_rating / p.matches.length) * 10) / 10
      }
    }))
    .sort((a, b) => b.ultimos5_promedio.minutos - a.ultimos5_promedio.minutos)
    .slice(0, 3);
}

async function getCorners(homeId, awayId, leagueId, season) {
  const [homeStats, awayStats] = await Promise.all([
    getTeamStatistics(leagueId, season, homeId),
    getTeamStatistics(leagueId, season, awayId)
  ]);
  
  const promedio_local_favor = homeStats?.promedio_corners_favor || 5.5;
  const promedio_visitante_favor = awayStats?.promedio_corners_favor || 4.5;
  
  const local_favor_estimado = promedio_local_favor * 1.1;
  const visitante_favor_estimado = promedio_visitante_favor * 0.9;
  
  return {
    promedio_local_a_favor: Math.round(local_favor_estimado * 10) / 10,
    promedio_local_en_contra: Math.round(visitante_favor_estimado * 10) / 10,
    promedio_visitante_a_favor: Math.round(visitante_favor_estimado * 10) / 10,
    promedio_visitante_en_contra: Math.round(local_favor_estimado * 10) / 10,
    total_estimado: Math.round((local_favor_estimado + visitante_favor_estimado) * 10) / 10
  };
}

// =====================================================
// BUILD MATCH DATA OBJECT (EXACT STRUCTURE)
// =====================================================

async function buildMatchDataObject(fixture) {
  // Determine correct season based on league and date
  const season = getSeasonForLeague(fixture.league_id, fixture.kickoff_utc);
  console.log(`   📊 Building: ${fixture.home_name} vs ${fixture.away_name} (Season: ${season})`);
  
  const [standings, homeStats, awayStats, homeForm, awayForm, h2h, odds, prediction, injuries] = await Promise.all([
    getStandings(fixture.league_id, season),
    getTeamStatistics(fixture.league_id, season, fixture.home_id),
    getTeamStatistics(fixture.league_id, season, fixture.away_id),
    getRecentForm(fixture.home_id),
    getRecentForm(fixture.away_id),
    getH2H(fixture.home_id, fixture.away_id),
    getOdds(fixture.fixture_id),
    getPrediction(fixture.fixture_id),
    requestCountToday < CONFIG.MAX_API_REQUESTS - 10 
      ? getInjuries(fixture.fixture_id, fixture.home_id, fixture.away_id)
      : Promise.resolve({ local: [], visitante: [] })
  ]);
  
  const standingsLocal = standings.find(t => t.team_id === fixture.home_id);
  const standingsVisitante = standings.find(t => t.team_id === fixture.away_id);
  
  const corners = await getCorners(fixture.home_id, fixture.away_id, fixture.league_id, season);
  
  let jugadores_clave = { local: [], visitante: [] };
  if (requestCountToday < CONFIG.MAX_API_REQUESTS - 15) {
    const [homePlayers, awayPlayers] = await Promise.all([
      getKeyPlayers(fixture.home_id),
      getKeyPlayers(fixture.away_id)
    ]);
    jugadores_clave = { local: homePlayers, visitante: awayPlayers };
  }
  
  // =====================================================
  // EXACT DATA OBJECT STRUCTURE (as specified)
  // =====================================================
  
  const matchData = {
    partido: `${fixture.home_name} vs ${fixture.away_name}`,
    liga: fixture.league_name,
    pais: fixture.country,
    fecha_utc: fixture.kickoff_utc,
    
    standings: {
      local: standingsLocal ? {
        posicion: standingsLocal.posicion,
        puntos: standingsLocal.puntos,
        forma: standingsLocal.forma,
        goles_favor: standingsLocal.goles_favor,
        goles_contra: standingsLocal.goles_contra,
        record_casa: standingsLocal.record_casa,
        descripcion: standingsLocal.descripcion
      } : null,
      visitante: standingsVisitante ? {
        posicion: standingsVisitante.posicion,
        puntos: standingsVisitante.puntos,
        forma: standingsVisitante.forma,
        goles_favor: standingsVisitante.goles_favor,
        goles_contra: standingsVisitante.goles_contra,
        record_fuera: standingsVisitante.record_fuera,
        descripcion: standingsVisitante.descripcion
      } : null
    },
    
    estadisticas_equipo: {
      local: homeStats ? {
        promedio_goles_anotados_casa: homeStats.promedio_goles_anotados_casa,
        promedio_goles_recibidos_casa: homeStats.promedio_goles_recibidos_casa,
        partidos_sin_recibir_casa: homeStats.partidos_sin_recibir_casa,
        partidos_sin_anotar_casa: homeStats.partidos_sin_anotar_casa,
        clean_sheets_casa: homeStats.partidos_sin_recibir_casa,
        failed_to_score_casa: homeStats.partidos_sin_anotar_casa,
        formacion_habitual: homeStats.formacion_habitual
      } : null,
      visitante: awayStats ? {
        promedio_goles_anotados_fuera: awayStats.promedio_goles_anotados_fuera,
        promedio_goles_recibidos_fuera: awayStats.promedio_goles_recibidos_fuera,
        partidos_sin_recibir_fuera: awayStats.partidos_sin_recibir_fuera,
        partidos_sin_anotar_fuera: awayStats.partidos_sin_anotar_fuera,
        clean_sheets_fuera: awayStats.partidos_sin_recibir_fuera,
        failed_to_score_fuera: awayStats.partidos_sin_anotar_fuera,
        formacion_habitual: awayStats.formacion_habitual
      } : null
    },
    
    forma_reciente: {
      local: homeForm,
      visitante: awayForm
    },
    
    h2h,
    
    cuotas: {
      resultado: odds.resultado,
      over15: odds.over15,
      over25: odds.over25,
      over35: odds.over35,
      btts: odds.btts,
      corners: odds.corners
    },
    
    probabilidades_implicitas_normalizadas: odds.probabilidades_implicitas_normalizadas,
    
    prediccion_api: prediction,
    
    lesionados_suspendidos: injuries,
    
    corners,
    
    jugadores_clave,
    
    // Internal tracking (NOT passed to LLM)
    _meta: {
      fixture_id: fixture.fixture_id,
      league_id: fixture.league_id
    }
  };
  
  return matchData;
}

// =====================================================
// VALIDATION (2+ missing = discard)
// =====================================================

function validateMatchData(matchData) {
  const missing = [];
  
  // 1. standings - both teams must have position
  const hasStandings = matchData.standings?.local?.posicion && matchData.standings?.visitante?.posicion;
  if (!hasStandings) missing.push('standings');
  
  // 2. forma_reciente - min 5 matches for both teams
  const hasLocalForm = matchData.forma_reciente?.local?.partidos_count >= CONFIG.MIN_FORM_MATCHES;
  const hasAwayForm = matchData.forma_reciente?.visitante?.partidos_count >= CONFIG.MIN_FORM_MATCHES;
  if (!hasLocalForm && !hasAwayForm) missing.push('forma_reciente');
  else if (!hasLocalForm || !hasAwayForm) missing.push('forma_reciente_parcial');
  
  // 3. cuotas.resultado - must have 1X2 odds
  const hasOdds = matchData.cuotas?.resultado?.['1'] > 0;
  if (!hasOdds) missing.push('cuotas_resultado');
  
  // 4. prediccion_api - must have winner suggestion
  const hasPrediction = matchData.prediccion_api?.ganador_sugerido;
  if (!hasPrediction) missing.push('prediccion_api');
  
  // 5. h2h - min 3 matches
  const hasH2H = matchData.h2h?.ultimos10?.length >= CONFIG.MIN_H2H_MATCHES;
  if (!hasH2H) missing.push('h2h');
  
  // Count critical missing (exclude partial)
  const criticalMissing = missing.filter(m => !m.includes('parcial'));
  
  // VALIDATION RULE: 2+ missing = discard
  const shouldDiscard = criticalMissing.length >= 2;
  
  return {
    valid: !shouldDiscard,
    missing,
    criticalMissingCount: criticalMissing.length,
    details: {
      hasStandings,
      hasLocalForm,
      hasAwayForm,
      hasOdds,
      hasPrediction,
      hasH2H
    }
  };
}

// =====================================================
// LLM ANALYSIS WITH NEW SYSTEM PROMPT
// =====================================================

async function analyzeWithLLM(matchData) {
  if (!OPENROUTERFREE_API_KEY) return null;
  
  // =====================================================
  // COMPLETE SYSTEM PROMPT (as provided)
  // =====================================================
  
  const SYSTEM_PROMPT = `Eres Coco, analista experto en fútbol y value bets.
Recibes un JSON con datos reales de un partido.
Responde SIEMPRE en español y en JSON válido.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 1 — CADENA DE PENSAMIENTO INTERNO
(ejecutar antes de generar el JSON final)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Antes de responder, valida internamente:

A) CALIDAD DE DATOS
   ¿Tienes forma reciente de ambos equipos (mín 5 partidos)?
   ¿Tienes cuotas reales?
   ¿Tienes standings y H2H?
   → Si faltan 2 o más bloques: marcar data_quality="baja"
     y no proponer ningún value_bet=true.

B) CÁLCULO DE PROBABILIDADES
   Para cada mercado calcular:
   prob_implicita = 1 / cuota
   prob_normalizada = prob_implicita / suma_todas_implicitas
   prob_estimada = tu estimación basada en los datos
   EV = (prob_estimada × cuota) - 1

C) REFINAMIENTO ITERATIVO DEL EV
   Después de calcular el EV inicial, aplicar ajustes:
   - Lesionado titular en equipo favorecido:
     reducir prob_estimada en 0.05
   - Partido back-to-back:
     reducir prob_estimada en 0.03
   - H2H contradice la forma reciente:
     reducir confidence en 0.10
   - Predicción poisson de la API coincide con tu pick:
     aumentar confidence en 0.05
   Recalcular EV con prob_estimada ajustada.
   Este es el EV final que usarás en el JSON.

D) VALIDACIÓN DE CONFIANZA (no negociable)
   0.80+     → Solo si 4+ factores alineados Y EV >= 0.08
   0.65–0.79 → 2-3 factores, EV entre 0.04 y 0.08
   < 0.65    → value_bet: false obligatoriamente
   PROHIBIDO dar confidence > 0.75 sin al menos
   3 factores explícitos en supporting_factors.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 2 — ANALIZAR LOS 5 MERCADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MERCADO 1 — RESULTADO (1X2)
Usar: standings, forma como local/visitante específicamente,
H2H, lesionados, poisson de la API.
Calcular EV para las 3 opciones (1, X, 2).
Proponer solo la selección con EV ajustado más alto.

MERCADO 2 — AMBOS ANOTAN (BTTS)
Estimar:
  prob_local_anota  = % veces anotó como local en last10
  prob_visitante_anota = % veces anotó como visitante en last10
  prob_btts = prob_local_anota × prob_visitante_anota
Cruzar con:
  clean_sheets de ambos equipos
  failed_to_score de ambos equipos
  % de BTTS en H2H recientes
  Lesionados: ¿falta el goleador principal?

MERCADO 3 — TOTAL GOLES (OVER/UNDER)
Calcular xG estimado:
  xG = promedio_goles_anotados_local_en_casa
     + promedio_goles_anotados_visitante_fuera
Comparar xG con líneas 1.5 / 2.5 / 3.5 disponibles.
Usar también: avg_total_goals de H2H y over25_porcentaje.
Elegir la línea con mayor EV ajustado.

MERCADO 4 — CORNERS (ALTA/BAJA)
Calcular total estimado:
  total = promedio_corners_a_favor_local
        + promedio_corners_a_favor_visitante
Comparar con línea disponible (típico 9.5 o 10.5).
Si no hay cuota: reportar tendencia informativa únicamente.
Considerar: equipos ofensivos generan más corners,
formaciones atacantes vs defensivas.

MERCADO 5 — PROYECCIÓN INTEGRADA
Cruzar los 4 mercados anteriores para dar:
- Resultado más probable del partido
- Marcador estimado orientativo
- Rango de goles esperado
- Rango de corners esperado
- Si BTTS es probable o no
- El pick con mayor EV de los 4 mercados anteriores

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 3 — FORMATO DE RESPUESTA JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Responde ÚNICAMENTE con este JSON, sin texto fuera de él:

{
  "partido": "string",
  "liga": "string",
  "data_quality": "alta" | "media" | "baja",

  "mercados": {

    "resultado_1x2": {
      "seleccion": "1" | "X" | "2",
      "prob_estimada": number,
      "prob_implicita_normalizada": number,
      "cuota": number,
      "ev_ajustado": number,
      "value_bet": boolean,
      "confidence": number,
      "analisis": "máx 80 palabras citando datos concretos"
    },

    "ambos_anotan": {
      "seleccion": "yes" | "no",
      "prob_local_anota": number,
      "prob_visitante_anota": number,
      "prob_btts_estimada": number,
      "cuota": number,
      "ev_ajustado": number,
      "value_bet": boolean,
      "confidence": number,
      "analisis": "máx 60 palabras"
    },

    "total_goles": {
      "xg_estimado": number,
      "seleccion": "over" | "under",
      "linea": number,
      "cuota": number,
      "ev_ajustado": number,
      "value_bet": boolean,
      "confidence": number,
      "analisis": "máx 60 palabras"
    },

    "corners": {
      "total_estimado": number,
      "tendencia": "alta" | "media" | "baja",
      "linea": number | null,
      "seleccion": "over" | "under" | "sin_cuota",
      "cuota": number | null,
      "ev_ajustado": number | null,
      "value_bet": boolean,
      "confidence": number,
      "analisis": "máx 50 palabras"
    },

    "proyeccion_final": {
      "resultado_probable": "1" | "X" | "2",
      "marcador_estimado": "2-1",
      "rango_goles": "2-3",
      "rango_corners": "9-11",
      "btts_probable": boolean,
      "resumen": "máx 60 palabras integrando todo el análisis",
      "mejor_pick": {
        "mercado": "string",
        "seleccion": "string",
        "cuota": number,
        "ev_ajustado": number
      }
    }
  },

  "picks_con_value": [
    {
      "mercado": "string",
      "seleccion": "string",
      "cuota": number,
      "ev_ajustado": number,
      "confidence": number
    }
  ],

  "supporting_factors": [
    "factor concreto 1",
    "factor concreto 2",
    "factor concreto 3"
  ],

  "risk_factors": [
    "riesgo 1",
    "riesgo 2"
  ],

  "ajustes_aplicados": [
    "Descripción de cada ajuste del refinamiento iterativo aplicado"
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS FINALES PROHIBIDAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- NUNCA inventar datos no presentes en el JSON recibido
- NUNCA omitir el campo ajustes_aplicados (usar [] si no aplica)
- NUNCA emitir value_bet: true con confidence < 0.65
- NUNCA dar confidence > 0.75 sin mínimo 3 supporting_factors
- NUNCA responder con texto fuera del bloque JSON
- NUNCA analizar partidos de ligas femeninas, juveniles
  o segunda división`;

  // Create clean object for LLM (remove _meta)
  const cleanMatchData = { ...matchData };
  delete cleanMatchData._meta;
  
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
          { role: "user", content: JSON.stringify(cleanMatchData, null, 2) }
        ],
        temperature: 0.1,
        max_tokens: 1500,
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
// PROCESS LLM RESULTS (NEW FORMAT)
// =====================================================

function processLLMResults(llmResult, matchData) {
  if (!llmResult) return null;
  
  // Check data quality
  if (llmResult.data_quality === 'baja') {
    return null;
  }
  
  // Get picks with value
  const picksConValue = llmResult.picks_con_value || [];
  
  if (picksConValue.length === 0) {
    return null;
  }
  
  // Get the best pick
  const bestPick = llmResult.mercados?.proyeccion_final?.mejor_pick || picksConValue[0];
  
  if (!bestPick) return null;
  
  // Validate confidence
  const pickWithValue = picksConValue.find(p => 
    p.mercado === bestPick.mercado && p.seleccion === bestPick.seleccion
  );
  
  const confidence = pickWithValue?.confidence || 0;
  const evAjustado = bestPick.ev_ajustado || 0;
  
  // Apply validation rules
  if (confidence < CONFIG.MIN_CONFIDENCE) {
    return { valid: false, reason: 'low_confidence', confidence, ev: evAjustado };
  }
  
  if (evAjustado < CONFIG.MIN_EV) {
    return { valid: false, reason: 'low_ev', confidence, ev: evAjustado };
  }
  
  // Determine quality tier
  let qualityTier = 'B';
  if (evAjustado >= 0.08 && confidence >= 0.80) {
    qualityTier = 'A_PLUS';
  }
  
  // Get actual odds from match data
  let odds = bestPick.cuota || 2.0;
  const { mercado, seleccion } = bestPick;
  
  if (mercado === 'resultado_1x2' || mercado === 'resultado') {
    const sel = seleccion === '1' ? '1' : seleccion === '2' ? '2' : 'X';
    odds = matchData.cuotas?.resultado?.[sel] || odds;
  } else if (mercado === 'total_goles' || mercado.includes('over')) {
    const linea = bestPick.linea || 2.5;
    if (linea === 1.5) {
      odds = seleccion === 'over' 
        ? (matchData.cuotas?.over15?.over || 1.3)
        : (matchData.cuotas?.over15?.under || 3.5);
    } else if (linea === 2.5) {
      odds = seleccion === 'over' 
        ? (matchData.cuotas?.over25?.over || 1.9)
        : (matchData.cuotas?.over25?.under || 1.9);
    } else if (linea === 3.5) {
      odds = seleccion === 'over' 
        ? (matchData.cuotas?.over35?.over || 3.0)
        : (matchData.cuotas?.over35?.under || 1.4);
    }
  } else if (mercado === 'ambos_anotan' || mercado === 'btts') {
    odds = seleccion === 'yes'
      ? (matchData.cuotas?.btts?.yes || 1.75)
      : (matchData.cuotas?.btts?.no || 1.95);
  } else if (mercado === 'corners') {
    odds = seleccion === 'over'
      ? (matchData.cuotas?.corners?.over || 1.85)
      : (matchData.cuotas?.corners?.under || 1.90);
  }
  
  // Build selection name
  const [home, away] = matchData.partido.split(' vs ');
  let selectionName = '';
  
  if (mercado === 'resultado_1x2' || mercado === 'resultado') {
    selectionName = seleccion === '1' ? home : seleccion === '2' ? away : 'Empate';
  } else if (mercado === 'total_goles' || mercado.includes('over')) {
    const linea = bestPick.linea || 2.5;
    selectionName = `${seleccion === 'over' ? 'Over' : 'Under'} ${linea}`;
  } else if (mercado === 'ambos_anotan' || mercado === 'btts') {
    selectionName = seleccion === 'yes' ? 'Sí' : 'No';
  } else if (mercado === 'corners') {
    const linea = matchData.cuotas?.corners?.linea || 9.5;
    selectionName = `${seleccion === 'over' ? 'Over' : 'Under'} ${linea} corners`;
  } else {
    selectionName = `${seleccion}`;
  }
  
  // Get analysis from appropriate market
  let analysis = '';
  if (mercado === 'resultado_1x2' && llmResult.mercados?.resultado_1x2?.analisis) {
    analysis = llmResult.mercados.resultado_1x2.analisis;
  } else if (mercado === 'ambos_anotan' && llmResult.mercados?.ambos_anotan?.analisis) {
    analysis = llmResult.mercados.ambos_anotan.analisis;
  } else if (mercado === 'total_goles' && llmResult.mercados?.total_goles?.analisis) {
    analysis = llmResult.mercados.total_goles.analisis;
  } else if (mercado === 'corners' && llmResult.mercados?.corners?.analisis) {
    analysis = llmResult.mercados.corners.analisis;
  } else if (llmResult.mercados?.proyeccion_final?.resumen) {
    analysis = llmResult.mercados.proyeccion_final.resumen;
  }
  
  return {
    valid: true,
    pick: {
      fixture_id: matchData._meta.fixture_id,
      league: matchData.liga,
      home_team: home,
      away_team: away,
      kickoff: matchData.fecha_utc,
      market: mercado.toUpperCase(),
      selection: selectionName,
      odds,
      estimated_prob: pickWithValue?.prob_estimada || (1 / odds),
      implied_prob: matchData.probabilidades_implicitas_normalizadas?.victoria_local || 0.33,
      edge_percent: Math.round(evAjustado * 100),
      confidence: Math.round(confidence * 10),
      quality_tier: qualityTier,
      analysis,
      risk_factors: llmResult.risk_factors || [],
      supporting_factors: llmResult.supporting_factors || [],
      ajustes_aplicados: llmResult.ajustes_aplicados || [],
      source: 'daily_auto',
      sport: 'football'
    }
  };
}

// =====================================================
// SELECT BEST PICKS
// =====================================================

function selectBestPicks(llmResults, matchDataObjects) {
  const validPicks = [];
  
  for (let i = 0; i < llmResults.length; i++) {
    const result = llmResults[i];
    const match = matchDataObjects[i];
    
    if (!result) {
      logDiscarded(
        { local: match.partido.split(' vs ')[0], visitante: match.partido.split(' vs ')[1] },
        match._meta.league_id,
        DISCARD_REASONS.NO_VALUE,
        { reason: 'llm_no_response' }
      );
      continue;
    }
    
    const processed = processLLMResults(result, match);
    
    if (!processed) {
      logDiscarded(
        { local: match.partido.split(' vs ')[0], visitante: match.partido.split(' vs ')[1] },
        match._meta.league_id,
        DISCARD_REASONS.NO_VALUE,
        { data_quality: result.data_quality }
      );
      continue;
    }
    
    if (!processed.valid) {
      logDiscarded(
        { local: match.partido.split(' vs ')[0], visitante: match.partido.split(' vs ')[1] },
        match._meta.league_id,
        processed.reason === 'low_confidence' ? DISCARD_REASONS.LOW_CONFIDENCE : DISCARD_REASONS.LOW_EV,
        { confidence: processed.confidence, ev: processed.ev }
      );
      continue;
    }
    
    validPicks.push(processed.pick);
  }
  
  // Sort by confidence * edge
  validPicks.sort((a, b) => (b.confidence * b.edge_percent) - (a.confidence * a.edge_percent));
  
  return validPicks.slice(0, CONFIG.MAX_PICKS_PER_DAY);
}

// =====================================================
// SAVE TO GOOGLE SHEETS
// =====================================================

async function savePicks(picks) {
  if (!GOOGLE_SHEETS_URL || picks.length === 0) return;
  
  try {
    // Format picks for Google Sheets cache
    const cacheEntries = picks.map(p => formatCacheEntry({
      sport: 'football',
      home_team: p.home_team,
      away_team: p.away_team,
      league: p.league,
      date: p.kickoff.split('T')[0],
      kickoff: p.kickoff,
      market_type: p.market,
      selection: p.selection,
      odds: p.odds,
      implied_prob: p.implied_prob,
      stats_json: {
        estimated_prob: p.estimated_prob,
        edge_percent: p.edge_percent,
        confidence: p.confidence,
        quality_tier: p.quality_tier,
        analysis: p.analysis,
        risk_factors: p.risk_factors,
        supporting_factors: p.supporting_factors
      }
    }));
    
    const result = await writeToCache(cacheEntries);
    
    if (result.success) {
      console.log(`✅ Saved ${picks.length} picks to Google Sheets`);
    } else {
      console.log(`⚠️ Google Sheets save returned: ${result.reason || 'unknown error'}`);
    }
  } catch (e) {
    console.error("Google Sheets save error:", e.message);
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
    
    console.log(`\n🚀 Football Picks - ${targetDate} (Season ${season})`);
    
    checkAndResetCounter();
    
    // STEP 1: Get fixtures
    console.log("\n📅 STEP 1: Fetching fixtures...");
    const fixtures = await getFixtures(targetDate);
    console.log(`   Found ${fixtures.length} fixtures`);
    
    if (fixtures.length === 0) {
      return res.status(200).json({
        date: targetDate,
        picks_generated: 0,
        picks: [],
        discarded_count: 0,
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: "No fixtures found"
      });
    }
    
    // STEP 2: Build match data objects
    console.log("\n📊 STEP 2: Building match data objects...");
    const matchDataObjects = [];
    
    for (const fixture of fixtures) {
      if (requestCountToday >= CONFIG.MAX_API_REQUESTS - 20) {
        console.log(`   ⚠️ Budget low, stopping`);
        break;
      }
      
      const matchData = await buildMatchDataObject(fixture);
      
      // Validate: 2+ missing = discard
      const validation = validateMatchData(matchData);
      if (validation.valid) {
        matchDataObjects.push(matchData);
        console.log(`   ✅ ${matchData.partido} (missing: ${validation.missing.length})`);
      } else {
        logDiscarded(
          { local: fixture.home_name, visitante: fixture.away_name },
          fixture.league_id,
          DISCARD_REASONS.INSUFFICIENT_DATA,
          { missing: validation.missing.join(','), count: validation.criticalMissingCount }
        );
      }
    }
    
    console.log(`   ${matchDataObjects.length} matches validated`);
    
    if (matchDataObjects.length === 0) {
      await saveDiscarded();
      return res.status(200).json({
        date: targetDate,
        picks_generated: 0,
        picks: [],
        discarded_count: discardedPicks.length,
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: "No matches with sufficient data"
      });
    }
    
    // STEP 3: LLM Analysis
    console.log("\n🤖 STEP 3: LLM Analysis...");
    const llmResults = [];
    
    for (const match of matchDataObjects) {
      console.log(`   Analyzing: ${match.partido}`);
      const analysis = await analyzeWithLLM(match);
      llmResults.push(analysis);
    }
    
    // STEP 4: Select picks
    console.log("\n✅ STEP 4: Selecting picks...");
    const picks = selectBestPicks(llmResults, matchDataObjects);
    console.log(`   Selected ${picks.length} picks`);
    
    // STEP 5: Save
    if (picks.length > 0) {
      console.log("\n💾 STEP 5: Saving...");
      await savePicks(picks);
    }
    
    await saveDiscarded();
    
    const executionTime = Date.now() - startTime;
    console.log(`\n🎉 Complete! ${picks.length} picks, ${requestCountToday} API calls, ${executionTime}ms`);
    
    return res.status(200).json({
      date: targetDate,
      picks_generated: picks.length,
      picks,
      discarded_count: discardedPicks.length,
      api_requests_used: requestCountToday,
      execution_time_ms: executionTime
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
    await saveDiscarded();
    
    return res.status(500).json({
      error: "Failed",
      message: error.message,
      api_requests_used: requestCountToday,
      execution_time_ms: Date.now() - startTime
    });
  }
}
