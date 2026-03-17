/**
 * Daily Picks Auto-Generation API (FIXED VERSION)
 * 
 * POST /api/generate-daily-picks
 * Body: { date?: string } // if not provided, uses today
 * 
 * QUALITY OVER QUANTITY: Maximum 3 picks per day with strict criteria.
 * 
 * Fixes applied:
 * - FIX 1: Strict league whitelist (men's football only)
 * - FIX 2: Strict confidence scale in LLM prompt
 * - FIX 3: Minimum data blocks required before LLM analysis
 * - FIX 4: Quality over quantity (max 3 picks, don't force low quality)
 * - FIX 5: Discard logging for transparency
 */

const SPORTS_API_KEY = process.env.SPORTS_API_KEY;
const OPENROUTERFREE_API_KEY = process.env.OPENROUTERFREE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Configuration
const CONFIG = {
  MAX_PICKS_PER_DAY: 3, // Reduced from 5 to 3
  MAX_API_REQUESTS: 100,
  
  // STRICT WHITELIST - Only these leagues allowed (men's football)
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
  
  CANDIDATE_LIMIT: 15,
  MIN_CONFIDENCE: 0.65, // Raised from 0.60
  MIN_EV: 0.04,
  LLM_MODEL: "deepseek/deepseek-chat",
  DEFAULT_BOOKMAKER_ID: 8,
  BET_TYPE_1X2: 1,
  MIN_DATA_BLOCKS_REQUIRED: 4, // Out of 6 data blocks
  MIN_FORM_MATCHES: 3,
  
  QUALITY_TIERS: {
    A_PLUS: { min_ev: 0.08, min_confidence: 0.80 },
    B: { min_ev: 0.04, min_confidence: 0.65 }
  }
};

// Discard reasons enum
const DISCARD_REASONS = {
  LEAGUE_NOT_ALLOWED: "liga_no_permitida",
  FEMALE_FOOTBALL: "partido_femenino",
  INSUFFICIENT_DATA: "datos_insuficientes",
  LOW_CONFIDENCE: "confianza_baja",
  LOW_EV: "ev_insuficiente",
  NO_VALUE: "sin_value_bet"
};

// In-memory cache for standings (24h TTL)
const standingsCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Request counter (in-memory, reset daily)
let requestCountToday = 0;
let lastResetDate = new Date().toISOString().split('T')[0];

// Discarded picks log for the current run
let discardedPicks = [];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if league is in the allowed whitelist
 */
function isLeagueAllowed(leagueId) {
  return CONFIG.ALLOWED_LEAGUES.some(l => l.id === leagueId);
}

/**
 * Get league config from whitelist
 */
function getLeagueConfig(leagueId) {
  return CONFIG.ALLOWED_LEAGUES.find(l => l.id === leagueId);
}

/**
 * Log a discarded pick
 */
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
  console.log(`   ❌ DISCARDED: ${entry.match_name} - Reason: ${reason}`);
  
  return entry;
}

/**
 * Save discarded picks to Supabase
 */
async function saveDiscardedPicksToSupabase(discarded) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || discarded.length === 0) {
    return;
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/picks_discarded`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(discarded)
    });
    
    if (response.ok) {
      console.log(`   📝 Logged ${discarded.length} discarded picks`);
    }
  } catch (error) {
    console.error("Error saving discarded picks:", error.message);
  }
}

/**
 * Fetch from API-FOOTBALL
 */
async function fetchFromAPI(endpoint) {
  const response = await fetch(`https://v3.football.api-sports.io/${endpoint}`, {
    headers: {
      'x-apisports-key': SPORTS_API_KEY || ''
    }
  });

  if (!response.ok) {
    throw new Error(`API-Sports error: ${response.status}`);
  }

  requestCountToday++;
  return response.json();
}

/**
 * Reset request counter if new day
 */
function checkAndResetCounter() {
  const today = new Date().toISOString().split('T')[0];
  if (today !== lastResetDate) {
    requestCountToday = 0;
    lastResetDate = today;
  }
}

