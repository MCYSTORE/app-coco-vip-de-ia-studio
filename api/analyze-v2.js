/**
 * Coco VIP - AI-Driven Analysis Endpoint (Vercel Serverless)
 * 
 * 3-Step Pipeline:
 * 1. The Odds API - Real-time odds from major bookmakers
 * 2. Perplexity (via OpenRouter) - Research agent for live web data
 * 3. DeepSeek R1 (via OpenRouter) - Quant/Sniper agent for value calculation
 */

// Sport key mapping for The Odds API
const SPORT_KEY_MAP = {
  football: [
    'soccer_epl',
    'soccer_spain_la_liga',
    'soccer_italy_serie_a',
    'soccer_germany_bundesliga',
    'soccer_france_ligue_one',
    'soccer_uefa_champs_league',
    'soccer_uefa_europa_league'
  ],
  basketball: ['basketball_nba', 'basketball_euroleague'],
  baseball: ['baseball_mlb']
};

// System prompt for DeepSeek
const DEEPSEEK_SYSTEM_PROMPT = `Eres Coco, motor de IA de Coco VIP para análisis de apuestas deportivas. Responde SOLO con JSON válido, sin markdown, sin texto adicional.

REGLAS CRÍTICAS:
1. Calcula edge = ((prob_estimada * cuota) - 1) * 100
2. Solo recomienda si edge >= 3% y confidence >= 0.65
3. Kelly = (prob_estimada * cuota - 1) / (cuota - 1), máximo 0.25
4. Tier A+: confidence >= 0.80, Tier B: 0.65-0.79
5. NO inventar datos, usa solo el contexto proporcionado

OUTPUT JSON (sin backticks):
{
  "sport": "Football",
  "match": "string",
  "data_quality": "alta|media|baja",
  "estimated_odds": false,
  "best_pick": {
    "market": "1X2|Over/Under|BTTS",
    "selection": "apuesta específica",
    "odds": 1.85,
    "edge_percentage": 5.5,
    "confidence_score": 0.75,
    "tier": "A+|B",
    "kelly_stake_units": 0.10,
    "value_bet": true,
    "analysis": {
      "pros": ["factor1", "factor2"],
      "cons": ["riesgo1"],
      "conclusion": "explicación breve"
    }
  },
  "mercados_completos": {
    "resultado": {"seleccion": "1|X|2", "prob_estimada": 0.45, "odds": 2.10, "edge_percentage": 4.5, "value_bet": true, "confidence_score": 0.70, "analisis": "texto"},
    "total": {"xg_estimado": 2.5, "seleccion": "over|under", "linea": 2.5, "odds": 1.90, "edge_percentage": 5.0, "value_bet": true, "confidence_score": 0.72, "analisis": "texto"},
    "ambos_anotan": {"aplica": true, "seleccion": "yes|no", "prob_btts_estimada": 0.55, "odds": 1.75, "edge_percentage": 3.5, "value_bet": true, "confidence_score": 0.68, "analisis": "texto"},
    "corners": {"aplica": true, "total_estimado": 9.5, "tendencia": "alta|media|baja", "seleccion": "over|under|sin_cuota", "odds": null, "edge_percentage": null, "value_bet": false, "confidence_score": 0.60, "analisis": "texto"},
    "handicap": {"aplica": true, "linea": -0.5, "seleccion": "home|away", "odds": 1.85, "edge_percentage": 4.0, "value_bet": true, "confidence_score": 0.67, "analisis": "texto"},
    "proyeccion_final": {"resultado_probable": "1X", "marcador_estimado": "2-1", "rango_total": "2-4 goles", "btts_probable": true, "banker_double_viable": true, "resumen": "texto"}
  },
  "picks_con_value": [{"market": "string", "selection": "string", "odds": 1.85, "edge_percentage": 5.0, "confidence_score": 0.75, "tier": "B"}],
  "supporting_factors": ["factor1", "factor2", "factor3"],
  "risk_factors": ["riesgo1"],
  "ajustes_aplicados": [],
  "fuentes_contexto": []
}`;

const PERPLEXITY_SYSTEM_PROMPT = `You are a sports research assistant. Today is March 2026. Search for latest news about the match.

Find and return ONLY confirmed data from 2025/2026:
- Injuries and suspensions
- Team form (last 5 matches with scores)
- Head-to-head record
- Motivation and standings

Respond in Spanish with a concise factual summary. DO NOT hallucinate. If data not found, state 'No data found'.`;

