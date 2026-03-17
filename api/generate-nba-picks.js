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
 * Uses balldontlie.io API (FREE, no API key required for basic tier)
 */

const OPENROUTERFREE_API_KEY = process.env.OPENROUTERFREE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Ballldontlie API base URL (FREE, no API key required)
const BALLDONTLIE_BASE_URL = "https://www.balldontlie.io/api/v1";

// NBA Configuration
const CONFIG = {
  MAX_PICKS_PER_DAY: 3,
  MAX_API_REQUESTS: 100,
  CANDIDATE_LIMIT: 10,
  MIN_CONFIDENCE: 0.65,
  MIN_EV: 0.04,
  LLM_MODEL: "deepseek/deepseek-chat",
  
  QUALITY_TIERS: {
    A_PLUS: { min_ev: 0.08, min_confidence: 0.80 },
    B: { min_ev: 0.04, min_confidence: 0.65 }
  }
};

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

function formatDateForAPI(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0];
}

/**
 * Fetch from balldontlie API (FREE, no API key required)
 */
async function fetchFromBalldontlie(endpoint) {
  try {
    const response = await fetch(`${BALLDONTLIE_BASE_URL}${endpoint}`, {
      headers: {
        'User-Agent': 'Coco-VIP-Betting-App/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Balldontlie API error: ${response.status}`);
    }

    requestCountToday++;
    return response.json();
  } catch (error) {
    console.error(`Balldontlie fetch error:`, error.message);
    return null;
  }
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
// DATA FETCHING FUNCTIONS
// =====================================================

/**
 * Get NBA games for a specific date
 */
async function getNBAGames(date) {
  const games = [];
  const season = getNBASeasonYear(date);
  const formattedDate = formatDateForAPI(date);
  
  console.log(`   📅 Fetching NBA games for ${formattedDate} (season ${season}-${season + 1})`);
  
  try {
    const data = await fetchFromBalldontlie(`/games?seasons[]=${season}&per_page=100`);
    
    if (data && data.data) {
      console.log(`   📊 API Response: ${data.data.length} total games this season`);
      
      // Filter games for target date
      const todayGames = data.data.filter(game => {
        const gameDate = new Date(game.date).toISOString().split('T')[0];
        return gameDate === formattedDate && game.status === 'Scheduled';
      });
      
      console.log(`   📊 Games scheduled for ${formattedDate}: ${todayGames.length}`);
      
      for (const game of todayGames) {
        games.push({
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
        });
      }
    }
  } catch (error) {
    console.error(`Error fetching NBA games:`, error.message);
  }
  
  return games;
}

/**
 * Get team statistics
 */
async function getTeamStats(teamId, season) {
  try {
    const data = await fetchFromBalldontlie(`/teams/${teamId}`);
    if (data) {
      return {
        team_id: teamId,
        name: data.full_name || data.name,
        abbreviation: data.abbreviation,
        conference: data.conference,
        division: data.division
      };
    }
  } catch (error) {
    console.error(`Error fetching team stats for ${teamId}:`, error.message);
  }
  return null;
}

/**
 * Get team's last games
 */
async function getTeamLastGames(teamId, season, limit = 10) {
  try {
    const data = await fetchFromBalldontlie(`/games?seasons[]=${season}&team_ids[]=${teamId}&per_page=${limit}`);
    
    if (data && data.data) {
      const games = data.data
        .filter(g => g.status === 'Final')
        .slice(0, limit)
        .map(g => {
          const isHome = g.home_team.id === teamId;
          const teamScore = isHome ? g.home_team_score : g.visitor_team_score;
          const oppScore = isHome ? g.visitor_team_score : g.home_team_score;
          const result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D';
          
          return {
            date: g.date,
            opponent: isHome ? g.visitor_team.full_name : g.home_team.full_name,
            is_home: isHome,
            team_score: teamScore,
            opponent_score: oppScore,
            result,
            total_points: teamScore + oppScore
          };
        });
      
      const totalPoints = games.reduce((sum, g) => sum + g.total_points, 0);
      const avgPoints = games.length > 0 ? totalPoints / games.length : 0;
      
      return {
        games,
        avg_total_points: Math.round(avgPoints * 10) / 10,
        wins: games.filter(g => g.result === 'W').length,
        losses: games.filter(g => g.result === 'L').length
      };
    }
  } catch (error) {
    console.error(`Error fetching last games for ${teamId}:`, error.message);
  }
  return null;
}

/**
 * Get player stats for a team
 */
async function getTeamPlayers(teamId, season) {
  try {
    const data = await fetchFromBalldontlie(`/players?team_ids[]=${teamId}&per_page=25`);
    
    if (data && data.data) {
      return data.data.map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name}`,
        position: p.position,
        team_id: teamId
      }));
    }
  } catch (error) {
    console.error(`Error fetching players for team ${teamId}:`, error.message);
  }
  return [];
}

/**
 * Get player season stats
 */
async function getPlayerStats(playerId, season) {
  try {
    const data = await fetchFromBalldontlie(`/season_averages?season=${season}&player_ids[]=${playerId}`);
    
    if (data && data.data && data.data.length > 0) {
      const stats = data.data[0];
      return {
        points: stats.pts || 0,
        rebounds: stats.reb || 0,
        assists: stats.ast || 0,
        minutes: stats.min || '0',
        games_played: stats.games_played || 0,
        fg_pct: stats.fg_pct || 0,
        ft_pct: stats.ft_pct || 0,
        fg3_pct: stats.fg3_pct || 0
      };
    }
  } catch (error) {
    console.error(`Error fetching player stats for ${playerId}:`, error.message);
  }
  return null;
}

/**
 * Get top players with stats for a team
 */
async function getTopPlayersWithStats(teamId, season, limit = 3) {
  try {
    const players = await getTeamPlayers(teamId, season);
    const playersWithStats = [];
    
    for (const player of players.slice(0, 10)) {
      const stats = await getPlayerStats(player.id, season);
      if (stats && stats.points > 5) {
        playersWithStats.push({
          ...player,
          season_avg: stats
        });
      }
      if (playersWithStats.length >= limit) break;
    }
    
    // Sort by points
    return playersWithStats.sort((a, b) => (b.season_avg?.points || 0) - (a.season_avg?.points || 0));
  } catch (error) {
    console.error(`Error getting top players for ${teamId}:`, error.message);
    return [];
  }
}

/**
 * Enrich NBA game with data
 */
async function enrichNBAGame(game, season) {
  const enriched = {
    game_id: game.game_id,
    league: game.league,
    home: game.home,
    away: game.away,
    tipoff_utc: game.tipoff_utc
  };
  
  try {
    // Team info
    enriched.home_team_info = await getTeamStats(game.home.id, season);
    enriched.away_team_info = await getTeamStats(game.away.id, season);
    
    // Last games
    enriched.home_last10 = await getTeamLastGames(game.home.id, season, 10);
    enriched.away_last10 = await getTeamLastGames(game.away.id, season, 10);
    
    // Top players with stats
    enriched.home_players = await getTopPlayersWithStats(game.home.id, season, 3);
    enriched.away_players = await getTopPlayersWithStats(game.away.id, season, 3);
    
    // Calculate data quality score
    enriched.data_quality_score = calculateDataQualityScore(enriched);
    
  } catch (error) {
    console.error(`Error enriching game ${game.game_id}:`, error.message);
  }
  
  return enriched;
}

function calculateDataQualityScore(enriched) {
  let score = 0;
  if (enriched.home_team_info) score++;
  if (enriched.away_team_info) score++;
  if (enriched.home_last10?.games?.length >= 3) score++;
  if (enriched.away_last10?.games?.length >= 3) score++;
  if (enriched.home_players?.length >= 1) score++;
  if (enriched.away_players?.length >= 1) score++;
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
- Considerar forma reciente (últimos 10)
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
        selectionName = `${pick.selection === 'over' ? 'Over' : 'Under'} ${pick.line || 220.5}`;
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
    
    // Limit candidates based on budget
    const remainingRequests = CONFIG.MAX_API_REQUESTS - requestCountToday;
    const maxCandidates = Math.min(CONFIG.CANDIDATE_LIMIT, Math.floor(remainingRequests / 8));
    const candidates = games.slice(0, Math.max(1, maxCandidates));
    
    // Enrich games
    console.log("\n📊 Enriching games with data...");
    const enrichedGames = [];
    
    for (const game of candidates) {
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
