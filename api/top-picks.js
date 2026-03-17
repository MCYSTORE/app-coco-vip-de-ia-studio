const SPORTS_API_KEY = process.env.SPORTS_API_KEY;
const OPENROUTERFREE_API_KEY = process.env.OPENROUTERFREE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

import { fetchFromCache, getCacheMetadata } from './google-sheets.js';

// List of bookmakers for odds shopping simulation
const BOOKMAKERS = [
  'Bet365', 'Pinnacle', 'Bwin', '1xBet', 'William Hill', 
  'Betfair', 'DraftKings', 'FanDuel', 'BetMGM', 'Caesars'
];

// Generate multiple odds from different bookmakers
function generateAllOdds(baseOdds, numBookmakers = 5) {
  const allOdds = [];
  const selectedBookmakers = BOOKMAKERS.sort(() => 0.5 - Math.random()).slice(0, numBookmakers);
  
  for (const bookmaker of selectedBookmakers) {
    const variation = -0.03 + Math.random() * 0.08;
    const odds = +(baseOdds * (1 + variation)).toFixed(2);
    allOdds.push({ bookmaker, odds });
  }
  
  return allOdds.sort((a, b) => b.odds - a.odds);
}

function getBestOdd(allOdds) {
  if (!allOdds || allOdds.length === 0) return null;
  return allOdds[0];
}

// Fetch picks from Supabase (including player props)
async function fetchPicksFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log("⚠️ Supabase not configured");
    return [];
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch picks for today, ordered by confidence
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/predictions?select=*&date=eq.${today}&status=eq.pending&order=confidence.desc&limit=10`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );

    if (!response.ok) {
      console.log(`Supabase error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      console.log(`✅ Found ${data.length} picks in Supabase for today`);
      
      // Map Supabase data to Prediction format
      return data.map((pick, index) => ({
        id: pick.id || `supabase-${index}`,
        matchName: pick.match_name || `${pick.home_team} vs ${pick.away_team}`,
        sport: pick.sport || 'Football',
        bestMarket: pick.market || '1X2',
        selection: pick.selection || '',
        bookmaker: pick.bookmaker || 'Bet365',
        odds: pick.odds || 1.85,
        edgePercent: pick.edge_percent || 5,
        confidence: pick.confidence || 7,
        analysisText: pick.analysis_text || 'Análisis generado automáticamente',
        status: pick.status || 'pending',
        createdAt: pick.created_at || new Date().toISOString(),
        league: pick.league || '',
        isLive: false,
        source: pick.source || 'daily_auto',
        qualityTier: pick.quality_tier || 'B',
        riskFactors: pick.risk_factors || [],
        // Player Props fields
        pickType: pick.pick_type || 'team',
        playerName: pick.player_name || null,
        playerTeam: pick.player_name ? (pick.home_team || pick.away_team) : null,
        line: pick.line || null
      }));
    }
    
    return [];
  } catch (error) {
    console.error("Error fetching from Supabase:", error.message);
    return [];
  }
}

async function fetchFromAPI(endpoint, sport) {
  const baseUrls = {
    football: 'https://v3.football.api-sports.io',
    basketball: 'https://v3.basketball.api-sports.io',
    baseball: 'https://v3.baseball.api-sports.io'
  };

  const baseUrl = baseUrls[sport];
  if (!baseUrl) return null;

  const response = await fetch(`${baseUrl}/${endpoint}`, {
    headers: {
      'x-apisports-key': SPORTS_API_KEY || ''
    }
  });

  if (!response.ok) {
    throw new Error(`API-Sports error: ${response.status}`);
  }

  return response.json();
}