// Step 1: Fetch odds from The Odds API
async function fetchOddsFromAPI(matchName, sport) {
  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  
  if (!ODDS_API_KEY) {
    return { oddsPayload: null, warning: 'ODDS_API_KEY no configurada' };
  }

  const sportKeys = SPORT_KEY_MAP[sport] || [];
  const teams = matchName.split(/\s+vs\s+|\s+v\s+/i);
  const homeTeam = (teams[0] || '').trim().toLowerCase();
  const awayTeam = (teams[1] || '').trim().toLowerCase();

  for (const sportKey of sportKeys) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&bookmakers=bet365,pinnacle`;
      
      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      
      // Fuzzy match
      const match = data.find((game) => {
        const gameHome = (game.home_team || '').toLowerCase();
        const gameAway = (game.away_team || '').toLowerCase();
        return (gameHome.includes(homeTeam) || homeTeam.includes(gameHome)) &&
               (gameAway.includes(awayTeam) || awayTeam.includes(gameAway));
      });

      if (!match) continue;

      const bookmaker = match.bookmakers?.[0];
      const h2h = bookmaker?.markets?.find(m => m.key === 'h2h');
      const totals = bookmaker?.markets?.find(m => m.key === 'totals');

      const oddsPayload = {
        match: `${match.home_team} vs ${match.away_team}`,
        commence_time: match.commence_time,
        bookmakers: {
          h2h: {
            home: h2h?.outcomes?.find(o => o.name === match.home_team)?.price || 0,
            draw: h2h?.outcomes?.find(o => o.name === 'Draw')?.price || null,
            away: h2h?.outcomes?.find(o => o.name === match.away_team)?.price || 0
          },
          totals: totals ? {
            line: totals.outcomes?.[0]?.point || 0,
            over: totals.outcomes?.find(o => o.name === 'Over')?.price || 0,
            under: totals.outcomes?.find(o => o.name === 'Under')?.price || 0
          } : null
        }
      };

      return { oddsPayload };
    } catch (error) {
      console.error(`Error fetching odds for ${sportKey}:`, error.message);
      continue;
    }
  }

  return { oddsPayload: null, warning: 'Cuotas no disponibles' };
}

// Step 2: Research with Perplexity
async function fetchResearchContext(matchName, sport) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  
  if (!OPENROUTER_API_KEY) {
    return { context: 'Sin contexto web.', warning: 'OPENROUTER_API_KEY no configurada' };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Research'
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-pro',
        temperature: 0.1,
        max_tokens: 800,
        messages: [
          { role: 'system', content: PERPLEXITY_SYSTEM_PROMPT },
          { role: 'user', content: `Investiga: ${matchName}\nDeporte: ${sport}\nFecha: Marzo 2026` }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity error: ${response.status}`);
    }

    const data = await response.json();
    const context = data.choices?.[0]?.message?.content || 'Sin contexto.';
    return { context };
  } catch (error) {
    console.error('Research error:', error.message);
    return { context: 'Sin contexto web.', warning: 'Búsqueda fallida' };
  }
}

// Step 3: DeepSeek analysis
async function runQuantAnalysis(matchName, sport, oddsPayload, researchContext) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY no configurada');
  }

  const oddsText = oddsPayload ? JSON.stringify(oddsPayload, null, 2) : 'No disponibles';

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Quant'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        temperature: 0.1,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
          { role: 'user', content: `Partido: ${matchName}\nDeporte: ${sport}\n\nCuotas:\n${oddsText}\n\nContexto:\n${researchContext}` }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    
    // Clean markdown
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(content);
    result.oddsPayload = oddsPayload;
    result.timestamp = new Date().toISOString();
    
    // Normalize sport
    if (sport === 'football') result.sport = 'Football';
    if (sport === 'basketball') result.sport = 'NBA';
    if (sport === 'baseball') result.sport = 'MLB';
    
    return result;
  } catch (error) {
    console.error('Quant error:', error.message);
    throw error;
  }
}

// Main handler
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { matchName, sport = 'football' } = req.body || {};

  if (!matchName) {
    return res.status(400).json({ 
      error: 'matchName required',
      message: 'Ingresa el nombre del partido'
    });
  }

  const validSports = ['football', 'basketball', 'baseball'];
  if (!validSports.includes(sport)) {
    return res.status(400).json({ error: 'Invalid sport' });
  }

  console.log(`🎯 Analizando: ${matchName} (${sport})`);

  try {
    // Step 1: Odds
    const { oddsPayload, warning: oddsWarning } = await fetchOddsFromAPI(matchName, sport);
    if (oddsWarning) console.log(`⚠️ ${oddsWarning}`);

    // Step 2: Research
    const { context: researchContext, warning: researchWarning } = await fetchResearchContext(matchName, sport);
    if (researchWarning) console.log(`⚠️ ${researchWarning}`);

    // Step 3: Analysis
    const result = await runQuantAnalysis(matchName, sport, oddsPayload, researchContext);

    console.log(`✅ Completado: ${result.best_pick?.selection}`);
    
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      match: matchName,
      sport,
      timestamp: new Date().toISOString()
    });
  }
};