/**
 * Get cached standings or fetch new
 */
async function getStandings(leagueId, season) {
  const cacheKey = `${leagueId}-${season}`;
  const cached = standingsCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetchFromAPI(`standings?league=${leagueId}&season=${season}`);
  
  if (data.response && data.response[0]?.league?.standings?.[0]) {
    const standings = data.response[0].league.standings[0].map(team => ({
      team_id: team.team.id,
      team_name: team.team.name,
      position: team.rank,
      points: team.points,
      goals_for: team.all.goals.for,
      goals_against: team.all.goals.against,
      form: team.form,
      played: team.all.played,
      won: team.all.win,
      drawn: team.all.draw,
      lost: team.all.lose
    }));
    
    standingsCache.set(cacheKey, { data: standings, timestamp: Date.now() });
    return standings;
  }
  
  return [];
}

/**
 * Calculate implied probability from odds
 */
function impliedProb(odds) {
  return 1 / odds;
}

/**
 * Calculate interest score for pre-filtering
 */
function calculateInterestScore(homeStats, awayStats, totalTeams = 20) {
  if (!homeStats || !awayStats) return 0;
  
  // Position difference (normalized)
  const positionDiff = Math.abs(homeStats.position - awayStats.position) / totalTeams;
  
  // Points difference (normalized)
  const pointsDiff = Math.abs(homeStats.points - awayStats.points) / 60;
  
  // Form analysis
  let homeFormScore = 0;
  let awayFormScore = 0;
  
  if (homeStats.form) {
    const homeWins = (homeStats.form.match(/W/g) || []).length;
    const homeDraws = (homeStats.form.match(/D/g) || []).length;
    homeFormScore = (homeWins * 3 + homeDraws) / 15;
  }
  
  if (awayStats.form) {
    const awayWins = (awayStats.form.match(/W/g) || []).length;
    const awayDraws = (awayStats.form.match(/D/g) || []).length;
    awayFormScore = (awayWins * 3 + awayDraws) / 15;
  }
  
  const formContrast = Math.abs(homeFormScore - awayFormScore);
  
  return (positionDiff * 0.4) + (pointsDiff * 0.2) + (formContrast * 0.4);
}

/**
 * Calculate data quality score (how many data blocks have real data)
 */
function calculateDataQualityScore(enrichedMatch) {
  let score = 0;
  
  // Block 1: Home table stats
  if (enrichedMatch.table_stats?.home && enrichedMatch.table_stats.home.position) {
    score++;
  }
  
  // Block 2: Away table stats
  if (enrichedMatch.table_stats?.away && enrichedMatch.table_stats.away.position) {
    score++;
  }
  
  // Block 3: Home recent form (min 3 matches)
  if (enrichedMatch.recent_form?.home && enrichedMatch.recent_form.home.matches_count >= CONFIG.MIN_FORM_MATCHES) {
    score++;
  }
  
  // Block 4: Away recent form (min 3 matches)
  if (enrichedMatch.recent_form?.away && enrichedMatch.recent_form.away.matches_count >= CONFIG.MIN_FORM_MATCHES) {
    score++;
  }
  
  // Block 5: H2H data
  if (enrichedMatch.h2h?.results && enrichedMatch.h2h.results.length > 0) {
    score++;
  }
  
  // Block 6: Odds available
  if (enrichedMatch.odds && enrichedMatch.odds['1'] > 0) {
    score++;
  }
  
  return score;
}

// =====================================================
// MAIN FLOW STEPS
// =====================================================

/**
 * PASO 1: Obtener fixtures del día (con validación de liga)
 */
