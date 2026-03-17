/**
 * Daily Picks Auto-Generation API
 * 
 * POST /api/generate-daily-picks
 * Body: { date?: string } // if not provided, uses today
 * 
 * Generates exactly 5 high-quality football picks daily using:
 * - API-FOOTBALL (Free plan, max 100 requests/day)
 * - OpenRouter (DeepSeek)
 */

const SPORTS_API_KEY = process.env.SPORTS_API_KEY;
const OPENROUTERFREE_API_KEY = process.env.OPENROUTERFREE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Configuration
const CONFIG = {
  MAX_PICKS_PER_DAY: 5,
  MAX_API_REQUESTS: 100,
  LEAGUES: [
    { id: 39, name: "Premier League", country: "England" },
    { id: 140, name: "La Liga", country: "Spain" },
    { id: 135, name: "Serie A", country: "Italy" },
    { id: 78, name: "Bundesliga", country: "Germany" },
    { id: 61, name: "Ligue 1", country: "France" }
  ],
  CANDIDATE_LIMIT: 15,
  MIN_CONFIDENCE: 0.60,
  MIN_EV: 0.04,
  LLM_MODEL: "deepseek/deepseek-chat",
  DEFAULT_BOOKMAKER_ID: 8,
  BET_TYPE_1X2: 1,
  QUALITY_TIERS: {
    A_PLUS: { min_ev: 0.07, min_confidence: 0.75 },
    B: { min_ev: 0.04, min_confidence: 0.60 }
  }
};

// In-memory cache for standings (24h TTL)
const standingsCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Request counter (in-memory, reset daily)
let requestCountToday = 0;
let lastResetDate = new Date().toISOString().split('T')[0];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

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
 * Calculate expected value
 */
function calculateEV(estimatedProb, odds) {
  return (estimatedProb * odds) - 1;
}

/**
 * Calculate interest score for pre-filtering
 */
function calculateInterestScore(homeStats, awayStats, totalTeams = 20) {
  if (!homeStats || !awayStats) return 0;
  
  // Position difference (normalized)
  const positionDiff = Math.abs(homeStats.position - awayStats.position) / totalTeams;
  
  // Points difference (normalized)
  const pointsDiff = Math.abs(homeStats.points - awayStats.points) / 60; // Max ~60 points difference
  
  // Form analysis
  let homeFormScore = 0;
  let awayFormScore = 0;
  
  if (homeStats.form) {
    const homeWins = (homeStats.form.match(/W/g) || []).length;
    const homeDraws = (homeStats.form.match(/D/g) || []).length;
    homeFormScore = (homeWins * 3 + homeDraws) / 15; // Normalized to last 5 games
  }
  
  if (awayStats.form) {
    const awayWins = (awayStats.form.match(/W/g) || []).length;
    const awayDraws = (awayStats.form.match(/D/g) || []).length;
    awayFormScore = (awayWins * 3 + awayDraws) / 15;
  }
  
  // Interest score: higher for competitive matches
  // and matches where teams have contrasting form
  const formContrast = Math.abs(homeFormScore - awayFormScore);
  
  // High position teams vs low position teams are interesting (upsets potential)
  // Close positions are also interesting (tight competition)
  const score = (positionDiff * 0.4) + (pointsDiff * 0.2) + (formContrast * 0.4);
  
  return score;
}

/**
 * Parse form string to record
 */
function parseForm(formString) {
  if (!formString) return { last5: '', wins: 0, draws: 0, losses: 0 };
  
  const wins = (formString.match(/W/g) || []).length;
  const draws = (formString.match(/D/g) || []).length;
  const losses = (formString.match(/L/g) || []).length;
  
  return {
    last5: formString.slice(-5),
    wins,
    draws,
    losses
  };
}

// =====================================================
// MAIN FLOW STEPS
// =====================================================

/**
 * PASO 1: Obtener fixtures del día
 */