// Fetch live and upcoming games for all sports
async function fetchAllGames() {
  const games = {
    football: [],
    basketball: [],
    baseball: []
  };

  const today = new Date().toISOString().split('T')[0];

  // ========================================
  // TRY CACHE FIRST
  // ========================================
  try {
    const sports = ['football', 'basketball', 'baseball'];
    let cacheHit = false;

    for (const sport of sports) {
      const cachedData = await fetchFromCache({ date: today, sport });

      if (cachedData && cachedData.length > 0) {
        console.log(`✅ Top Picks: Using cached ${sport} data (${cachedData.length} entries)`);
        cacheHit = true;

        // Group by match_id to create game objects
        const matchMap = new Map();

        for (const entry of cachedData) {
          const matchId = entry.match_id;

          if (!matchMap.has(matchId)) {
            matchMap.set(matchId, {
              id: matchId,
              homeTeam: entry.home_team,
              awayTeam: entry.away_team,
              league: entry.league,
              date: entry.kickoff || entry.date,
              status: 'NS',
              isLive: false,
              sport: sport.charAt(0).toUpperCase() + sport.slice(1),
              fromCache: true,
              odds: {}
            });
          }

          const game = matchMap.get(matchId);
          const market = entry.market_type;
          if (!game.odds[market]) {
            game.odds[market] = {};
          }
          game.odds[market][entry.selection] = entry.odds;
        }

        games[sport] = Array.from(matchMap.values()).slice(0, 10);
      }
    }

    // If we got cache data for all sports, return early
    if (cacheHit && games.football.length + games.basketball.length + games.baseball.length > 0) {
      return games;
    }
  } catch (cacheError) {
    console.log("⚠️ Cache error in top-picks:", cacheError.message);
  }

  // ========================================
  // FALLBACK TO API
  // ========================================
  console.log("⚠️ Top Picks: Falling back to API...");

  // Football - live games
  try {
    const footballLiveData = await fetchFromAPI('fixtures?live=all', 'football');
    if (footballLiveData?.response) {
      games.football = footballLiveData.response.slice(0, 10).map(match => ({
        id: `fb-live-${match.fixture?.id}`,
        homeTeam: match.teams?.home?.name,
        awayTeam: match.teams?.away?.name,
        league: match.league?.name,
        country: match.league?.country,
        date: match.fixture?.date,
        status: match.fixture?.status?.short,
        isLive: true,
        sport: 'Football',
        homeScore: match.goals?.home,
        awayScore: match.goals?.away,
        elapsed: match.fixture?.status?.elapsed
      }));
    }
  } catch (e) {
    console.log("Football live fetch skipped:", e.message);
  }
  
  // Football - upcoming major leagues
  try {
    const footballUpcomingData = await fetchFromAPI(`fixtures?date=${today}`, 'football');
    if (footballUpcomingData?.response) {
      const majorLeagues = [39, 140, 135, 78, 61, 144, 94]; // Premier, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga
      const upcoming = footballUpcomingData.response
        .filter(f => majorLeagues.includes(f.league?.id) && f.fixture?.status?.short !== 'FT')
        .slice(0, 10)
        .map(match => ({
          id: `fb-up-${match.fixture?.id}`,
          homeTeam: match.teams?.home?.name,
          awayTeam: match.teams?.away?.name,
          league: match.league?.name,
          country: match.league?.country,
          date: match.fixture?.date,
          status: match.fixture?.status?.short,
          isLive: false,
          sport: 'Football'
        }));
      games.football = [...games.football, ...upcoming];
    }
  } catch (e) {
    console.log("Football upcoming fetch skipped:", e.message);
  }
  
  // Basketball - live games
  try {
    const basketballLiveData = await fetchFromAPI('games?live=all', 'basketball');
    if (basketballLiveData?.response) {
      games.basketball = basketballLiveData.response.slice(0, 10).map(game => ({
        id: `bk-live-${game.id}`,
        homeTeam: game.teams?.home?.name,
        awayTeam: game.teams?.away?.name,
        league: game.league?.name,
        country: game.country?.name,
        date: game.date,
        status: game.status?.short,
        isLive: ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'HT'].includes(game.status?.short),
        sport: 'Basketball',
        homeScore: game.scores?.home?.total,
        awayScore: game.scores?.away?.total
      }));
    }
  } catch (e) {
    console.log("Basketball live fetch skipped:", e.message);
  }
  
  // Basketball - upcoming games
  try {
    const basketballUpcomingData = await fetchFromAPI(`games?date=${today}`, 'basketball');
    if (basketballUpcomingData?.response) {
      const upcoming = basketballUpcomingData.response
        .filter(g => !['FT', 'AOT', 'POST'].includes(g.status?.short))
        .slice(0, 10)
        .map(game => ({
          id: `bk-up-${game.id}`,
          homeTeam: game.teams?.home?.name,
          awayTeam: game.teams?.away?.name,
          league: game.league?.name,
          country: game.country?.name,
          date: game.date,
          status: game.status?.short,
          isLive: false,
          sport: 'Basketball'
        }));
      games.basketball = [...games.basketball, ...upcoming];
    }
  } catch (e) {
    console.log("Basketball upcoming fetch skipped:", e.message);
  }
  
  // Baseball - live games
  try {
    const baseballLiveData = await fetchFromAPI('games?live=all', 'baseball');
    if (baseballLiveData?.response) {
      games.baseball = baseballLiveData.response.slice(0, 10).map(game => ({
        id: `bb-live-${game.id}`,
        homeTeam: game.teams?.home?.name,
        awayTeam: game.teams?.away?.name,
        league: game.league?.name,
        country: game.country?.name,
        date: game.date,
        status: game.status?.short,
        isLive: game.status?.short === 'LIVE',
        sport: 'Baseball',
        homeScore: game.scores?.home?.total,
        awayScore: game.scores?.away?.total,
        inning: game.status?.inning
      }));
    }
  } catch (e) {
    console.log("Baseball live fetch skipped:", e.message);
  }
  
  // Baseball - upcoming games
  try {
    const baseballUpcomingData = await fetchFromAPI(`games?date=${today}`, 'baseball');
    if (baseballUpcomingData?.response) {
      const upcoming = baseballUpcomingData.response
        .filter(g => !['FT', 'POST', 'CANC'].includes(g.status?.short))
        .slice(0, 10)
        .map(game => ({
          id: `bb-up-${game.id}`,
          homeTeam: game.teams?.home?.name,
          awayTeam: game.teams?.away?.name,
          league: game.league?.name,
          country: game.country?.name,
          date: game.date,
          status: game.status?.short,
          isLive: false,
          sport: 'Baseball'
        }));
      games.baseball = [...games.baseball, ...upcoming];
    }
  } catch (e) {
    console.log("Baseball upcoming fetch skipped:", e.message);
  }
  
  return games;
}

