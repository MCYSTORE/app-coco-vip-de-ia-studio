/**
 * Coco VIP - AI-Driven Match Analysis Pipeline
 * 
 * 4-Step Pipeline:
 * 1. The Odds API - Real-time odds from major bookmakers
 * 2. Parallel Research (Gemini 2.5 Pro + Perplexity Sonar Pro) - Live web data in parallel
 * 3. Claude Sonnet 4.6 - Quant/Sniper agent for value calculation
 * 4. Grok 4.1 Fast - Final validation and formatting
 */

// ═══════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface OddsPayload {
  match: string;
  commence_time: string;
  bookmakers: {
    h2h: { home: number; draw: number | null; away: number };
    totals: { line: number; over: number; under: number } | null;
    spreads: { point: number; home: number; away: number } | null;
  };
}

export interface AnalysisStep {
  step: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  icon: string;
  message: string;
  progress: number;
  warning?: string;
}

export interface AnalysisState {
  currentStep: number;
  steps: AnalysisStep[];
  result: AnalysisResult | null;
  error: string | null;
}

export interface AnalysisResult {
  sport: 'Football' | 'NBA' | 'MLB';
  match: string;
  data_quality: 'alta' | 'media' | 'baja';
  estimated_odds: boolean;
  best_pick: {
    market: string;
    selection: string;
    odds: number;
    edge_percentage: number;
    confidence_score: number;
    tier: 'A+' | 'B';
    kelly_stake_units: number;
    value_bet: boolean;
    analysis: {
      pros: string[];
      cons: string[];
      conclusion: string;
    };
    stats_highlights: {
      metric_1: string;
      metric_2: string;
      metric_3: string;
    };
  };
  mercados_completos: {
    resultado: MarketAnalysis;
    total: TotalMarketAnalysis;
    ambos_anotan: BTTSMarketAnalysis;
    corners: CornersMarketAnalysis;
    handicap: HandicapMarketAnalysis;
    proyeccion_final: ProyeccionFinal;
  };
  picks_con_value: ValuePick[];
  supporting_factors: string[];
  risk_factors: string[];
  ajustes_aplicados: string[];
  fuentes_contexto: string[];
  // Metadata
  oddsPayload?: OddsPayload;
  researchContext?: string;
  timestamp: string;
}

export interface MarketAnalysis {
  seleccion: string;
  prob_estimada: number;
  prob_implicita_normalizada: number;
  odds: number;
  edge_percentage: number;
  value_bet: boolean;
  confidence_score: number;
  analisis: string;
}

export interface TotalMarketAnalysis {
  xg_o_pts_estimado: number;
  seleccion: 'over' | 'under';
  linea: number;
  odds: number;
  edge_percentage: number;
  value_bet: boolean;
  confidence_score: number;
  analisis: string;
}

export interface BTTSMarketAnalysis {
  aplica: boolean;
  seleccion: 'yes' | 'no';
  prob_btts_estimada: number;
  odds: number;
  edge_percentage: number;
  value_bet: boolean;
  confidence_score: number;
  analisis: string;
}

export interface CornersMarketAnalysis {
  aplica: boolean;
  total_estimado: number;
  tendencia: 'alta' | 'media' | 'baja';
  linea: number | null;
  seleccion: 'over' | 'under' | 'sin_cuota';
  odds: number | null;
  edge_percentage: number | null;
  value_bet: boolean;
  confidence_score: number;
  analisis: string;
}

export interface HandicapMarketAnalysis {
  aplica: boolean;
  linea: number | null;
  seleccion: 'home' | 'away' | null;
  odds: number | null;
  edge_percentage: number | null;
  value_bet: boolean;
  confidence_score: number;
  analisis: string;
}

export interface ProyeccionFinal {
  resultado_probable: string;
  marcador_estimado: string;
  rango_total: string;
  btts_probable: boolean;
  banker_double_viable: boolean;
  banker_double_cuota_minima: number | null;
  resumen: string;
  mejor_pick_resumen: {
    market: string;
    selection: string;
    odds: number;
    edge_percentage: number;
    kelly_stake_units: number;
  };
}

export interface ValuePick {
  market: string;
  selection: string;
  odds: number;
  edge_percentage: number;
  confidence_score: number;
  tier: 'A+' | 'B';
}

