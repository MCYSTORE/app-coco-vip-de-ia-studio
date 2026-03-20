/**
 * Football Picks Generation API
 * 
 * POST /api/generate-football-picks
 * Body: { date?: string }
 * 
 * Architecture:
 * 1. Data Layer: Fetch from API-Football v3
 * 2. Build clean match data object
 * 3. Validate minimum data
 * 4. Pass ONLY the object to LLM (no endpoints, URLs, or frontend code)
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
  MIN_H2H_MATCHES: 3,
  MIN_VALIDATION_SCORE: 4
};

const DISCARD_REASONS = {
  INSUFFICIENT_DATA: "datos_insuficientes",
  LOW_CONFIDENCE: "confianza_baja",
  LOW_EV: "ev_insuficiente",
  NO_VALUE: "sin_value_bet"
};

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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || discardedPicks.length === 0) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/picks_discarded`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(discardedPicks)
    });
  } catch (e) {}
}

// =====================================================
// DATA FETCHING FUNCTIONS
// =====================================================

async function getFixtures(date) {
  const data = await fetchAPI(`fixtures?date=${date}&timezone=UTC`);
  if (!data?.response) return [];
  
  return data.response
    .filter(f => f.fixture.status.short === 'NS')
    .filter(f => CONFIG.ALLOWED_LEAGUES.some(l => l.id === f.league.id))
    .map(f => ({
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
    // Corners
    corners_favor: s.cards?.total || 0,
    promedio_corners_favor: parseFloat(s.cards?.total) / (s.fixtures?.played || 1) || 0
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
  
  // Calculate streak
  let racha = '';
  for (const m of matches) {
    if (racha === '' || racha[0] === m.resultado) {
      racha = m.resultado + racha;
    } else break;
  }
  
  const totalGF = matches.reduce((sum, m) => sum + m.gf, 0);
  const totalGA = matches.reduce((sum, m) => sum + m.ga, 0);
  
  return {
    ultimos10: matches,
    promedio_gf: Math.round((totalGF / matches.length) * 100) / 100,
    promedio_ga: Math.round((totalGA / matches.length) * 100) / 100,
    racha_actual: racha || 'N/A',
    partidos_count: matches.length
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
  
  return {
    ultimos10,
    promedio_goles_total: avgGoals,
    victorias_local,
    victorias_visitante,
    empates,
    over25_porcentaje: ultimos10.length > 0 ? `${Math.round((over25 / ultimos10.length) * 100)}%` : '0%'
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
  
  // Collect player stats from last 5 matches
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
  
  // Calculate averages and return top 3 by minutes
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
  // Get corner stats from team statistics
  const [homeStats, awayStats] = await Promise.all([
    getTeamStatistics(leagueId, season, homeId),
    getTeamStatistics(leagueId, season, awayId)
  ]);
  
  // Estimate corners based on team tendencies
  // Note: API-Football corners data is in the cards field for some reason
  const promedio_local_favor = homeStats?.promedio_corners_favor || 5.5;
  const promedio_visitante_favor = awayStats?.promedio_corners_favor || 4.5;
  
  // Estimate: home team usually gets more corners at home
  const local_favor_estimado = promedio_local_favor * 1.1;
  const local_contra_estimado = promedio_visitante_favor * 0.9;
  const visitante_favor_estimado = promedio_visitante_favor * 0.9;
  const visitante_contra_estimado = promedio_local_favor * 1.1;
  
  return {
    promedio_local_a_favor: Math.round(local_favor_estimado * 10) / 10,
    promedio_local_en_contra: Math.round(local_contra_estimado * 10) / 10,
    promedio_visitante_a_favor: Math.round(visitante_favor_estimado * 10) / 10,
    promedio_visitante_en_contra: Math.round(visitante_contra_estimado * 10) / 10,
    total_estimado: Math.round((local_favor_estimado + visitante_favor_estimado) * 10) / 10
  };
}

// =====================================================
// BUILD MATCH DATA OBJECT
// =====================================================

async function buildMatchDataObject(fixture, season) {
  console.log(`   📊 Building: ${fixture.home_name} vs ${fixture.away_name}`);
  
  // Fetch all data in parallel where possible
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
  
  // Find standings for each team
  const standingsLocal = standings.find(t => t.team_id === fixture.home_id);
  const standingsVisitante = standings.find(t => t.team_id === fixture.away_id);
  
  // Get corners
  const corners = await getCorners(fixture.home_id, fixture.away_id, fixture.league_id, season);
  
  // Get key players (only if budget allows)
  let jugadores_clave = { local: [], visitante: [] };
  if (requestCountToday < CONFIG.MAX_API_REQUESTS - 15) {
    const [homePlayers, awayPlayers] = await Promise.all([
      getKeyPlayers(fixture.home_id),
      getKeyPlayers(fixture.away_id)
    ]);
    jugadores_clave = { local: homePlayers, visitante: awayPlayers };
  }
  
  // Build the final object
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
        formacion_habitual: homeStats.formacion_habitual
      } : null,
      visitante: awayStats ? {
        promedio_goles_anotados_fuera: awayStats.promedio_goles_anotados_fuera,
        promedio_goles_recibidos_fuera: awayStats.promedio_goles_recibidos_fuera,
        partidos_sin_recibir_fuera: awayStats.partidos_sin_recibir_fuera,
        partidos_sin_anotar_fuera: awayStats.partidos_sin_anotar_fuera,
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
    
    // Internal tracking (not passed to LLM)
    _meta: {
      fixture_id: fixture.fixture_id,
      league_id: fixture.league_id
    }
  };
  
  return matchData;
}

// =====================================================
// VALIDATION
// =====================================================

function validateMatchData(matchData) {
  let score = 0;
  const issues = [];
  
  // 1. Standings de ambos equipos presentes
  if (matchData.standings?.local?.posicion && matchData.standings?.visitante?.posicion) {
    score++;
  } else {
    issues.push('standings_missing');
  }
  
  // 2. forma_reciente con mín 5 partidos
  if (matchData.forma_reciente?.local?.partidos_count >= CONFIG.MIN_FORM_MATCHES) {
    score++;
  } else {
    issues.push('home_form_insufficient');
  }
  
  if (matchData.forma_reciente?.visitante?.partidos_count >= CONFIG.MIN_FORM_MATCHES) {
    score++;
  } else {
    issues.push('away_form_insufficient');
  }
  
  // 3. cuotas.resultado presentes
  if (matchData.cuotas?.resultado?.['1'] > 0) {
    score++;
  } else {
    issues.push('odds_missing');
  }
  
  // 4. prediccion_api presente
  if (matchData.prediccion_api?.ganador_sugerido) {
    score++;
  } else {
    issues.push('prediction_missing');
  }
  
  // 5. h2h con mín 3 partidos
  if (matchData.h2h?.ultimos10?.length >= CONFIG.MIN_H2H_MATCHES) {
    score++;
  } else {
    issues.push('h2h_insufficient');
  }
  
  return {
    valid: score >= CONFIG.MIN_VALIDATION_SCORE,
    score,
    max: 6,
    issues
  };
}

// =====================================================
// LLM ANALYSIS
// =====================================================

async function analyzeWithLLM(matchData) {
  if (!OPENROUTERFREE_API_KEY) return null;
  
  const SYSTEM_PROMPT = `Eres un analista experto en apuestas deportivas con criterio EXTREMADAMENTE CONSERVADOR.
Analizas partidos de fútbol basándote EXCLUSIVAMENTE en el objeto de datos proporcionado.
RESPONDE SIEMPRE EN ESPAÑOL Y EN JSON VÁLIDO.

MERCADOS DISPONIBLES:
- resultado (1X2): "1"=local, "X"=empate, "2"=visitante
- over15, over25, over35: "over" o "under"
- btts: "yes" o "no"
- corners: "over" o "under"

TAREA:
1. Estimar probabilidad real basándote en los datos
2. Comparar con probabilidades_implicitas_normalizadas
3. Calcular EV = (prob_estimada * cuota) - 1
4. Proponer el pick con mayor valor (EV > 4%)

╔══════════════════════════════════════════════════════════════╗
║  ESCALA DE CONFIANZA:                                        ║
╠══════════════════════════════════════════════════════════════╣
║  >= 0.80: 4+ factores sólidos, EV >= 8%                      ║
║  0.65-0.79: 2-3 factores, EV 4-8%                            ║
║  < 0.65: NO proponer pick                                    ║
╚══════════════════════════════════════════════════════════════╝

FORMATO RESPUESTA:
{
  "pick": {
    "market": "resultado" | "over25" | "over15" | "over35" | "btts" | "corners",
    "selection": "1" | "X" | "2" | "over" | "under" | "yes" | "no",
    "estimated_prob": 0.0-1.0,
    "bookmaker_odds": number,
    "expected_value": number,
    "value_bet": boolean
  },
  "analysis": "120-180 palabras: forma, standings, H2H, valor de cuota, riesgos",
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
          { role: "user", content: JSON.stringify(matchData, null, 2) }
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

function selectBestPicks(llmResults, matchDataObjects) {
  const validPicks = [];
  
  for (let i = 0; i < llmResults.length; i++) {
    const result = llmResults[i];
    const match = matchDataObjects[i];
    
    if (!result?.pick?.value_bet) {
      logDiscarded(
        { local: match.partido.split(' vs ')[0], visitante: match.partido.split(' vs ')[1] },
        match._meta.league_id,
        DISCARD_REASONS.NO_VALUE,
        { confidence: result?.confidence, ev: result?.pick?.expected_value }
      );
      continue;
    }
    
    if (result.confidence < CONFIG.MIN_CONFIDENCE) {
      logDiscarded(
        { local: match.partido.split(' vs ')[0], visitante: match.partido.split(' vs ')[1] },
        match._meta.league_id,
        DISCARD_REASONS.LOW_CONFIDENCE,
        { confidence: result.confidence }
      );
      continue;
    }
    
    if (result.pick.expected_value < CONFIG.MIN_EV) {
      logDiscarded(
        { local: match.partido.split(' vs ')[0], visitante: match.partido.split(' vs ')[1] },
        match._meta.league_id,
        DISCARD_REASONS.LOW_EV,
        { ev: result.pick.expected_value }
      );
      continue;
    }
    
    // Determine quality tier
    let qualityTier = 'B';
    if (result.pick.expected_value >= 0.08 && result.confidence >= 0.80) {
      qualityTier = 'A_PLUS';
    }
    
    // Get odds
    let odds = 2.0;
    const { market, selection } = result.pick;
    
    if (market === 'resultado') {
      odds = match.cuotas?.resultado?.[selection] || 2.0;
    } else if (market === 'over25') {
      odds = selection === 'over' 
        ? (match.cuotas?.over25?.over || 1.9)
        : (match.cuotas?.over25?.under || 1.9);
    } else if (market === 'over15') {
      odds = selection === 'over'
        ? (match.cuotas?.over15?.over || 1.3)
        : (match.cuotas?.over15?.under || 3.5);
    } else if (market === 'over35') {
      odds = selection === 'over'
        ? (match.cuotas?.over35?.over || 3.0)
        : (match.cuotas?.over35?.under || 1.4);
    } else if (market === 'btts') {
      odds = selection === 'yes'
        ? (match.cuotas?.btts?.yes || 1.75)
        : (match.cuotas?.btts?.no || 1.95);
    } else if (market === 'corners') {
      odds = selection === 'over'
        ? (match.cuotas?.corners?.over || 1.85)
        : (match.cuotas?.corners?.under || 1.90);
    }
    
    // Selection name
    const [home, away] = match.partido.split(' vs ');
    const selectionName = market === 'resultado'
      ? (selection === '1' ? home : selection === '2' ? away : 'Empate')
      : market.startsWith('over')
        ? `${selection === 'over' ? 'Over' : 'Under'} ${market.replace('over', '')}`
        : market === 'btts'
          ? (selection === 'yes' ? 'Sí' : 'No')
          : `${selection === 'over' ? 'Over' : 'Under'} ${match.cuotas?.corners?.linea || 9.5} corners`;
    
    validPicks.push({
      fixture_id: match._meta.fixture_id,
      league: match.liga,
      home_team: home,
      away_team: away,
      kickoff: match.fecha_utc,
      market: market === 'resultado' ? '1X2' : market.toUpperCase(),
      selection: selectionName,
      odds,
      estimated_prob: result.pick.estimated_prob,
      implied_prob: match.probabilidades_implicitas_normalizadas?.victoria_local || 0.33,
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

async function savePicks(picks) {
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
    console.log(`✅ Saved ${picks.length} picks`);
  } catch (e) {
    console.error("Save error:", e.message);
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
      
      const matchData = await buildMatchDataObject(fixture, season);
      
      // Validate
      const validation = validateMatchData(matchData);
      if (validation.valid) {
        matchDataObjects.push(matchData);
        console.log(`   ✅ ${matchData.partido} (${validation.score}/6)`);
      } else {
        logDiscarded(
          { local: fixture.home_name, visitante: fixture.away_name },
          fixture.league_id,
          DISCARD_REASONS.INSUFFICIENT_DATA,
          { validation_score: validation.score, issues: validation.issues.join(',') }
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
