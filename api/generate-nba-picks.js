/**
 * NBA Picks Auto-Generation API with Player Props
 * 
 * POST /api/generate-nba-picks
 * Body: { date?: string }
 * 
 * Features:
 * - Team markets (Over/Under, Moneyline)
 * - Player Props (points, rebounds, assists)
 * - Key player statistics analysis
 * - Maximum 3 picks per day (quality over quantity)
 * 
 * Uses demo data when no BALLDONTLIE_API_KEY is configured
 */

const BALLDONTLIE_API_KEY = process.env.BALLDONTLIE_API_KEY || null;
const OPENROUTERFREE_API_KEY = process.env.OPENROUTERFREE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// NBA Configuration
const CONFIG = {
  MAX_PICKS_PER_DAY: 3,
  MIN_CONFIDENCE: 0.65,
  MIN_EV: 0.04,
  LLM_MODEL: "deepseek/deepseek-chat",
  
  QUALITY_TIERS: {
    A_PLUS: { min_ev: 0.08, min_confidence: 0.80 },
    B: { min_ev: 0.04, min_confidence: 0.65 }
  }
};

// Ballldontlie API base URL
const BALLDONTLIE_BASE_URL = "https://api.balldontlie.io/v1";

// Discard reasons
const DISCARD_REASONS = {
  INSUFFICIENT_DATA: "datos_insuficientes",
  LOW_CONFIDENCE: "confianza_baja",
  LOW_EV: "ev_insuficiente",
  NO_VALUE: "sin_value_bet"
};

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
  }
}

function logDiscardedPick(match, reason, extra = {}) {
  const entry = {
    date: new Date().toISOString().split('T')[0],
    match_name: `${match.home?.name || 'Home'} vs ${match.away?.name || 'Away'}`,
    league: 'NBA',
    reason,
    ...extra,
    created_at: new Date().toISOString()
  };
  discardedPicks.push(entry);
  console.log(`   ❌ DISCARDED: ${entry.match_name} - Reason: ${reason}`);
  return entry;
}

function formatDateForAPI(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0];
}

/**
 * Get NBA season year from date
 * NBA 2024-25 season: Oct 2024 - June 2025
 */