export interface AnalysisOptions {
  matchName: string;
  sport: 'football' | 'basketball' | 'baseball';
  onProgress?: (state: AnalysisState) => void;
}

// ═══════════════════════════════════════════════════════════════
// SPORT KEY MAPPING FOR THE ODDS API
// ═══════════════════════════════════════════════════════════════

const SPORT_KEY_MAP: Record<string, string[]> = {
  football: [
    'soccer_epl',
    'soccer_spain_la_liga',
    'soccer_italy_serie_a',
    'soccer_germany_bundesliga',
    'soccer_france_ligue_one',
    'soccer_uefa_champs_league',
    'soccer_uefa_europa_league',
    'soccer_portugal_primeira_liga',
    'soccer_netherlands_eredivisie',
    'soccer_belgium_first_div'
  ],
  basketball: [
    'basketball_nba',
    'basketball_euroleague',
    'basketball_aba_league'
  ],
  baseball: [
    'baseball_mlb',
    'baseball_npb',
    'baseball_kbo'
  ]
};

// ═══════════════════════════════════════════════════════════════
// CLAUDE SONNET SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════

const CLAUDE_SYSTEM_PROMPT = `Eres Coco, el motor de Inteligencia Artificial Avanzada de Coco VIP, operando como Senior Quant Analyst de fútbol y NBA. Responde ÚNICAMENTE con JSON válido parseable por JSON.parse(). Sin markdown, sin texto fuera del JSON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANCLA TEMPORAL CRÍTICA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hoy es Marzo 2026. Temporada 2025/2026.
Todo análisis se basa EXCLUSIVAMENTE en el contexto recibido.
PROHIBIDO usar datos de temporadas anteriores a 2025/2026.
PROHIBIDO inventar lesiones, estadísticas o alineaciones.
Si el dato no está en el contexto: declarar 'No confirmado en contexto disponible'.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 1 — CADENA DE PENSAMIENTO INTERNO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A) FILTRO ANTI-ALUCINACIONES
   ¿El contexto recibido contiene datos de 2025/2026?
   ¿Las cuotas son reales o estimadas?
   → Datos de 2024 o anteriores: ignorar completamente
   → Sin contexto web: data_quality='baja', confidence_score máximo 0.65 en todos los mercados

B) BÚSQUEDA DE VALOR OCULTO
   Priorizar mercados donde la casa suele equivocarse:
   1. Hándicap asiático y corners
   2. Props de jugadores si hay datos individuales
   3. Banker Double con cuota mínima 1.35
   4. Over/Under de goles o puntos
   5. 1X2 o Moneyline como último recurso

C) CÁLCULO DE PROBABILIDADES Y EDGE
   prob_implicita = 1 / cuota
   prob_normalizada = prob_implicita / suma_todas_implicitas
   prob_estimada = estimación basada en contexto recibido
   EV = (prob_estimada × cuota) - 1
   edge_percentage = EV × 100
   Solo proponer pick si edge_percentage >= 3.0

D) REFINAMIENTO ITERATIVO DEL EV
   Ajustar prob_estimada con datos CONFIRMADOS del contexto:
   Lesionado titular en equipo favorecido:    -0.05
   Back-to-back o fatiga confirmada:          -0.03
   xG superior confirmado en últimas 5:       +0.04
   Motivación superior confirmada:            +0.03
   H2H contradice forma reciente:             -0.02
   Contexto táctico alineado con el pick:     +0.03
   Recalcular EV final. Registrar en ajustes_aplicados.

E) KELLY CRITERION
   kelly = (prob_estimada × cuota - 1) / (cuota - 1)
   Redondear a 2 decimales.
   Tope máximo a reportar: 0.25
   Si kelly <= 0: no hay value, value_bet: false

F) ESCALA DE CONFIANZA (no negociable)
   0.80+     → 4+ factores confirmados, edge >= 8%
   0.65–0.79 → 2-3 factores confirmados, edge 3%–8%
   < 0.65    → value_bet: false obligatoriamente
   PROHIBIDO confidence > 0.75 sin 3 supporting_factors

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 2 — MERCADOS A ANALIZAR (en orden de prioridad)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. HÁNDICAP Y CORNERS (mercados asiáticos)
   Mayor edge oculto. Analizar si hay línea disponible.

2. TOTAL GOLES O PUNTOS (Over/Under)
   xG_estimado = xG_local + xG_visitante del contexto
   Comparar con línea. Analizar 1.5 / 2.5 / 3.5.

   ANÁLISIS DE CORNERS (obligatorio):
   - Promedio de corners por partido local (en casa): [número]
   - Promedio de corners por partido visitante (fuera): [número]
   - Suma estimada de corners del partido: [número]
   - Línea habitual de mercado: 9.5 o 10.5
   - % partidos Over 9.5 corners local + visitante combinado
   - Estilo de juego: equipos de presión alta generan más corners
   - Si el contexto no trae el dato: estímalo con el estilo
     táctico (pressing alto → Over, bloque bajo → Under)
   - EV y Kelly para el mercado de corners si edge >= 3%

3. AMBOS ANOTAN — solo fútbol
   prob_btts = prob_local_anota × prob_visitante_anota
   Cruzar con clean sheets y failed_to_score del contexto.

4. RESULTADO (1X2 o Moneyline)
   Forma reciente, lesionados, motivación, xG, H2H.

5. PROYECCIÓN INTEGRADA
   Cruzar todos. Identificar mejor edge.
   Evaluar Banker Double viable (cuota >= 1.35).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 3 — JSON DE RESPUESTA OBLIGATORIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "sport": "Football" | "NBA" | "MLB",
  "match": string,
  "data_quality": "alta" | "media" | "baja",
  "estimated_odds": boolean,

  "best_pick": {
    "market": string,
    "selection": string,
    "odds": number,
    "edge_percentage": number,
    "confidence_score": number,
    "tier": "A+" | "B",
    "kelly_stake_units": number,
    "value_bet": boolean,
    "analysis": {
      "pros": [string, string, string],
      "cons": [string],
      "conclusion": "máx 60 palabras, tono analítico y frío"
    },
    "stats_highlights": {
      "metric_1": string,
      "metric_2": string,
      "metric_3": string
    }
  },

  "mercados_completos": {
    "resultado": {
      "seleccion": "1"|"X"|"2"|"home"|"away",
      "prob_estimada": number,
      "prob_implicita_normalizada": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": boolean,
      "confidence_score": number,
      "analisis": string
    },
    "total": {
      "xg_o_pts_estimado": number,
      "seleccion": "over" | "under",
      "linea": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": boolean,
      "confidence_score": number,
      "analisis": string
    },
    "ambos_anotan": {
      "aplica": boolean,
      "seleccion": "yes" | "no",
      "prob_btts_estimada": number,
      "odds": number,
      "edge_percentage": number,
      "value_bet": boolean,
      "confidence_score": number,
      "analisis": string
    },
    "corners": {
      "aplica": boolean,
      "total_estimado": number,
      "tendencia": "alta" | "media" | "baja",
      "linea": number | null,
      "seleccion": "over" | "under" | "sin_cuota",
      "odds": number | null,
      "edge_percentage": number | null,
      "value_bet": boolean,
      "confidence_score": number,
      "analisis": string
    },
    "handicap": {
      "aplica": boolean,
      "linea": number | null,
      "seleccion": "home" | "away" | null,
      "odds": number | null,
      "edge_percentage": number | null,
      "value_bet": boolean,
      "confidence_score": number,
      "analisis": string
    },
    "proyeccion_final": {
      "resultado_probable": string,
      "marcador_estimado": string,
      "rango_total": string,
      "btts_probable": boolean,
      "banker_double_viable": boolean,
      "banker_double_cuota_minima": number | null,
      "resumen": string,
      "mejor_pick_resumen": {
        "market": string,
        "selection": string,
        "odds": number,
        "edge_percentage": number,
        "kelly_stake_units": number
      }
    }
  },

  "picks_con_value": [
    {
      "market": string,
      "selection": string,
      "odds": number,
      "edge_percentage": number,
      "confidence_score": number,
      "tier": "A+" | "B"
    }
  ],

  "supporting_factors": [string, string, string],
  "risk_factors": [string],
  "ajustes_aplicados": [string],
  "fuentes_contexto": [string]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGLAS FINALES PROHIBIDAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NUNCA texto ni markdown fuera del JSON
NUNCA inventar datos no presentes en el contexto
NUNCA value_bet: true con confidence_score < 0.65
NUNCA confidence_score > 0.75 sin 3 supporting_factors
NUNCA usar datos de temporadas anteriores a 2025/2026
NUNCA kelly_stake_units > 0.25`;

