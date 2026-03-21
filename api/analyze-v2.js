/**
 * Coco VIP - AI Analysis Endpoint
 * 4-Step Pipeline: Odds API → Perplexity → DeepSeek Reasoning → DeepSeek Formatting
 * 
 * STEP 1: The Odds API - Real odds
 * STEP 2: Perplexity (sonar) - Web research
 * STEP 3: DeepSeek R1 - Free reasoning (NO JSON)
 * STEP 4: DeepSeek Chat V3 - Format to JSON
 */

// ═══════════════════════════════════════════════════════════════
// STEP 2: PERPLEXITY SYSTEM PROMPT (Extended)
// ═══════════════════════════════════════════════════════════════

const PERPLEXITY_SYSTEM_PROMPT = `You are a sports data researcher with real-time web access.
Today is March 2026, season 2025/2026.
Search the web RIGHT NOW for this specific match.

CRITICAL REQUIREMENT: Return minimum 800 words of structured data.
Include exact numbers for every stat.
Include exact scores for every recent match.
Include confirmed player names for every injury.

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
// STEP 3: DEEPSEEK FREE REASONING PROMPT
// ═══════════════════════════════════════════════════════════════

const DEEPSEEK_REASONING_PROMPT = `Eres un analista cuantitativo de apuestas deportivas.
Razona libremente y en profundidad sobre este partido.
NO te preocupes por el formato todavía.
Escribe tu análisis completo en texto libre, mínimo 600 palabras, cubriendo:

1. EVALUACIÓN DE CUOTAS
   ¿Dónde se equivoca la casa? Calcular prob implícita de cada mercado y comparar con tu estimación real.
   Mostrar los cálculos explícitamente:
   prob_implicita = 1/1.85 = 54.1%
   mi_estimacion = 63% por razones X, Y, Z
   EV = (0.63 × 1.85) - 1 = +16.5%

2. ANÁLISIS TÁCTICO PROFUNDO
   ¿Qué implican los lesionados para el sistema de juego?
   ¿Cómo afecta el contexto de tabla a la motivación?
   ¿Qué dice el xG sobre la eficiencia real vs los goles?

3. IDENTIFICACIÓN DEL MEJOR MERCADO
   ¿Dónde está el mayor edge oculto?
   ¿Por qué ese mercado y no otro?
   Razonar con números concretos del contexto.

4. DEVIL'S ADVOCATE
   ¿Cuál es el escenario más probable donde este pick falla?
   ¿Qué probabilidad le das a ese escenario?

5. CONCLUSIÓN DE CONFIANZA
   ¿Cuánto apostarías realmente y por qué?
   Kelly criterion calculado paso a paso.

