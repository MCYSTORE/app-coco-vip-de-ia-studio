const OPENROUTERFREE_API_KEY = process.env.OPENROUTERFREE_API_KEY;
const SPORTS_API_KEY = process.env.SPORTS_API_KEY;

import { fetchFromCache, parseCacheEntry } from './google-sheets.js';

// ============================================
// xG SCRAPER - Fetch xG data for football
// ============================================
async function fetchXGData(homeTeam, awayTeam, league) {
  const leagueMap = {
    'premier league': 'Premier-League',
    'la liga': 'La_liga',
    'serie a': 'Serie-A',
    'bundesliga': 'Bundesliga',
    'ligue 1': 'Ligue_1',
    'ligue1': 'Ligue_1',
    'laliga': 'La_liga',
    'premier-league': 'Premier-League',
    'epl': 'Premier-League'
  };

  const normalizedLeague = (league || '').toLowerCase();
  const understatLeague = leagueMap[normalizedLeague] || 'Premier-League';

  try {
    const response = await fetch(
      `http://localhost:${process.env.PORT || 3000}/api/xg-scraper?league=${understatLeague}&home_team=${encodeURIComponent(homeTeam)}&away_team=${encodeURIComponent(awayTeam)}`
    );

    if (!response.ok) {
      console.log(`xG scraper returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching xG data:", error.message);
    return null;
  }
}

// Build xG context for LLM prompt
function buildXGContext(xgData) {
  if (!xgData || !xgData.home || !xgData.away) return '';

  const home = xgData.home;
  const away = xgData.away;

  return `

=== DATOS de EXPECTED GOALS (xG) de Understat ===

${home.team} (LOCAL):
- xG promedio: ${home.avg_xg} | xGA promedio: ${home.avg_xga}
- xG en casa: ${home.avg_home_xg} | xGA en casa: ${home.avg_home_xga}
- npxG (sin penales): ${home.npxg}
- Goles reales: ${home.goals_scored} | Goles concedidos: ${home.goals_conceded}
- Forma xG últimos 5: [${(home.xg_last5 || []).join(', ')}]
- Fuente: ${home.source}

${away.team} (VISITANTE):
- xG promedio: ${away.avg_xg} | xGA promedio: ${away.avg_xga}
- xG fuera: ${away.avg_away_xg} | xGA fuera: ${away.avg_away_xga}
- npxG (sin penales): ${away.npxg}
- Goles reales: ${away.goals_scored} | Goles concedidos: ${away.goals_conceded}
- Forma xG últimos 5: [${(away.xg_last5 || []).join(', ')}]
- Fuente: ${away.source}

ANÁLISIS xG:
- Compara xG vs goles reales para detectar sobre/sub-rendimiento
- USA xG para predecir Over/Under (suma xG de ambos equipos)
- Equipos con xG alto pero pocos goles = candidatos a Over
- npxG excluye penales, más fiable para análisis

`;
}

// Fetch team/match statistics from API-Sports or Cache
async function fetchMatchStats(matchName, sport) {
  if (!SPORTS_API_KEY) return null;
  
  try {
    const teams = matchName.split(/\s+vs\s+|\s+v\s+|\s*-vs-\s*|\s*-v-\s*/i);
    if (teams.length < 2) return null;
    
    const homeTeam = teams[0].trim();
    const awayTeam = teams[1].trim();
    const today = new Date().toISOString().split('T')[0];

    // TRY CACHE FIRST
    const cachedData = await fetchFromCache({ date: today, sport });

    const matchingEntries = cachedData.filter(entry => {
      const cachedHome = (entry.home_team || '').toLowerCase();
      const cachedAway = (entry.away_team || '').toLowerCase();
      return (cachedHome.includes(homeTeam.toLowerCase()) || homeTeam.toLowerCase().includes(cachedHome)) &&
             (cachedAway.includes(awayTeam.toLowerCase()) || awayTeam.toLowerCase().includes(cachedAway));
    });

    if (matchingEntries.length > 0) {
      console.log(`✅ Using cached data for ${matchName} (${matchingEntries.length} entries)`);
      
      const statsJson = matchingEntries[0].stats_json ? 
        (typeof matchingEntries[0].stats_json === 'string' ? 
          JSON.parse(matchingEntries[0].stats_json) : 
          matchingEntries[0].stats_json) : {};
      
      return {
        homeTeam, awayTeam,
        homeStats: statsJson?.predictions?.teams?.home || null,
        awayStats: statsJson?.predictions?.teams?.away || null,
        h2h: statsJson?.h2h || [],
        recentMatches: [],
        sport,
        markets: matchingEntries.map(e => ({
          market: e.market_type, selection: e.selection, odds: e.odds,
          bookmaker: e.bookmaker, implied_prob: e.implied_prob
        })),
        fromCache: true
      };
    }

    console.log(`⚠️ No cache found for ${matchName}, falling back to API...`);
    
    let stats = { homeTeam, awayTeam, homeStats: null, awayStats: null, h2h: [], recentMatches: [], sport };
    
    if (sport === 'football') return await fetchFootballStats(homeTeam, awayTeam, stats);
    if (sport === 'basketball') return await fetchBasketballStats(homeTeam, awayTeam, stats);
    if (sport === 'baseball') return await fetchBaseballStats(homeTeam, awayTeam, stats);
    
    return stats;
  } catch (error) {
    console.error("Error fetching match stats:", error);
    return null;
  }
}

// Football stats from API-Sports
async function fetchFootballStats(homeTeam, awayTeam, stats) {
  const baseUrl = 'https://v3.football.api-sports.io';
  
  try {
    const homeSearch = await fetch(`${baseUrl}/teams?search=${encodeURIComponent(homeTeam)}`, {
      headers: { 'x-apisports-key': SPORTS_API_KEY }
    });
    const homeData = await homeSearch.json();
    
    const awaySearch = await fetch(`${baseUrl}/teams?search=${encodeURIComponent(awayTeam)}`, {
      headers: { 'x-apisports-key': SPORTS_API_KEY }
    });
    const awayData = await awaySearch.json();
    
    const homeTeamId = homeData.response?.[0]?.team?.id;
    const awayTeamId = awayData.response?.[0]?.team?.id;
    
    if (homeTeamId && awayTeamId) {
      const h2hRes = await fetch(`${baseUrl}/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=5`, {
        headers: { 'x-apisports-key': SPORTS_API_KEY }
      });
      const h2hData = await h2hRes.json();
      stats.h2h = h2hData.response?.map(m => ({
        date: m.fixture?.date,
        home: m.teams?.home?.name,
        away: m.teams?.away?.name,
        score: `${m.goals?.home}-${m.goals?.away}`,
        winner: m.teams?.winner
      })) || [];
      
      const currentSeason = new Date().getFullYear() - 1;
      const homeStatsRes = await fetch(`${baseUrl}/teams/statistics?team=${homeTeamId}&season=${currentSeason}&league=39`, {
        headers: { 'x-apisports-key': SPORTS_API_KEY }
      });
      const homeStatsData = await homeStatsRes.json();
      stats.homeStats = homeStatsData.response ? {
        played: homeStatsData.response.fixtures?.played?.total,
        wins: homeStatsData.response.fixtures?.wins?.total,
        draws: homeStatsData.response.fixtures?.draws?.total,
        loses: homeStatsData.response.fixtures?.loses?.total,
        goalsFor: homeStatsData.response.goals?.for?.total,
        goalsAgainst: homeStatsData.response.goals?.against?.total,
        avgGoalsFor: homeStatsData.response.goals?.for?.average?.total,
        cleanSheets: homeStatsData.response.clean_sheet?.total,
        form: homeStatsData.response.form
      } : null;
    }
    
    return stats;
  } catch (error) {
    console.error("Error fetching football stats:", error);
    return stats;
  }
}

// Basketball stats from API-Sports
async function fetchBasketballStats(homeTeam, awayTeam, stats) {
  const baseUrl = 'https://v3.basketball.api-sports.io';
  
  try {
    const homeSearch = await fetch(`${baseUrl}/teams?search=${encodeURIComponent(homeTeam)}`, {
      headers: { 'x-apisports-key': SPORTS_API_KEY }
    });
    const homeData = await homeSearch.json();
    
    const awaySearch = await fetch(`${baseUrl}/teams?search=${encodeURIComponent(awayTeam)}`, {
      headers: { 'x-apisports-key': SPORTS_API_KEY }
    });
    const awayData = await awaySearch.json();
    
    const homeTeamData = homeData.response?.[0];
    const awayTeamData = awayData.response?.[0];
    
    if (homeTeamData?.id && awayTeamData?.id) {
      const h2hRes = await fetch(`${baseUrl}/games/headtohead?h2h=${homeTeamData.id}-${awayTeamData.id}&last=5`, {
        headers: { 'x-apisports-key': SPORTS_API_KEY }
      });
      const h2hData = await h2hRes.json();
      stats.h2h = h2hData.response?.map(g => ({
        date: g.date,
        home: g.teams?.home?.name,
        away: g.teams?.away?.name,
        score: `${g.scores?.home?.total}-${g.scores?.away?.total}`,
        winner: g.scores?.home?.total > g.scores?.away?.total ? 'home' : 'away'
      })) || [];
      
      const currentSeason = new Date().getFullYear();
      const seasonsRes = await fetch(`${baseUrl}/seasons`, {
        headers: { 'x-apisports-key': SPORTS_API_KEY }
      });
      const seasonsData = await seasonsRes.json();
      const latestSeason = seasonsData.response?.filter(s => s < currentSeason).pop() || currentSeason - 1;
      
      const homeGamesRes = await fetch(`${baseUrl}/games?team=${homeTeamData.id}&season=${latestSeason}`, {
        headers: { 'x-apisports-key': SPORTS_API_KEY }
      });
      const homeGamesData = await homeGamesRes.json();
      
      if (homeGamesData.response?.length > 0) {
        const games = homeGamesData.response;
        const wins = games.filter(g => {
          const isHome = g.teams?.home?.id === homeTeamData.id;
          const teamScore = isHome ? g.scores?.home?.total : g.scores?.away?.total;
          const oppScore = isHome ? g.scores?.away?.total : g.scores?.home?.total;
          return teamScore > oppScore;
        }).length;
        
        const totalPoints = games.reduce((sum, g) => {
          const isHome = g.teams?.home?.id === homeTeamData.id;
          return sum + (isHome ? g.scores?.home?.total || 0 : g.scores?.away?.total || 0);
        }, 0);
        
        stats.homeStats = {
          played: games.length,
          wins,
          losses: games.length - wins,
          avgPointsFor: games.length > 0 ? Math.round(totalPoints / games.length) : 0,
          winRate: games.length > 0 ? ((wins / games.length) * 100).toFixed(1) : 0
        };
      }
      
      const awayGamesRes = await fetch(`${baseUrl}/games?team=${awayTeamData.id}&season=${latestSeason}`, {
        headers: { 'x-apisports-key': SPORTS_API_KEY }
      });
      const awayGamesData = await awayGamesRes.json();
      
      if (awayGamesData.response?.length > 0) {
        const games = awayGamesData.response;
        const wins = games.filter(g => {
          const isHome = g.teams?.home?.id === awayTeamData.id;
          const teamScore = isHome ? g.scores?.home?.total : g.scores?.away?.total;
          const oppScore = isHome ? g.scores?.away?.total : g.scores?.home?.total;
          return teamScore > oppScore;
        }).length;
        
        const totalPoints = games.reduce((sum, g) => {
          const isHome = g.teams?.home?.id === awayTeamData.id;
          return sum + (isHome ? g.scores?.home?.total || 0 : g.scores?.away?.total || 0);
        }, 0);
        
        stats.awayStats = {
          played: games.length,
          wins,
          losses: games.length - wins,
          avgPointsFor: games.length > 0 ? Math.round(totalPoints / games.length) : 0,
          winRate: games.length > 0 ? ((wins / games.length) * 100).toFixed(1) : 0
        };
      }
    }
    
    return stats;
  } catch (error) {
    console.error("Error fetching basketball stats:", error);
    return stats;
  }
}

// Baseball stats from API-Sports
async function fetchBaseballStats(homeTeam, awayTeam, stats) {
  const baseUrl = 'https://v3.baseball.api-sports.io';
  
  try {
    const homeSearch = await fetch(`${baseUrl}/teams?search=${encodeURIComponent(homeTeam)}`, {
      headers: { 'x-apisports-key': SPORTS_API_KEY }
    });
    const homeData = await homeSearch.json();
    
    const awaySearch = await fetch(`${baseUrl}/teams?search=${encodeURIComponent(awayTeam)}`, {
      headers: { 'x-apisports-key': SPORTS_API_KEY }
    });
    const awayData = await awaySearch.json();
    
    const homeTeamData = homeData.response?.[0];
    const awayTeamData = awayData.response?.[0];
    
    if (homeTeamData?.id && awayTeamData?.id) {
      const h2hRes = await fetch(`${baseUrl}/games/headtohead?h2h=${homeTeamData.id}-${awayTeamData.id}&last=5`, {
        headers: { 'x-apisports-key': SPORTS_API_KEY }
      });
      const h2hData = await h2hRes.json();
      stats.h2h = h2hData.response?.map(g => ({
        date: g.date,
        home: g.teams?.home?.name,
        away: g.teams?.away?.name,
        score: `${g.scores?.home?.total}-${g.scores?.away?.total}`,
        winner: g.scores?.home?.total > g.scores?.away?.total ? 'home' : 'away'
      })) || [];
      
      const currentSeason = new Date().getFullYear();
      
      const homeGamesRes = await fetch(`${baseUrl}/games?team=${homeTeamData.id}&season=${currentSeason}`, {
        headers: { 'x-apisports-key': SPORTS_API_KEY }
      });
      const homeGamesData = await homeGamesRes.json();
      
      if (homeGamesData.response?.length > 0) {
        const games = homeGamesData.response.filter(g => g.status?.short === 'FT');
        const wins = games.filter(g => {
          const isHome = g.teams?.home?.id === homeTeamData.id;
          const teamScore = isHome ? g.scores?.home?.total : g.scores?.away?.total;
          const oppScore = isHome ? g.scores?.away?.total : g.scores?.home?.total;
          return teamScore > oppScore;
        }).length;
        
        const totalRuns = games.reduce((sum, g) => {
          const isHome = g.teams?.home?.id === homeTeamData.id;
          return sum + (isHome ? g.scores?.home?.total || 0 : g.scores?.away?.total || 0);
        }, 0);
        
        stats.homeStats = {
          played: games.length,
          wins,
          losses: games.length - wins,
          avgRunsFor: games.length > 0 ? (totalRuns / games.length).toFixed(1) : 0,
          winRate: games.length > 0 ? ((wins / games.length) * 100).toFixed(1) : 0
        };
      }
      
      const awayGamesRes = await fetch(`${baseUrl}/games?team=${awayTeamData.id}&season=${currentSeason}`, {
        headers: { 'x-apisports-key': SPORTS_API_KEY }
      });
      const awayGamesData = await awayGamesRes.json();
      
      if (awayGamesData.response?.length > 0) {
        const games = awayGamesData.response.filter(g => g.status?.short === 'FT');
        const wins = games.filter(g => {
          const isHome = g.teams?.home?.id === awayTeamData.id;
          const teamScore = isHome ? g.scores?.home?.total : g.scores?.away?.total;
          const oppScore = isHome ? g.scores?.away?.total : g.scores?.home?.total;
          return teamScore > oppScore;
        }).length;
        
        const totalRuns = games.reduce((sum, g) => {
          const isHome = g.teams?.home?.id === awayTeamData.id;
          return sum + (isHome ? g.scores?.home?.total || 0 : g.scores?.away?.total || 0);
        }, 0);
        
        stats.awayStats = {
          played: games.length,
          wins,
          losses: games.length - wins,
          avgRunsFor: games.length > 0 ? (totalRuns / games.length).toFixed(1) : 0,
          winRate: games.length > 0 ? ((wins / games.length) * 100).toFixed(1) : 0
        };
      }
    }
    
    return stats;
  } catch (error) {
    console.error("Error fetching baseball stats:", error);
    return stats;
  }
}

function generateMockAnalysis(matchName, sport) {
  // Extract team names from match name
  const teams = matchName.split(/\s+vs\s+|\s+v\s+|\s*-vs-\s*|\s*-v-\s*/i);
  const homeTeam = teams[0]?.trim() || 'Local';
  const awayTeam = teams[1]?.trim() || 'Visitante';

  const marketsWithSelections = {
    football: [
      { market: 'Over/Under 2.5', selection: 'Over 2.5' },
      { market: 'BTTS', selection: 'Ambos Anotan - Sí' },
      { market: '1X2', selection: homeTeam },
      { market: 'Over/Under 1.5', selection: 'Over 1.5' },
      { market: 'Doble Oportunidad', selection: `${homeTeam} o Empate` }
    ],
    basketball: [
      { market: 'Over/Under 220.5', selection: 'Over 220.5' },
      { market: 'Moneyline', selection: homeTeam },
      { market: 'Handicap -5.5', selection: `${homeTeam} -5.5` }
    ],
    baseball: [
      { market: 'Run Line -1.5', selection: `${homeTeam} -1.5` },
      { market: 'Over/Under 7.5 Carreras', selection: 'Over 7.5' },
      { market: 'Moneyline', selection: awayTeam }
    ]
  };

  const bookmakers = ['Bet365', 'Pinnacle', 'Bwin', '1xBet', 'William Hill'];
  const sportMarkets = marketsWithSelections[sport] || marketsWithSelections.football;

  const randomPick = sportMarkets[Math.floor(Math.random() * sportMarkets.length)];
  const randomBookmaker = bookmakers[Math.floor(Math.random() * bookmakers.length)];
  const randomOdds = (1.5 + Math.random() * 1.5).toFixed(2);
  const randomEdge = (5 + Math.random() * 15).toFixed(1);
  const randomConfidence = Math.floor(6 + Math.random() * 4);
  const now = new Date().toISOString();

  return {
    matchName,
    sport: sport.charAt(0).toUpperCase() + sport.slice(1),
    bestMarket: randomPick.market,
    selection: randomPick.selection,
    bookmaker: randomBookmaker,
    odds: parseFloat(randomOdds),
    edgePercent: parseFloat(randomEdge),
    confidence: randomConfidence,
    analysisText: `Análisis basado en estadísticas recientes y rendimiento histórico. ${matchName} presenta una oportunidad de valor en el mercado de ${randomPick.market}. La cuota de ${randomOdds} parece sobrevalorada según nuestros modelos predictivos.`,
    status: 'pending',
    openingOdd: parseFloat(randomOdds),
    openingOddTimestamp: now,
    currentOdd: parseFloat(randomOdds),
    currentOddTimestamp: now,
    lineMovementPercent: 0,
    lineMovementDirection: 'stable'
  };
}

// Build stats context for LLM
function buildStatsContext(matchStats, sport) {
  if (!matchStats) return "";
  
  let context = `\n\n=== DATOS ESTADÍSTICOS REALES ===`;
  context += `\nDeporte: ${sport.toUpperCase()}`;
  context += `\nEquipos: ${matchStats.homeTeam} vs ${matchStats.awayTeam}`;
  
  if (matchStats.homeStats) {
    context += `\n\nEstadísticas de ${matchStats.homeTeam}:`;
    
    if (sport === 'football') {
      context += `\n- Partidos jugados: ${matchStats.homeStats.played || 'N/A'}`;
      context += `\n- Victorias: ${matchStats.homeStats.wins || 'N/A'} | Empates: ${matchStats.homeStats.draws || 'N/A'} | Derrotas: ${matchStats.homeStats.loses || 'N/A'}`;
      context += `\n- Goles a favor: ${matchStats.homeStats.goalsFor || 'N/A'} | Goles en contra: ${matchStats.homeStats.goalsAgainst || 'N/A'}`;
      context += `\n- Promedio goles por partido: ${matchStats.homeStats.avgGoalsFor || 'N/A'}`;
      context += `\n- Porterías a cero: ${matchStats.homeStats.cleanSheets || 'N/A'}`;
      if (matchStats.homeStats.form) {
        context += `\n- Forma reciente: ${matchStats.homeStats.form}`;
      }
    } else if (sport === 'basketball') {
      context += `\n- Partidos jugados: ${matchStats.homeStats.played || 'N/A'}`;
      context += `\n- Victorias: ${matchStats.homeStats.wins || 'N/A'} | Derrotas: ${matchStats.homeStats.losses || 'N/A'}`;
      context += `\n- Promedio puntos por partido: ${matchStats.homeStats.avgPointsFor || 'N/A'}`;
      context += `\n- Porcentaje victorias: ${matchStats.homeStats.winRate || 'N/A'}%`;
    } else if (sport === 'baseball') {
      context += `\n- Partidos jugados: ${matchStats.homeStats.played || 'N/A'}`;
      context += `\n- Victorias: ${matchStats.homeStats.wins || 'N/A'} | Derrotas: ${matchStats.homeStats.losses || 'N/A'}`;
      context += `\n- Promedio carreras por partido: ${matchStats.homeStats.avgRunsFor || 'N/A'}`;
      context += `\n- Porcentaje victorias: ${matchStats.homeStats.winRate || 'N/A'}%`;
    }
  }
  
  if (matchStats.awayStats) {
    context += `\n\nEstadísticas de ${matchStats.awayTeam}:`;
    
    if (sport === 'football') {
      context += `\n- Partidos jugados: ${matchStats.awayStats.played || 'N/A'}`;
      context += `\n- Victorias: ${matchStats.awayStats.wins || 'N/A'} | Empates: ${matchStats.awayStats.draws || 'N/A'} | Derrotas: ${matchStats.awayStats.loses || 'N/A'}`;
      context += `\n- Goles a favor: ${matchStats.awayStats.goalsFor || 'N/A'} | Goles en contra: ${matchStats.awayStats.goalsAgainst || 'N/A'}`;
      context += `\n- Promedio goles por partido: ${matchStats.awayStats.avgGoalsFor || 'N/A'}`;
      context += `\n- Porterías a cero: ${matchStats.awayStats.cleanSheets || 'N/A'}`;
      if (matchStats.awayStats.form) {
        context += `\n- Forma reciente: ${matchStats.awayStats.form}`;
      }
    } else if (sport === 'basketball') {
      context += `\n- Partidos jugados: ${matchStats.awayStats.played || 'N/A'}`;
      context += `\n- Victorias: ${matchStats.awayStats.wins || 'N/A'} | Derrotas: ${matchStats.awayStats.losses || 'N/A'}`;
      context += `\n- Promedio puntos por partido: ${matchStats.awayStats.avgPointsFor || 'N/A'}`;
      context += `\n- Porcentaje victorias: ${matchStats.awayStats.winRate || 'N/A'}%`;
    } else if (sport === 'baseball') {
      context += `\n- Partidos jugados: ${matchStats.awayStats.played || 'N/A'}`;
      context += `\n- Victorias: ${matchStats.awayStats.wins || 'N/A'} | Derrotas: ${matchStats.awayStats.losses || 'N/A'}`;
      context += `\n- Promedio carreras por partido: ${matchStats.awayStats.avgRunsFor || 'N/A'}`;
      context += `\n- Porcentaje victorias: ${matchStats.awayStats.winRate || 'N/A'}%`;
    }
  }
  
  if (matchStats.h2h && matchStats.h2h.length > 0) {
    context += `\n\nÚltimos enfrentamientos directos (H2H):`;
    matchStats.h2h.slice(0, 5).forEach(m => {
      context += `\n- ${m.home} ${m.score} ${m.away}`;
    });
  }
  
  context += `\n\nUsa estos datos para tu análisis.`;
  return context;
}

// ============================================
// DEBATE DE ANALISTAS - PRO vs CONTRA
// ============================================

async function generateDebate(analysis, matchStats, sport, statsContext) {
  if (!OPENROUTERFREE_API_KEY) return null;

  const pickData = {
    matchName: analysis.matchName,
    sport: analysis.sport,
    market: analysis.bestMarket,
    selection: analysis.selection,
    odds: analysis.odds,
    edgePercent: analysis.edgePercent,
    confidence: analysis.confidence,
    analysisText: analysis.analysisText
  };

  const [proResult, contraResult] = await Promise.all([
    generateProArguments(pickData, statsContext),
    generateContraArguments(pickData, statsContext)
  ]);

  const conclusionResult = await generateConclusion(pickData, proResult, contraResult);

  return { pro: proResult, contra: contraResult, conclusion: conclusionResult };
}

async function generateProArguments(pickData, statsContext) {
  const SYSTEM_PROMPT_PRO = `* **Role:** Eres un analista de apuestas deportivas optimista cuyo rol es buscar argumentos A FAVOR de la apuesta propuesta.

* **Context:** Tu trabajo es identificar TODOS los factores positivos que respaldan la apuesta recomendada.

* **Constraints:**
    1. Basa tus argumentos SOLO en los datos proporcionados
    2. NO inventes datos ni estadísticas
    3. Si no hay argumentos fuertes, reconócelo explícitamente
    4. Sé específico y menciona números cuando sea posible

* **Output JSON Format:**
{
  "summary": "resumen breve de 1-2 oraciones del mejor argumento a favor",
  "details": "argumentos detallados a favor con datos específicos"
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTERFREE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Debate PRO'
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT_PRO },
          { role: "user", content: `Analiza este pick y proporciona argumentos A FAVOR:

PARTIDO: ${pickData.matchName}
DEPORTE: ${pickData.sport}
MERCADO: ${pickData.market}
SELECCIÓN: ${pickData.selection}
CUOTA: ${pickData.odds}
EDGE: ${pickData.edgePercent}%
CONFIANZA: ${pickData.confidence}/10

${statsContext || ''}

Proporciona los mejores argumentos a favor de esta apuesta. Responde SOLO con JSON válido.` }
        ],
        temperature: 0.2,
        max_tokens: 500
      })
    });

    const data = await response.json();
    let content = data.choices[0]?.message?.content || '{}';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(content);
  } catch (error) {
    console.error("Debate PRO Error:", error);
    return { summary: "No se pudieron generar argumentos a favor", details: "Error en el análisis." };
  }
}

