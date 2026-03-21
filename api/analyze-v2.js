/**
 * Coco VIP - AI Analysis Endpoint
 * 4-Step Pipeline: Odds API → Perplexity → Claude Reasoning → Grok Formatting
 * 
 * STEP 1: The Odds API - Real odds
 * STEP 2: Perplexity (sonar) - Web research (ESPAÑOL)
 * STEP 3: Claude Sonnet 4 - Free reasoning (ESPAÑOL FORZADO)
 * STEP 4: Grok 4.1 Fast - Format to JSON (ESPAÑOL FORZADO)
 */

// ═══════════════════════════════════════════════════════════════
// DETECT LANGUAGE HELPER
// ═══════════════════════════════════════════════════════════════

function detectLanguage(text) {
  if (!text) return 'unknown';
  
  // Chinese detection
  if (/[一-鿿]/.test(text)) return 'chinese';
  // Japanese detection
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'japanese';
  // Korean detection
  if (/[\uAC00-\uD7AF]/.test(text)) return 'korean';
  // Spanish detection (common words)
  if (/\b(el|la|los|las|de|que|en|es|un|una|por|con|para|como|más|pero|sus|le|ya|o|este|sí|porque|esta|entre|cuando|muy|sin|sobre|también|me|hasta|hay|donde|quien|desde|todo|nos|durante|todos|uno|les|ni|contra|otros|ese|eso|ante|ellos|e|esto|mí|antes|algunos|qué|unos|yo|otro|otras|otra|él|tanto|esa|estos|mucho|quienes|nada|muchos|cual|poco|ella|estar|estas|algunas|algo|nosotros|mi|mis|tú|te|ti|tu|tus|ellas|nosotras|vosostros|vosostras|os|mío|mía|míos|mías|tuyo|tuya|tuyos|tuyas|suyo|suya|suyos|suyas|nuestro|nuestra|nuestros|nuestras|vuestro|vuestra|vuestros|vuestras|esos|esas|estoy|estás|está|estamos|estáis|están|esté|estés|estemos|estéis|estén|estaré|estarás|estará|estaremos|estaréis|estarán|estaría|estarías|estaríamos|estaríais|estarían|estaba|estabas|estábamos|estabais|estaban|estuve|estuviste|estuvo|estuvimos|estuvisteis|estuvieron|estuviera|estuvieras|estuviéramos|estuvierais|estuvieran|estuviese|estuvieses|estuviésemos|estuvieseis|estuviesen|estando|estado|estada|estados|estadas|estad|he|has|ha|hemos|habéis|han|haya|hayas|hayamos|hayáis|hayan|habré|habrás|habrá|habremos|habréis|habrán|habría|habrías|habríamos|habríais|habrían|había|habías|habíamos|habíais|habían|hube|hubiste|hubo|hubimos|hubisteis|hubieron|hubiera|hubieras|hubiéramos|hubierais|hubieran|hubiese|hubieses|hubiésemos|hubieseis|hubiesen|habiendo|habido|habida|habidos|habidas|soy|eres|es|somos|sois|son|sea|seas|seamos|seáis|sean|seré|serás|será|seremos|seréis|serán|sería|serías|seríamos|seríais|serían|era|eras|éramos|erais|eran|fui|fuiste|fue|fuimos|fuisteis|fueron|fuera|fueras|fuéramos|fuerais|fueran|fuese|fueses|fuésemos|fueseis|fuesen|siendo|sido|tengo|tienes|tiene|tenemos|tenéis|tienen|tenga|tengas|tengamos|tengáis|tengan|tendré|tendrás|tendrá|tendremos|tendréis|tendrán|tendría|tendrías|tendríamos|tendríais|tendrían|tenía|tenías|teníamos|teníais|tenían|tuve|tuviste|tuvo|tuvimos|tuvisteis|tuvieron|tuviera|tuvieras|tuviéramos|tuvierais|tuvieran|tuviese|tuvieses|tuviésemos|tuvieseis|tuviesen|teniendo|tenido|tenida|tenidos|tenidas|tenid)\b/i.test(text)) return 'spanish';
  // English detection
  if (/\b(the|be|to|of|and|a|in|that|have|I|it|for|not|on|with|he|as|you|do|at|this|but|his|by|from|they|we|say|her|she|or|an|will|my|one|all|would|there|their|what|so|up|out|if|about|who|get|which|go|me|when|make|can|like|time|no|just|him|know|take|people|into|year|your|good|some|could|them|see|other|than|then|now|look|only|come|its|over|think|also|back|after|use|two|how|our|work|first|well|way|even|new|want|because|any|these|give|day|most|us)\b/i.test(text)) return 'english';
  
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════
// STEP 2: PERPLEXITY SYSTEM PROMPT (ESPAÑOL FORZADO)
// ═══════════════════════════════════════════════════════════════

const PERPLEXITY_SYSTEM_PROMPT = `🚨 INSTRUCCIONES CRÍTICAS DE IDIOMA (OBLIGATORIO):
1. Responder EXCLUSIVAMENTE en español neutro.
2. Si encuentras fuentes en otros idiomas, traduce al español.
3. NO incluyas texto en otros idiomas en tu respuesta.
4. La respuesta debe ser legible para un usuario chileno.

You are a sports data researcher with real-time web access.
Today is March 2026, season 2025/2026.
Search the web RIGHT NOW for this specific match.

CRITICAL REQUIREMENT: Return minimum 800 words of structured data IN SPANISH.
Include exact numbers for every stat.
Include exact scores for every recent match.
Include confirmed player names for every injury.

You MUST find and return ALL of these items.
For each item NOT found, write exactly: '[NO ENCONTRADO]'
NEVER skip an item. NEVER summarize vaguely.

Return a structured report in SPANISH with these exact sections:

## FORMA RECIENTE (últimos 5 partidos con marcadores exactos)
Local: [fecha] vs [rival] [marcador] | [fecha] vs [rival]...
Visitante: [fecha] vs [rival] [marcador]...

## LESIONADOS Y SUSPENDIDOS CONFIRMADOS
Local: [nombre jugador] - [lesión] - [fuente/fecha]
Visitante: [nombre jugador] - [lesión] - [fuente/fecha]
Si no hay: 'Plantilla completa confirmada'

## ESTADÍSTICAS AVANADAS 2025/2026
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
Responde SOLO en español con datos estructurados.`;

// ═══════════════════════════════════════════════════════════════
// STEP 3: CLAUDE SONNET 4 - REASONING PROMPT (ESPAÑOL FORZADO)
// ═══════════════════════════════════════════════════════════════

const CLAUDE_REASONING_PROMPT = `🚨 INSTRUCCIONES CRÍTICAS DE IDIOMA (OBLIGATORIO):
1. Toda tu respuesta debe ser EXCLUSIVAMENTE en ESPAÑOL NEUTRO.
2. Si el contexto contiene texto en chino, inglés u otro idioma:
   TRADUCE todo al español antes de analizar.
   Mantén nombres propios y números sin traducir.
3. NO incluyas NINGÚN texto en otros idiomas en tu respuesta.
4. La respuesta debe ser legible para un usuario chileno.

Eres Coco, analista cuantitativo de apuestas deportivas premium.
Hoy es Marzo 2026, temporada 2025/2026.

Estructura tu razonamiento en 5 pasos numerados:

1. EVALUACIÓN DE CUOTAS
   Calcular probabilidades implícitas:
   prob_implicita = 1 / cuota
   Normalizar por casa de apuestas.
   Identificar dónde la casa se equivoca más.

2. ANÁLISIS TÁCTICO (usar datos del contexto táctico)
   Lesionados, motivación, contexto de tabla, alineaciones.

3. ESTADÍSTICAS AVANZADAS (usar datos del contexto stats)
   xG, PPDA, forma reciente con marcadores exactos, H2H.

4. CÁLCULO DE EDGE Y KELLY
   prob_estimada = tu estimación real basada en datos
   EV = (prob_estimada × cuota) - 1
   kelly = (prob_estimada × cuota - 1) / (cuota - 1)
   Redondear a 2 decimales.

5. MEJOR PICK
   Identificar el mercado con más edge.
   Explicar por qué es superior a otros mercados.

Escribe mínimo 600 palabras en español.
Usa datos NUMÉRICOS concretos del contexto.
Si falta un dato: 'No disponible en contexto actual'.`;

// ═══════════════════════════════════════════════════════════════
// STEP 4: GROK 4.1 FAST - FORMATTING PROMPT (ESPAÑOL FORZADO)
// ═══════════════════════════════════════════════════════════════

const GROK_FORMATTING_PROMPT = `🚨 INSTRUCCIONES CRÍTICAS DE IDIOMA (OBLIGATORIO):
1. Convertir el análisis recibido al JSON EXACTO del schema.
2. TODOS los campos de texto deben estar en ESPAÑOL.
3. Si encuentras frases en chino/inglés en el razonamiento:
   TRADUCE al español antes de copiar al JSON.
4. NO incluir texto en otros idiomas en el JSON final.

Tu ÚNICA tarea es formatear. NO añadir nueva información.

Schema JSON requerido (copiar exactamente):

{
  "sport": "Football",
  "match": "nombre completo del partido",
  "data_quality": "alta|media|baja",
  "estimated_odds": false,
  "best_pick": {
    "market": "string en español",
    "selection": "string en español",
    "odds": number,
    "edge_percentage": number,
    "confidence_score": number,
    "tier": "A+|B",
    "kelly_stake_units": number,
    "value_bet": true|false,
    "analysis": {
      "pros": ["en español", "en español", "en español"],
      "cons": ["en español"],
      "conclusion": "texto completo EN ESPAÑOL, máximo 80 palabras"
    },
    "stats_highlights": {
      "metric_1": "stat en español",
      "metric_2": "stat en español", 
      "metric_3": "stat en español"
    }
  },
  "mercados_completos": {
    "resultado": {
      "seleccion": "en español",
      "prob_estimada": number,
      "prob_implicita_normalizada": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": true|false,
      "confidence_score": number,
      "analisis": "en español"
    },
    "total": {
      "seleccion": "over|under",
      "linea": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": true|false,
      "confidence_score": number,
      "analisis": "en español"
    },
    "ambos_anotan": {
      "seleccion": "yes|no",
      "prob_btts_estimada": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": true|false,
      "confidence_score": number,
      "analisis": "en español"
    },
    "corners": {
      "seleccion": "over|under|sin_cuota",
      "total_estimado": number,
      "linea": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": true|false,
      "confidence_score": number,
      "analisis": "en español"
    },
    "handicap": {
      "seleccion": "home|away|null",
      "linea": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": true|false,
      "confidence_score": number,
      "analisis": "en español"
    }
  },
  "picks_con_value": [
    {
      "market": "string en español",
      "selection": "string en español",
      "odds": number,
      "edge_percentage": number,
      "confidence_score": number,
      "tier": "A+|B"
    }
  ]
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
    // STEP 2: RESEARCH WITH PERPLEXITY (ESPAÑOL)
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
            { role: 'user', content: `${matchName}\nDeporte: ${sport}\nFecha: Marzo 2026\n\nResponde SOLO en español con datos estructurados.` }
          ],
          max_tokens: 2500
        })
      });

      if (perplexityRes.ok) {
        const pData = await perplexityRes.json();
        researchContext = pData.choices?.[0]?.message?.content || 'Sin contexto.';
        console.log(`✅ Research completado (${researchContext.length} chars)`);
        console.log(`🌐 Idioma detectado en research: ${detectLanguage(researchContext)}`);
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
    // STEP 3: CLAUDE SONNET 4 - FREE REASONING (ESPAÑOL FORZADO)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n🧠 STEP 3: Claude Sonnet 4 razonando en profundidad...');

    const oddsPayload = oddsData;
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
        model: 'anthropic/claude-sonnet-4',
        messages: [
          { role: 'system', content: CLAUDE_REASONING_PROMPT },
          { 
            role: 'user', 
            content: `${matchName} (${sport})

CUOTAS ACTUALES:
${oddsText}

CONTEXTO TÁCTICO Y SITUACIONAL:
${researchContext}

CONTEXTO ESTADÍSTICO Y H2H:
${researchContext}

Analiza paso a paso en ESPAÑOL.` 
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      })
    });

    let deepReasoningText = '';

    if (reasoningRes.ok) {
      const reasoningData = await reasoningRes.json();
      deepReasoningText = reasoningData.choices?.[0]?.message?.content || '';
      console.log(`✅ Razonamiento completado (${deepReasoningText.length} chars)`);
      console.log(`🌐 Idioma detectado en razonamiento: ${detectLanguage(deepReasoningText)}`);
    } else {
      const errText = await reasoningRes.text();
      console.log(`⚠️ Claude Reasoning error: ${reasoningRes.status}`);
      deepReasoningText = 'Razonamiento no disponible debido a un error en el modelo.';
    }

    // DEBUG LOG
    console.log('\n=== DEEP REASONING (first 500 chars) ===');
    console.log(deepReasoningText.substring(0, 500) + '...');

    // ═══════════════════════════════════════════════════════════════
    // CLEAN CHINESE/MARKDOWN FROM REASONING BEFORE FORMATTING
    // ═══════════════════════════════════════════════════════════════
    
    // Remove markdown code blocks that might contain Chinese
    let cleanedReasoning = deepReasoningText
      .replace(/```json[\s\S]*?```/gi, '')
      .replace(/```[\s\S]*?```/gi, '')
      .replace(/`[^`]+`/g, match => {
        // Keep inline code only if it doesn't contain Chinese
        return /[一-鿿]/.test(match) ? '' : match;
      })
      .trim();

    console.log(`🧹 Razonamiento limpiado: ${deepReasoningText.length} → ${cleanedReasoning.length} chars`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: GROK 4.1 FAST - FORMATTING (ESPAÑOL FORZADO)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n⚙️ STEP 4: Grok formateando el análisis final...');

    const formattingRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Format'
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast',
        messages: [
          { role: 'system', content: GROK_FORMATTING_PROMPT },
          { 
            role: 'user', 
            content: `Razonamiento recibido:
${cleanedReasoning}

Convierte EXACTAMENTE a este JSON en ESPAÑOL.
Traduce cualquier frase en otro idioma.` 
          }
        ],
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      })
    });

    if (!formattingRes.ok) {
      const errText = await formattingRes.text();
      throw new Error(`Grok Formatting error ${formattingRes.status}: ${errText.substring(0, 200)}`);
    }

    const formattingData = await formattingRes.json();
    
    // Check for OpenRouter API errors
    if (formattingData.error) {
      console.error('❌ OpenRouter API Error:', formattingData.error);
      throw new Error(`OpenRouter error: ${formattingData.error.message || JSON.stringify(formattingData.error)}`);
    }
    
    let content = formattingData.choices?.[0]?.message?.content || '';

    // DEBUG LOG
    console.log('\n=== FORMATTING RAW RESPONSE (first 500 chars) ===');
    console.log(content.substring(0, 500) + '...');

    // DEBUG LOG - ODDS PAYLOAD
    console.log('\n=== ODDS PAYLOAD ===');
    console.log(JSON.stringify(oddsPayload, null, 2));

    // Clean markdown if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Try to parse JSON safely
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ JSON Parse Error. Content received:');
      console.error(content.substring(0, 1000));
      
      // Return a fallback response with the raw analysis
      return res.status(200).json({
        sport: sport === 'football' ? 'Football' : sport === 'basketball' ? 'NBA' : 'MLB',
        match: matchName,
        data_quality: 'baja',
        estimated_odds: !oddsData,
        best_pick: {
          market: 'Análisis',
          selection: 'Ver detalles',
          odds: 1.85,
          edge_percentage: 0,
          confidence_score: 0.5,
          tier: 'B',
          kelly_stake_units: 0.05,
          value_bet: false,
          analysis: {
            pros: ['Análisis generado'],
            cons: ['Error en formato de respuesta'],
            conclusion: content.substring(0, 500) || 'El modelo no pudo generar un JSON válido. Revisa el contexto de investigación.'
          }
        },
        mercados_completos: {
          proyeccion_final: {
            resultado_probable: 'N/A',
            marcador_estimado: 'N/A',
            resumen: 'Error procesando la respuesta del modelo'
          }
        },
        picks_con_value: [],
        supporting_factors: [],
        risk_factors: ['Error en formato de respuesta del modelo'],
        oddsPayload: oddsPayload,
        researchContext: researchContext,
        deep_reasoning: deepReasoningText,
        timestamp: new Date().toISOString(),
        parse_error: true,
        raw_content: content.substring(0, 1000)
      });
    }

    // Add metadata
    result.oddsPayload = oddsPayload;
    result.researchContext = researchContext;
    result.deep_reasoning = deepReasoningText;
    result.timestamp = new Date().toISOString();
    result.sport = sport === 'football' ? 'Football' : sport === 'basketball' ? 'NBA' : 'MLB';
    result.estimated_odds = !oddsData;

    // Set data_quality based on research context
    if (researchContext.includes('[NO ENCONTRADO]') || researchContext.length < 300) {
      result.data_quality = result.data_quality || 'baja';
    } else if (researchContext.includes('xG') && researchContext.includes('LESIONADOS')) {
      result.data_quality = result.data_quality || 'alta';
    } else {
      result.data_quality = result.data_quality || 'media';
    }

    // Final language check
    const resultLanguage = detectLanguage(JSON.stringify(result));
    console.log(`🌐 Idioma detectado en resultado final: ${resultLanguage}`);

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
