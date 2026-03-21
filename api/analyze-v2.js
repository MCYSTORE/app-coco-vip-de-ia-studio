/**
 * Coco VIP - AI Analysis Endpoint
 * 3-Step Pipeline: Odds API → Perplexity → DeepSeek
 */

// ═══════════════════════════════════════════════════════════════
// FIX 1: IMPROVED PERPLEXITY PROMPT
// ═══════════════════════════════════════════════════════════════

const PERPLEXITY_SYSTEM_PROMPT = `You are a sports data researcher with real-time web access.
Today is March 2026, season 2025/2026.
Search the web RIGHT NOW for this specific match.

You MUST find and return ALL of these items.
For each item NOT found, write exactly: '[NOT FOUND]'
NEVER skip an item. NEVER summarize vaguely.

Return a structured report with these exact sections:

## FORMA RECIENTE (últimos 5 partidos con marcadores exactos)
Local: [fecha] vs [rival] [marcador] | [fecha] vs [rival]...
Visitante: [fecha] vs [rival] [marcador]...

## LESIONADOS Y SUSPENDIDOS CONFIRMADOS
Local: [nombre jugador] - [lesión] - [fuente/fecha]
Visitante: [nombre jugador] - [lesión] - [fuente/fecha]
Si no hay: 'Plantilla completa confirmada'

## ESTADÍSTICAS AVANZADAS 2025/2026
xG local (promedio): [número]
xGA local (promedio): [número]  
xG visitante (promedio): [número]
xGA visitante (promedio): [número]
PPDA local: [número] (presión defensiva, menor = mejor)
PPDA visitante: [número]

## CLASIFICACIÓN ACTUAL
Local: [posición]º con [puntos] pts en [liga]
Visitante: [posición]º con [puntos] pts en [liga]

## HEAD TO HEAD (últimos 3 enfrentamientos con marcadores)
[fecha] [local] [marcador] [visitante]

## MOTIVACIÓN Y CONTEXTO
[descripción concreta: persigue título, evitar descenso, etc]

## NOTICIAS RELEVANTES (últimas 48h)
[titular concreto con fecha]

DO NOT hallucinate. DO NOT use 2024 data.
Respond in Spanish.`;

// ═══════════════════════════════════════════════════════════════
// FIX 2: IMPROVED DEEPSEEK PROMPT WITH CRITICAL INSTRUCTIONS
// ═══════════════════════════════════════════════════════════════

