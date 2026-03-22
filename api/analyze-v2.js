/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * COCO VIP - PIPELINE DE ANÁLISIS 5-STEP v4.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * STEP 1: The Odds API       → Cuotas en tiempo real + probabilidades normalizadas
 * STEP 2: PARALLEL RESEARCH  → Gemini 2.5 Pro + Sonar Pro + Sonar Pro Corners
 * STEP 3: Claude Sonnet 4.6  → Razonamiento profundo de 5 secciones
 * STEP 4: Grok 4.1 Fast      → Formateo JSON para UI
 * 
 * TODAS LAS RESPUESTAS VISIBLES EN ESPAÑOL NEUTRO
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detecta el idioma del texto
 */
function detectLanguage(text) {
  if (!text) return 'unknown';
  
  // Chinese detection
  if (/[一-鿿]/.test(text)) return 'chinese';
  // Japanese detection
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'japanese';
  // Korean detection
  if (/[\uAC00-\uD7AF]/.test(text)) return 'korean';
  // Spanish detection
  if (/\b(el|la|los|las|de|que|en|es|un|una|por|con|para|como|más|pero|sus|le|ya|o|este|sí|porque|esta|entre|cuando|muy|sin|sobre|también|me|hasta|hay|donde|quien|desde|todo|nos|durante|todos|uno|les|ni|contra|otros|ese|eso|ante|ellos|e|esto|mí|antes|algunos|qué|unos|yo|otro|otras|otra|él|tanto|esa|estos|mucho|quienes|nada|muchos|cual|poco|ella|estar|estas|algunas|algo|nosotros|mi|mis|tú|te|ti|tu|tus|ellas|nosotras|vosostros|vosostras|os|mío|mía|míos|mías|tuyo|tuya|tuyos|tuyas|suyo|suya|suyos|suyas|nuestro|nuestra|nuestros|nuestras|vuestro|vuestra|vuestros|vuestras|esos|esas|estoy|estás|está|estamos|estáis|están|esté|estés|estemos|estéis|estén|estaré|estarás|estará|estaremos|estaréis|estarán|estaría|estarías|estaríamos|estaríais|estarían|estaba|estabas|estábamos|estabais|estaban|estuve|estuviste|estuvo|estuvimos|estuvisteis|estuvieron|estuviera|estuvieras|estuviéramos|estuvierais|estuvieran|estuviese|estuvieses|estuviésemos|estuvieseis|estuviesen|estando|estado|estada|estados|estadas|estad|he|has|ha|hemos|habéis|han|haya|hayas|hayamos|hayáis|hayan|habré|habrás|habrá|habremos|habréis|habrán|habría|habrías|habríamos|habríais|habrían|había|habías|habíamos|habíais|habían|hube|hubiste|hubo|hubimos|hubisteis|hubieron|hubiera|hubieras|hubiéramos|hubierais|hubieran|hubiese|hubieses|hubiésemos|hubieseis|hubiesen|habiendo|habido|habida|habidos|habidas|soy|eres|es|somos|sois|son|sea|seas|seamos|seáis|sean|seré|serás|será|seremos|seréis|serán|sería|serías|seríamos|seríais|serían|era|eras|éramos|erais|eran|fui|fuiste|fue|fuimos|fuisteis|fueron|fuera|fueras|fuéramos|fuerais|fueran|fuese|fueses|fuésemos|fueseis|fuesen|siendo|sido|tengo|tienes|tiene|tenemos|tenéis|tienen|tenga|tengas|tengamos|tengáis|tengan|tendré|tendrás|tendrá|tendremos|tendréis|tendrán|tendría|tendrías|tendríamos|tendríais|tendrían|tenía|tenías|teníamos|teníais|tenían|tuve|tuviste|tuvo|tuvimos|tuvisteis|tuvieron|tuviera|tuvieras|tuviéramos|tuvierais|tuvieran|tuviese|tuvieses|tuviésemos|tuvieseis|tuviesen|teniendo|tenido|tenida|tenidos|tenidas|tenid)\b/i.test(text)) return 'spanish';
  // English detection
  if (/\b(the|be|to|of|and|a|in|that|have|I|it|for|not|on|with|he|as|you|do|at|this|but|his|by|from|they|we|say|her|she|or|an|will|my|one|all|would|there|their|what|so|up|out|if|about|who|get|which|go|me|when|make|can|like|time|no|just|him|know|take|people|into|year|your|good|some|could|them|see|other|than|then|now|look|only|come|its|over|think|also|back|after|use|two|how|our|work|first|well|way|even|new|want|because|any|these|give|day|most|us)\b/i.test(text)) return 'english';
  
  return 'unknown';
}

/**
 * Normaliza probabilidades implícitas
 */