async function getDailyFixtures(date) {
  const allFixtures = [];
  const season = new Date(date).getFullYear();
  
  for (const league of CONFIG.ALLOWED_LEAGUES) {
    try {
      const data = await fetchFromAPI(`fixtures?date=${date}&league=${league.id}&season=${season}`);
      
      if (data.response) {
        for (const fixture of data.response) {
          // FIX 1: Strict league validation (already filtered by league in request)
          // But double-check and filter by status
          if (fixture.fixture.status.short !== 'NS') continue;
          
          // FIX 1: Filter out women's football
          // API-Football doesn't explicitly mark gender, but league IDs are unique
          // The leagues in our whitelist are all men's leagues
          
          allFixtures.push({
            fixture_id: fixture.fixture.id,
            league: league,
            home: {
              id: fixture.teams.home.id,
              name: fixture.teams.home.name,
              logo: fixture.teams.home.logo
            },
            away: {
              id: fixture.teams.away.id,
              name: fixture.teams.away.name,
              logo: fixture.teams.away.logo
            },
            kickoff_utc: fixture.fixture.date,
            status: fixture.fixture.status.short
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching fixtures for ${league.name}:`, error.message);
    }
  }
  
  return allFixtures;
}

/**
 * PASO 2: Obtener standings (cached)
 */
async function getLeagueStandings(leagues, season) {
  const standingsMap = new Map();
  
  for (const league of leagues) {
    try {
      const standings = await getStandings(league.id, season);
      standingsMap.set(league.id, standings);
    } catch (error) {
      console.error(`Error fetching standings for ${league.name}:`, error.message);
      standingsMap.set(league.id, []);
    }
  }
  
  return standingsMap;
}

/**
 * PASO 3: Pre-filtro de candidatos
 */
async function preFilterCandidates(fixtures, standingsMap) {
  const candidates = [];
  
  for (const fixture of fixtures) {
    const standings = standingsMap.get(fixture.league.id) || [];
    const homeStats = standings.find(t => t.team_id === fixture.home.id);
    const awayStats = standings.find(t => t.team_id === fixture.away.id);
    
    const interestScore = calculateInterestScore(homeStats, awayStats, standings.length || 20);
    
    candidates.push({
      ...fixture,
      interest_score: interestScore,
      home_stats: homeStats,
      away_stats: awayStats
    });
  }
  
  // Sort by interest score descending
  candidates.sort((a, b) => b.interest_score - a.interest_score);
  
  // Check request budget
  checkAndResetCounter();
  const remainingRequests = CONFIG.MAX_API_REQUESTS - requestCountToday;
  const maxCandidatesByBudget = Math.floor((remainingRequests - CONFIG.ALLOWED_LEAGUES.length) / 5);
  
  const limit = Math.min(CONFIG.CANDIDATE_LIMIT, maxCandidatesByBudget, candidates.length);
  
  return candidates.slice(0, limit);
}

/**
 * PASO 4: Enriquecer candidatos con datos detallados
 */
async function enrichCandidates(candidates) {
  const enriched = [];
  
  for (const candidate of candidates) {
    try {
      // 4a. Last 5 home team fixtures
      const homeFixturesData = await fetchFromAPI(`fixtures?team=${candidate.home.id}&last=5`);
      const homeLast5 = (homeFixturesData.response || []).map(f => ({
        date: f.fixture.date,
        home: f.teams.home.name,
        away: f.teams.away.name,
        home_goals: f.goals.home,
        away_goals: f.goals.away,
        result: f.teams.home.id === candidate.home.id 
          ? (f.goals.home > f.goals.away ? 'W' : f.goals.home < f.goals.away ? 'L' : 'D')
          : (f.goals.away > f.goals.home ? 'W' : f.goals.away < f.goals.home ? 'L' : 'D')
      }));
      
      // 4b. Last 5 away team fixtures
      const awayFixturesData = await fetchFromAPI(`fixtures?team=${candidate.away.id}&last=5`);
      const awayLast5 = (awayFixturesData.response || []).map(f => ({
        date: f.fixture.date,
        home: f.teams.home.name,
        away: f.teams.away.name,
        home_goals: f.goals.home,
        away_goals: f.goals.away,
        result: f.teams.away.id === candidate.away.id
          ? (f.goals.away > f.goals.home ? 'W' : f.goals.away < f.goals.home ? 'L' : 'D')
          : (f.goals.home > f.goals.away ? 'W' : f.goals.home < f.goals.away ? 'L' : 'D')
      }));
      
      // 4c. H2H
      const h2hData = await fetchFromAPI(`fixtures/headtohead?h2h=${candidate.home.id}-${candidate.away.id}&last=5`);
      const h2hResults = (h2hData.response || []).map(f => ({
        date: f.fixture.date,
        home_team: f.teams.home.name,
        away_team: f.teams.away.name,
        home_goals: f.goals.home,
        away_goals: f.goals.away
      }));
      
      const avgH2HGoals = h2hResults.length > 0
        ? h2hResults.reduce((sum, r) => sum + r.home_goals + r.away_goals, 0) / h2hResults.length
        : 0;
      
      // 4d. Odds (Bet365 = bookmaker ID 8, bet type 1 = 1X2)
      let odds = null;
      try {
        const oddsData = await fetchFromAPI(`odds?fixture=${candidate.fixture_id}&bookmaker=${CONFIG.DEFAULT_BOOKMAKER_ID}&bet=${CONFIG.BET_TYPE_1X2}`);
        if (oddsData.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
          const oddsValues = oddsData.response[0].bookmakers[0].bets[0].values;
          odds = {
            '1': parseFloat(oddsValues.find(v => v.value === 'Home')?.odd || '0'),
            'X': parseFloat(oddsValues.find(v => v.value === 'Draw')?.odd || '0'),
            '2': parseFloat(oddsValues.find(v => v.value === 'Away')?.odd || '0')
          };
        }
      } catch (e) {
        console.log(`   ⚠️ Odds not available for fixture ${candidate.fixture_id}`);
      }
      
      // 4e. API Prediction
      let apiPrediction = null;
      try {
        const predData = await fetchFromAPI(`predictions?fixture=${candidate.fixture_id}`);
        if (predData.response?.[0]) {
          const pred = predData.response[0];
          apiPrediction = {
            winner: pred.predictions?.winner?.name || 'N/A',
            under_over: pred.predictions?.under_over || 'N/A',
            advice: pred.predictions?.advice || ''
          };
        }
      } catch (e) {
        console.log(`   ⚠️ Prediction not available for fixture ${candidate.fixture_id}`);
      }
      
      // Calculate implied probabilities
      let impliedProbs = null;
      if (odds && odds['1'] > 0) {
        impliedProbs = {
          '1': impliedProb(odds['1']),
          'X': impliedProb(odds['X']),
          '2': impliedProb(odds['2'])
        };
      }
      
      // Build enriched match object
      const enrichedMatch = {
        league: candidate.league,
        match: {
          home: candidate.home,
          away: candidate.away,
          kickoff_utc: candidate.kickoff_utc,
          fixture_id: candidate.fixture_id
        },
        table_stats: {
          home: candidate.home_stats || null,
          away: candidate.away_stats || null
        },
        recent_form: {
          home: {
            last5: homeLast5.map(r => r.result).join(''),
            goals_for: homeLast5.reduce((sum, r) => sum + (r.home === candidate.home.name ? r.home_goals : r.away_goals), 0),
            goals_against: homeLast5.reduce((sum, r) => sum + (r.home === candidate.home.name ? r.away_goals : r.home_goals), 0),
            matches_count: homeLast5.length
          },
          away: {
            last5: awayLast5.map(r => r.result).join(''),
            goals_for: awayLast5.reduce((sum, r) => sum + (r.away === candidate.away.name ? r.away_goals : r.home_goals), 0),
            goals_against: awayLast5.reduce((sum, r) => sum + (r.away === candidate.away.name ? r.home_goals : r.away_goals), 0),
            matches_count: awayLast5.length
          }
        },
        h2h: {
          results: h2hResults,
          avg_goals: avgH2HGoals
        },
        odds,
        implied_probs: impliedProbs,
        api_prediction: apiPrediction
      };
      
      // FIX 3: Calculate data quality score
      enrichedMatch.data_quality_score = calculateDataQualityScore(enrichedMatch);
      
      enriched.push(enrichedMatch);
      
    } catch (error) {
      console.error(`Error enriching fixture ${candidate.fixture_id}:`, error.message);
    }
  }
  
  return enriched;
}

/**
 * FIX 3: Validate minimum data blocks before calling LLM
 */
function hasMinimumDataForLLM(enrichedMatch) {
  return enrichedMatch.data_quality_score >= CONFIG.MIN_DATA_BLOCKS_REQUIRED;
}

/**
 * PASO 5: Análisis con LLM (OpenRouter - DeepSeek) - UPDATED SYSTEM PROMPT
 */
async function analyzeWithLLM(enrichedMatch) {
  if (!OPENROUTERFREE_API_KEY) {
    return null;
  }
  
  // FIX 2: STRICT SYSTEM PROMPT with confidence rules
  const SYSTEM_PROMPT = `Eres un experto en análisis de apuestas deportivas con criterio EXTREMADAMENTE CONSERVADOR.
Recibes datos estructurados de un partido de fútbol.
RESPONDE SIEMPRE EN ESPAÑOL Y EN JSON VÁLIDO.

Tu tarea:
1. Estimar probabilidad real de cada resultado (1X2 y over/under 2.5).
2. Comparar con probabilidades implícitas de las cuotas.
3. Calcular expected value: EV = (prob_estimada * cuota) - 1
4. Indicar si hay value bet (EV > 0.04 = 4%).
5. Proponer UN pick o ninguno si no hay valor claro.

╔══════════════════════════════════════════════════════════════╗
║  REGLAS DE CONFIANZA (NO NEGOCIABLES):                       ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  confidence >= 0.80 SOLO si:                                 ║
║    • Al menos 4 factores estadísticos sólidos a favor        ║
║    • EV >= 0.08 (8%)                                         ║
║    • Sin factores de riesgo mayores                          ║
║    • Liga de primer nivel con datos abundantes               ║
║                                                              ║
║  confidence 0.65 - 0.79 si:                                  ║
║    • Hay 2-3 factores a favor                                ║
║    • EV entre 0.04 y 0.08                                    ║
║    • Algún factor de riesgo menor                            ║
║                                                              ║
║  confidence < 0.65:                                          ║
║    • Datos insuficientes o contradictorios                   ║
║    • En este caso NO proponer pick (value_bet: false)        ║
║                                                              ║
║  PROHIBIDO dar confidence > 0.75 si:                         ║
║    • La liga tiene menos de 5 temporadas de historia         ║
║    • Es un partido de fase de grupos intrascendente          ║
║    • Los datos de forma tienen menos de 3 partidos           ║
║    • Es fútbol femenino, juvenil o segunda división          ║
╚══════════════════════════════════════════════════════════════╝

ANÁLISIS OBLIGATORIO en el campo "analysis":
El análisis DEBE mencionar explícitamente:
1) Forma reciente de ambos equipos (últimos 5)
2) Situación en la tabla (posición y puntos)
3) H2H relevante si lo hay
4) Por qué la cuota tiene o no tiene valor
5) Al menos 1 factor de riesgo

Si no puede mencionar algo por falta de datos, indicarlo:
'Sin datos de H2H disponibles.'

Máximo 150 palabras. En español.

Formato de respuesta obligatorio:
{
  "pick": {
    "market": "1X2" | "over_under",
    "selection": "1" | "X" | "2" | "over" | "under",
    "estimated_prob": 0.0_to_1.0,
    "bookmaker_odds": number,
    "expected_value": number,
    "value_bet": boolean
  },
  "analysis": "texto en español, máx 150 palabras",
  "confidence": 0.0_to_1.0,
  "risk_factors": ["factor1", "factor2"],
  "no_value_reason": "string o null"
}

Si no hay value: value_bet=false, confidence < 0.65,
no_value_reason con explicación breve.
NO inventar datos. NO inflar confianza. Ser EXTREMADAMENTE conservador.`;

  const matchJSON = JSON.stringify(enrichedMatch, null, 2);
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTERFREE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Daily Picks'
      },
      body: JSON.stringify({
        model: CONFIG.LLM_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analiza este partido:\n\n${matchJSON}` }
        ],
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '{}';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(content);
  } catch (error) {
    console.error("LLM Analysis Error:", error.message);
    return null;
  }
}

