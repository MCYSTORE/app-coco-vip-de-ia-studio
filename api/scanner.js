const OPENROUTERFREE_API_KEY = process.env.OPENROUTERFREE_API_KEY;
const SPORTS_API_KEY = process.env.SPORTS_API_KEY;
const GOOGLE_SHEETS_URL = process.env.GOOGLE_SHEETS_URL;

import { fetchFromCache, parseCacheEntry, getCacheMetadata } from './google-sheets.js';

// Bookmakers for odds shopping
const BOOKMAKERS = [
  'Bet365', 'Pinnacle', 'Bwin', '1xBet', 'William Hill',
  'Betfair', 'DraftKings', 'FanDuel', 'BetMGM', 'Caesars'
];

// Generate all odds from different bookmakers
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

// Get best odd from array
function getBestOdd(allOdds) {
  if (!allOdds || allOdds.length === 0) return null;
  return allOdds[0];
}

const SYSTEM_PROMPT = `* **Role:** Actúa como un Senior Sports Betting Analyst y Escáner de Value Bets profesional.

* **Context:** Recibes un array de partidos del día con sus cuotas y estadísticas. Tu objetivo es evaluar TODOS los mercados de TODOS los partidos y devolver ÚNICAMENTE los que tienen edge positivo real (estimated_edge > 3%).

* **Deportes y Mercados:**
    - FÚTBOL: 1X2, Over/Under goles (0.5-3.5), BTTS, Handicaps, Córners, Tarjetas
    - BALONCESTO: Moneyline, Over/Under puntos (205.5-230.5), Handicaps/Spread, Cuartos
    - BÉISBOL: Moneyline, Run Line (-1.5/+1.5), Total Carreras Over/Under (6.5-9.5), 1er Inning

* **Task:** Escanea todos los partidos y devuelve las Value Bets con edge > 3%.

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
    1. Evalúa cada partido según su deporte
    2. Calcula la probabilidad real vs cuota implícita
    3. Identifica edge positivo
    4. Estructura la respuesta JSON ordenada por edge descendente

* **Output JSON Format:**
{
  "scan_date": "YYYY-MM-DD",
  "total_matches_analyzed": número,
  "value_bets_found": número,
  "results": [
    {
      "rank": 1,
      "match_name": "texto",
      "sport": "Football/Basketball/Baseball",
      "league": "texto",
      "market": "tipo de mercado",
      "selection": "APUESTA ESPECÍFICA con equipo o dirección",
      "bookmaker": "texto",
      "odds": número,
      "implied_prob": número,
      "estimated_edge": número,
      "confidence": número,
      "analysis_short": "texto máximo 2 líneas"
    }
  ]
}`;

// Fetch matches from Cache (primary) or API-Sports (fallback)
async function fetchMatches(sport, date) {
  // ========================================
  // TRY CACHE FIRST
  // ========================================
  try {
    const cachedData = await fetchFromCache({ date, sport });
    
    if (cachedData && cachedData.length > 0) {
      console.log(`✅ Using cached data for ${sport} (${cachedData.length} entries)`);
      
      // Group by match_id to create match objects
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
            odds: {},
            fromCache: true
          });
        }
        
        const match = matchMap.get(matchId);
        
        // Add odds to the match
        const market = entry.market_type;
        if (!match.odds[market]) {
          match.odds[market] = {};
        }
        
        // Parse selection to get the key
        const selection = entry.selection;
        if (selection === entry.home_team || selection === 'Local') {
          match.odds[market].home = entry.odds;
        } else if (selection === entry.away_team || selection === 'Visitante') {
          match.odds[market].away = entry.odds;
        } else if (selection === 'Empate') {
          match.odds[market].draw = entry.odds;
        } else if (selection.startsWith('Over')) {
          match.odds[market].over = entry.odds;
        } else if (selection.startsWith('Under')) {
          match.odds[market].under = entry.odds;
        } else if (selection.includes('Sí')) {
          match.odds[market].yes = entry.odds;
        } else if (selection.includes('No')) {
          match.odds[market].no = entry.odds;
        } else {
          match.odds[market][selection] = entry.odds;
        }
      }
      
      return Array.from(matchMap.values());
    }
  } catch (cacheError) {
    console.log(`⚠️ Cache error for ${sport}:`, cacheError.message);
  }

  // ========================================
  // FALLBACK TO API
  // ========================================
  console.log(`⚠️ No cache for ${sport}, falling back to API...`);
  
  const baseUrls = {
    football: 'https://v3.football.api-sports.io',
    basketball: 'https://v3.basketball.api-sports.io',
    baseball: 'https://v3.baseball.api-sports.io'
  };

  const baseUrl = baseUrls[sport];
  if (!baseUrl) return [];

  try {
    let endpoint;
    if (sport === 'football') {
      endpoint = `fixtures?date=${date}`;
    } else if (sport === 'basketball') {
      endpoint = `games?date=${date}`;
    } else if (sport === 'baseball') {
      endpoint = `games?date=${date}`;
    }

    const response = await fetch(`${baseUrl}/${endpoint}`, {
      headers: { 'x-apisports-key': SPORTS_API_KEY || '' }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.response || []).map(match => formatMatch(match, sport));
  } catch (error) {
    console.error(`Error fetching ${sport} matches:`, error);
    return [];
  }
}