function normalizeProbabilities(homeOdds, drawOdds, awayOdds) {
  if (!homeOdds || !awayOdds) return null;
  
  const homeProb = 1 / homeOdds;
  const drawProb = drawOdds ? 1 / drawOdds : 0;
  const awayProb = 1 / awayOdds;
  
  // Calcular margen de la casa
  const margin = (homeProb + drawProb + awayProb) - 1;
  
  // Normalizar
  const divisor = 1 + margin;
  
  return {
    home: Math.round((homeProb / divisor) * 1000) / 1000,
    draw: drawOdds ? Math.round((drawProb / divisor) * 1000) / 1000 : null,
    away: Math.round((awayProb / divisor) * 1000) / 1000,
    margin: Math.round(margin * 1000) / 1000
  };
}

/**
 * Validar y normalizar confidence_score (debe estar entre 0 y 1)
 */
function validateConfidenceScore(score) {
  if (typeof score !== 'number' || isNaN(score)) return 0.5;
  
  // Si viene en escala 0-10, convertir a 0-1
  if (score > 1) {
    score = score / 10;
  }
  
  // Clamp entre 0 y 1
  score = Math.max(0, Math.min(1, score));
  
  // Redondear a 2 decimales
  return Math.round(score * 100) / 100;
}

/**
 * Determinar tier basado en edge y confidence
 */
function determineTier(edgePercentage, confidenceScore) {
  const edge = parseFloat(edgePercentage) || 0;
  const conf = parseFloat(confidenceScore) || 0;
  
  if (edge >= 8 && conf >= 0.7) return 'A+';
  if (edge >= 4 && conf >= 0.5) return 'B';
  return 'B';
}

/**
 * Determinar calidad de datos
 */