// ═══════════════════════════════════════════════════════════════
// STEP 2: PARALLEL RESEARCH (Gemini 2.5 Pro + Perplexity Sonar Pro)
// ═══════════════════════════════════════════════════════════════

interface Step2Result {
  researchContext: string;
  dataQuality: 'alta' | 'media' | 'baja';
  warning?: string;
}

async function runParallelResearch(
  matchName: string,
  sport: 'football' | 'basketball' | 'baseball'
): Promise<Step2Result> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    return {
      researchContext: 'Sin contexto web disponible.',
      dataQuality: 'baja',
      warning: 'OPENROUTER_API_KEY no configurada'
    };
  }

  try {
    // STEP 2 — BÚSQUEDA PARALELA (Gemini 2.5 Pro + Perplexity Sonar Pro)
    const [researchA, researchB] = await Promise.all([

      // ── LLAMADA A: Gemini 2.5 Pro (forma reciente, clasificación, noticias)
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro-exp-03-25",
          max_tokens: 2000,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: `🚨 IDIOMA: Responde EXCLUSIVAMENTE en español neutro.
Traduce cualquier fuente en otro idioma al español.
Nunca mezcles idiomas en la respuesta.

Eres un investigador deportivo con acceso web en tiempo real.
Busca información ACTUAL sobre el partido indicado.
Hoy es Marzo 2026. Solo datos de temporada 2025/2026.
NUNCA inventes datos. Si no encuentras algo escribe:
'DATO NO ENCONTRADO'.
No incluyas tu proceso de razonamiento, solo el reporte final.

Formato de respuesta usando árbol ├── └──:

📋 SECCIÓN A — FORMA Y CONTEXTO

1. FORMA RECIENTE (últimos 5 partidos de CADA equipo,
   NO solo H2H entre ellos, sino todos sus partidos recientes)
   ├── Local: [fecha] vs [rival] [marcador] | [nota táctica breve]
   ├── Local: [fecha] vs [rival] [marcador] | [nota táctica breve]
   ├── Local: [fecha] vs [rival] [marcador] | [nota táctica breve]
   ├── Local: [fecha] vs [rival] [marcador] | [nota táctica breve]
   └── Local: [fecha] vs [rival] [marcador] | [nota táctica breve]
   ├── Visitante: [fecha] vs [rival] [marcador] | [nota táctica breve]
   ├── Visitante: [fecha] vs [rival] [marcador] | [nota táctica breve]
   ├── Visitante: [fecha] vs [rival] [marcador] | [nota táctica breve]
   ├── Visitante: [fecha] vs [rival] [marcador] | [nota táctica breve]
   └── Visitante: [fecha] vs [rival] [marcador] | [nota táctica breve]

2. CLASIFICACIÓN ACTUAL
   ├── Local: [posición]º con [puntos] pts en [nombre de la liga]
   └── Visitante: [posición]º con [puntos] pts en [nombre de la liga]

3. HEAD TO HEAD (últimos 3 enfrentamientos oficiales)
   ├── [fecha] [local] [marcador] [visitante] | [competición]
   ├── [fecha] [local] [marcador] [visitante] | [competición]
   └── [fecha] [local] [marcador] [visitante] | [competición]

4. MOTIVACIÓN Y CONTEXTO
   └── [pelea por título / descenso / Champions / rotaciones / etc]

5. NOTICIAS RELEVANTES (últimas 48h)
   ├── [fecha] — [titular en español] — [fuente]
   └── [fecha] — [titular en español] — [fuente]`
            },
            {
              role: "user",
              content: `Busca en tiempo real el partido: ${matchName}
Deporte: ${sport}. Fecha: Marzo 2026.
Responde SOLO en español con la estructura pedida.`
            }
          ]
        })
      }).then(r => r.json())
        .then(r => r.choices?.[0]?.message?.content ?? "Sin datos de contexto")
        .catch(() => "Sin datos de contexto (error Gemini)"),

      // ── LLAMADA B: Perplexity Sonar Pro (estadísticas avanzadas y lesiones)
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          max_tokens: 1500,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: `🚨 IDIOMA: Responde EXCLUSIVAMENTE en español neutro.
Traduce cualquier fuente en otro idioma al español.
Nunca mezcles idiomas en la respuesta.

Eres un investigador OSINT deportivo de nivel senior.
Especialidad: estadísticas avanzadas y lesiones confirmadas.
Hoy es Marzo 2026. Solo datos de temporada 2025/2026.

Busca en FBref.com, Understat.com, SofaScore.com, WhoScored.com.
NUNCA inventes estadísticas.
Si no encuentras un dato tras buscar en 3+ fuentes:
escribe exactamente 'DATO NO ENCONTRADO'.
No incluyas tu proceso de búsqueda, solo el reporte final.

Formato de respuesta usando árbol ├── └──:

📋 SECCIÓN B — ESTADÍSTICAS AVANZADAS Y LESIONES

1. LESIONADOS Y SUSPENDIDOS CONFIRMADOS
   ├── Local: [jugador] - [lesión/estado] - [fuente/fecha]
   └── Visitante: [jugador] - [lesión/estado] - [fuente/fecha]
   (Si no hay bajas: 'Plantilla completa según [fuente]')

2. ESTADÍSTICAS AVANZADAS 2025/2026
   ├── xG local (promedio por partido): [número o 'DATO NO ENCONTRADO']
   ├── xGA local (promedio por partido): [número o 'DATO NO ENCONTRADO']
   ├── xG visitante (promedio por partido): [número o 'DATO NO ENCONTRADO']
   ├── xGA visitante (promedio por partido): [número o 'DATO NO ENCONTRADO']
   ├── PPDA local: [número o 'DATO NO ENCONTRADO']
   └── PPDA visitante: [número o 'DATO NO ENCONTRADO']

3. ESTADÍSTICAS DE GOLES (temporada 2025/2026)
   ├── Promedio goles marcados local: [número]
   ├── Promedio goles recibidos local: [número]
   ├── Promedio goles marcados visitante: [número]
   └── Promedio goles recibidos visitante: [número]

4. BTTS Y OVER/UNDER (temporada actual)
   ├── % partidos con BTTS local: [número]%
   ├── % partidos con BTTS visitante: [número]%
   ├── % partidos Over 2.5 local: [número]%
   └── % partidos Over 2.5 visitante: [número]%`
            },
            {
              role: "user",
              content: `Busca xG y xGA en estas fuentes EN ESTE ORDEN:
1. fotmob.com/leagues (tiene xG por equipo gratis)
2. sofascore.com (estadísticas de temporada)
3. whoscored.com
4. understat.com
5. fbref.com

Para cada equipo busca:
'[nombre equipo] xG 2025 2026 Premier League'
'[nombre equipo] expected goals per game 2026'

Si encuentras el dato en cualquier fuente, úsalo.
Solo escribe DATO NO ENCONTRADO si falló en TODAS.

---

CORNERS — Buscar obligatoriamente para cada equipo:
- Promedio de corners por partido jugando en casa
- Promedio de corners por partido jugando de visitante
- Total de corners en los últimos 5 partidos
- H2H: corners totales en últimos 3 enfrentamientos

Queries a usar:
'[equipo local] corners per game [liga] 2025 2026'
'[equipo visitante] corners per game [liga] 2025 2026'
'[local] vs [visitante] corners head to head'

Fuentes en orden de prioridad:
1. sofascore.com
2. fotmob.com
3. whoscored.com
4. flashscore.com

Formato de respuesta obligatorio:
CORNERS:
- Local promedio en casa: X.X/partido
- Visitante promedio fuera: X.X/partido
- Suma estimada partido: X.X
- Línea de mercado sugerida: 9.5 o 10.5
- Tendencia: Over / Under / Neutral

Si no encuentras el dato en ninguna fuente,
escribe: 'CORNERS: DATO NO ENCONTRADO' pero
intenta al menos 3 fuentes antes.

---

Investiga estadísticas avanzadas y lesiones para: ${matchName}
Deporte: ${sport}. Fecha: Marzo 2026.
Responde SOLO en español con la estructura pedida.`
            }
          ]
        })
      }).then(r => r.json())
        .then(r => r.choices?.[0]?.message?.content ?? "Sin datos estadísticos")
        .catch(() => "Sin datos estadísticos (error Sonar Pro)")

    ]);

    // Combinar ambas respuestas en una sola variable para Step 3
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
`;

    // data_quality logic basada en los resultados
    const hasStats = !researchB.includes("DATO NO ENCONTRADO") ||
                     researchB.includes("xG");
    const hasForm  = !researchA.includes("Sin datos");

    const dataQuality: 'alta' | 'media' | 'baja' = hasStats && hasForm ? "alta"
                                    : hasForm || hasStats ? "media"
                                    : "baja";

    console.log(`✅ Parallel research completed (${researchContext.length} chars, quality: ${dataQuality})`);
    return { researchContext, dataQuality };

  } catch (error) {
    console.error('Parallel research error:', error);
    return {
      researchContext: 'Sin contexto web disponible.',
      dataQuality: 'baja',
      warning: 'Búsqueda paralela fallida'
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP 1: THE ODDS API
// ═══════════════════════════════════════════════════════════════

async function fetchOddsFromAPI(
  matchName: string,
  sport: 'football' | 'basketball' | 'baseball'
): Promise<{ oddsPayload: OddsPayload | null; warning?: string }> {
  const ODDS_API_KEY = process.env.ODDS_API_KEY;
  
  if (!ODDS_API_KEY) {
    return { 
      oddsPayload: null, 
      warning: 'ODDS_API_KEY no configurada' 
    };
  }

  const sportKeys = SPORT_KEY_MAP[sport] || [];
  const teams = matchName.split(/\s+vs\s+|\s+v\s+|\s*-vs-\s*|\s*-v-\s*/i);
  const homeTeam = teams[0]?.trim().toLowerCase() || '';
  const awayTeam = teams[1]?.trim().toLowerCase() || '';

  // Try each sport key until we find the match
  for (const sportKey of sportKeys) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals,spreads&oddsFormat=decimal&bookmakers=bet365,pinnacle,betfair`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        continue; // Try next sport key
      }

      const data = await response.json();
      
      // Fuzzy match to find the specific match
      const match = data.find((game: any) => {
        const gameHome = (game.home_team || '').toLowerCase();
        const gameAway = (game.away_team || '').toLowerCase();
        
        return (
          (gameHome.includes(homeTeam) || homeTeam.includes(gameHome)) &&
          (gameAway.includes(awayTeam) || awayTeam.includes(gameAway))
        );
      });

      if (!match) continue;

      // Extract odds from bookmakers
      const bookmakers = match.bookmakers || [];
      if (bookmakers.length === 0) continue;

      // Use first available bookmaker (prefer Bet365, then Pinnacle, then Betfair)
      const priorityOrder = ['bet365', 'pinnacle', 'betfair'];
      let selectedBookmaker = bookmakers[0];
      
      for (const priority of priorityOrder) {
        const found = bookmakers.find((b: any) => b.key === priority);
        if (found) {
          selectedBookmaker = found;
          break;
        }
      }

      // Extract markets
      const h2hMarket = selectedBookmaker.markets?.find((m: any) => m.key === 'h2h');
      const totalsMarket = selectedBookmaker.markets?.find((m: any) => m.key === 'totals');
      const spreadsMarket = selectedBookmaker.markets?.find((m: any) => m.key === 'spreads');

      const oddsPayload: OddsPayload = {
        match: `${match.home_team} vs ${match.away_team}`,
        commence_time: match.commence_time,
        bookmakers: {
          h2h: {
            home: h2hMarket?.outcomes?.find((o: any) => o.name === match.home_team)?.price || 0,
            draw: h2hMarket?.outcomes?.find((o: any) => o.name === 'Draw')?.price || null,
            away: h2hMarket?.outcomes?.find((o: any) => o.name === match.away_team)?.price || 0
          },
          totals: totalsMarket ? {
            line: totalsMarket.outcomes?.[0]?.point || 0,
            over: totalsMarket.outcomes?.find((o: any) => o.name === 'Over')?.price || 0,
            under: totalsMarket.outcomes?.find((o: any) => o.name === 'Under')?.price || 0
          } : null,
          spreads: spreadsMarket ? {
            point: spreadsMarket.outcomes?.[0]?.point || 0,
            home: spreadsMarket.outcomes?.find((o: any) => o.name === match.home_team)?.price || 0,
            away: spreadsMarket.outcomes?.find((o: any) => o.name === match.away_team)?.price || 0
          } : null
        }
      };

      console.log(`✅ Odds found via The Odds API: ${match.home_team} vs ${match.away_team}`);
      return { oddsPayload };

    } catch (error) {
      console.error(`Error fetching odds for ${sportKey}:`, error);
      continue;
    }
  }

  return { 
    oddsPayload: null, 
    warning: 'Cuotas no disponibles para este partido' 
  };
}