const DEEPSEEK_SYSTEM_PROMPT = `INSTRUCCIÓN CRÍTICA DE ANÁLISIS:
El campo 'conclusion' en best_pick.analysis DEBE tener mínimo 120 palabras y citar DATOS NUMÉRICOS CONCRETOS del contexto recibido.
Los campos 'pros' deben citar stats específicos con números.
Ejemplo CORRECTO: 'Bayern promedia xG 2.8 en casa, Unión Berlin xGA 1.9 como visitante. Kane anotó en 4 de los últimos 5 partidos.'
Ejemplo INCORRECTO (PROHIBIDO): 'Bayern es superior y debería ganar.'
Si el contexto no tiene datos numéricos: indicar explícitamente qué datos faltan en lugar de generalizar.

Eres analista de apuestas profesional de Coco VIP. Responde SOLO JSON válido sin markdown.

REGLAS DE CÁLCULO:
1. prob_implicita = 1 / cuota
2. prob_normalizada = prob_implicita / suma_todas (para 1X2)
3. edge_percentage = ((prob_estimada × cuota) - 1) × 100
4. Solo value_bet=true si edge >= 3% Y confidence_score >= 0.65
5. Kelly = (prob_estimada × cuota - 1) / (cuota - 1), máximo 0.25
6. Tier A+: confidence >= 0.80, Tier B: 0.65-0.79

JSON de respuesta (sin backticks):
{
  "sport": "Football",
  "match": "nombre completo del partido",
  "data_quality": "alta|media|baja",
  "estimated_odds": false,
  "best_pick": {
    "market": "1X2|Over/Under|BTTS|Corners|Handicap",
    "selection": "apuesta específica con número (ej: 'Over 2.5', 'Bayern', 'Sí')",
    "odds": 1.85,
    "edge_percentage": 5.5,
    "confidence_score": 0.75,
    "tier": "A+|B",
    "kelly_stake_units": 0.10,
    "value_bet": true,
    "analysis": {
      "pros": ["factor con número específico", "factor con número específico", "factor con número específico"],
      "cons": ["riesgo concreto"],
      "conclusion": "mínimo 120 palabras citando datos numéricos del contexto"
    },
    "stats_highlights": {
      "metric_1": "xG Local: 2.1 promedio",
      "metric_2": "xGA Visitante: 1.4 promedio", 
      "metric_3": "H2H: 3 victorias local en últimos 5"
    }
  },
  "mercados_completos": {
    "resultado": {
      "seleccion": "1|X|2",
      "prob_estimada": 0.45,
      "prob_implicita_normalizada": 0.42,
      "odds": 2.10,
      "edge_percentage": 5.0,
      "value_bet": true,
      "confidence_score": 0.70,
      "analisis": "análisis breve con datos"
    },
    "total": {
      "xg_o_pts_estimado": 2.5,
      "seleccion": "over|under",
      "linea": 2.5,
      "odds": 1.90,
      "edge_percentage": 5.0,
      "value_bet": true,
      "confidence_score": 0.72,
      "analisis": "análisis con xG"
    },
    "ambos_anotan": {
      "aplica": true,
      "seleccion": "yes|no",
      "prob_btts_estimada": 0.55,
      "odds": 1.75,
      "edge_percentage": 3.5,
      "value_bet": true,
      "confidence_score": 0.68,
      "analisis": "análisis BTTS"
    },
    "corners": {
      "aplica": true,
      "total_estimado": 9.5,
      "tendencia": "alta|media|baja",
      "linea": null,
      "seleccion": "over|under|sin_cuota",
      "odds": null,
      "edge_percentage": null,
      "value_bet": false,
      "confidence_score": 0.60,
      "analisis": "análisis corners"
    },
    "handicap": {
      "aplica": true,
      "linea": -0.5,
      "seleccion": "home|away",
      "odds": 1.85,
      "edge_percentage": 4.0,
      "value_bet": true,
      "confidence_score": 0.67,
      "analisis": "análisis handicap"
    },
    "proyeccion_final": {
      "resultado_probable": "1X|12|X2",
      "marcador_estimado": "2-1",
      "rango_total": "2-4 goles",
      "btts_probable": true,
      "banker_double_viable": true,
      "banker_double_cuota_minima": 1.35,
      "resumen": "resumen ejecutivo",
      "mejor_pick_resumen": {
        "market": "string",
        "selection": "string",
        "odds": 1.85,
        "edge_percentage": 5.0,
        "kelly_stake_units": 0.10
      }
    }
  },
  "picks_con_value": [
    {"market": "string", "selection": "string", "odds": 1.85, "edge_percentage": 5.0, "confidence_score": 0.75, "tier": "B"}
  ],
  "supporting_factors": ["factor 1 con dato", "factor 2 con dato", "factor 3 con dato"],
  "risk_factors": ["riesgo 1", "riesgo 2"],
  "ajustes_aplicados": ["ajuste aplicado"],
  "fuentes_contexto": ["fuente 1", "fuente 2"]
}`;

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

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🎯 INICIANDO ANÁLISIS: ${matchName}`);
  console.log(`📊 Deporte: ${sport}`);
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log(`${'═'.repeat(60)}`);

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
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: FETCH ODDS FROM THE ODDS API
    // ═══════════════════════════════════════════════════════════════
    console.log('\n📊 STEP 1: Fetching odds from The Odds API...');
    
    let oddsData = null;
    const sportKeyMap = {
      football: ['soccer_spain_la_liga', 'soccer_epl', 'soccer_italy_serie_a', 'soccer_germany_bundesliga'],
      basketball: ['basketball_nba'],
      baseball: ['baseball_mlb']
    };

    if (ODDS_API_KEY) {
      for (const sportKey of (sportKeyMap[sport] || [])) {
        try {
          const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&bookmakers=bet365,pinnacle`;
          const oddsRes = await fetch(oddsUrl);
          
          if (!oddsRes.ok) continue;
          
          const odds = await oddsRes.json();
          const teams = matchName.toLowerCase().split(/\s+vs\s+|\s+v\s+/);
          
          const match = odds.find(g => {
            const home = (g.home_team || '').toLowerCase();
            const away = (g.away_team || '').toLowerCase();
            return (home.includes(teams[0]) || teams[0].includes(home)) &&
                   (away.includes(teams[1] || '') || (teams[1] && teams[1].includes(away)));
          });

          if (match) {
            const bm = match.bookmakers?.[0];
            const h2h = bm?.markets?.find(m => m.key === 'h2h');
            const totals = bm?.markets?.find(m => m.key === 'totals');
            
            oddsData = {
              match: `${match.home_team} vs ${match.away_team}`,
              commence_time: match.commence_time,
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
            };
            
            console.log(`✅ Odds found: ${oddsData.match}`);
            console.log(`   Home: ${oddsData.h2h.home} | Draw: ${oddsData.h2h.draw} | Away: ${oddsData.h2h.away}`);
            break;
          }
        } catch (e) {
          console.log(`⚠️ Odds fetch error for ${sportKey}:`, e.message);
        }
      }
    }

    if (!oddsData) {
      console.log('⚠️ No odds found, analysis will use estimated odds');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: RESEARCH WITH PERPLEXITY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n📡 STEP 2: Researching with Perplexity (sonar-pro)...');
    
    let researchContext = 'Sin contexto adicional.';
    
    try {
      const perplexityRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
          'X-Title': 'Coco VIP Research'
        },
        body: JSON.stringify({
          model: 'perplexity/sonar-pro',
          messages: [
            { role: 'system', content: PERPLEXITY_SYSTEM_PROMPT },
            { role: 'user', content: `${matchName}\nDeporte: ${sport}\nFecha: Marzo 2026` }
          ],
          max_tokens: 1500
        })
      });

      if (perplexityRes.ok) {
        const pData = await perplexityRes.json();
        researchContext = pData.choices?.[0]?.message?.content || 'Sin contexto.';
        console.log(`✅ Research completed (${researchContext.length} chars)`);
      } else {
        const errText = await perplexityRes.text();
        console.log(`⚠️ Perplexity error: ${perplexityRes.status}`);
      }
    } catch (e) {
      console.log('⚠️ Research failed:', e.message);
    }

    // FIX 4: DEBUG LOG
    console.log('\n=== PERPLEXITY CONTEXT ===');
    console.log(researchContext.substring(0, 500) + '...');

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: DEEPSEEK ANALYSIS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n🤖 STEP 3: DeepSeek R1 Analysis...');
    
    const oddsText = oddsData ? JSON.stringify(oddsData, null, 2) : 'Cuotas no disponibles - estimar líneas razonables';

    const deepseekRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Quant'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        messages: [
          { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `Partido: ${matchName}
Deporte: ${sport}

CUOTAS ACTUALES:
${oddsText}

CONTEXTO INVESTIGADO:
${researchContext}` 
          }
        ],
        // FIX 2: Increased max_tokens from 1500 to 3500
        max_tokens: 3500
      })
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      throw new Error(`DeepSeek error ${deepseekRes.status}: ${errText.substring(0, 200)}`);
    }

    const deepseekData = await deepseekRes.json();
    let content = deepseekData.choices?.[0]?.message?.content || '';

    // FIX 4: DEBUG LOG
    console.log('\n=== DEEPSEEK RAW RESPONSE ===');
    console.log(content.substring(0, 500) + '...');

    // Clean markdown if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // FIX 4: DEBUG LOG
    console.log('\n=== ODDS PAYLOAD ===');
    console.log(JSON.stringify(oddsData, null, 2));

    // Parse JSON
    const result = JSON.parse(content);

    // Add metadata
    result.oddsPayload = oddsData;
    result.researchContext = researchContext;
    result.timestamp = new Date().toISOString();
    result.sport = sport === 'football' ? 'Football' : sport === 'basketball' ? 'NBA' : 'MLB';
    result.estimated_odds = !oddsData;

    // Set data_quality based on research context
    if (researchContext.includes('[NOT FOUND]') || researchContext.length < 300) {
      result.data_quality = result.data_quality || 'baja';
    } else if (researchContext.includes('xG') && researchContext.includes('LESIONADOS')) {
      result.data_quality = result.data_quality || 'alta';
    } else {
      result.data_quality = result.data_quality || 'media';
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ ANÁLISIS COMPLETADO`);
    console.log(`📌 Best Pick: ${result.best_pick?.selection} en ${result.best_pick?.market}`);
    console.log(`💰 Odds: ${result.best_pick?.odds}`);
    console.log(`📈 Edge: ${result.best_pick?.edge_percentage}%`);
    console.log(`🎯 Confidence: ${result.best_pick?.confidence_score}`);
    console.log(`🏷️ Tier: ${result.best_pick?.tier}`);
    console.log(`📊 Data Quality: ${result.data_quality}`);
    console.log(`${'═'.repeat(60)}\n`);

    return res.status(200).json(result);

  } catch (error) {
    console.error('\n❌ ANALYSIS ERROR:', error);
    
    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      match: matchName,
      sport,
      timestamp: new Date().toISOString()
    });
  }
}