function getNBASeasonYear(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  // January through September = previous year's season
  if (month >= 1 && month <= 9) {
    return year - 1;
  }
  return year;
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
// DEMO DATA (used when no API key is configured)
// =====================================================

const DEMO_TEAMS = {
  'HOU': {
    id: 14,
    name: 'Houston Rockets',
    abbreviation: 'HOU',
    conference: 'West',
    stats: {
      avg_points_for: 112.5,
      avg_points_against: 109.2,
      record: '41-25',
      home_record: '24-10',
      conference_rank: 5,
      form: ['W','W','L','W','W'],
      last10_avg_total: 221.7
    },
    players: [
      { name: 'Jalen Green', position: 'SG', season_avg: { points: 21.8, rebounds: 4.2, assists: 3.5, minutes: 32.5, games_played: 62 } },
      { name: 'Alperen Sengun', position: 'C', season_avg: { points: 19.1, rebounds: 10.3, assists: 5.0, minutes: 31.2, games_played: 60 } },
      { name: 'Fred VanVleet', position: 'PG', season_avg: { points: 15.2, rebounds: 3.8, assists: 7.1, minutes: 35.0, games_played: 58 } }
    ]
  },
  'LAL': {
    id: 13,
    name: 'Los Angeles Lakers',
    abbreviation: 'LAL',
    conference: 'West',
    stats: {
      avg_points_for: 115.8,
      avg_points_against: 112.4,
      record: '40-26',
      away_record: '18-14',
      conference_rank: 6,
      form: ['W','L','W','W','L'],
      last10_avg_total: 228.2
    },
    players: [
      { name: 'LeBron James', position: 'SF', season_avg: { points: 24.8, rebounds: 7.2, assists: 8.8, minutes: 34.5, games_played: 58 } },
      { name: 'Anthony Davis', position: 'PF-C', season_avg: { points: 24.5, rebounds: 12.6, assists: 3.2, minutes: 35.2, games_played: 60 } },
      { name: "D'Angelo Russell", position: 'PG', season_avg: { points: 18.1, rebounds: 3.0, assists: 6.3, minutes: 30.5, games_played: 55 } }
    ]
  },
  'BOS': {
    id: 26,
    name: 'Boston Celtics',
    abbreviation: 'BOS',
    conference: 'East',
    stats: {
      avg_points_for: 120.3,
      avg_points_against: 109.5,
      record: '50-14',
      home_record: '28-5',
      conference_rank: 1,
      form: ['W','W','W','W','W'],
      last10_avg_total: 229.8
    },
    players: [
      { name: 'Jayson Tatum', position: 'SF', season_avg: { points: 27.1, rebounds: 8.4, assists: 5.0, minutes: 36.0, games_played: 62 } },
      { name: 'Jaylen Brown', position: 'SG', season_avg: { points: 23.5, rebounds: 5.8, assists: 3.8, minutes: 34.5, games_played: 60 } }
    ]
  },
  'MIA': {
    id: 20,
    name: 'Miami Heat',
    abbreviation: 'MIA',
    conference: 'East',
    stats: {
      avg_points_for: 108.7,
      avg_points_against: 107.2,
      record: '35-28',
      away_record: '15-15',
      conference_rank: 7,
      form: ['L','W','L','W','W'],
      last10_avg_total: 215.9
    },
    players: [
      { name: 'Jimmy Butler', position: 'SF', season_avg: { points: 20.2, rebounds: 5.4, assists: 5.2, minutes: 32.0, games_played: 50 } },
      { name: 'Bam Adebayo', position: 'C', season_avg: { points: 18.8, rebounds: 9.5, assists: 4.2, minutes: 33.5, games_played: 58 } }
    ]
  },
  'DEN': {
    id: 11,
    name: 'Denver Nuggets',
    abbreviation: 'DEN',
    conference: 'West',
    stats: {
      avg_points_for: 118.2,
      avg_points_against: 112.8,
      record: '44-20',
      home_record: '26-6',
      conference_rank: 2,
      form: ['W','W','W','L','W'],
      last10_avg_total: 231.0
    },
    players: [
      { name: 'Nikola Jokic', position: 'C', season_avg: { points: 26.1, rebounds: 12.3, assists: 9.0, minutes: 35.0, games_played: 62 } },
      { name: 'Jamal Murray', position: 'PG', season_avg: { points: 21.2, rebounds: 4.0, assists: 6.5, minutes: 33.0, games_played: 55 } }
    ]
  },
  'MIL': {
    id: 15,
    name: 'Milwaukee Bucks',
    abbreviation: 'MIL',
    conference: 'East',
    stats: {
      avg_points_for: 116.5,
      avg_points_against: 114.1,
      record: '38-26',
      away_record: '17-14',
      conference_rank: 4,
      form: ['W','L','L','W','W'],
      last10_avg_total: 230.6
    },
    players: [
      { name: 'Giannis Antetokounmpo', position: 'PF', season_avg: { points: 30.8, rebounds: 11.8, assists: 6.2, minutes: 35.5, games_played: 60 } },
      { name: 'Damian Lillard', position: 'PG', season_avg: { points: 24.5, rebounds: 4.2, assists: 7.0, minutes: 35.0, games_played: 58 } }
    ]
  }
};

function getDemoNBAGames(date) {
  const formattedDate = formatDateForAPI(date);
  
  const demoGames = [
    {
      game_id: 1,
      league: { id: 12, name: "NBA", country: "USA", tier: 1 },
      home: { id: 14, name: "Houston Rockets", abbreviation: "HOU" },
      away: { id: 13, name: "Los Angeles Lakers", abbreviation: "LAL" },
      tipoff_utc: `${formattedDate}T01:00:00Z`,
      status: 'NS'
    },
    {
      game_id: 2,
      league: { id: 12, name: "NBA", country: "USA", tier: 1 },
      home: { id: 26, name: "Boston Celtics", abbreviation: "BOS" },
      away: { id: 20, name: "Miami Heat", abbreviation: "MIA" },
      tipoff_utc: `${formattedDate}T00:30:00Z`,
      status: 'NS'
    },
    {
      game_id: 3,
      league: { id: 12, name: "NBA", country: "USA", tier: 1 },
      home: { id: 11, name: "Denver Nuggets", abbreviation: "DEN" },
      away: { id: 15, name: "Milwaukee Bucks", abbreviation: "MIL" },
      tipoff_utc: `${formattedDate}T02:00:00Z`,
      status: 'NS'
    }
  ];
  
  console.log(`   📊 Using demo data: ${demoGames.length} sample games`);
  return demoGames;
}

// =====================================================
// DATA FETCHING FUNCTIONS
// =====================================================

/**
 * Fetch from balldontlie API (requires API key)
 */
async function fetchFromBalldontlieAPI(endpoint) {
  if (!BALLDONTLIE_API_KEY) {
    return null;
  }
  
  try {
    const response = await fetch(`${BALLDONTLIE_BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${BALLDONTLIE_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Balldontlie API error: ${response.status}`);
    }

    requestCountToday++;
    return response.json();
  } catch (error) {
    console.error(`Balldontlie API fetch error:`, error.message);
    return null;
  }
}

