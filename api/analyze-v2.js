/**
 * Coco VIP - AI Analysis Endpoint
 * Simplified for Vercel debugging
 */

export default async function handler(req, res) {
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
    return res.status(400).json({ error: 'matchName is required' });
  }

  console.log(`🎯 Starting analysis for: ${matchName}`);

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const ODDS_API_KEY = process.env.ODDS_API_KEY;

  // Check environment variables
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ 
      error: 'OPENROUTER_API_KEY not configured',
      hint: 'Add OPENROUTER_API_KEY to Vercel environment variables'
    });
  }

  try {
    // Step 1: Get odds (optional)
    let oddsData = null;
    if (ODDS_API_KEY) {
      try {
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/soccer_spain_la_liga/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;
        const oddsRes = await fetch(oddsUrl);
        if (oddsRes.ok) {
          const odds = await oddsRes.json();
          const match = odds.find(g => {
            const home = (g.home_team || '').toLowerCase();
            const away = (g.away_team || '').toLowerCase();
            return home.includes(matchName.toLowerCase().split(' vs ')[0]) || 
                   away.includes(matchName.toLowerCase().split(' vs ')[1] || '');
          });
          if (match) {
            const bm = match.bookmakers?.[0];
            const h2h = bm?.markets?.find(m => m.key === 'h2h');
            oddsData = {
              match: `${match.home_team} vs ${match.away_team}`,
              home: h2h?.outcomes?.[0]?.price || 0,
              draw: h2h?.outcomes?.[1]?.price || 0,
              away: h2h?.outcomes?.[2]?.price || 0
            };
          }
        }
      } catch (e) {
        console.log('Odds fetch failed:', e.message);
      }
    }

    // Step 2: Research with Perplexity
    console.log('📡 Step 2: Research...');
    let researchContext = 'Sin contexto adicional.';
    
    try {
      const perplexityRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
          'X-Title': 'Coco VIP'
        },
        body: JSON.stringify({
          model: 'perplexity/sonar-pro',
          messages: [
            { role: 'system', content: 'Sports research. Find injuries, form, H2H. Brief Spanish response.' },
            { role: 'user', content: `${matchName} ${sport} March 2026` }
          ],
          max_tokens: 400
        })
      });
      
      if (perplexityRes.ok) {
        const pData = await perplexityRes.json();
        researchContext = pData.choices?.[0]?.message?.content || 'Sin contexto.';
      }
    } catch (e) {
      console.log('Research failed:', e.message);
    }

    // Step 3: DeepSeek Analysis
    console.log('🤖 Step 3: DeepSeek...');
    
    const deepseekRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        messages: [
          { 
            role: 'system', 
            content: `Eres analista de apuestas. Responde SOLO JSON válido sin markdown.
{
  "sport": "Football",
  "match": "nombre",
  "data_quality": "alta",
  "best_pick": {
    "market": "1X2",
    "selection": "equipo o Over/Under",
    "odds": 1.85,
    "edge_percentage": 5.5,
    "confidence_score": 0.75,
    "tier": "B",
    "kelly_stake_units": 0.10,
    "value_bet": true,
    "analysis": {"pros": [], "cons": [], "conclusion": "texto"}
  },
  "mercados_completos": {
    "resultado": {"seleccion": "1", "prob_estimada": 0.45, "odds": 2.10, "edge_percentage": 5.0, "value_bet": true, "confidence_score": 0.70, "analisis": "texto"},
    "total": {"xg_estimado": 2.5, "seleccion": "over", "linea": 2.5, "odds": 1.90, "edge_percentage": 5.0, "value_bet": true, "confidence_score": 0.72, "analisis": "texto"},
    "ambos_anotan": {"aplica": true, "seleccion": "yes", "prob_btts_estimada": 0.55, "odds": 1.75, "edge_percentage": 3.5, "value_bet": true, "confidence_score": 0.68, "analisis": "texto"},
    "corners": {"aplica": true, "total_estimado": 9.5, "tendencia": "alta", "seleccion": "over", "odds": null, "edge_percentage": null, "value_bet": false, "confidence_score": 0.60, "analisis": "texto"},
    "handicap": {"aplica": true, "linea": -0.5, "seleccion": "home", "odds": 1.85, "edge_percentage": 4.0, "value_bet": true, "confidence_score": 0.67, "analisis": "texto"},
    "proyeccion_final": {"resultado_probable": "1X", "marcador_estimado": "2-1", "rango_total": "2-4", "btts_probable": true, "banker_double_viable": true, "resumen": "texto"}
  },
  "picks_con_value": [],
  "supporting_factors": [],
  "risk_factors": [],
  "ajustes_aplicados": [],
  "fuentes_contexto": []
}`
          },
          { 
            role: 'user', 
            content: `Partido: ${matchName}\nDeporte: ${sport}\nCuotas: ${oddsData ? JSON.stringify(oddsData) : 'No disponibles'}\nContexto: ${researchContext}` 
          }
        ],
        max_tokens: 1500
      })
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      throw new Error(`DeepSeek error ${deepseekRes.status}: ${errText.substring(0, 200)}`);
    }

    const deepseekData = await deepseekRes.json();
    let content = deepseekData.choices?.[0]?.message?.content || '';
    
    // Clean markdown
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parse JSON
    const result = JSON.parse(content);
    
    // Add metadata
    result.oddsPayload = oddsData;
    result.researchContext = researchContext;
    result.timestamp = new Date().toISOString();
    result.sport = sport === 'football' ? 'Football' : sport === 'basketball' ? 'NBA' : 'MLB';

    console.log(`✅ Analysis complete: ${result.best_pick?.selection}`);
    
    return res.status(200).json(result);

  } catch (error) {
    console.error('Analysis error:', error);
    
    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      match: matchName,
      sport,
      timestamp: new Date().toISOString()
    });
  }
}