function determineDataQuality(researchContext, oddsPayload, cornersData) {
  let score = 0;
  
  // Verificar contenido del research
  if (researchContext.includes('xG') || researchContext.includes('xGA')) score += 2;
  if (researchContext.includes('LESIONAD') || researchContext.includes('lesionad')) score += 1;
  if (researchContext.includes('CLASIFICACIÓN') || researchContext.includes('clasificación')) score += 1;
  if (researchContext.includes('HEAD TO HEAD') || researchContext.includes('H2H')) score += 1;
  if (!researchContext.includes('DATO NO ENCONTRADO')) score += 1;
  if (researchContext.length > 800) score += 1;
  
  // Verificar cuotas reales
  if (oddsPayload && !oddsPayload.estimated_odds && oddsPayload.h2h?.home) score += 2;
  
  // Verificar datos de corners
  if (cornersData && cornersData.corners_local_casa !== null) score += 1;
  
  if (score >= 8) return 'alta';
  if (score >= 5) return 'media';
  return 'baja';
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1: THE ODDS API - CUOTAS EN TIEMPO REAL
// ═══════════════════════════════════════════════════════════════════════════════

const SPORT_KEY_MAP = {
  football: [
    'soccer_spain_la_liga',
    'soccer_epl',
    'soccer_italy_serie_a',
    'soccer_germany_bundesliga',
    'soccer_france_ligue_one',
    'soccer_uefa_champs_league',
    'soccer_uefa_europa_league',
    'soccer_portugal_primeira_liga',
    'soccer_netherlands_eredivisie'
  ],
  basketball: ['basketball_nba'],
  baseball: ['baseball_mlb']
};

async function fetchOdds(matchName, sport, oddsApiKey) {
  console.log('\n📊 STEP 1: Obteniendo cuotas en tiempo real...');
  
  if (!oddsApiKey) {
    console.log('⚠️ ODDS_API_KEY no configurada, usando cuotas estimadas');
    return {
      match: matchName,
      commence_time: null,
      estimated_odds: true,
      h2h: { home: null, draw: null, away: null, probs_normalizadas: null },
      totals: { line: null, over: null, under: null }
    };
  }

  const teams = matchName.toLowerCase().split(/\s+vs\s+|\s+v\s+/);
  const sportKeys = SPORT_KEY_MAP[sport] || [];

  for (const sportKey of sportKeys) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${oddsApiKey}&regions=eu&markets=h2h,totals&oddsFormat=decimal&bookmakers=bet365,pinnacle`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log(`⚠️ Odds API error for ${sportKey}: ${response.status}`);
        continue;
      }
      
      const games = await response.json();
      
      // Buscar partido por fuzzy match
      const match = games.find(g => {
        const home = (g.home_team || '').toLowerCase();
        const away = (g.away_team || '').toLowerCase();
        const team1 = teams[0]?.trim() || '';
        const team2 = teams[1]?.trim() || '';
        
        return (
          (home.includes(team1) || team1.includes(home)) &&
          (away.includes(team2) || team2.includes(away))
        ) || (
          (home.includes(team2) || team2.includes(home)) &&
          (away.includes(team1) || team1.includes(away))
        );
      });

      if (match) {
        const bookmaker = match.bookmakers?.[0];
        const h2hMarket = bookmaker?.markets?.find(m => m.key === 'h2h');
        const totalsMarket = bookmaker?.markets?.find(m => m.key === 'totals');

        const homeOdds = h2hMarket?.outcomes?.find(o => 
          o.name === match.home_team || o.name.toLowerCase().includes(teams[0])
        )?.price || null;
        
        const drawOdds = h2hMarket?.outcomes?.find(o => o.name === 'Draw')?.price || null;
        
        const awayOdds = h2hMarket?.outcomes?.find(o => 
          o.name === match.away_team || o.name.toLowerCase().includes(teams[1])
        )?.price || null;

        const probs = normalizeProbabilities(homeOdds, drawOdds, awayOdds);

        const oddsPayload = {
          match: `${match.home_team} vs ${match.away_team}`,
          commence_time: match.commence_time,
          estimated_odds: false,
          h2h: {
            home: homeOdds,
            draw: drawOdds,
            away: awayOdds,
            probs_normalizadas: probs
          },
          totals: totalsMarket ? {
            line: totalsMarket.outcomes?.[0]?.point || null,
            over: totalsMarket.outcomes?.find(o => o.name === 'Over')?.price || null,
            under: totalsMarket.outcomes?.find(o => o.name === 'Under')?.price || null
          } : { line: null, over: null, under: null }
        };

        console.log(`✅ Cuotas encontradas: ${oddsPayload.match}`);
        console.log(`   📊 1X2: ${homeOdds} | ${drawOdds} | ${awayOdds}`);
        console.log(`   📊 Probabilidades normalizadas: L:${probs?.home} E:${probs?.draw} V:${probs?.away}`);
        console.log(`   📊 Margen de casa: ${(probs?.margin * 100).toFixed(1)}%`);

        return oddsPayload;
      }
    } catch (e) {
      console.log(`⚠️ Error fetching ${sportKey}:`, e.message);
    }
  }

  console.log('⚠️ No se encontraron cuotas reales, usando estimadas');
  return {
    match: matchName,
    commence_time: null,
    estimated_odds: true,
    h2h: { home: null, draw: null, away: null, probs_normalizadas: null },
    totals: { line: null, over: null, under: null }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2: PARALLEL RESEARCH (Gemini 2.5 Pro + Sonar Pro + Sonar Pro Corners)
// ═══════════════════════════════════════════════════════════════════════════════

const GEMINI_SYSTEM_PROMPT = `════════════════════════════════════════════════════════════════
🚨 REGLA CRÍTICA PARA LIGAS SUDAMERICANAS:
════════════════════════════════════════════════════════════════
Si el partido es de Argentina, Brasil, Chile, Colombia, Uruguay o Paraguay, buscar en español usando estas fuentes específicas:

Para Argentina (Liga Profesional):
- Query: '[equipo] últimos partidos Liga Profesional 2026 site:espn.com.ar'
- Query: '[equipo] forma reciente resultados site:infobae.com'
- Query: '[equipo] [rival] previa fecha site:ole.com.ar'
- Query: '[equipo] clasificación tabla posiciones Liga Profesional Argentina 2026'

Para Brasil (Brasileirão):
- Query: '[equipo] últimos jogos Brasileirão 2026 site:ge.globo.com'
- Query: '[equipo] classificação tabela Brasileirão 2026'

Para Chile (Primera División):
- Query: '[equipo] últimos partidos Primera División Chile 2026'
- Query: '[equipo] clasificación tabla Chile 2026 site:latercera.com'

Fuentes prioritarias para Sudamérica:
1. espn.com.ar / espn.com.br
2. ole.com.ar
3. infobae.com
4. tycsports.com
5. ge.globo.com (Brasil)
6. latercera.com (Chile)
7. livefutbol.com
8. bdfa.com.ar (historial H2H Argentina)

⚠️ IMPORTANTE: Las búsquedas en inglés para ligas sudamericanas devuelven resultados vacíos. Siempre buscar en español para estas ligas.
════════════════════════════════════════════════════════════════

🚨 IDIOMA: Responde EXCLUSIVAMENTE en español neutro.
Traduce cualquier fuente en otro idioma al español.
Nunca mezcles idiomas en la respuesta.

Eres un investigador deportivo con acceso web en tiempo real.
Busca información ACTUAL sobre el partido indicado.
Hoy es Marzo 2026. Solo datos de temporada 2025/2026.
NUNCA inventes datos. Si no encuentras algo escribe: 'DATO NO ENCONTRADO'.
No incluyas tu proceso de razonamiento, solo el reporte final.

Formato de respuesta usando árbol ├── └──:

📋 SECCIÓN A — FORMA Y CONTEXTO

1. FORMA RECIENTE (últimos 5 partidos de CADA equipo)
   ├── Local: [fecha] vs [rival] [marcador] | [nota táctica breve]
   └── Visitante: [fecha] vs [rival] [marcador] | [nota táctica breve]

2. CLASIFICACIÓN ACTUAL
   ├── Local: [posición]º con [puntos] pts en [nombre de la liga]
   └── Visitante: [posición]º con [puntos] pts en [nombre de la liga]

3. HEAD TO HEAD (últimos 3 enfrentamientos oficiales)
   └── [fecha] [local] [marcador] [visitante] | [competición]

4. MOTIVACIÓN Y CONTEXTO
   └── [pelea por título / descenso / Champions / rotaciones / etc]

5. NOTICIAS RELEVANTES (últimas 48h)
   └── [fecha] — [titular en español] — [fuente]`;

const SONAR_SYSTEM_PROMPT = `Eres un investigador deportivo experto. DEBES hacer búsquedas profundas y multi-step para cada dato.
NO respondas con 'DATO NO ENCONTRADO' sin haber buscado en mínimo 5 URLs distintas.
Responde TODO en español.

🚨 IDIOMA: Responde EXCLUSIVAMENTE en español neutro.

Eres un investigador OSINT deportivo de nivel senior.
Especialidad: estadísticas avanzadas y lesiones confirmadas.
Hoy es Marzo 2026. Solo datos de temporada 2025/2026.

Formato de respuesta usando árbol ├── └──:

📋 SECCIÓN B — ESTADÍSTICAS AVANZADAS Y LESIONES

1. LESIONADOS Y SUSPENDIDOS CONFIRMADOS
   ├── Local: [jugador] - [lesión/estado] - [fuente/fecha]
   └── Visitante: [jugador] - [lesión/estado] - [fuente/fecha]

2. ESTADÍSTICAS AVANZADAS 2025/2026
   ├── xG local (promedio por partido): [número o 'DATO NO ENCONTRADO']
   ├── xGA local (promedio por partido): [número o 'DATO NO ENCONTRADO']
   ├── xG visitante (promedio por partido): [número o 'DATO NO ENCONTRADO']
   └── xGA visitante (promedio por partido): [número o 'DATO NO ENCONTRADO']

3. ESTADÍSTICAS DE GOLES (temporada 2025/2026)
   ├── Promedio goles marcados local: [número]
   ├── Promedio goles recibidos local: [número]
   ├── Promedio goles marcados visitante: [número]
   └── Promedio goles recibidos visitante: [número]

4. BTTS Y OVER/UNDER (temporada actual)
   ├── % partidos con BTTS local: [número]%
   └── % partidos Over 2.5 local: [número]%`;

const CORNERS_SYSTEM_PROMPT = `Eres un extractor de datos deportivos especializado.
Tu única tarea es encontrar estadísticas de corners.
Devuelve SOLO JSON válido, sin texto adicional, sin markdown, sin explicaciones.
Si no encuentras un dato, usa null como valor.
El JSON debe ser parseable por JSON.parse() directamente.

════════════════════════════════════════════════════════════════
REGLA PARA LIGAS SUDAMERICANAS (Argentina, Brasil, Chile, etc):
════════════════════════════════════════════════════════════════
Si el dato de corners del equipo visitante fuera de casa no aparece, buscar en:
- Query: '[equipo visitante] corners visitante promedio 2026 site:sofascore.com'
- Query: '[equipo visitante] corners away per game Argentina 2026'
- Query: '[equipo visitante] corners estadísticas site:livefutbol.com'
- Query: '[equipo] corners por partido site:promiedos.com.ar'

REGLA DE ESTIMACIÓN:
Si solo encuentras corners en casa del local pero no fuera del visitante:
suma_estimada = corners_local_casa × 1.6 (factor estándar para ligas sudamericanas)
Y marcar tendencia como 'Estimado' en vez de null o 'Sin datos'.
════════════════════════════════════════════════════════════════`;

async function runParallelResearch(matchName, sport, openrouterKey) {
  console.log('\n📡 STEP 2: Investigación paralela (Gemini + Sonar Pro + Corners)...');
  
  const teams = matchName.split(/\s+vs\s+|\s+v\s+|\s*-vs-\s*|\s*-v-\s*/i);
  const homeTeam = teams[0]?.trim() || '';
  const awayTeam = teams[1]?.trim() || '';

  try {
    // STEP 2 — BÚSQUEDA PARALELA (Gemini 2.5 Pro + Sonar Pro + Sonar Pro Corners)
    const [researchA, researchB, researchC] = await Promise.all([

      // STEP 2A: Gemini 2.5 Pro (forma, clasificación, noticias)
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro-exp-03-25",
          max_tokens: 2000,
          temperature: 0.1,
          messages: [
            { role: "system", content: GEMINI_SYSTEM_PROMPT },
            { role: "user", content: `Busca en tiempo real el partido: ${matchName}\nDeporte: ${sport}. Fecha: Marzo 2026.\nResponde SOLO en español con la estructura pedida.` }
          ]
        })
      }).then(r => r.json())
        .then(r => r.choices?.[0]?.message?.content ?? "Sin datos de contexto")
        .catch(() => "Sin datos de contexto (error Gemini)"),

      // STEP 2B: Perplexity Sonar Pro (estadísticas avanzadas)
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          max_tokens: 1500,
          temperature: 0.1,
          messages: [
            { role: "system", content: SONAR_SYSTEM_PROMPT },
            { role: "user", content: `Investiga estadísticas avanzadas y lesiones para: ${matchName}\nDeporte: ${sport}. Fecha: Marzo 2026.\nResponde SOLO en español con la estructura pedida.` }
          ]
        })
      }).then(r => r.json())
        .then(r => r.choices?.[0]?.message?.content ?? "Sin datos estadísticos")
        .catch(() => "Sin datos estadísticos (error Sonar Pro)"),

      // STEP 2C: Sonar Pro DEDICADO A CORNERS (JSON exclusivo)
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          max_tokens: 500,
          temperature: 0.1,
          messages: [
            { role: "system", content: CORNERS_SYSTEM_PROMPT },
            { role: "user", content: `Busca SOLO estadísticas de corners de estos equipos en la temporada 2025/2026:
- Equipo local: ${homeTeam}
- Equipo visitante: ${awayTeam}

Queries a ejecutar (EN ESPAÑOL para ligas sudamericanas):
1. '${homeTeam} corners por partido 2026'
2. '${awayTeam} corners por partido 2026'
3. '${homeTeam} corner statistics sofascore'
4. '${awayTeam} corner statistics sofascore'
5. '${homeTeam} corners site:livefutbol.com'
6. '${awayTeam} corners site:livefutbol.com'
7. '${homeTeam} corners site:promiedos.com.ar' (para Argentina)
8. '${awayTeam} corners site:promiedos.com.ar' (para Argentina)

Fuentes prioritarias:
- sofascore.com
- livefutbol.com
- promiedos.com.ar (Argentina)
- whoscored.com
- fbref.com
- footystats.org

Responde SOLO con este formato JSON (sin markdown):
{
  "corners_local_casa": <número o null>,
  "corners_visitante_fuera": <número o null>,
  "suma_estimada": <número o null>,
  "linea_recomendada": "9.5" o "10.5" o null,
  "tendencia": "Over" o "Under" o "Estimado" o "Sin datos",
  "fuente": "<URL>"
}

Si solo encuentras corners del local pero no del visitante, calcular suma_estimada = corners_local_casa × 1.6` }
          ]
        })
      }).then(r => r.json())
        .then(r => {
          const content = r.choices?.[0]?.message?.content ?? "";
          try {
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleanContent);
            return { ...parsed, raw_response: content };
          } catch {
            return {
              corners_local_casa: null,
              corners_visitante_fuera: null,
              suma_estimada: null,
              linea_recomendada: null,
              tendencia: 'Sin datos',
              fuente: null,
              raw_response: content
            };
          }
        })
        .catch(() => ({
          corners_local_casa: null,
          corners_visitante_fuera: null,
          suma_estimada: null,
          linea_recomendada: null,
          tendencia: 'Sin datos',
          fuente: null,
          raw_response: 'Error en llamada corners'
        }))

    ]);

    // Procesar datos de corners
    const cornersData = researchC;
    const hasCorners = cornersData && cornersData.corners_local_casa !== null;

    // Construir sección de corners
    let cornersSection = '';
    if (hasCorners) {
      cornersSection = `
═══════════════════════════════════════════════
SECCIÓN C: ESTADÍSTICAS DE CORNERS (EXCLUSIVO)
(Fuente: Sonar Pro - Búsqueda Dedicada)
═══════════════════════════════════════════════

CORNERS 2025/2026:
├── ${homeTeam} corners en casa: ${cornersData.corners_local_casa}/partido
├── ${awayTeam} corners fuera: ${cornersData.corners_visitante_fuera}/partido
├── Suma estimada: ${cornersData.suma_estimada}
├── Línea recomendada: ${cornersData.linea_recomendada || 'Sin definir'}
├── Tendencia: ${cornersData.tendencia}
└── Fuente: ${cornersData.fuente || 'No especificada'}
`;
      console.log(`✅ Corners data: ${homeTeam}=${cornersData.corners_local_casa}, ${awayTeam}=${cornersData.corners_visitante_fuera}`);
    } else {
      cornersSection = `
═══════════════════════════════════════════════
SECCIÓN C: ESTADÍSTICAS DE CORNERS
═══════════════════════════════════════════════

Datos de corners no encontrados en búsqueda dedicada.
Usar información de Sección B como alternativa.
`;
      console.log('⚠️ Corners data: No disponible');
    }

    // Combinar las tres respuestas
    const researchContext = `
═══════════════════════════════════════════════
SECCIÓN A: FORMA, CLASIFICACIÓN Y CONTEXTO
(Fuente: Gemini 2.5 Pro con Google Search)
═══════════════════════════════════════════════

${researchA}

═══════════════════════════════════════════════
SECCIÓN B: ESTADÍSTICAS AVANZADAS Y LESIONES
(Fuente: Perplexity Sonar Pro)
═══════════════════════════════════════════════

${researchB}
${cornersSection}
`;

    console.log(`✅ Parallel research completado (${researchContext.length} caracteres)`);
    console.log(`📊 Corners: ${hasCorners ? '✅ Encontrado' : '⚠️ No disponible'}`);

    return { researchContext, cornersData };

  } catch (error) {
    console.log('⚠️ Research error:', error.message);
    return { 
      researchContext: 'Contexto de investigación no disponible.', 
      cornersData: null 
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3: CLAUDE SONNET 4.6 - RAZONAMIENTO PROFUNDO
// ═══════════════════════════════════════════════════════════════════════════════

const CLAUDE_SYSTEM_PROMPT = `🚨 INSTRUCCIONES CRÍTICAS DE IDIOMA:
- Toda tu respuesta debe estar en español neutro.
- Traduce cualquier dato del contexto que no esté en español.
- Prohibido devolver texto en chino o inglés.

Eres Coco, analista cuantitativo de apuestas deportivas premium.
Hoy es Marzo 2026. Solo debes considerar datos de la temporada 2025/2026 (más H2H histórico reciente cuando se indique).

Tu objetivo es evaluar si existe una apuesta con 'value' claro y cuánto apostar usando criterio de Kelly.

Estructura tu razonamiento en 5 secciones numeradas:

1. EVALUACIÓN DE CUOTAS
   - Resume las cuotas recibidas (1X2, totales, hándicap).
   - Usa las probabilidades implícitas y normalizadas enviadas por la API.
   - Explica en qué mercados la casa parece equivocarse más.

2. ANÁLISIS TÁCTICO
   - Lesionados y sancionados clave.
   - Cambios de alineación relevantes.
   - Contexto de tabla y motivación.
   - Ventaja de localía y estilo de juego.

3. ESTADÍSTICAS AVANZADAS
   - xG y xGA de ambos equipos (promedios liga).
   - Forma reciente con marcadores exactos.
   - PPDA y presión.
   - H2H reciente (máx 2 temporadas).
   - Conecta datos con mercados: goles, BTTS, hándicap.

4. CÁLCULO DE PROBABILIDADES, EDGE Y KELLY
   - Elige 2–3 mercados candidatos (por ejemplo: 1X2, Over/Under, ambos anotan, hándicap).
   - Para cada mercado:
     • Asigna prob_estimada basada en los datos.
     • Calcula EV = (prob_estimada × cuota) - 1.
     • Calcula kelly = (prob_estimada × cuota - 1) / (cuota - 1).
   - Escribe los cálculos numéricos de al menos UN mercado paso a paso, con números explícitos.

5. MEJOR PICK (SNIPER)
   - Elige el mercado con mejor combinación de: edge >= 3%, prob_estimada razonable y contexto alineado.
   - Explica por qué ese pick es mejor que los otros candidatos.
   - Indica stake recomendado en unidades de Kelly (máximo 0.25).
   - Enumera exactamente 3 PROS concretos y 1 CONTRA claro.

🚨 REGLA CRÍTICA DE ESCALA DE CONFIANZA:
- Cuando menciones "confidence" o "confianza", usa SIEMPRE escala de 0.0 a 1.0.
- Ejemplo correcto: "Confianza: 0.75" (equivalente a 7.5/10).
- NUNCA uses valores mayores a 1.0 para confianza.`;

async function runClaudeReasoning(matchName, sport, oddsPayload, researchContext, openrouterKey) {
  console.log('\n🧠 STEP 3: Claude Sonnet 4.6 razonando en profundidad...');
  
  const oddsText = oddsPayload.estimated_odds 
    ? 'CUOTAS ESTIMADAS (no disponibles en tiempo real). Basa tus estimaciones en el contexto del partido.'
    : `CUOTAS ACTUALES:
1X2: Local ${oddsPayload.h2h?.home || 'N/A'} | Empate ${oddsPayload.h2h?.draw || 'N/A'} | Visitante ${oddsPayload.h2h?.away || 'N/A'}
Probabilidades normalizadas: Local ${(oddsPayload.h2h?.probs_normalizadas?.home * 100)?.toFixed(1) || 'N/A'}% | Empate ${(oddsPayload.h2h?.probs_normalizadas?.draw * 100)?.toFixed(1) || 'N/A'}% | Visitante ${(oddsPayload.h2h?.probs_normalizadas?.away * 100)?.toFixed(1) || 'N/A'}%
Totales: Línea ${oddsPayload.totals?.line || 'N/A'} | Over ${oddsPayload.totals?.over || 'N/A'} | Under ${oddsPayload.totals?.under || 'N/A'}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Reasoning'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.6',
        messages: [
          { role: 'system', content: CLAUDE_SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `Partido: ${matchName}
Deporte: ${sport}

${oddsText}

CONTEXTO INVESTIGADO:
${researchContext}

Redacta tu razonamiento completo siguiendo las 5 secciones, EN ESPAÑOL, mínimo 600 palabras.`
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`⚠️ Claude error: ${response.status}`);
      return 'Razonamiento no disponible debido a error en el modelo. Por favor intenta nuevamente.';
    }

    const data = await response.json();
    const deepReasoning = data.choices?.[0]?.message?.content || '';
    
    console.log(`✅ Razonamiento completado (${deepReasoning.length} caracteres)`);
    console.log(`🌐 Idioma detectado: ${detectLanguage(deepReasoning)}`);
    
    return deepReasoning;

  } catch (error) {
    console.log('⚠️ Claude error:', error.message);
    return 'Razonamiento no disponible debido a error de conexión.';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 4: GROK 4.1 FAST - FORMATEO JSON
// ═══════════════════════════════════════════════════════════════════════════════

const GROK_SYSTEM_PROMPT = `🚨 INSTRUCCIONES CRÍTICAS DE IDIOMA:
- El JSON final debe contener SOLO texto en español.
- Si el razonamiento trae frases en otro idioma, TRADÚCELAS al español antes de escribir el JSON.

Eres un formateador estricto. Recibirás un análisis largo y debes convertirlo al SIGUIENTE SCHEMA JSON:

{
  "sport": "string",
  "match": "string",
  "data_quality": "alta | media | baja",
  "estimated_odds": boolean,
  "best_pick": {
    "market": "string en español",
    "selection": "string en español",
    "odds": number,
    "edge_percentage": number,
    "confidence_score": number (ENTRE 0 Y 1, NUNCA mayor),
    "tier": "A+ | B",
    "kelly_stake_units": number,
    "value_bet": boolean,
    "analysis": {
      "pros": ["string", "string", "string"],
      "cons": ["string"],
      "conclusion": "string de 60-100 palabras en español"
    },
    "stats_highlights": {
      "metric_1": "string",
      "metric_2": "string",
      "metric_3": "string"
    }
  },
  "mercados_completos": {
    "resultado": {
      "seleccion": "string",
      "prob_estimada": number,
      "prob_implicita_normalizada": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": boolean,
      "confidence_score": number (ENTRE 0 Y 1),
      "analisis": "string"
    },
    "total": {
      "seleccion": "over | under",
      "linea": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": boolean,
      "confidence_score": number (ENTRE 0 Y 1),
      "analisis": "string"
    },
    "ambos_anotan": {
      "seleccion": "yes | no",
      "prob_btts_estimada": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": boolean,
      "confidence_score": number (ENTRE 0 Y 1),
      "analisis": "string"
    },
    "corners": {
      "seleccion": "over | under | sin_cuota",
      "total_estimado": number,
      "linea": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": boolean,
      "confidence_score": number (ENTRE 0 Y 1),
      "analisis": "string"
    },
    "handicap": {
      "seleccion": "home | away | null",
      "linea": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": boolean,
      "confidence_score": number (ENTRE 0 Y 1),
      "analisis": "string"
    }
  },
  "picks_con_value": [
    {
      "market": "string",
      "selection": "string",
      "odds": number,
      "edge_percentage": number,
      "confidence_score": number (ENTRE 0 Y 1),
      "tier": "A+ | B"
    }
  ]
}

🚨 REGLAS CRÍTICAS:
1. confidence_score SIEMPRE debe ser un número entre 0 y 1 (ej: 0.75, nunca 75 ni 7.5).
2. NO inventes números que no aparezcan en el razonamiento.
3. Si falta un dato, usa null o cadena vacía.
4. Elige como best_pick el mismo pick que el razonamiento marca como mejor apuesta.
5. Mantén coherentes odds, edge y kelly con lo descrito en el razonamiento.`;

async function runGrokFormatting(deepReasoning, matchName, sport, oddsPayload, openrouterKey) {
  console.log('\n⚙️ STEP 4: Grok 4.1 Fast formateando el análisis final...');
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Format'
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4.1-fast',
        messages: [
          { role: 'system', content: GROK_SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `Análisis completo del analista (en español):

${deepReasoning}

CUOTAS DISPONIBLES:
${JSON.stringify(oddsPayload, null, 2)}

Convierte este análisis al JSON con el schema indicado. Devuelve ÚNICAMENTE JSON válido (sin markdown).`
          }
        ],
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok error ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    
    // Check for OpenRouter errors
    if (data.error) {
      throw new Error(`OpenRouter error: ${data.error.message || JSON.stringify(data.error)}`);
    }
    
    let content = data.choices?.[0]?.message?.content || '';
    
    // Clean markdown if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ JSON Parse Error');
      throw new Error('El modelo no pudo generar un JSON válido');
    }

    console.log('✅ Formateo completado');
    return result;

  } catch (error) {
    console.error('❌ Grok error:', error.message);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIÓN Y POST-PROCESAMIENTO DEL JSON
// ═══════════════════════════════════════════════════════════════════════════════

function validateAndFixResult(result, matchName, sport, oddsPayload, researchContext, cornersData) {
  // Asegurar campos básicos
  result.sport = result.sport || (sport === 'football' ? 'Football' : sport === 'basketball' ? 'NBA' : 'MLB');
  result.match = result.match || matchName;
  result.estimated_odds = oddsPayload?.estimated_odds ?? true;
  result.data_quality = result.data_quality || determineDataQuality(researchContext, oddsPayload, cornersData);

  // Validar best_pick
  if (result.best_pick) {
    result.best_pick.confidence_score = validateConfidenceScore(result.best_pick.confidence_score);
    result.best_pick.tier = result.best_pick.tier || determineTier(result.best_pick.edge_percentage, result.best_pick.confidence_score);
    result.best_pick.kelly_stake_units = Math.min(result.best_pick.kelly_stake_units || 0.05, 0.25);
    result.best_pick.value_bet = result.best_pick.edge_percentage >= 3;
    
    // Asegurar arrays
    result.best_pick.analysis = result.best_pick.analysis || {};
    result.best_pick.analysis.pros = result.best_pick.analysis.pros || ['Análisis disponible'];
    result.best_pick.analysis.cons = result.best_pick.analysis.cons || ['Consultar detalles'];
    result.best_pick.analysis.conclusion = result.best_pick.analysis.conclusion || 'Revisar razonamiento completo para detalles.';
    result.best_pick.stats_highlights = result.best_pick.stats_highlights || {};
  }

  // Validar mercados_completos
  if (result.mercados_completos) {
    Object.keys(result.mercados_completos).forEach(market => {
      const m = result.mercados_completos[market];
      if (m && typeof m === 'object') {
        m.confidence_score = validateConfidenceScore(m.confidence_score);
        m.value_bet = m.edge_percentage >= 3;
      }
    });
  }

  // Agregar datos de corners si están disponibles
  if (cornersData && cornersData.corners_local_casa !== null) {
    if (!result.mercados_completos) result.mercados_completos = {};
    if (!result.mercados_completos.corners) result.mercados_completos.corners = {};
    
    result.mercados_completos.corners.total_estimado = cornersData.suma_estimada || result.mercados_completos.corners.total_estimado;
    result.mercados_completos.corners.linea = cornersData.linea_recomendada ? parseFloat(cornersData.linea_recomendada) : result.mercados_completos.corners.linea;
    result.mercados_completos.corners.seleccion = cornersData.tendencia === 'Over' ? 'over' : cornersData.tendencia === 'Under' ? 'under' : result.mercados_completos.corners.seleccion;
  }

  // Validar picks_con_value
  if (result.picks_con_value && Array.isArray(result.picks_con_value)) {
    result.picks_con_value = result.picks_con_value.map(pick => ({
      ...pick,
      confidence_score: validateConfidenceScore(pick.confidence_score),
      tier: pick.tier || determineTier(pick.edge_percentage, pick.confidence_score)
    }));
  }

  // Agregar arrays de soporte si no existen
  result.supporting_factors = result.supporting_factors || [];
  result.risk_factors = result.risk_factors || [];

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

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
    return res.status(400).json({ error: 'matchName es requerido' });
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🎯 COCO VIP PIPELINE 5-STEP v4.0`);
  console.log(`📌 Partido: ${matchName}`);
  console.log(`🏈 Deporte: ${sport}`);
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log(`${'═'.repeat(70)}`);

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const ODDS_API_KEY = process.env.ODDS_API_KEY;

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: 'OPENROUTER_API_KEY no configurada',
      hint: 'Agrega OPENROUTER_API_KEY en las variables de entorno de Vercel'
    });
  }

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: THE ODDS API
    // ═══════════════════════════════════════════════════════════════════════════
    const oddsPayload = await fetchOdds(matchName, sport, ODDS_API_KEY);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: PARALLEL RESEARCH (Gemini 2.5 Pro + Sonar Pro + Sonar Pro Corners)
    // ═══════════════════════════════════════════════════════════════════════════
    const { researchContext, cornersData } = await runParallelResearch(matchName, sport, OPENROUTER_API_KEY);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: CLAUDE SONNET 4.6
    // ═══════════════════════════════════════════════════════════════════════════
    const deepReasoning = await runClaudeReasoning(matchName, sport, oddsPayload, researchContext, OPENROUTER_API_KEY);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: GROK 4.1 FAST
    // ═══════════════════════════════════════════════════════════════════════════
    let result = await runGrokFormatting(deepReasoning, matchName, sport, oddsPayload, OPENROUTER_API_KEY);

    // ═══════════════════════════════════════════════════════════════════════════
    // VALIDACIÓN Y POST-PROCESAMIENTO
    // ═══════════════════════════════════════════════════════════════════════════
    result = validateAndFixResult(result, matchName, sport, oddsPayload, researchContext, cornersData);

    // Agregar metadata
    result.oddsPayload = oddsPayload;
    result.researchContext = researchContext;
    result.deep_reasoning = deepReasoning;
    result.cornersData = cornersData;
    result.timestamp = new Date().toISOString();

    // Log final
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ PIPELINE 5-STEP COMPLETADO`);
    console.log(`📌 Best Pick: ${result.best_pick?.selection} en ${result.best_pick?.market}`);
    console.log(`💰 Odds: ${result.best_pick?.odds}`);
    console.log(`📈 Edge: ${result.best_pick?.edge_percentage}%`);
    console.log(`🎯 Confidence: ${result.best_pick?.confidence_score} (${Math.round(result.best_pick?.confidence_score * 10)}/10)`);
    console.log(`🏷️ Tier: ${result.best_pick?.tier}`);
    console.log(`📊 Data Quality: ${result.data_quality}`);
    console.log(`📊 Corners: ${cornersData?.corners_local_casa || 'No disponible'}`);
    console.log(`🌐 Idioma final: ${detectLanguage(JSON.stringify(result))}`);
    console.log(`${'═'.repeat(70)}\n`);

    return res.status(200).json(result);

  } catch (error) {
    console.error('\n❌ PIPELINE ERROR:', error);
    
    return res.status(500).json({
      error: 'Error en el pipeline de análisis',
      message: error.message,
      match: matchName,
      sport,
      timestamp: new Date().toISOString()
    });
  }
}