/**
 * Get NBA games for a specific date
 */
async function getNBAGames(date) {
  const season = getNBASeasonYear(date);
  const formattedDate = formatDateForAPI(date);
  
  console.log(`   📅 Fetching NBA games for ${formattedDate} (season ${season}-${season + 1})`);
  
  // Try API first if key is available
  if (BALLDONTLIE_API_KEY) {
    try {
      const data = await fetchFromBalldontlieAPI(`/games?seasons[]=${season}&per_page=100`);
      
      if (data && data.data) {
        console.log(`   📊 API Response: ${data.data.length} total games this season`);
        
        const todayGames = data.data.filter(game => {
          const gameDate = new Date(game.date).toISOString().split('T')[0];
          return gameDate === formattedDate && game.status === 'Scheduled';
        });
        
        console.log(`   📊 Games scheduled for ${formattedDate}: ${todayGames.length}`);
        
        return todayGames.map(game => ({
          game_id: game.id,
          league: { id: 12, name: "NBA", country: "USA", tier: 1 },
          home: {
            id: game.home_team.id,
            name: game.home_team.full_name || game.home_team.name,
            abbreviation: game.home_team.abbreviation
          },
          away: {
            id: game.visitor_team.id,
            name: game.visitor_team.full_name || game.visitor_team.name,
            abbreviation: game.visitor_team.abbreviation
          },
          tipoff_utc: game.date,
          status: 'NS'
        }));
      }
    } catch (error) {
      console.error(`Error fetching NBA games:`, error.message);
    }
  }
  
  // Fallback to demo data
  return getDemoNBAGames(formattedDate);
}

/**
 * Enrich NBA game with data
 */
async function enrichNBAGame(game, season) {
  const homeAbbr = game.home.abbreviation;
  const awayAbbr = game.away.abbreviation;
  
  const homeTeamData = DEMO_TEAMS[homeAbbr] || null;
  const awayTeamData = DEMO_TEAMS[awayAbbr] || null;
  
  const enriched = {
    game_id: game.game_id,
    league: game.league,
    home: game.home,
    away: game.away,
    tipoff_utc: game.tipoff_utc
  };
  
  // Use demo data or fallback
  enriched.home_stats = homeTeamData?.stats || {
    avg_points_for: 110.0,
    avg_points_against: 110.0,
    record: '35-35',
    conference_rank: 10,
    last10_avg_total: 220.0
  };
  
  enriched.away_stats = awayTeamData?.stats || {
    avg_points_for: 110.0,
    avg_points_against: 110.0,
    record: '35-35',
    conference_rank: 10,
    last10_avg_total: 220.0
  };
  
  enriched.home_players = homeTeamData?.players || [];
  enriched.away_players = awayTeamData?.players || [];
  
  // Calculate projected total
  const projectedTotal = (enriched.home_stats.avg_points_for + enriched.away_stats.avg_points_for + 
                          enriched.home_stats.avg_points_against + enriched.away_stats.avg_points_against) / 2;
  enriched.projected_total = Math.round(projectedTotal * 10) / 10;
  
  // Data quality score
  enriched.data_quality_score = calculateDataQualityScore(enriched);
  
  return enriched;
}

function calculateDataQualityScore(enriched) {
  let score = 0;
  if (enriched.home_stats?.avg_points_for) score++;
  if (enriched.away_stats?.avg_points_for) score++;
  if (enriched.home_players?.length >= 1) score++;
  if (enriched.away_players?.length >= 1) score++;
  if (enriched.home_stats?.record) score++;
  if (enriched.away_stats?.record) score++;
  return score;
}

function hasMinimumDataForLLM(enriched) {
  return enriched.data_quality_score >= 3;
}

// =====================================================
// LLM ANALYSIS
// =====================================================