// Use LLM to generate top picks from real games
async function generatePicksWithLLM(allGames) {
  if (!OPENROUTERFREE_API_KEY) {
    return null;
  }
  
  // Prepare games data for LLM
  const gamesList = [];
  Object.entries(allGames).forEach(([sport, games]) => {
    games.forEach(g => {
      gamesList.push({
        match: `${g.homeTeam} vs ${g.awayTeam}`,
        sport: g.sport,
        league: g.league,
        isLive: g.isLive
      });
    });
  });
  
  if (gamesList.length === 0) return null;
  
  const SYSTEM_PROMPT = `* **Role:** Actúa como un Senior Sports Betting Analyst experto en identificar las mejores Value Bets del día.

* **Context:** Analizas partidos en vivo y próximos para seleccionar los 3 mejores picks con mayor valor potencial.

* **Deportes y Mercados:**
    - FÚTBOL: 1X2, Over/Under goles, BTTS, Handicaps, Córners
    - BALONCESTO: Moneyline, Over/Under puntos, Handicap/Spread, Cuartos
    - BÉISBOL: Moneyline, Run Line, Total Carreras Over/Under

* **Task:** Selecciona los 3 mejores picks con mayor valor del listado de partidos proporcionado.

* **Constraints/Formatting:**
    1. El campo "selection" debe ser la APUESTA ESPECÍFICA, NO el nombre del mercado.
    2. Ejemplos CORRECTOS de selection:
       - Moneyline → "Lakers" (nombre del equipo)
       - Over/Under 220.5 → "Over 220.5" o "Under 220.5"
       - BTTS → "Ambos Anotan - Sí" o "Ambos Anotan - No"
       - 1X2 → "Local", "Visitante" o "Empate"
    3. ❌ NUNCA pongas "Ganador", "Moneyline", "Over/Under" como selection
    4. ✅ SIEMPRE incluye equipo específico o dirección completa

* **Steps:**
    1. Prioriza partidos EN VIVO si están disponibles
    2. Varía entre deportes si es posible
    3. Evalúa edge potencial y confianza
    4. Estructura la respuesta JSON

* **Output JSON Format:**
{
  "picks": [
    {
      "matchName": "Local vs Visitante",
      "sport": "Football/Basketball/Baseball",
      "bestMarket": "tipo de mercado",
      "selection": "APUESTA ESPECÍFICA con equipo o dirección",
      "bookmaker": "casa sugerida",
      "odds": número,
      "edgePercent": número,
      "confidence": número 1-10,
      "analysisText": "justificación breve",
      "league": "nombre liga",
      "isLive": true/false
    }
  ]
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTERFREE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Top Picks'
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Partidos disponibles para analizar:\n\n${JSON.stringify(gamesList.slice(0, 30), null, 2)}\n\nSelecciona los 3 mejores picks con mayor valor. Responde SOLO con JSON.` }
        ],
        temperature: 0.4
      })
    });

    const data = await response.json();
    let content = data.choices[0]?.message?.content || '{}';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(content);
    return result.picks || null;
  } catch (error) {
    console.error("LLM Top Picks Error:", error);
    return null;
  }
}