/**
 * PASO 6: Selección de los mejores picks (FIX 4: Quality over quantity)
 */
function selectBestPicks(llmResults, enrichedMatches) {
  const validPicks = [];
  
  for (let i = 0; i < llmResults.length; i++) {
    const result = llmResults[i];
    const match = enrichedMatches[i];
    
    if (!result || !result.pick) {
      continue;
    }
    
    // Log discarded picks
    if (!result.pick.value_bet) {
      logDiscardedPick(match.match, match.league.id, DISCARD_REASONS.NO_VALUE, {
        confidence_llm: result.confidence,
        ev_llm: result.pick.expected_value,
        data_blocks_available: match.data_quality_score
      });
      continue;
    }
    
    // FIX 4: Strict thresholds - don't lower for any reason
    if (result.confidence < CONFIG.MIN_CONFIDENCE) {
      logDiscardedPick(match.match, match.league.id, DISCARD_REASONS.LOW_CONFIDENCE, {
        confidence_llm: result.confidence,
        ev_llm: result.pick.expected_value
      });
      continue;
    }
    
    if (result.pick.expected_value < CONFIG.MIN_EV) {
      logDiscardedPick(match.match, match.league.id, DISCARD_REASONS.LOW_EV, {
        confidence_llm: result.confidence,
        ev_llm: result.pick.expected_value
      });
      continue;
    }
    
    // Determine quality tier with RAISED thresholds
    let qualityTier = 'B';
    if (result.pick.expected_value >= CONFIG.QUALITY_TIERS.A_PLUS.min_ev &&
        result.confidence >= CONFIG.QUALITY_TIERS.A_PLUS.min_confidence) {
      qualityTier = 'A_PLUS';
    }
    
    // Get the correct odds for the selection
    let odds = match.odds?.['1'] || 2.0;
    let impliedProb = match.implied_probs?.['1'] || 0.5;
    
    if (result.pick.selection === 'X') {
      odds = match.odds?.['X'] || 3.3;
      impliedProb = match.implied_probs?.['X'] || 0.3;
    } else if (result.pick.selection === '2') {
      odds = match.odds?.['2'] || 3.5;
      impliedProb = match.implied_probs?.['2'] || 0.28;
    } else if (result.pick.selection === 'over' || result.pick.selection === 'under') {
      odds = result.pick.bookmaker_odds || 1.9;
      impliedProb = odds > 0 ? impliedProb(odds) : 0.5;
    }
    
    const selectionName = result.pick.selection === '1' ? match.match.home.name :
                         result.pick.selection === '2' ? match.match.away.name :
                         result.pick.selection === 'X' ? 'Empate' :
                         result.pick.selection === 'over' ? 'Over 2.5' :
                         'Under 2.5';
    
    validPicks.push({
      fixture_id: match.match.fixture_id,
      league: match.league.name,
      home_team: match.match.home.name,
      away_team: match.match.away.name,
      kickoff: match.match.kickoff_utc,
      market: result.pick.market === '1X2' ? '1X2' : 'Over/Under 2.5',
      selection: selectionName,
      odds: odds,
      estimated_prob: result.pick.estimated_prob,
      implied_prob: impliedProb,
      edge_percent: Math.round(result.pick.expected_value * 100),
      confidence: Math.round(result.confidence * 10),
      quality_tier: qualityTier,
      analysis: result.analysis,
      risk_factors: result.risk_factors || [],
      source: 'daily_auto'
    });
  }
  
  // FIX 4: Sort by score (confidence * EV) - NO lowering thresholds
  validPicks.sort((a, b) => 
    (b.confidence * b.edge_percent) - (a.confidence * a.edge_percent)
  );
  
  // FIX 4: Take top 3 ONLY - don't force fill
  // If we have 0 picks, return 0 (quality over quantity)
  const selected = validPicks.slice(0, CONFIG.MAX_PICKS_PER_DAY);
  
  return { 
    picks: selected, 
    picksInsuficientes: false, // We don't care anymore - quality over quantity
    totalCandidates: llmResults.length,
    validPicksFound: validPicks.length
  };
}

