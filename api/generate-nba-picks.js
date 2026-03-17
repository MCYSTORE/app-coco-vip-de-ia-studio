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
 */

const SPORTS_API_KEY = process.env.SPORTS_API_KEY;
const OPENROUTERFREE_API_KEY = process.env.OPENROUTERFREE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// NBA Configuration
const CONFIG = {
  MAX_PICKS_PER_DAY: 3,
  MAX_API_REQUESTS: 100,
  
  // NBA Leagues (NBA = 12, Euroleague = 120)
  LEAGUES: [
    { id: 12, name: "NBA", country: "USA", tier: 1 }
    // Can add more leagues later
  ],
  
  CANDIDATE_LIMIT: 10,
  MIN_CONFIDENCE: 0.65,
  MIN_EV: 0.04,
  LLM_MODEL: "deepseek/deepseek-chat",
  
  QUALITY_TIERS: {
    A_PLUS: { min_ev: 0.08, min_confidence: 0.80 },
    B: { min_ev: 0.04, min_confidence: 0.65 }
  },
  
  // Player props markets
  PLAYER_PROP_BETS: {
    POINTS: 'player_points',
    REBOUNDS: 'player_rebounds',
    ASSISTS: 'player_assists'
  },
  
  // Bookmaker IDs
  DEFAULT_BOOKMAKER_ID: 6, // Bet365 for NBA odds
};

// Discard reasons
const DISCARD_REASONS = {
  INSUFFICIENT_DATA: "datos_insuficientes",
  LOW_CONFIDENCE: "confianza_baja",
  LOW_EV: "ev_insuficiente",
  NO_VALUE: "sin_value_bet"
};

// In-memory cache
const standingsCache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12h for NBA

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