// ═══════════════════════════════════════════════════════════════
// STEP 3: CLAUDE SONNET 4.6 - QUANT/SNIPER AGENT
// ═══════════════════════════════════════════════════════════════

async function runQuantAnalysis(
  matchName: string,
  sport: 'football' | 'basketball' | 'baseball',
  oddsPayload: OddsPayload | null,
  researchContext: string
): Promise<AnalysisResult> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY no configurada');
  }

  const oddsText = oddsPayload 
    ? JSON.stringify(oddsPayload, null, 2)
    : 'No disponibles, estima líneas razonables';

  const userMessage = `Partido: ${matchName}
Deporte: ${sport}

Cuotas actuales:
${oddsText}

Contexto investigado (Marzo 2026):
${researchContext}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': APP_URL,
        'X-Title': 'Coco VIP Quant'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-6',
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: CLAUDE_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';

    // Clean markdown if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse JSON
    const result: AnalysisResult = JSON.parse(content);

    // Add metadata
    result.oddsPayload = oddsPayload || undefined;
    result.researchContext = researchContext;
    result.timestamp = new Date().toISOString();

    // Normalize sport name
    if (sport === 'basketball') result.sport = 'NBA';
    if (sport === 'baseball') result.sport = 'MLB';
    if (sport === 'football') result.sport = 'Football';

    console.log(`✅ Claude Sonnet analysis completed for ${matchName}`);
    return result;

  } catch (error) {
    console.error('Claude agent error:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP 4: GROK 4.1 FAST - FINAL VALIDATION
// ═══════════════════════════════════════════════════════════════

async function runFinalValidation(
  result: AnalysisResult
): Promise<AnalysisResult> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    console.log('⚠️ OPENROUTER_API_KEY not configured, skipping Step 4');
    return result;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'x-ai/grok-4-1-fast',
        temperature: 0.1,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `REGLA CRÍTICA DE confidence_score:
- El valor SIEMPRE debe estar entre 0.0 y 1.0.
- La UI multiplica por 10 para mostrar '/10'.
- Ejemplos correctos: 0.72 → se verá como 7.2/10
- Ejemplos PROHIBIDOS: 7, 7.2, 72, 720, 850.
- Si tu cálculo da un número mayor a 1,
  divídelo entre 10 antes de escribirlo en el JSON.
- Esta regla aplica a TODOS los confidence_score
  del JSON: best_pick y cada mercado.

---

Eres un validador de análisis deportivos. Verifica que el JSON recibido:
1. Tiene todos los campos requeridos
2. Los valores numéricos están en rangos lógicos
3. edge_percentage y confidence_score son coherentes

Los siguientes campos son OBLIGATORIOS y no pueden
quedar vacíos o null. Si el razonamiento no los
menciona explícitamente, INFIERE un valor razonable
basado en el análisis:

'proyeccion_final': {
  'resultado_probable': string,   // '1' o 'X' o '2'
  'marcador_estimado': string,    // Ej: '2-1' o '1-0'
  'rango_total_goles': string,    // Ej: '2-3 goles'
  'btts_probable': boolean,       // true o false
  'confianza_proyeccion': number  // entre 0.0 y 1.0
}

Regla: si el pick es victoria local con prob 62%,
el marcador estimado debería reflejarlo (ej: '2-1').
Nunca dejar este bloque vacío.