async function analyzeWithLLM(enrichedGame) {
  if (!OPENROUTERFREE_API_KEY) return null;
  
  const SYSTEM_PROMPT = `Eres Coco, analista experto en NBA. Analiza el partido y genera picks de valor.
RESPONDE SIEMPRE EN ESPAÑOL Y EN JSON VÁLIDO.

MERCADOS A ANALIZAR:
1. Over/Under puntos totales del partido
2. Player Prop: puntos de un jugador clave

METODOLOGÍA:
- Usar promedios de puntos de ambos equipos
- Considerar forma reciente
- EV = (prob_estimada * cuota) - 1

ESCALA DE CONFIANZA:
- 0.80+: 4+ factores a favor, EV >= 0.08
- 0.65-0.79: 2-3 factores, EV entre 0.04-0.08
- <0.65: NO proponer pick

FORMATO JSON:
{
  "picks": [
    {
      "type": "team" | "player_prop",
      "player_name": null | "Nombre Jugador",
      "market": "over_under" | "player_points",
      "selection": "over" | "under",
      "line": number,
      "estimated_prob": number,
      "bookmaker_odds": 1.90,
      "expected_value": number,
      "value_bet": boolean,
      "confidence": number
    }
  ],
  "analysis": "120-160 palabras con: promedios, forma, riesgo",
  "risk_factors": ["riesgo1", "riesgo2"]
}`;

  const gameJSON = JSON.stringify(enrichedGame, null, 2);
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTERFREE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP NBA Picks'
      },
      body: JSON.stringify({
        model: CONFIG.LLM_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analiza este partido NBA:\n\n${gameJSON}` }
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
    console.error("LLM Analysis Error:", error.message);
    return null;
  }
}

/**
 * Select best picks from LLM results
 */
function selectBestPicks(llmResults, enrichedGames) {
  const allPicks = [];
  const picksPerGame = new Map();
  
  for (let i = 0; i < llmResults.length; i++) {
    const result = llmResults[i];
    const game = enrichedGames[i];
    
    if (!result?.picks || !Array.isArray(result.picks)) continue;
    
    for (const pick of result.picks) {
      if (!pick.value_bet) {
        logDiscardedPick({ home: game.home, away: game.away }, DISCARD_REASONS.NO_VALUE, {
          confidence_llm: pick.confidence,
          ev_llm: pick.expected_value
        });
        continue;
      }
      
      if (pick.confidence < CONFIG.MIN_CONFIDENCE) {
        logDiscardedPick({ home: game.home, away: game.away }, DISCARD_REASONS.LOW_CONFIDENCE, {
          confidence_llm: pick.confidence,
          ev_llm: pick.expected_value
        });
        continue;
      }
      
      if (pick.expected_value < CONFIG.MIN_EV) {
        logDiscardedPick({ home: game.home, away: game.away }, DISCARD_REASONS.LOW_EV, {
          confidence_llm: pick.confidence,
          ev_llm: pick.expected_value
        });
        continue;
      }
      
      // Track picks per game (max 2)
      const gamePicks = picksPerGame.get(game.game_id) || 0;
      if (gamePicks >= 2) continue;
      
      // Determine quality tier
      let qualityTier = 'B';
      if (pick.expected_value >= CONFIG.QUALITY_TIERS.A_PLUS.min_ev &&
          pick.confidence >= CONFIG.QUALITY_TIERS.A_PLUS.min_confidence) {
        qualityTier = 'A_PLUS';
      }
      
      // Build selection name
      let selectionName = '';
      let odds = 1.90;
      
      if (pick.type === 'team' && pick.market === 'over_under') {
        selectionName = `${pick.selection === 'over' ? 'Over' : 'Under'} ${pick.line || game.projected_total || 225}`;
        odds = 1.90;
      } else if (pick.market === 'player_points' && pick.player_name) {
        selectionName = `${pick.player_name} ${pick.selection === 'over' ? 'Over' : 'Under'} ${pick.line} pts`;
        odds = 1.90;
      } else if (pick.market === 'player_rebounds') {
        selectionName = `${pick.player_name} ${pick.selection === 'over' ? 'Over' : 'Under'} ${pick.line} reb`;
        odds = 1.90;
      } else if (pick.market === 'player_assists') {
        selectionName = `${pick.player_name} ${pick.selection === 'over' ? 'Over' : 'Under'} ${pick.line} ast`;
        odds = 1.90;
      }
      
      allPicks.push({
        game_id: game.game_id,
        league: 'NBA',
        home_team: game.home.name,
        away_team: game.away.name,
        tipoff: game.tipoff_utc,
        
        pick_type: pick.type || 'team',
        player_name: pick.player_name || null,
        market: pick.market,
        selection: selectionName,
        line: pick.line || null,
        odds: pick.bookmaker_odds || odds,
        
        estimated_prob: pick.estimated_prob,
        edge_percent: Math.round(pick.expected_value * 100),
        confidence: Math.round(pick.confidence * 10),
        quality_tier: qualityTier,
        
        analysis: result.analysis,
        risk_factors: result.risk_factors || [],
        
        source: 'daily_auto',
        sport: 'basketball'
      });
      
      picksPerGame.set(game.game_id, gamePicks + 1);
    }
  }
  
  // Sort by quality and take top 3
  allPicks.sort((a, b) => 
    (b.confidence * b.edge_percent) - (a.confidence * a.edge_percent)
  );
  
  return allPicks.slice(0, CONFIG.MAX_PICKS_PER_DAY);
}

/**
 * Save picks to Supabase
 */
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
      body: JSON.stringify(picks.map(pick => ({
        sport: 'basketball',
        match_name: `${pick.home_team} vs ${pick.away_team}`,
        date: pick.tipoff.split('T')[0],
        league: 'NBA',
        home_team: pick.home_team,
        away_team: pick.away_team,
        kickoff: pick.tipoff,
        
        pick_type: pick.pick_type,
        player_name: pick.player_name,
        line: pick.line,
        
        market: pick.market,
        selection: pick.selection,
        odds: pick.odds,
        estimated_prob: pick.estimated_prob,
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
    
    console.log(`✅ Saved ${picks.length} NBA picks to Supabase`);
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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();
  discardedPicks = [];
  
  try {
    const { date } = req.body || {};
    const targetDate = date || new Date().toISOString().split('T')[0];
    const season = getNBASeasonYear(targetDate);
    
    console.log(`\n🏀 Starting NBA Picks Generation for ${targetDate}`);
    console.log(`   Season: ${season}-${season + 1} NBA Season`);
    console.log(`   API Key configured: ${!!BALLDONTLIE_API_KEY}`);
    
    checkAndResetCounter();
    
    // Get games
    console.log("\n📅 Fetching NBA games...");
    const games = await getNBAGames(targetDate);
    console.log(`   Found ${games.length} NBA games`);
    
    if (games.length === 0) {
      return res.status(200).json({
        date: targetDate,
        picks_generated: 0,
        picks: [],
        discarded_count: 0,
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: "No NBA games scheduled for today"
      });
    }
    
    // Enrich games
    console.log("\n📊 Enriching games with data...");
    const enrichedGames = [];
    
    for (const game of games.slice(0, 5)) {
      console.log(`   Enriching: ${game.home.name} vs ${game.away.name}`);
      const enriched = await enrichNBAGame(game, season);
      
      if (hasMinimumDataForLLM(enriched)) {
        enrichedGames.push(enriched);
      } else {
        logDiscardedPick({ home: game.home, away: game.away }, DISCARD_REASONS.INSUFFICIENT_DATA, {
          data_blocks_available: enriched.data_quality_score
        });
      }
    }
    
    if (enrichedGames.length === 0) {
      await saveDiscardedPicksToSupabase(discardedPicks);
      return res.status(200).json({
        date: targetDate,
        picks_generated: 0,
        picks: [],
        discarded_count: discardedPicks.length,
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: "No games with sufficient data quality"
      });
    }
    
    // Analyze with LLM
    console.log("\n🤖 Analyzing with LLM...");
    const llmResults = [];
    
    for (const game of enrichedGames) {
      console.log(`   Analyzing: ${game.home.name} vs ${game.away.name}`);
      const analysis = await analyzeWithLLM(game);
      llmResults.push(analysis);
    }
    
    // Select best picks
    console.log("\n✅ Selecting best picks...");
    const picks = selectBestPicks(llmResults, enrichedGames);
    console.log(`   Selected ${picks.length} picks`);
    
    // Save
    if (picks.length > 0) {
      console.log("\n💾 Saving to Supabase...");
      await savePicksToSupabase(picks);
    }
    
    await saveDiscardedPicksToSupabase(discardedPicks);
    
    const executionTime = Date.now() - startTime;
    console.log(`\n🎉 NBA Picks Complete! (${executionTime}ms, ${picks.length} picks, ${discardedPicks.length} discarded)`);
    
    return res.status(200).json({
      date: targetDate,
      picks_generated: picks.length,
      picks,
      discarded_count: discardedPicks.length,
      api_requests_used: requestCountToday,
      execution_time_ms: executionTime,
      message: picks.length === 0 ? "No quality NBA picks found today" : undefined
    });
    
  } catch (error) {
    console.error("❌ NBA Picks Error:", error);
    await saveDiscardedPicksToSupabase(discardedPicks);
    
    return res.status(500).json({
      error: "Failed to generate NBA picks",
      message: error.message,
      api_requests_used: requestCountToday,
      execution_time_ms: Date.now() - startTime
    });
  }
}