async function fetchFromAPI(endpoint) {
  console.log(`   🔗 Fetching: https://v3.basketball.api-sports.io/${endpoint}`);
  
  const response = await fetch(`https://v3.basketball.api-sports.io/${endpoint}`, {
    headers: {
      'x-apisports-key': SPORTS_API_KEY || ''
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error(`   ❌ API-Sports Basketball error: ${response.status} - ${errorText}`);
    
    // Check for common issues
    if (response.status === 403) {
      throw new Error(`API access denied (403). The Basketball API may require a separate subscription. Your API key may only have access to Football.`);
    }
    if (response.status === 429) {
      throw new Error(`API rate limit exceeded (429). Too many requests today.`);
    }
    
    throw new Error(`API-Sports Basketball error: ${response.status}`);
  }

  requestCountToday++;
  const data = await response.json();
  console.log(`   ✅ API Response: ${data.response?.length || 0} items`);
  return data;
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
 * Get NBA season year from date
 * NBA season starts in October and ends in June of next year
 * So for Jan-June 2025, season = 2024 (2024-25 season)
 * For Oct-Dec 2024, season = 2024 (2024-25 season)
 */
function getNBASeasonYear(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  
  // If month is January through September (1-9), we're in the previous year's season
  // NBA 2024-25 season: Oct 2024 - June 2025
  if (month >= 1 && month <= 9) {
    return year - 1;
  }
  // October through December: current year is the season start
  return year;
}

/**
 * Get NBA games for a specific date
 */
async function getNBAGames(date) {
  const games = [];
  const season = getNBASeasonYear(date);
  
  console.log(`   📅 Fetching NBA games for ${date} (season ${season})`);
  
  for (const league of CONFIG.LEAGUES) {
    try {
      const data = await fetchFromAPI(`games?date=${date}&league=${league.id}&season=${season}`);
      
      console.log(`   📊 API Response for ${league.name}: ${data.response?.length || 0} games`);
      
      if (data.response) {
        for (const game of data.response) {
          if (game.status?.short === 'NS') { // Not started
            games.push({
              game_id: game.id,
              league: league,
              home: {
                id: game.teams.home.id,
                name: game.teams.home.name,
                logo: game.teams.home.logo
              },
              away: {
                id: game.teams.away.id,
                name: game.teams.away.name,
                logo: game.teams.away.logo
              },
              tipoff_utc: game.date,
              status: game.status?.short
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching NBA games:`, error.message);
    }
  }
  
  return games;
}

/**
 * Get team statistics for the season
 */
async function getTeamStats(teamId, season) {
  try {
    const data = await fetchFromAPI(`statistics?team=${teamId}&season=${season}&league=12`);
    
    if (data.response) {
      const stats = data.response;
      return {
        games_played: stats.games?.played || 0,
        avg_points_for: stats.points?.for?.average?.all || 0,
        avg_points_against: stats.points?.against?.average?.all || 0,
        home_record: stats.games?.wins?.home_total ? 
          `${stats.games.wins.home_total}-${stats.games.loses?.home_total || 0}` : 'N/A',
        away_record: stats.games?.wins?.away_total ?
          `${stats.games.wins.away_total}-${stats.games.loses?.away_total || 0}` : 'N/A',
        form: stats.form || '',
        win_streak: stats.streak?.wins || 0,
        lose_streak: stats.streak?.loses || 0
      };
    }
  } catch (error) {
    console.error(`Error fetching team stats for ${teamId}:`, error.message);
  }
  return null;
}

/**
 * Get last 10 games for a team
 */
async function getTeamLastGames(teamId, limit = 10) {
  try {
    const data = await fetchFromAPI(`games?team=${teamId}&last=${limit}`);
    
    if (data.response) {
      const games = data.response.filter(g => g.status?.short === 'FT').map(g => {
        const isHome = g.teams.home.id === teamId;
        const teamScore = isHome ? g.scores.home.total : g.scores.away.total;
        const oppScore = isHome ? g.scores.away.total : g.scores.home.total;
        const result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D';
        
        return {
          date: g.date,
          opponent: isHome ? g.teams.away.name : g.teams.home.name,
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
 * Get H2H games between two teams
 */
async function getH2HGames(homeId, awayId, limit = 5) {
  try {
    const data = await fetchFromAPI(`games/headtohead?h2h=${homeId}-${awayId}&last=${limit}`);
    
    if (data.response) {
      const games = data.response.filter(g => g.status?.short === 'FT').map(g => ({
        date: g.date,
        home_team: g.teams.home.name,
        away_team: g.teams.away.name,
        home_score: g.scores.home.total,
        away_score: g.scores.away.total,
        total: g.scores.home.total + g.scores.away.total
      }));
      
      const avgTotal = games.length > 0 ?
        games.reduce((sum, g) => sum + g.total, 0) / games.length : 0;
      
      return { games, avg_total: Math.round(avgTotal * 10) / 10 };
    }
  } catch (error) {
    console.error(`Error fetching H2H:`, error.message);
  }
  return { games: [], avg_total: 0 };
}

/**
 * Get key players statistics for a team
 */
async function getKeyPlayersStats(teamId, gameId, season) {
  try {
    // Try to get game-specific stats first
    let playerData = null;
    
    if (gameId) {
      const gameStatsData = await fetchFromAPI(`players/statistics?game=${gameId}&team=${teamId}`);
      if (gameStatsData.response && gameStatsData.response.length > 0) {
        playerData = gameStatsData.response;
      }
    }
    
    // Fallback to season stats
    if (!playerData || playerData.length === 0) {
      const seasonStatsData = await fetchFromAPI(`players/statistics?team=${teamId}&season=${season}&league=12`);
      if (seasonStatsData.response) {
        playerData = seasonStatsData.response;
      }
    }
    
    if (!playerData) return [];
    
    // Sort by points per game and get top players
    const sortedPlayers = playerData
      .filter(p => p.points > 0 || p.rebounds > 0 || p.assists > 0)
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 4); // Get top 4 players (2 per team for display)
    
    return sortedPlayers.map(p => ({
      name: p.player?.name || 'Unknown',
      team: p.team?.name || '',
      position: p.pos || 'N/A',
      
      season_avg: {
        points: parseFloat((p.points || 0).toFixed(1)),
        rebounds: parseFloat((p.totReb || 0).toFixed(1)),
        assists: parseFloat((p.assists || 0).toFixed(1)),
        minutes: parseFloat((p.min || 0).toString().replace(':', '.').split('.')[0] || 0)
      },
      
      // For game-specific stats
      last_game: p.points !== undefined ? {
        points: p.points || 0,
        rebounds: p.totReb || 0,
        assists: p.assists || 0,
        minutes: p.min || '0'
      } : null,
      
      games_played: p.games?.played || 0
    }));
  } catch (error) {
    console.error(`Error fetching player stats for team ${teamId}:`, error.message);
    return [];
  }
}

/**
 * Get player props odds (if available)
 */
async function getPlayerPropsOdds(gameId) {
  const props = {};
  
  // Note: API-Football/Basketball may not have player props odds in free tier
  // We'll create placeholder structure that can be filled if odds are available
  
  try {
    // Try to get odds with player props
    // This might not work with free tier, but structure is ready
    const oddsData = await fetchFromAPI(`odds?game=${gameId}&bookmaker=${CONFIG.DEFAULT_BOOKMAKER_ID}`);
    
    if (oddsData.response?.[0]?.bookmakers?.[0]?.bets) {
      const bets = oddsData.response[0].bookmakers[0].bets;
      
      // Look for player props
      for (const bet of bets) {
        if (bet.name?.includes('Player Points') || bet.name?.includes('player_points')) {
          props.points = {
            line: parseFloat(bet.values?.[0]?.value || 0),
            over_odds: parseFloat(bet.values?.find(v => v.value === 'Over')?.odd || 0),
            under_odds: parseFloat(bet.values?.find(v => v.value === 'Under')?.odd || 0)
          };
        }
        if (bet.name?.includes('Player Rebounds') || bet.name?.includes('player_rebounds')) {
          props.rebounds = {
            line: parseFloat(bet.values?.[0]?.value || 0),
            over_odds: parseFloat(bet.values?.find(v => v.value === 'Over')?.odd || 0),
            under_odds: parseFloat(bet.values?.find(v => v.value === 'Under')?.odd || 0)
          };
        }
      }
    }
  } catch (error) {
    console.log(`Player props odds not available for game ${gameId}`);
  }
  
  return props;
}

/**
 * Get game odds
 */
async function getGameOdds(gameId) {
  try {
    const oddsData = await fetchFromAPI(`odds?game=${gameId}&bookmaker=${CONFIG.DEFAULT_BOOKMAKER_ID}`);
    
    if (oddsData.response?.[0]?.bookmakers?.[0]?.bets) {
      const bets = oddsData.response[0].bookmakers[0].bets;
      
      // Find moneyline
      const moneyline = bets.find(b => b.name === 'Match Winner');
      // Find totals
      const totals = bets.find(b => b.name === 'Match Total' || b.name === 'Over/Under');
      
      return {
        moneyline: moneyline ? {
          home: parseFloat(moneyline.values?.find(v => v.value === 'Home')?.odd || 0),
          away: parseFloat(moneyline.values?.find(v => v.value === 'Away')?.odd || 0)
        } : null,
        totals: totals ? {
          line: parseFloat(totals.values?.[0]?.value || 220.5),
          over: parseFloat(totals.values?.find(v => v.value === 'Over')?.odd || 1.90),
          under: parseFloat(totals.values?.find(v => v.value === 'Under')?.odd || 1.90)
        } : null
      };
    }
  } catch (error) {
    console.log(`Odds not available for game ${gameId}`);
  }
  
  return { moneyline: null, totals: null };
}

/**
 * Check if team is in back-to-back
 */
function isBackToBack(teamLastGames) {
  if (!teamLastGames?.games || teamLastGames.games.length < 1) return false;
  
  const lastGame = teamLastGames.games[0];
  if (!lastGame?.date) return false;
  
  const lastGameDate = new Date(lastGame.date);
  const today = new Date();
  
  const diffDays = Math.abs(today - lastGameDate) / (1000 * 60 * 60 * 24);
  return diffDays <= 1;
}

/**
 * Enrich NBA game with all data
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
    // Team stats
    const homeStats = await getTeamStats(game.home.id, season);
    const awayStats = await getTeamStats(game.away.id, season);
    enriched.home_stats = homeStats;
    enriched.away_stats = awayStats;
    
    // Last games
    const homeLastGames = await getTeamLastGames(game.home.id, 10);
    const awayLastGames = await getTeamLastGames(game.away.id, 10);
    enriched.home_last10 = homeLastGames;
    enriched.away_last10 = awayLastGames;
    
    // H2H
    enriched.h2h = await getH2HGames(game.home.id, game.away.id, 5);
    
    // Key players
    const homePlayers = await getKeyPlayersStats(game.home.id, game.game_id, season);
    const awayPlayers = await getKeyPlayersStats(game.away.id, game.game_id, season);
    
    // Add context factors to players
    enriched.key_players = [
      ...homePlayers.slice(0, 2).map(p => ({
        ...p,
        context_factors: {
          is_back_to_back: isBackToBack(homeLastGames),
          minutes_projection: p.season_avg.minutes,
          key_absences_in_team: [] // Would need injury report API
        }
      })),
      ...awayPlayers.slice(0, 2).map(p => ({
        ...p,
        context_factors: {
          is_back_to_back: isBackToBack(awayLastGames),
          minutes_projection: p.season_avg.minutes,
          key_absences_in_team: []
        }
      }))
    ];
    
    // Odds
    enriched.odds = await getGameOdds(game.game_id);
    
    // Player props odds (if available)
    enriched.player_props_odds = await getPlayerPropsOdds(game.game_id);
    
    // Calculate data quality score
    enriched.data_quality_score = calculateDataQualityScore(enriched);
    
  } catch (error) {
    console.error(`Error enriching game ${game.game_id}:`, error.message);
  }
  
  return enriched;
}

function calculateDataQualityScore(enriched) {
  let score = 0;
  if (enriched.home_stats?.avg_points_for) score++;
  if (enriched.away_stats?.avg_points_for) score++;
  if (enriched.home_last10?.games?.length >= 5) score++;
  if (enriched.away_last10?.games?.length >= 5) score++;
  if (enriched.h2h?.games?.length > 0) score++;
  if (enriched.odds?.totals) score++;
  if (enriched.key_players?.length >= 2) score++;
  return score;
}

function hasMinimumDataForLLM(enriched) {
  return enriched.data_quality_score >= 4;
}

// =====================================================
// LLM ANALYSIS
// =====================================================

async function analyzeWithLLM(enrichedGame) {
  if (!OPENROUTERFREE_API_KEY) return null;
  
  const SYSTEM_PROMPT = `Eres Coco, analista experto en NBA, apuestas de equipo y player props. Recibes datos reales y estructurados de un partido NBA incluyendo estadísticas de jugadores clave.
RESPONDE SIEMPRE EN ESPAÑOL Y EN JSON VÁLIDO.

MERCADOS A ANALIZAR (en orden de prioridad):
1. Over/Under puntos totales del partido
2. Player Prop: puntos, rebotes o asistencias de un jugador clave
3. Moneyline (ganador)

METODOLOGÍA PARA TEAM MARKETS (over/under / moneyline):
- Usar avg_pts_last10 y avg_pts_allowed_last10 de ambos equipos
- Considerar racha actual, record local/visitante
- H2H totales recientes
- EV = (prob_estimada * cuota) - 1

METODOLOGÍA PARA PLAYER PROPS:
- Comparar last_5_games_avg del jugador con la línea ofrecida
- Evaluar opponent_defense_rank_vs_position:
    rank 25-30 = defensa débil = favorece el OVER del jugador
    rank 1-8 = defensa fuerte = favorece el UNDER
- Considerar:
    is_back_to_back: true = posible reducción de minutos
    key_absences_in_team: si faltan compañeros clave,
      el jugador puede tomar más protagonismo (favorece OVER)
    minutes_projection: si < 30 min, ser conservador
- EV = (prob_estimada * cuota) - 1
- Solo proponer prop si el jugador tiene datos en season_avg

ESCALA DE CONFIANZA (estricta, no negociable):
- 0.80+: 4+ factores alineados, EV >= 0.08, sin riesgos mayores
- 0.65-0.79: 2-3 factores, EV entre 0.04 y 0.08
- <0.65: NO proponer pick en ese mercado

PROHIBIDO:
- Inventar stats no presentes en el JSON recibido
- Dar confidence > 0.75 sin citar datos concretos del contexto
- Proponer player prop si el jugador tiene menos de 10 juegos jugados

FORMATO JSON (puede incluir hasta 2 picks por partido: uno de equipo y uno de player prop):

{
  "picks": [
    {
      "type": "team" | "player_prop",
      "player_name": null | "Nikola Jokić",
      "market": "over_under" | "moneyline" | "player_points" | "player_rebounds" | "player_assists",
      "selection": "over" | "under" | "home" | "away",
      "line": number,
      "estimated_prob": number,
      "bookmaker_odds": number,
      "expected_value": number,
      "value_bet": boolean,
      "confidence": number
    }
  ],
  "analysis": "120-160 palabras en español. DEBE incluir:
    1) Promedio de puntos de ambos equipos últimos 10
    2) Justificación del over/under de equipo
    3) Si hay player prop: avg del jugador vs línea
    4) Record local/visitante de ambos
    5) Al menos 1 factor de riesgo por pick propuesto",
  "supporting_factors": ["factor1", "factor2", "factor3"],
  "risk_factors": ["riesgo1", "riesgo2"],
  "no_value_reason": null | "razón si no hay value"
}`;

  const gameJSON = JSON.stringify(enrichedGame, null, 2);
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTERFREE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://app-coco-vip-de-ia-studio.vercel.app',
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
  const picksPerGame = new Map(); // Track picks per game (max 2 per game)
  
  for (let i = 0; i < llmResults.length; i++) {
    const result = llmResults[i];
    const game = enrichedGames[i];
    
    if (!result?.picks || !Array.isArray(result.picks)) continue;
    
    for (const pick of result.picks) {
      // Validate pick
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
      
      // Get odds
      let odds = 1.90;
      if (pick.type === 'team' && pick.market === 'over_under') {
        odds = pick.selection === 'over' ? 
          (game.odds?.totals?.over || 1.90) : 
          (game.odds?.totals?.under || 1.90);
      } else if (pick.type === 'team' && pick.market === 'moneyline') {
        odds = pick.selection === 'home' ?
          (game.odds?.moneyline?.home || 2.0) :
          (game.odds?.moneyline?.away || 2.0);
      }
      
      // Build selection name
      let selectionName = '';
      if (pick.market === 'over_under') {
        selectionName = `${pick.selection === 'over' ? 'Over' : 'Under'} ${pick.line || game.odds?.totals?.line || 220.5}`;
      } else if (pick.market === 'moneyline') {
        selectionName = pick.selection === 'home' ? game.home.name : game.away.name;
      } else if (pick.market === 'player_points') {
        selectionName = `${pick.player_name} ${pick.selection === 'over' ? 'Over' : 'Under'} ${pick.line} pts`;
      } else if (pick.market === 'player_rebounds') {
        selectionName = `${pick.player_name} ${pick.selection === 'over' ? 'Over' : 'Under'} ${pick.line} reb`;
      } else if (pick.market === 'player_assists') {
        selectionName = `${pick.player_name} ${pick.selection === 'over' ? 'Over' : 'Under'} ${pick.line} ast`;
      }
      
      allPicks.push({
        game_id: game.game_id,
        league: game.league.name,
        home_team: game.home.name,
        away_team: game.away.name,
        tipoff: game.tipoff_utc,
        
        // Pick details
        pick_type: pick.type,
        player_name: pick.player_name || null,
        market: pick.market,
        selection: selectionName,
        line: pick.line || null,
        odds: pick.bookmaker_odds || odds,
        
        // Analysis metrics
        estimated_prob: pick.estimated_prob,
        edge_percent: Math.round(pick.expected_value * 100),
        confidence: Math.round(pick.confidence * 10),
        quality_tier: qualityTier,
        
        // Analysis
        analysis: result.analysis,
        supporting_factors: result.supporting_factors || [],
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
        league: pick.league,
        home_team: pick.home_team,
        away_team: pick.away_team,
        kickoff: pick.tipoff,
        
        // New fields
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
    const season = getNBASeasonYear(targetDate); // Use correct NBA season year
    
    console.log(`\n🏀 Starting NBA Picks Generation for ${targetDate}`);
    console.log(`   Season: ${season}-${season + 1} NBA Season`);
    
    checkAndResetCounter();
    
    // Get games
    console.log("\n📅 Fetching NBA games...");
    const games = await getNBAGames(targetDate);
    console.log(`   Found ${games.length} NBA games`);
    
    if (games.length === 0) {
      // Check if API key might not have basketball access
      const apiMessage = requestCountToday === 0 
        ? "No se pudo conectar con la API de Basketball. Tu suscripción de API-Sports puede no incluir Basketball (solo Football). Verifica tu plan en api-sports.io"
        : "No hay partidos de NBA programados para hoy";
      
      return res.status(200).json({
        date: targetDate,
        picks_generated: 0,
        picks: [],
        discarded_count: 0,
        api_requests_used: requestCountToday,
        execution_time_ms: Date.now() - startTime,
        message: apiMessage
      });
    }
    
    // Limit candidates based on budget
    const remainingRequests = CONFIG.MAX_API_REQUESTS - requestCountToday;
    const maxCandidates = Math.min(CONFIG.CANDIDATE_LIMIT, Math.floor(remainingRequests / 8));
    const candidates = games.slice(0, maxCandidates);
    
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