Si algo está mal, corrígelo. Responde SOLO con el JSON corregido.`
          },
          {
            role: 'user',
            content: JSON.stringify(result)
          }
        ]
      })
    });

    if (!response.ok) {
      console.log(`⚠️ Grok validation skipped: ${response.status}`);
      return result;
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const validated: AnalysisResult = JSON.parse(content);
    validated.timestamp = result.timestamp;
    validated.oddsPayload = result.oddsPayload;
    validated.researchContext = result.researchContext;

    console.log(`✅ Grok validation completed`);
    return validated;

  } catch (error) {
    console.error('Grok validation error:', error);
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════

export async function analyzeMatch(
  options: AnalysisOptions
): Promise<AnalysisResult> {
  const { matchName, sport, onProgress } = options;

  // Initialize state
  const initialState: AnalysisState = {
    currentStep: 1,
    steps: [
      { step: 1, status: 'pending', icon: '🔍', message: 'Buscando cuotas en tiempo real...', progress: 15 },
      { step: 2, status: 'pending', icon: '📡', message: 'Búsqueda paralela (Gemini + Sonar Pro)...', progress: 45 },
      { step: 3, status: 'pending', icon: '🤖', message: 'Claude Sonnet analizando valor...', progress: 65 },
      { step: 4, status: 'pending', icon: '✅', message: 'Grok validando análisis...', progress: 90 }
    ],
    result: null,
    error: null
  };

  // Helper to emit progress
  const emitProgress = (step: number, status: 'running' | 'completed' | 'failed', warning?: string) => {
    if (onProgress) {
      const state: AnalysisState = {
        ...initialState,
        currentStep: step,
        steps: initialState.steps.map(s => {
          if (s.step === step) {
            return { ...s, status, warning };
          }
          if (s.step < step) {
            return { ...s, status: 'completed' };
          }
          return s;
        }),
        result: null,
        error: null
      };
      onProgress(state);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: THE ODDS API
  // ═══════════════════════════════════════════════════════════════

  emitProgress(1, 'running');
  
  const { oddsPayload, warning: oddsWarning } = await fetchOddsFromAPI(matchName, sport);
  
  if (oddsWarning) {
    console.log(`⚠️ Step 1 warning: ${oddsWarning}`);
  }
  
  emitProgress(1, 'completed', oddsWarning);

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: PARALLEL RESEARCH (Gemini 2.5 Pro + Sonar Pro)
  // ═══════════════════════════════════════════════════════════════

  emitProgress(2, 'running');
  
  const { researchContext, dataQuality, warning: researchWarning } = await runParallelResearch(matchName, sport);
  
  if (researchWarning) {
    console.log(`⚠️ Step 2 warning: ${researchWarning}`);
  }
  
  console.log(`📊 Data quality: ${dataQuality}`);
  
  emitProgress(2, 'completed', researchWarning);

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: CLAUDE SONNET QUANT ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  emitProgress(3, 'running');
  
  const quantResult = await runQuantAnalysis(matchName, sport, oddsPayload, researchContext);
  
  emitProgress(3, 'completed');

  // ═══════════════════════════════════════════════════════════════
  // STEP 4: GROK FINAL VALIDATION
  // ═══════════════════════════════════════════════════════════════

  emitProgress(4, 'running');
  
  const result = await runFinalValidation(quantResult);
  
  // Emit final completed state
  if (onProgress) {
    const finalState: AnalysisState = {
      currentStep: 4,
      steps: initialState.steps.map(s => ({ ...s, status: 'completed' as const })),
      result,
      error: null
    };
    onProgress(finalState);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// SAVE TO GOOGLE SHEETS
// ═══════════════════════════════════════════════════════════════

export async function saveAnalysisToSheets(result: AnalysisResult): Promise<boolean> {
  const GOOGLE_SHEETS_URL = process.env.GOOGLE_SHEETS_URL;

  if (!GOOGLE_SHEETS_URL) {
    console.log('⚠️ GOOGLE_SHEETS_URL not configured, skipping save');
    return false;
  }

  try {
    const encodedData = encodeURIComponent(JSON.stringify(result));
    const url = `${GOOGLE_SHEETS_URL}?action=writeAnalysis&data=${encodedData}`;

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      console.log('✅ Analysis saved to Google Sheets:', data);
      return true;
    } catch {
      console.error('Google Sheets response not JSON:', text.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.error('Error saving to Google Sheets:', error);
    return false;
  }
}