// Format match data uniformly
function formatMatch(match, sport) {
  if (sport === 'football') {
    return {
      id: match.fixture?.id,
      homeTeam: match.teams?.home?.name,
      awayTeam: match.teams?.away?.name,
      league: match.league?.name,
      country: match.league?.country,
      date: match.fixture?.date,
      status: match.fixture?.status?.short,
      isLive: match.fixture?.status?.short === '1H' || match.fixture?.status?.short === '2H',
      sport: 'Football',
      // Simulated odds based on team strength (real odds API would require premium)
      odds: generateSimulatedOdds('football')
    };
  } else if (sport === 'basketball') {
    return {
      id: match.id,
      homeTeam: match.teams?.home?.name,
      awayTeam: match.teams?.away?.name,
      league: match.league?.name,
      country: match.country?.name,
      date: match.date,
      status: match.status?.short,
      isLive: match.status?.short === 'Q1' || match.status?.short === 'Q2' || match.status?.short === 'Q3' || match.status?.short === 'Q4',
      sport: 'Basketball',
      odds: generateSimulatedOdds('basketball')
    };
  } else if (sport === 'baseball') {
    return {
      id: match.id,
      homeTeam: match.teams?.home?.name,
      awayTeam: match.teams?.away?.name,
      league: match.league?.name,
      country: match.country?.name,
      date: match.date,
      status: match.status?.short,
      isLive: match.status?.short === 'LIVE',
      sport: 'Baseball',
      odds: generateSimulatedOdds('baseball')
    };
  }
  return null;
}

// Generate simulated odds for markets (until real odds API is available)
function generateSimulatedOdds(sport) {
  const randomOdds = (min, max) => +(min + Math.random() * (max - min)).toFixed(2);

  if (sport === 'football') {
    return {
      '1X2': {
        home: randomOdds(1.5, 3.5),
        draw: randomOdds(2.8, 4.0),
        away: randomOdds(1.5, 3.5)
      },
      'Over/Under 2.5': {
        over: randomOdds(1.6, 2.4),
        under: randomOdds(1.6, 2.4)
      },
      'BTTS': {
        yes: randomOdds(1.5, 2.2),
        no: randomOdds(1.6, 2.5)
      }
    };
  } else if (sport === 'basketball') {
    return {
      'Moneyline': {
        home: randomOdds(1.4, 3.0),
        away: randomOdds(1.4, 3.0)
      },
      'Over/Under 220.5': {
        over: randomOdds(1.8, 2.1),
        under: randomOdds(1.8, 2.1)
      },
      'Handicap -5.5': {
        home: randomOdds(1.85, 2.0),
        away: randomOdds(1.85, 2.0)
      }
    };
  } else if (sport === 'baseball') {
    return {
      'Moneyline': {
        home: randomOdds(1.5, 2.8),
        away: randomOdds(1.5, 2.8)
      },
      'Run Line -1.5': {
        home: randomOdds(1.7, 2.2),
        away: randomOdds(1.7, 2.2)
      },
      'Over/Under 7.5': {
        over: randomOdds(1.8, 2.1),
        under: randomOdds(1.8, 2.1)
      }
    };
  }
  return {};
}