/**
 * PASO 7: Guardar en Supabase
 */
async function savePicksToSupabase(picks) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log("⚠️ Supabase not configured, skipping save");
    return;
  }
  
  if (picks.length === 0) {
    console.log("   ℹ️ No picks to save (quality over quantity)");
    return;
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(picks.map(pick => ({
        sport: 'football',
        match_name: `${pick.home_team} vs ${pick.away_team}`,
        date: pick.kickoff.split('T')[0],
        league: pick.league,
        home_team: pick.home_team,
        away_team: pick.away_team,
        kickoff: pick.kickoff,
        market: pick.market,
        selection: pick.selection,
        odds: pick.odds,
        estimated_prob: pick.estimated_prob,
        implied_prob: pick.implied_prob,
        edge_percent: pick.edge_percent,
        confidence: pick.confidence,
        quality_tier: pick.quality_tier,
        analysis_text: pick.analysis,
        risk_factors: pick.risk_factors,
        is_official: true,
        status: 'pending',
        source: 'daily_auto'
      })))
    });
    
    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }
    
    console.log(`✅ Saved ${picks.length} picks to Supabase`);
  } catch (error) {
    console.error("Error saving to Supabase:", error.message);
  }
}

// =====================================================
// MAIN HANDLER
// =====================================================

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

  const startTime = Date.now();
  
  // Reset discarded picks log for this run
  discardedPicks = [];
  
  try {
    // Get date from body or use today
    const { date } = req.body || {};
    const targetDate = date || new Date().toISOString().split('T')[0];
    const season = new Date(targetDate).getFullYear();
    
    console.log(`\n🚀 Starting Daily Picks Generation for ${targetDate}`);
    console.log(`📊 Season: ${season}`);
    console.log(`🎯 Max picks: ${CONFIG.MAX_PICKS_PER_DAY} (quality over quantity)`);
    
    // Reset counter if new day
    checkAndResetCounter();
    
    // PASO 1: Obtener fixtures del día (whitelist filtered)
    console.log("\n📅 PASO 1: Fetching fixtures from allowed leagues...");
    const fixtures = await getDailyFixtures(targetDate);
    console.log(`   Found ${fixtures.length} fixtures from whitelisted leagues`);
    
    if (fixtures.length === 0) {
      return res.status(200).json({
        date: targetDate,
        picks_generated: 0,
        picks: [],
        discarded_count: 0,
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: "No fixtures found from allowed leagues today"
      });
    }
    
    // PASO 2: Obtener standings (cached)
    console.log("\n📊 PASO 2: Fetching standings...");
    const standingsMap = await getLeagueStandings(CONFIG.ALLOWED_LEAGUES, season);
    console.log(`   Cached standings for ${standingsMap.size} leagues`);
    
    // PASO 3: Pre-filtro de candidatos
    console.log("\n🔍 PASO 3: Pre-filtering candidates...");
    const candidates = await preFilterCandidates(fixtures, standingsMap);
    console.log(`   Selected ${candidates.length} candidates for detailed analysis`);
    
    if (candidates.length === 0) {
      return res.status(200).json({
        date: targetDate,
        picks_generated: 0,
        picks: [],
        discarded_count: discardedPicks.length,
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: "No suitable candidates found"
      });
    }
    
    // PASO 4: Enriquecer candidatos
    console.log("\n📈 PASO 4: Enriching candidates with detailed data...");
    const enrichedMatches = await enrichCandidates(candidates);
    console.log(`   Enriched ${enrichedMatches.length} matches`);
    
    // FIX 3: Filter out matches with insufficient data
    console.log("\n🔬 PASO 4b: Checking data quality (min ${CONFIG.MIN_DATA_BLOCKS_REQUIRED}/6 blocks)...");
    const matchesWithSufficientData = [];
    
    for (const match of enrichedMatches) {
      if (hasMinimumDataForLLM(match)) {
        matchesWithSufficientData.push(match);
      } else {
        logDiscardedPick(match.match, match.league.id, DISCARD_REASONS.INSUFFICIENT_DATA, {
          data_blocks_available: match.data_quality_score
        });
      }
    }
    
    console.log(`   ${matchesWithSufficientData.length} matches have sufficient data for LLM analysis`);
    
    if (matchesWithSufficientData.length === 0) {
      // Save discarded picks
      await saveDiscardedPicksToSupabase(discardedPicks);
      
      return res.status(200).json({
        date: targetDate,
        picks_generated: 0,
        picks: [],
        discarded_count: discardedPicks.length,
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: "No matches with sufficient data quality for analysis"
      });
    }
    
    // PASO 5: Análisis con LLM
    console.log("\n🤖 PASO 5: Analyzing with LLM (strict confidence rules)...");
    const llmResults = [];
    
    for (const match of matchesWithSufficientData) {
      console.log(`   Analyzing: ${match.match.home.name} vs ${match.match.away.name} (${match.data_quality_score}/6 data blocks)`);
      const analysis = await analyzeWithLLM(match);
      llmResults.push(analysis);
    }
    
    // PASO 6: Selección de picks (FIX 4: Quality over quantity)
    console.log("\n✅ PASO 6: Selecting best picks (max 3, quality over quantity)...");
    const { picks, totalCandidates, validPicksFound } = selectBestPicks(llmResults, matchesWithSufficientData);
    console.log(`   Found ${validPicksFound} valid picks, selected ${picks.length}`);
    
    // PASO 7: Guardar en Supabase
    if (picks.length > 0) {
      console.log("\n💾 PASO 7: Saving to Supabase...");
      await savePicksToSupabase(picks);
    } else {
      console.log("\n💾 PASO 7: No quality picks to save (protecting bankroll)");
    }
    
    // Save discarded picks log
    await saveDiscardedPicksToSupabase(discardedPicks);
    
    // PASO 8: Respuesta
    const executionTime = Date.now() - startTime;
    
    console.log(`\n🎉 Daily Picks Generation Complete!`);
    console.log(`   ⏱️ Execution time: ${executionTime}ms`);
    console.log(`   📊 API requests used: ${requestCountToday}`);
    console.log(`   🎯 Picks generated: ${picks.length}`);
    console.log(`   ❌ Picks discarded: ${discardedPicks.length}`);
    
    // FIX 4: Message when no quality picks
    let message = undefined;
    if (picks.length === 0) {
      message = "Hoy no se encontraron picks de suficiente calidad. El sistema es estricto para proteger tu bankroll.";
    }
    
    return res.status(200).json({
      date: targetDate,
      picks_generated: picks.length,
      picks,
      discarded_count: discardedPicks.length,
      api_requests_used: requestCountToday,
      execution_time_ms: executionTime,
      message
    });
    
  } catch (error) {
    console.error("❌ Daily Picks Error:", error);
    
    // Save any discarded picks we have
    await saveDiscardedPicksToSupabase(discardedPicks);
    
    return res.status(500).json({
      error: "Failed to generate daily picks",
      message: error.message,
      discarded_count: discardedPicks.length,
      api_requests_used: requestCountToday,
      execution_time_ms: Date.now() - startTime
    });
  }
}