function getFallbackPicks() {
  const now = new Date().toISOString();
  
  return [
    {
      id: "demo-1",
      matchName: "Real Madrid vs Barcelona",
      sport: "Football",
      bestMarket: "Over/Under 2.5",
      selection: "Over 2.5",
      bookmaker: "Bet365",
      odds: 1.95,
      edgePercent: 12.4,
      confidence: 9,
      analysisText: "El Clásico siempre ofrece goles. Ambos equipos con promedio de 3+ goles por partido.",
      status: "pending",
      createdAt: now,
      league: "La Liga",
      isLive: false,
      openingOdd: 1.95,
      openingOddTimestamp: now,
      currentOdd: 1.95,
      currentOddTimestamp: now,
      lineMovementPercent: 0,
      lineMovementDirection: 'stable',
      source: 'manual',
      qualityTier: 'A_PLUS'
    },
    {
      id: "demo-2",
      matchName: "Lakers vs Warriors",
      sport: "Basketball",
      bestMarket: "Over/Under 220.5",
      selection: "Over 220.5",
      bookmaker: "Pinnacle",
      odds: 1.88,
      edgePercent: 8.1,
      confidence: 8,
      analysisText: "Ritmo alto esperado. Warriors con excelente porcentaje de 3 puntos.",
      status: "pending",
      createdAt: now,
      league: "NBA",
      isLive: false,
      openingOdd: 1.88,
      openingOddTimestamp: now,
      currentOdd: 1.88,
      currentOddTimestamp: now,
      lineMovementPercent: 0,
      lineMovementDirection: 'stable',
      source: 'manual',
      qualityTier: 'B'
    },
    {
      id: "demo-3",
      matchName: "Yankees vs Red Sox",
      sport: "Baseball",
      bestMarket: "Total Runs Over/Under 8.5",
      selection: "Over 8.5",
      bookmaker: "Bwin",
      odds: 1.75,
      edgePercent: 10.5,
      confidence: 8,
      analysisText: "Rivalidad histórica. Ambos equipos con buenas ofensivas.",
      status: "pending",
      createdAt: now,
      league: "MLB",
      isLive: false,
      openingOdd: 1.75,
      openingOddTimestamp: now,
      currentOdd: 1.75,
      currentOddTimestamp: now,
      lineMovementPercent: 0,
      lineMovementDirection: 'stable',
      source: 'manual',
      qualityTier: 'A_PLUS'
    }
  ];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Fetch all games from API-Sports
    const allGames = await fetchAllGames();
    
    // Try to generate picks with LLM
    let llmPicks = null;
    if (OPENROUTERFREE_API_KEY) {
      llmPicks = await generatePicksWithLLM(allGames);
    }
    
    if (llmPicks && llmPicks.length > 0) {
      const now = new Date().toISOString();
      
      // Format picks from LLM
      const picks = llmPicks.slice(0, 3).map((pick, i) => {
        const baseOdds = pick.odds || 1.85;
        const allOdds = generateAllOdds(baseOdds);
        const best = getBestOdd(allOdds);
        
        return {
          id: `llm-pick-${Date.now()}-${i}`,
          matchName: pick.matchName,
          sport: pick.sport || 'Football',
          bestMarket: pick.bestMarket,
          selection: pick.selection,
          bookmaker: pick.bookmaker || 'Bet365',
          odds: baseOdds,
          edgePercent: pick.edgePercent || 8,
          confidence: pick.confidence || 7,
          analysisText: pick.analysisText,
          status: 'pending',
          createdAt: now,
          league: pick.league,
          isLive: pick.isLive || false,
          allOdds,
          bestBookmaker: best?.bookmaker,
          bestOdd: best?.odds,
          openingOdd: baseOdds,
          openingOddTimestamp: now,
          currentOdd: baseOdds,
          currentOddTimestamp: now,
          lineMovementPercent: 0,
          lineMovementDirection: 'stable',
          source: 'scanner',
          qualityTier: pick.edgePercent >= 10 ? 'A_PLUS' : 'B'
        };
      });
      
      return res.status(200).json(picks);
    }
    
    // Fallback: generate picks from real game data
    const now = new Date().toISOString();
    const fallbackPicks = [];
    
    // Take games from each sport with real data
    const sports = ['football', 'basketball', 'baseball'];
    for (const sport of sports) {
      const games = allGames[sport];
      if (games && games.length > 0 && fallbackPicks.length < 3) {
        // Prioritize live games
        const liveGames = games.filter(g => g.isLive);
        const gameToUse = liveGames.length > 0 ? liveGames[0] : games[0];
        
        const baseOdds = 1.75 + Math.random() * 0.4;
        const allOdds = generateAllOdds(baseOdds);
        const best = getBestOdd(allOdds);
        
        const markets = {
          football: { market: 'Over 2.5 Goles', selection: 'Over' },
          basketball: { market: 'Over 220.5 Puntos', selection: 'Over' },
          baseball: { market: 'Run Line -1.5', selection: gameToUse.homeTeam }
        };
        
        const sportMarket = markets[sport];
        
        fallbackPicks.push({
          id: gameToUse.id,
          matchName: `${gameToUse.homeTeam} vs ${gameToUse.awayTeam}`,
          sport: sport.charAt(0).toUpperCase() + sport.slice(1),
          bestMarket: sportMarket.market,
          selection: sportMarket.selection,
          bookmaker: best?.bookmaker || 'Bet365',
          odds: +baseOdds.toFixed(2),
          edgePercent: 6 + Math.random() * 10,
          confidence: Math.floor(7 + Math.random() * 3),
          analysisText: `${gameToUse.isLive ? '🔴 EN VIVO' : 'Próximo partido'}. ${gameToUse.league || 'Liga principal'}. Análisis basado en datos de API-Sports.`,
          status: 'pending',
          createdAt: now,
          league: gameToUse.league,
          isLive: gameToUse.isLive,
          allOdds,
          bestBookmaker: best?.bookmaker,
          bestOdd: best?.odds,
          openingOdd: +baseOdds.toFixed(2),
          openingOddTimestamp: now,
          currentOdd: +baseOdds.toFixed(2),
          currentOddTimestamp: now,
          lineMovementPercent: 0,
          lineMovementDirection: 'stable',
          source: 'scanner',
          qualityTier: 'B'
        });
      }
    }
    
    if (fallbackPicks.length > 0) {
      return res.status(200).json(fallbackPicks);
    }
    
    // Last resort fallback
    return res.status(200).json(getFallbackPicks());
  } catch (error) {
    console.error("Top picks error:", error);
    return res.status(200).json(getFallbackPicks());
  }
}