Usa los datos del contexto. Si falta un dato di exactamente cuál falta y cómo afecta tu confianza.`;

// ═══════════════════════════════════════════════════════════════
// STEP 4: DEEPSEEK FORMATTING PROMPT
// ═══════════════════════════════════════════════════════════════

const DEEPSEEK_FORMATTING_PROMPT = `Eres un formateador de datos JSON.
Recibirás un análisis deportivo en texto libre.
Tu ÚNICA tarea es convertirlo al schema JSON exacto.
NO añadas nueva información.
NO cambies los números ni conclusiones del análisis.
NO generalices lo que ya está concreto en el análisis.
Copia literalmente las frases analíticas al JSON.
El campo conclusion debe tener mínimo 100 palabras copiadas directamente del análisis recibido.

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
      "conclusion": "mínimo 100 palabras copiadas directamente del análisis recibido"
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
  console.log(`🎯 INICIANDO ANÁLISIS 4-STEP: ${matchName}`);
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
    console.log('\n📊 STEP 1: Obteniendo cuotas en tiempo real...');
    
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
            
            console.log(`✅ Cuotas encontradas: ${oddsData.match}`);
            console.log(`   Home: ${oddsData.h2h.home} | Draw: ${oddsData.h2h.draw} | Away: ${oddsData.h2h.away}`);
            break;
          }
        } catch (e) {
          console.log(`⚠️ Odds fetch error for ${sportKey}:`, e.message);
        }
      }
    }

    if (!oddsData) {
      console.log('⚠️ No se encontraron cuotas, el análisis usará cuotas estimadas');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: RESEARCH WITH PERPLEXITY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n📡 STEP 2: Perplexity investigando la web (sonar)...');
    
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
          model: 'perplexity/sonar',
          messages: [
            { role: 'system', content: PERPLEXITY_SYSTEM_PROMPT },
            { role: 'user', content: `${matchName}\nDeporte: ${sport}\nFecha: Marzo 2026` }
          ],
          max_tokens: 2500
        })
      });

      if (perplexityRes.ok) {
        const pData = await perplexityRes.json();
        researchContext = pData.choices?.[0]?.message?.content || 'Sin contexto.';
        console.log(`✅ Research completado (${researchContext.length} chars)`);
      } else {
        const errText = await perplexityRes.text();
        console.log(`⚠️ Perplexity error: ${perplexityRes.status}`);
      }
    } catch (e) {
      console.log('⚠️ Research failed:', e.message);
    }

    // DEBUG LOG
    console.log('\n=== PERPLEXITY CONTEXT (first 500 chars) ===');
    console.log(researchContext.substring(0, 500) + '...');

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: DEEPSEEK FREE REASONING
    // ═══════════════════════════════════════════════════════════════
    console.log('\n🧠 STEP 3: DeepSeek razonando en profundidad...');

    const oddsText = oddsData ? JSON.stringify(oddsData, null, 2) : 'Cuotas no disponibles - estimar líneas razonables';

    const reasoningRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Reasoning'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        messages: [
          { role: 'system', content: DEEPSEEK_REASONING_PROMPT },
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
        max_tokens: 3000,
        temperature: 0.2
      })
    });

    let deepReasoningText = '';

    if (reasoningRes.ok) {
      const reasoningData = await reasoningRes.json();
      deepReasoningText = reasoningData.choices?.[0]?.message?.content || '';
      console.log(`✅ Razonamiento completado (${deepReasoningText.length} chars)`);
    } else {
      const errText = await reasoningRes.text();
      console.log(`⚠️ DeepSeek Reasoning error: ${reasoningRes.status}`);
      deepReasoningText = 'Razonamiento no disponible debido a un error en el modelo.';
    }

    // DEBUG LOG
    console.log('\n=== DEEP REASONING (first 500 chars) ===');
    console.log(deepReasoningText.substring(0, 500) + '...');

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: DEEPSEEK FORMATTING (JSON output)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n⚙️ STEP 4: Estructurando el análisis final...');

    const formattingRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Format'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: DEEPSEEK_FORMATTING_PROMPT },
          { 
            role: 'user', 
            content: `ANÁLISIS A FORMATEAR:

${deepReasoningText}` 
          }
        ],
        max_tokens: 2500
      })
    });

    if (!formattingRes.ok) {
      const errText = await formattingRes.text();
      throw new Error(`DeepSeek Formatting error ${formattingRes.status}: ${errText.substring(0, 200)}`);
    }

    const formattingData = await formattingRes.json();
    let content = formattingData.choices?.[0]?.message?.content || '';

    // DEBUG LOG
    console.log('\n=== FORMATTING RAW RESPONSE (first 500 chars) ===');
    console.log(content.substring(0, 500) + '...');

    // DEBUG LOG - ODDS PAYLOAD
    console.log('\n=== ODDS PAYLOAD ===');
    console.log(JSON.stringify(oddsData, null, 2));

    // Clean markdown if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse JSON
    const result = JSON.parse(content);

    // Add metadata
    result.oddsPayload = oddsData;
    result.researchContext = researchContext;
    result.deep_reasoning = deepReasoningText;
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
    console.log(`✅ ANÁLISIS 4-STEP COMPLETADO`);
    console.log(`📌 Best Pick: ${result.best_pick?.selection} en ${result.best_pick?.market}`);
    console.log(`💰 Odds: ${result.best_pick?.odds}`);
    console.log(`📈 Edge: ${result.best_pick?.edge_percentage}%`);
    console.log(`🎯 Confidence: ${result.best_pick?.confidence_score}`);
    console.log(`🏷️ Tier: ${result.best_pick?.tier}`);
    console.log(`📊 Data Quality: ${result.data_quality}`);
    console.log(`🧠 Deep Reasoning: ${deepReasoningText.length} chars`);
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