async function getDailyFixtures(date) {
  const allFixtures = [];
  const season = new Date(date).getFullYear(); // Current season
  
  for (const league of CONFIG.LEAGUES) {
    try {
      const data = await fetchFromAPI(`fixtures?date=${date}&league=${league.id}&season=${season}`);
      
      if (data.response) {
        for (const fixture of data.response) {
          // Only include not started matches
          if (fixture.fixture.status.short === 'NS') {
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
  
  // Sort by interest score descending and take top candidates
  candidates.sort((a, b) => b.interest_score - a.interest_score);
  
  // Check request budget
  checkAndResetCounter();
  const remainingRequests = CONFIG.MAX_API_REQUESTS - requestCountToday;
  const maxCandidatesByBudget = Math.floor((remainingRequests - CONFIG.LEAGUES.length) / 5);
  
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
        : 2.5;
      
      // 4d. Odds (Bet365 = bookmaker ID 8, bet type 1 = 1X2)
      let odds = { '1': 2.0, 'X': 3.3, '2': 3.5 }; // Default odds
      try {
        const oddsData = await fetchFromAPI(`odds?fixture=${candidate.fixture_id}&bookmaker=${CONFIG.DEFAULT_BOOKMAKER_ID}&bet=${CONFIG.BET_TYPE_1X2}`);
        if (oddsData.response?.[0]?.bookmakers?.[0]?.bets?.[0]?.values) {
          const oddsValues = oddsData.response[0].bookmakers[0].bets[0].values;
          odds = {
            '1': parseFloat(oddsValues.find(v => v.value === 'Home')?.odd || '2.0'),
            'X': parseFloat(oddsValues.find(v => v.value === 'Draw')?.odd || '3.3'),
            '2': parseFloat(oddsValues.find(v => v.value === 'Away')?.odd || '3.5')
          };
        }
      } catch (e) {
        console.log(`Odds not available for fixture ${candidate.fixture_id}`);
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
        console.log(`Prediction not available for fixture ${candidate.fixture_id}`);
      }
      
      // Calculate implied probabilities
      const impliedProbs = {
        '1': impliedProb(odds['1']),
        'X': impliedProb(odds['X']),
        '2': impliedProb(odds['2'])
      };
      
      // Build enriched match object
      enriched.push({
        league: candidate.league,
        match: {
          home: candidate.home,
          away: candidate.away,
          kickoff_utc: candidate.kickoff_utc,
          fixture_id: candidate.fixture_id
        },
        table_stats: {
          home: candidate.home_stats || {},
          away: candidate.away_stats || {}
        },
        recent_form: {
          home: {
            last5: homeLast5.map(r => r.result).join(''),
            goals_for: homeLast5.reduce((sum, r) => sum + (r.home === candidate.home.name ? r.home_goals : r.away_goals), 0),
            goals_against: homeLast5.reduce((sum, r) => sum + (r.home === candidate.home.name ? r.away_goals : r.home_goals), 0)
          },
          away: {
            last5: awayLast5.map(r => r.result).join(''),
            goals_for: awayLast5.reduce((sum, r) => sum + (r.away === candidate.away.name ? r.away_goals : r.home_goals), 0),
            goals_against: awayLast5.reduce((sum, r) => sum + (r.away === candidate.away.name ? r.home_goals : r.away_goals), 0)
          }
        },
        h2h: {
          results: h2hResults,
          avg_goals: avgH2HGoals
        },
        odds,
        implied_probs: impliedProbs,
        api_prediction: apiPrediction
      });
      
    } catch (error) {
      console.error(`Error enriching fixture ${candidate.fixture_id}:`, error.message);
    }
  }
  
  return enriched;
}

/**
 * PASO 5: Análisis con LLM (OpenRouter - DeepSeek)
 */
async function analyzeWithLLM(enrichedMatch) {
  if (!OPENROUTERFREE_API_KEY) {
    return null;
  }
  
  const SYSTEM_PROMPT = `Eres un experto en análisis de apuestas deportivas.
Recibes datos estructurados de un partido de fútbol.
RESPONDE SIEMPRE EN ESPAÑOL Y EN JSON VÁLIDO.

Tu tarea:
1. Estimar probabilidad real de cada resultado (1X2 y over/under 2.5).
2. Comparar con probabilidades implícitas de las cuotas.
3. Calcular expected value: EV = (prob_estimada * cuota) - 1
4. Indicar si hay value bet (EV > 0.04 = 4%).
5. Proponer UN pick o ninguno si no hay valor claro.

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
  "analysis": "texto en español, máx 100 palabras",
  "confidence": 0.0_to_1.0,
  "risk_factors": ["factor1", "factor2"],
  "no_value_reason": "string o null"
}

Si no hay value: value_bet=false, confidence < 0.5,
no_value_reason con explicación breve.
NO inventar datos. NO inflar confianza.`;

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
        max_tokens: 500,
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
 * PASO 6: Selección de los mejores picks
 */
function selectBestPicks(llmResults, enrichedMatches) {
  const validPicks = [];
  
  for (let i = 0; i < llmResults.length; i++) {
    const result = llmResults[i];
    const match = enrichedMatches[i];
    
    if (!result || !result.pick || !result.pick.value_bet) {
      continue;
    }
    
    // Check minimum thresholds
    if (result.confidence >= CONFIG.MIN_CONFIDENCE && 
        result.pick.expected_value >= CONFIG.MIN_EV) {
      
      // Determine quality tier
      let qualityTier = 'B';
      if (result.pick.expected_value >= CONFIG.QUALITY_TIERS.A_PLUS.min_ev &&
          result.confidence >= CONFIG.QUALITY_TIERS.A_PLUS.min_confidence) {
        qualityTier = 'A_PLUS';
      }
      
      // Get the correct odds for the selection
      let odds = match.odds['1'];
      let impliedProb = match.implied_probs['1'];
      
      if (result.pick.selection === 'X') {
        odds = match.odds['X'];
        impliedProb = match.implied_probs['X'];
      } else if (result.pick.selection === '2') {
        odds = match.odds['2'];
        impliedProb = match.implied_probs['2'];
      } else if (result.pick.selection === 'over' || result.pick.selection === 'under') {
        // For over/under, use average odds estimation
        odds = result.pick.bookmaker_odds || 1.9;
        impliedProb = impliedProb(odds);
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
  }
  
  // Sort by score (confidence * EV)
  validPicks.sort((a, b) => 
    (b.confidence * b.edge_percent) - (a.confidence * a.edge_percent)
  );
  
  // Take top 5 or adjust if not enough
  let selected = validPicks.slice(0, CONFIG.MAX_PICKS_PER_DAY);
  let picksInsuficientes = false;
  
  // If less than 5 picks, lower EV threshold to 0.02
  if (selected.length < CONFIG.MAX_PICKS_PER_DAY) {
    const lowerThresholdPicks = [];
    
    for (let i = 0; i < llmResults.length; i++) {
      const result = llmResults[i];
      const match = enrichedMatches[i];
      
      if (!result || !result.pick || !result.pick.value_bet) continue;
      
      // Already in selected?
      if (selected.some(p => p.fixture_id === match.match.fixture_id)) continue;
      
      // Lower threshold: EV >= 0.02
      if (result.confidence >= CONFIG.MIN_CONFIDENCE && 
          result.pick.expected_value >= 0.02) {
        
        const selectionName = result.pick.selection === '1' ? match.match.home.name :
                             result.pick.selection === '2' ? match.match.away.name :
                             result.pick.selection === 'X' ? 'Empate' :
                             result.pick.selection === 'over' ? 'Over 2.5' :
                             'Under 2.5';
        
        let odds = match.odds['1'];
        let impliedProb = match.implied_probs['1'];
        
        if (result.pick.selection === 'X') {
          odds = match.odds['X'];
          impliedProb = match.implied_probs['X'];
        } else if (result.pick.selection === '2') {
          odds = match.odds['2'];
          impliedProb = match.implied_probs['2'];
        }
        
        lowerThresholdPicks.push({
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
          quality_tier: 'B',
          analysis: result.analysis,
          risk_factors: result.risk_factors || [],
          source: 'daily_auto'
        });
      }
    }
    
    // Add lower threshold picks to fill up to 5
    const needed = CONFIG.MAX_PICKS_PER_DAY - selected.length;
    selected = [...selected, ...lowerThresholdPicks.slice(0, needed)];
    picksInsuficientes = selected.length < CONFIG.MAX_PICKS_PER_DAY;
  }
  
  return { picks: selected, picksInsuficientes };
}

/**
 * PASO 7: Guardar en Supabase
 */
async function savePicksToSupabase(picks) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log("⚠️ Supabase not configured, skipping save");
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
  
  try {
    // Get date from body or use today
    const { date } = req.body || {};
    const targetDate = date || new Date().toISOString().split('T')[0];
    const season = new Date(targetDate).getFullYear();
    
    console.log(`\n🚀 Starting Daily Picks Generation for ${targetDate}`);
    console.log(`📊 Season: ${season}`);
    
    // Reset counter if new day
    checkAndResetCounter();
    
    // PASO 1: Obtener fixtures del día
    console.log("\n📅 PASO 1: Fetching fixtures...");
    const fixtures = await getDailyFixtures(targetDate);
    console.log(`   Found ${fixtures.length} fixtures`);
    
    if (fixtures.length === 0) {
      return res.status(200).json({
        date: targetDate,
        picks_generated: 0,
        picks: [],
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: "No fixtures found for today"
      });
    }
    
    // PASO 2: Obtener standings (cached)
    console.log("\n📊 PASO 2: Fetching standings...");
    const standingsMap = await getLeagueStandings(CONFIG.LEAGUES, season);
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
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: "No suitable candidates found"
      });
    }
    
    // PASO 4: Enriquecer candidatos
    console.log("\n📈 PASO 4: Enriching candidates with detailed data...");
    const enrichedMatches = await enrichCandidates(candidates);
    console.log(`   Enriched ${enrichedMatches.length} matches`);
    
    // PASO 5: Análisis con LLM
    console.log("\n🤖 PASO 5: Analyzing with LLM...");
    const llmResults = [];
    
    for (const match of enrichedMatches) {
      console.log(`   Analyzing: ${match.match.home.name} vs ${match.match.away.name}`);
      const analysis = await analyzeWithLLM(match);
      llmResults.push(analysis);
    }
    
    // PASO 6: Selección de picks
    console.log("\n✅ PASO 6: Selecting best picks...");
    const { picks, picksInsuficientes } = selectBestPicks(llmResults, enrichedMatches);
    console.log(`   Selected ${picks.length} picks`);
    
    // PASO 7: Guardar en Supabase
    if (picks.length > 0) {
      console.log("\n💾 PASO 7: Saving to Supabase...");
      await savePicksToSupabase(picks);
    }
    
    // PASO 8: Respuesta
    const executionTime = Date.now() - startTime;
    
    console.log(`\n🎉 Daily Picks Generation Complete!`);
    console.log(`   ⏱️ Execution time: ${executionTime}ms`);
    console.log(`   📊 API requests used: ${requestCountToday}`);
    console.log(`   🎯 Picks generated: ${picks.length}`);
    
    return res.status(200).json({
      date: targetDate,
      picks_generated: picks.length,
      picks,
      api_requests_used: requestCountToday,
      execution_time_ms: executionTime,
      picks_insuficientes: picksInsuficientes || undefined
    });
    
  } catch (error) {
    console.error("❌ Daily Picks Error:", error);
    return res.status(500).json({
      error: "Failed to generate daily picks",
      message: error.message,
      api_requests_used: requestCountToday,
      execution_time_ms: Date.now() - startTime
    });
  }
}