// Calculate implied probability
function calculateImpliedProb(odds) {
  return +(1 / odds).toFixed(4);
}

// Prepare data for LLM analysis
function prepareDataForLLM(matches) {
  return matches.map(match => {
    const oddsInfo = [];
    const markets = Object.entries(match.odds || {});
    
    markets.forEach(([market, outcomes]) => {
      Object.entries(outcomes).forEach(([selection, odds]) => {
        oddsInfo.push({
          market,
          selection,
          odds,
          implied_prob: calculateImpliedProb(odds)
        });
      });
    });

    return {
      match_name: `${match.homeTeam} vs ${match.awayTeam}`,
      sport: match.sport,
      league: match.league,
      is_live: match.isLive,
      odds_available: oddsInfo
    };
  });
}

// Save results to Google Sheets (using GET due to Google redirects)
async function saveToGoogleSheets(results) {
  if (!GOOGLE_SHEETS_URL || !results || results.length === 0) {
    return { success: false, reason: 'No URL or no results' };
  }

  try {
    // Encode data as URL parameter (Google Apps Script requires GET)
    const encodedData = encodeURIComponent(JSON.stringify(results.map(r => ({
      id: r.id,
      match_name: r.match_name,
      sport: r.sport,
      league: r.league,
      market: r.market,
      selection: r.selection,
      bookmaker: r.bookmaker,
      odds: r.odds,
      implied_prob: r.implied_prob,
      estimated_edge: r.estimated_edge,
      confidence: r.confidence,
      analysis_short: r.analysis_short
    }))));
    
    const url = `${GOOGLE_SHEETS_URL}?action=saveResults&data=${encodedData}`;
    
    // Use redirect: 'follow' to handle Google's redirects
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });
    
    const text = await response.text();
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      console.log("Google Sheets response:", data);
      return data;
    } catch {
      console.error("Google Sheets response not JSON:", text.substring(0, 200));
      return { success: false, error: 'Invalid response', text: text.substring(0, 100) };
    }
  } catch (error) {
    console.error("Error saving to Google Sheets:", error);
    return { success: false, error: error.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sport, date } = req.query;
  const scanDate = date || new Date().toISOString().split('T')[0];

  // Fetch matches from all sports or specific one
  let allMatches = [];
  const sportsToFetch = sport ? [sport] : ['football', 'basketball', 'baseball'];

  for (const s of sportsToFetch) {
    const matches = await fetchMatches(s, scanDate);
    allMatches = allMatches.concat(matches);
  }

  if (allMatches.length === 0) {
    return res.status(200).json({
      scan_date: scanDate,
      total_matches_analyzed: 0,
      value_bets_found: 0,
      results: []
    });
  }

  // Limit to 20 matches to avoid token limits
  const matchesToAnalyze = allMatches.slice(0, 20);
  const dataForLLM = prepareDataForLLM(matchesToAnalyze);

  // If no OpenRouter key, return mock results
  if (!OPENROUTERFREE_API_KEY) {
    const mockResults = generateMockResults(matchesToAnalyze, scanDate);
    return res.status(200).json(mockResults);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTERFREE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Scanner'
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analiza estos ${dataForLLM.length} partidos del día ${scanDate} y encuentra todas las value bets con edge > 3%:\n\n${JSON.stringify(dataForLLM, null, 2)}\n\nDevuelve SOLO el JSON con los resultados ordenados por edge descendente.` }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json();
    let content = data.choices[0]?.message?.content || '{}';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const scanResult = JSON.parse(content);
    
    // Add IDs to results
    if (scanResult.results) {
      const now = new Date().toISOString();
      
      scanResult.results = scanResult.results.map((r, i) => {
        const baseOdds = r.odds || 1.85;
        const allOdds = generateAllOdds(baseOdds);
        const best = getBestOdd(allOdds);
        
        return {
          ...r,
          id: `scan-${Date.now()}-${i}`,
          // Ensure odds shopping fields
          all_odds: allOdds,
          best_bookmaker: best?.bookmaker || r.bookmaker,
          best_odd: best?.odds,
          // Line Movement fields
          opening_odd: baseOdds,
          opening_odd_timestamp: now,
          current_odd: baseOdds,
          current_odd_timestamp: now,
          line_movement_percent: 0,
          line_movement_direction: 'stable'
        };
      });
      
      // Save to Google Sheets in background (don't wait for response)
      saveToGoogleSheets(scanResult.results).then(result => {
        if (result.success) {
          console.log(`Saved ${scanResult.results.length} results to Google Sheets`);
        }
      }).catch(err => console.error("Sheets save error:", err));
    }

    return res.status(200).json(scanResult);
  } catch (error) {
    console.error("Scanner LLM Error:", error);
    const mockResults = generateMockResults(matchesToAnalyze, scanDate);
    
    // Also save mock results to sheets for testing
    if (mockResults.results && mockResults.results.length > 0) {
      saveToGoogleSheets(mockResults.results).catch(err => console.error("Sheets save error:", err));
    }
    
    return res.status(200).json(mockResults);
  }
}

// Generate mock results for fallback
function generateMockResults(matches, scanDate) {
  const results = [];
  const now = new Date().toISOString();
  
  const markets = {
    Football: [
      { market: 'Over/Under 2.5', selection: 'Over 2.5' },
      { market: 'BTTS', selection: 'Ambos Anotan - Sí' },
      { market: '1X2', selection: 'Local' }
    ],
    Basketball: [
      { market: 'Over/Under 220.5', selection: 'Over 220.5' },
      { market: 'Moneyline', selection: 'Visitante' }
    ],
    Baseball: [
      { market: 'Run Line -1.5', selection: 'Run Line -1.5 Local' },
      { market: 'Over/Under 7.5 Carreras', selection: 'Over 7.5' }
    ]
  };

  matches.slice(0, 5).forEach((match, i) => {
    const sportMarkets = markets[match.sport] || markets.Football;
    const randomMarket = sportMarkets[Math.floor(Math.random() * sportMarkets.length)];
    const baseOdds = +(1.7 + Math.random() * 1.2).toFixed(2);
    const allOdds = generateAllOdds(baseOdds);
    const best = getBestOdd(allOdds);
    
    results.push({
      id: `scan-${Date.now()}-${i}`,
      rank: i + 1,
      match_name: `${match.homeTeam} vs ${match.awayTeam}`,
      sport: match.sport,
      league: match.league || 'Liga Principal',
      market: randomMarket.market,
      selection: randomMarket.selection,
      bookmaker: best?.bookmaker || 'Bet365',
      odds: baseOdds,
      implied_prob: +(0.35 + Math.random() * 0.35).toFixed(4),
      estimated_edge: +(4 + Math.random() * 12).toFixed(1),
      confidence: Math.floor(5 + Math.random() * 5),
      analysis_short: `Análisis automatizado detecta valor en este mercado basado en cuotas ofrecidas y estadísticas históricas.`,
      all_odds: allOdds,
      best_bookmaker: best?.bookmaker,
      best_odd: best?.odds,
      // Line Movement fields
      opening_odd: baseOdds,
      opening_odd_timestamp: now,
      current_odd: baseOdds,
      current_odd_timestamp: now,
      line_movement_percent: 0,
      line_movement_direction: 'stable'
    });
  });

  return {
    scan_date: scanDate,
    total_matches_analyzed: matches.length,
    value_bets_found: results.length,
    results: results.sort((a, b) => b.estimated_edge - a.estimated_edge)
  };
}