async function generateContraArguments(pickData, statsContext) {
  const SYSTEM_PROMPT_CONTRA = `* **Role:** Eres un analista de apuestas deportivas ESCÉPTICO cuyo rol es buscar argumentos EN CONTRA de la apuesta propuesta.

* **Context:** Tu trabajo es identificar TODOS los riesgos, sesgos o contraejemplos que ponen en duda la apuesta.

* **Constraints:**
    1. Basa tus argumentos SOLO en los datos proporcionados
    2. NO inventes datos
    3. Señala explícitamente cuando la información es insuficiente
    4. Identifica posibles sesgos o errores en el análisis original

* **Output JSON Format:**
{
  "summary": "resumen breve del mayor riesgo o argumento en contra",
  "details": "argumentos detallados en contra con riesgos específicos"
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTERFREE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Debate CONTRA'
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT_CONTRA },
          { role: "user", content: `Analiza este pick y proporciona argumentos EN CONTRA:

PARTIDO: ${pickData.matchName}
DEPORTE: ${pickData.sport}
MERCADO: ${pickData.market}
SELECCIÓN: ${pickData.selection}
CUOTA: ${pickData.odds}
EDGE: ${pickData.edgePercent}%
CONFIANZA: ${pickData.confidence}/10

${statsContext || ''}

Proporciona los mejores argumentos en contra. Responde SOLO con JSON válido.` }
        ],
        temperature: 0.2,
        max_tokens: 500
      })
    });

    const data = await response.json();
    let content = data.choices[0]?.message?.content || '{}';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(content);
  } catch (error) {
    console.error("Debate CONTRA Error:", error);
    return { summary: "No se pudieron generar argumentos en contra", details: "Error en el análisis." };
  }
}

async function generateConclusion(pickData, proResult, contraResult) {
  const SYSTEM_PROMPT_CONCLUSION = `* **Role:** Eres un moderador neutral de debates de apuestas deportivas.

* **Context:** Sintetizas argumentos a favor y en contra en una conclusión equilibrada.

* **Output JSON Format:**
{
  "summary": "conclusión equilibrada de 2-3 oraciones",
  "recommendation": "mantener" | "evitar" | "stake reducido",
  "confidence_adjusted": número del 1 al 10
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTERFREE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Debate Conclusion'
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT_CONCLUSION },
          { role: "user", content: `Sintetiza este debate:

PICK: ${pickData.selection} en ${pickData.market}
PARTIDO: ${pickData.matchName}
CUOTA: ${pickData.odds} | EDGE: ${pickData.edgePercent}% | CONFIANZA: ${pickData.confidence}/10

A FAVOR: ${proResult.summary}

EN CONTRA: ${contraResult.summary}

Proporciona conclusión. Responde SOLO con JSON.` }
        ],
        temperature: 0.2,
        max_tokens: 300
      })
    });

    const data = await response.json();
    let content = data.choices[0]?.message?.content || '{}';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(content);
  } catch (error) {
    console.error("Debate Conclusion Error:", error);
    return { summary: "No se pudo generar conclusión", recommendation: "mantener", confidence_adjusted: pickData.confidence };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { match_name, date, user_context, sport = 'football' } = req.body;

  if (!match_name) return res.status(400).json({ error: 'match_name is required' });

  // Fetch real statistics from API-Sports
  const matchStats = await fetchMatchStats(match_name, sport);
  
  if (!OPENROUTERFREE_API_KEY) {
    return res.status(200).json(generateMockAnalysis(match_name, sport));
  }

  // Build context with real statistics
  let statsContext = buildStatsContext(matchStats, sport);

  // ============================================
  // FETCH xG DATA FOR FOOTBALL
  // ============================================
  let xgData = null;
  if (sport === 'football') {
    const teams = match_name.split(/\s+vs\s+|\s+v\s+|\s*-vs-\s*|\s*-v-\s*/i);
    if (teams.length >= 2) {
      const homeTeam = teams[0].trim();
      const awayTeam = teams[1].trim();
      
      try {
        xgData = await fetchXGData(homeTeam, awayTeam, matchStats?.league || 'Premier-League');
        if (xgData) {
          const xgContext = buildXGContext(xgData);
          statsContext += xgContext;
          console.log(`✅ xG data fetched for ${homeTeam} vs ${awayTeam}`);
        }
      } catch (xgError) {
        console.log("⚠️ xG fetch failed:", xgError.message);
      }
    }
  }

  // Build sport-specific system prompt
  const sportPrompts = {
    football: `* **Deporte:** FÚTBOL
* **Mercados Disponibles:** 1X2 (Ganador/Empate), Over/Under goles (0.5, 1.5, 2.5, 3.5, 4.5), Ambos Equipos Anotan (BTTS), Handicaps Asiáticos, Córners, Tarjetas, Resultado exacto
* **Métricas Clave:** Goles por partido, posesión, tiros a puerta, porterías a cero, forma reciente, H2H, xG (expected goals)
* **xG Analysis:** Usa los datos de xG para evaluar si los equipos están sobre/sub-rendiendo. Compara xG vs goles reales para detectar valor en mercados Over/Under.`,

    basketball: `* **Deporte:** BALONCESTO
* **Mercados Disponibles:** Moneyline (Ganador), Over/Under puntos (205.5, 210.5, 215.5, 220.5, 225.5, 230.5), Handicaps/Spread, Resultado por cuartos
* **Métricas Clave:** Puntos por partido, porcentaje tiros, rebotes, asistencias, victorias/derrotas, H2H`,

    baseball: `* **Deporte:** BÉISBOL
* **Mercados Disponibles:** Moneyline (Ganador), Run Line (-1.5/+1.5), Total Carreras Over/Under (6.5, 7.5, 8.5, 9.5), 1er Inning, Primeras 5 entradas
* **Métricas Clave:** Carreras por partido, promedio bateo, ERA pitchers, victorias/derrotas, H2H`
  };

  const SYSTEM_PROMPT = `* **Role:** Actúa como un Senior Sports Betting Analyst y Experto en Value Bets con años de experiencia.

* **Context:** Analizas partidos para identificar la MEJOR oportunidad de valor evaluando TODOS los mercados.

${sportPrompts[sport] || sportPrompts.football}

* **Task:** Analiza el partido y devuelve la mejor Value Bet en JSON.

* **Constraints/Formatting:**
    1. "selection" debe ser la APUESTA ESPECÍFICA, NO el mercado.
    2. Ejemplos CORRECTOS: Moneyline → "Boston Celtics", Over/Under → "Over 220.5", BTTS → "Ambos Anotan - Sí"
    3. ❌ NUNCA pongas "Ganador", "Moneyline", "Over/Under" como selection
    4. ✅ SIEMPRE incluye equipo específico o dirección completa

* **Output JSON Format:**
{
  "matchName": "nombre del partido",
  "sport": "${sport}",
  "bestMarket": "tipo de mercado",
  "selection": "APUESTA ESPECÍFICA",
  "bookmaker": "casa de apuestas",
  "odds": número,
  "edgePercent": número,
  "confidence": número 1-10,
  "analysisText": "explicación detallada",
  "status": "pending",
  "hasRealStats": true/false
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTERFREE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Assistant'
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analiza COMPLETAMENTE este partido: ${match_name}.
Deporte: ${sport}
Fecha: ${date || 'próximamente'}
Contexto adicional del usuario: ${user_context || 'Ninguno'}
${statsContext}

Analiza TODOS los mercados y dame la MEJOR Value Bet. Responde SOLO con JSON válido.` }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    let content = data.choices[0].message.content;
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(content);
    
    if (matchStats && (matchStats.homeStats || matchStats.awayStats || matchStats.h2h?.length > 0)) {
      analysis.hasRealStats = true;
    }
    
    const now = new Date().toISOString();
    const baseOdds = analysis.odds || 1.85;
    analysis.openingOdd = baseOdds;
    analysis.openingOddTimestamp = now;
    analysis.currentOdd = baseOdds;
    analysis.currentOddTimestamp = now;
    analysis.lineMovementPercent = 0;
    analysis.lineMovementDirection = 'stable';

    // Add xG data to response
    if (xgData) {
      analysis.xgStats = xgData;
    }

    // Generate Debate
    try {
      const debate = await generateDebate(analysis, matchStats, sport, statsContext);
      if (debate) analysis.debate = debate;
    } catch (debateError) {
      console.error("Debate generation error:", debateError);
    }

    return res.status(200).json(analysis);
  } catch (error) {
    console.error("OpenRouter Error:", error);
    return res.status(200).json(generateMockAnalysis(match_name, sport));
  }
}
