/**
 * Coco VIP - AI-Driven Match Analysis Pipeline
 * 
 * 5-Step Pipeline:
 * 0. SoccerData (Python) - Official stats from FBref/FotMob
 * 1. The Odds API - Real-time odds from major bookmakers
 * 2. Parallel Research (Gemini 2.5 Pro + Perplexity Sonar Pro) - Live web data in parallel
 * 3. Claude Sonnet 4.6 - Quant/Sniper agent for value calculation
 * 4. Grok 4.1 Fast - Final validation and formatting
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface SoccerDataStats {
  source: string;
  timestamp: string;
  home_team: string;
  away_team: string;
  league: string;
  season: string;
  home_xG_avg?: number;
  home_xGA_avg?: number;
  away_xG_avg?: number;
  away_xGA_avg?: number;
  home_corners_avg?: number;
  away_corners_avg?: number;
  home_goals_total?: number;
  away_goals_total?: number;
  home_matches?: number;
  away_matches?: number;
  home_goals_avg?: number;
  away_goals_avg?: number;
  home_position?: number;
  home_points?: number;
  away_position?: number;
  away_points?: number;
  home_shots_avg?: number;
  home_shots_on_target_avg?: number;
  away_shots_avg?: number;
  away_shots_on_target_avg?: number;
  home_form?: Array<{date: string; opponent: string; result: string; goals_for: number; goals_against: number}>;
  away_form?: Array<{date: string; opponent: string; result: string; goals_for: number; goals_against: number}>;
  fallback: boolean;
  error?: string;
}

export interface UnderstatXG {
  source: string;
  timestamp: string;
  league: string;
  home_team: string;
  away_team: string;
  season: string;
  home_team_resolved?: string;
  away_team_resolved?: string;
  home_xG_total?: number | string;
  home_xGA_total?: number | string;
  home_matches?: number;
  home_xG_avg?: number;
  home_xGA_avg?: number;
  away_xG_total?: number | string;
  away_xGA_total?: number | string;
  away_matches?: number;
  away_xG_avg?: number;
  away_xGA_avg?: number;
  fallback?: boolean;
  partial_fallback?: boolean;
  warning?: string;
  error?: string;
}

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
REGLA — xG ESTIMADO PROPIO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Si el reporte de Sonar dice 'DATO NO ENCONTRADO' para xG
y xGA, DEBES calcularlos tú mismo con esta fórmula:

xG estimado = (goles marcados en temporada) ÷ (partidos jugados)
xGA estimado = (goles encajados en temporada) ÷ (partidos jugados)

Luego aplica estos ajustes:
- Si el equipo juega en CASA: xG × 1.10, xGA × 0.92
- Si el equipo juega de VISITANTE: xG × 0.90, xGA × 1.08
- Si el rival es de zona descenso: xGA × 1.15

Muestra el cálculo explícito así:
xG [equipo] = (N goles ÷ N partidos) × factor local = X.XX
xGA [equipo] = (N encajados ÷ N partidos) × factor = X.XX

Nunca escribir DATO NO ENCONTRADO para xG si tienes
los goles totales de la temporada disponibles en el reporte.

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
// STEP 2: PARALLEL RESEARCH (Gemini 2.5 Pro + Perplexity Sonar Pro + Sonar Pro Corners)
// ═══════════════════════════════════════════════════════════════

interface Step2Result {
  researchContext: string;
  dataQuality: 'alta' | 'media' | 'baja';
  warning?: string;
  cornersData?: CornersData;
}

interface CornersData {
  corners_local_casa: number | null;
  corners_visitante_fuera: number | null;
  suma_estimada: number | null;
  linea_recomendada: string | null;
  tendencia: 'Over' | 'Under' | 'Sin datos';
  fuente: string | null;
  raw_response?: string;
}

async function runParallelResearch(
  matchName: string,
  sport: 'football' | 'basketball' | 'baseball',
  understatData: UnderstatXG | null
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
    // Parsear equipos del matchName para el prompt de corners
    const teams = matchName.split(/\s+vs\s+|\s+v\s+|\s*-vs-\s*|\s*-v-\s*/i);
    const homeTeam = teams[0]?.trim() || '';
    const awayTeam = teams[1]?.trim() || '';

    // STEP 2 — BÚSQUEDA PARALELA (Gemini 2.5 Pro + Perplexity Sonar Pro + Sonar Pro Corners)
    const [researchA, researchB, researchC] = await Promise.all([

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
          search_type: "pro",
          max_tokens: 1500,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: `Eres un investigador deportivo experto. DEBES hacer
búsquedas profundas y multi-step para cada dato.
NO respondas con 'DATO NO ENCONTRADO' sin haber
buscado en mínimo 5 URLs distintas. Para cada equipo
busca forma reciente, lesionados y estadísticas en:
soccerway.com, transfermarkt.es, sofascore.com,
flashscore.es y marca.com en ese orden.
Responde TODO en español.

---

🚨 IDIOMA: Responde EXCLUSIVAMENTE en español neutro.
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
              content: `DATOS OFICIALES xG de Understat (usar como base):

${understatData && !understatData.fallback ? 
`${understatData.home_team}: xG promedio: ${understatData.home_xG_avg} por partido
${understatData.home_team}: xGA promedio: ${understatData.home_xGA_avg} por partido
${understatData.away_team}: xG promedio: ${understatData.away_xG_avg} por partido
${understatData.away_team}: xGA promedio: ${understatData.away_xGA_avg} por partido

Estos datos son reales y tienen prioridad sobre
cualquier estimación. NO calcular xG manualmente
si estos datos están disponibles.`
: 'Understat no disponible para este partido.'}

---

Busca xG y xGA en estas fuentes EN ESTE ORDEN:
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
Responde SOLO en español con la estructura pedida.

---

BÚSQUEDA OBLIGATORIA DE CORNERS:
Busca corners con estas queries EXACTAS en este orden:

Query 1:
"[equipo local] corners per game [liga] 2025 2026
site:soccerstats.com"

Query 2:
"[equipo visitante] corners per game [liga] 2025 2026
site:soccerstats.com"

Query 3:
"[liga] corner stats 2025 2026 site:betaminic.com"

Query 4:
"[equipo local] corner stats site:apwin.com"

Query 5:
"[equipo visitante] corner stats site:apwin.com"

Query 6:
"[equipo local] [equipo visitante] corners
site:windrawwin.com"

FORMATO DE RESPUESTA OBLIGATORIO:
═══════════════════════════
CORNERS 2025/26:
├── [Local] corners a favor/partido: X.XX
├── [Local] corners en contra/partido: X.XX
├── [Visitante] corners a favor/partido: X.XX
├── [Visitante] corners en contra/partido: X.XX
├── Total estimado partido: X.XX
├── % Over 8.5: XX%
├── % Over 9.5: XX%
└── % Over 10.5: XX%

MERCADO CORNERS RECOMENDADO:
├── Línea: X.5
├── Selección: Over / Under
├── Probabilidad estimada: XX%
└── Edge si cuota ~1.85: +X.X%
═══════════════════════════

REGLA: Si soccerstats.com falla, usar betaminic.com.
Si betaminic falla, usar apwin.com.
Si apwin falla, usar windrawwin.com.
NO escribir DATO NO ENCONTRADO sin haber
intentado las 4 fuentes.`
            }
          ]
        })
      }).then(r => r.json())
        .then(r => r.choices?.[0]?.message?.content ?? "Sin datos estadísticos")
        .catch(() => "Sin datos estadísticos (error Sonar Pro)"),

      // ── LLAMADA C: Sonar Pro DEDICADO A CORNERS (JSON exclusivo)
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          search_type: "pro",
          max_tokens: 500,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: `Eres un extractor de datos deportivos especializado.
Tu única tarea es encontrar estadísticas de corners.
Devuelve SOLO JSON válido, sin texto adicional, sin markdown, sin explicaciones.
Si no encuentras un dato, usa null como valor.
El JSON debe ser parseable por JSON.parse() directamente.`
            },
            {
              role: "user",
              content: `Busca SOLO estadísticas de corners de estos equipos en la temporada 2025/2026:
- Equipo local: ${homeTeam}
- Equipo visitante: ${awayTeam}

Queries a ejecutar en este orden:
1. '${homeTeam} corners per game 2025-26 La Liga'
2. '${awayTeam} corners per game 2025-26 La Liga'
3. '${homeTeam} ${awayTeam} corners h2h'
4. '${homeTeam} corner statistics sofascore'
5. '${awayTeam} corner statistics sofascore'

Fuentes prioritarias:
1. sofascore.com
2. whoscored.com
3. fbref.com
4. footystats.org
5. understat.com

Responde SOLO con este formato JSON (sin markdown, sin código):
{
  "corners_local_casa": <número o null>,
  "corners_visitante_fuera": <número o null>,
  "suma_estimada": <número o null>,
  "linea_recomendada": "9.5" o "10.5" o null,
  "tendencia": "Over" o "Under" o "Sin datos",
  "fuente": "<URL donde encontraste el dato>"
}

No escribas nada más. Solo el JSON. Sin backticks, sin explicaciones.`
            }
          ]
        })
      }).then(r => r.json())
        .then(r => {
          const content = r.choices?.[0]?.message?.content ?? "";
          // Intentar parsear el JSON de la respuesta
          try {
            // Limpiar posibles caracteres de markdown
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleanContent);
            return { ...parsed, raw_response: content };
          } catch {
            // Si falla el parseo, devolver objeto con raw_response
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

    // Procesar datos de corners (researchC)
    const cornersData: CornersData = researchC as CornersData;

    // Construir sección de corners para el contexto
    let cornersSection = '';
    const hasCorners = cornersData && cornersData.corners_local_casa !== null;
    
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
    } else {
      cornersSection = `
═══════════════════════════════════════════════
SECCIÓN C: ESTADÍSTICAS DE CORNERS
═══════════════════════════════════════════════

Datos de corners no encontrados en búsqueda dedicada.
Usar información de Sección B como alternativa.
`;
    }

    // Combinar las tres respuestas en una sola variable para Step 3
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

    // data_quality logic basada en los resultados
    const hasStats = !researchB.includes("DATO NO ENCONTRADO") ||
                     researchB.includes("xG");
    const hasForm  = !researchA.includes("Sin datos");
    // hasCorners ya fue definido arriba

    const dataQuality: 'alta' | 'media' | 'baja' = (hasStats && hasForm && hasCorners) ? "alta"
                                    : (hasForm || hasStats) ? "media"
                                    : "baja";

    console.log(`✅ Parallel research completed (${researchContext.length} chars, quality: ${dataQuality})`);
    console.log(`📊 Corners data: ${hasCorners ? '✅ Encontrado' : '⚠️ No disponible'}`);
    
    return { 
      researchContext, 
      dataQuality,
      cornersData
    };

  } catch (error) {
    console.error('Parallel research error:', error);
    return {
      researchContext: 'Sin contexto web disponible.',
      dataQuality: 'baja',
      warning: 'Búsqueda paralela fallida',
      cornersData: undefined
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP 0: SOCCERDATA (PYTHON) - OFFICIAL STATS FROM FBREF/FOTMOB
// ═══════════════════════════════════════════════════════════════

const LEAGUE_MAP: Record<string, string> = {
  'soccer_epl': 'ENG-Premier-League',
  'soccer_spain_la_liga': 'ESP-LaLiga',
  'soccer_italy_serie_a': 'ITA-Serie-A',
  'soccer_germany_bundesliga': 'GER-Bundesliga',
  'soccer_france_ligue_one': 'FRA-Ligue-1',
  'soccer_portugal_primeira_liga': 'POR-LigaPortugal',
  'soccer_netherlands_eredivisie': 'NED-Eredivisie',
};

async function fetchSoccerData(
  matchName: string,
  sport: 'football' | 'basketball' | 'baseball'
): Promise<{ soccerData: SoccerDataStats | null; warning?: string }> {
  // Solo aplicar a fútbol
  if (sport !== 'football') {
    return { soccerData: null, warning: 'SoccerData solo disponible para fútbol' };
  }

  try {
    // Parsear equipos del matchName
    const teams = matchName.split(/\s+vs\s+|\s+v\s+|\s*-vs-\s*|\s*-v-\s*/i);
    const homeTeam = teams[0]?.trim() || '';
    const awayTeam = teams[1]?.trim() || '';
    
    // Detectar liga basada en el contexto o usar LaLiga por defecto
    const league = 'ESP-LaLiga'; // Se podría hacer más inteligente
    
    // Ruta al script Python
    const scriptPath = path.join(process.cwd(), 'scripts', 'soccerdata_stats.py');
    
    // Preparar input para el script
    const inputPayload = JSON.stringify({
      league,
      home_team: homeTeam,
      away_team: awayTeam,
      season: '2025'
    });
    
    // Ejecutar Python script con timeout de 30 segundos
    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}"`,
      {
        timeout: 30000,
        maxBuffer: 1024 * 1024 // 1MB buffer
      }
    );
    
    if (stderr && !stderr.includes('Warning')) {
      console.log(`⚠️ SoccerData stderr: ${stderr.substring(0, 200)}`);
    }
    
    const soccerData: SoccerDataStats = JSON.parse(stdout);
    
    if (soccerData.fallback) {
      console.log(`⚠️ SoccerData fallback: ${soccerData.error || 'Unknown error'}`);
      return { soccerData, warning: soccerData.error };
    }
    
    console.log(`✅ SoccerData fetched: ${homeTeam} vs ${awayTeam}`);
    return { soccerData };
    
  } catch (error: any) {
    // Si Python no está disponible o falla, retornar null sin bloquear
    console.log(`⚠️ SoccerData not available: ${error.message}`);
    return { 
      soccerData: null, 
      warning: 'SoccerData no disponible (Python script falló)' 
    };
  }
}

function formatSoccerDataForPrompt(soccerData: SoccerDataStats | null): string {
  if (!soccerData) {
    return 'DATOS DE SOCCERDATA NO DISPONIBLES';
  }
  
  if (soccerData.fallback) {
    return `SOCCERDATA FALLBACK: ${soccerData.error || 'Error desconocido'}`;
  }
  
  const lines: string[] = [
    '═══════════════════════════════════════════════',
    'DATOS OFICIALES DE SOCCERDATA (FBref/FotMob)',
    '═══════════════════════════════════════════════',
    '',
    `Liga: ${soccerData.league}`,
    `Temporada: ${soccerData.season}`,
    '',
    '── ESTADÍSTICAS xG/xGA ──',
  ];
  
  if (soccerData.home_xG_avg) {
    lines.push(`xG ${soccerData.home_team} (promedio): ${soccerData.home_xG_avg}`);
  }
  if (soccerData.home_xGA_avg) {
    lines.push(`xGA ${soccerData.home_team} (promedio): ${soccerData.home_xGA_avg}`);
  }
  if (soccerData.away_xG_avg) {
    lines.push(`xG ${soccerData.away_team} (promedio): ${soccerData.away_xG_avg}`);
  }
  if (soccerData.away_xGA_avg) {
    lines.push(`xGA ${soccerData.away_team} (promedio): ${soccerData.away_xGA_avg}`);
  }
  
  lines.push('', '── CORNERS ──');
  if (soccerData.home_corners_avg) {
    lines.push(`Corners ${soccerData.home_team} (promedio): ${soccerData.home_corners_avg}/partido`);
  }
  if (soccerData.away_corners_avg) {
    lines.push(`Corners ${soccerData.away_team} (promedio): ${soccerData.away_corners_avg}/partido`);
  }
  
  lines.push('', '── CLASIFICACIÓN ──');
  if (soccerData.home_position) {
    lines.push(`${soccerData.home_team}: ${soccerData.home_position}º (${soccerData.home_points || '?'} pts)`);
  }
  if (soccerData.away_position) {
    lines.push(`${soccerData.away_team}: ${soccerData.away_position}º (${soccerData.away_points || '?'} pts)`);
  }
  
  lines.push('', '── GOLES TEMPORADA ──');
  if (soccerData.home_goals_total && soccerData.home_matches) {
    lines.push(`${soccerData.home_team}: ${soccerData.home_goals_total} goles en ${soccerData.home_matches} partidos (${soccerData.home_goals_avg?.toFixed(2)}/partido)`);
  }
  if (soccerData.away_goals_total && soccerData.away_matches) {
    lines.push(`${soccerData.away_team}: ${soccerData.away_goals_total} goles en ${soccerData.away_matches} partidos (${soccerData.away_goals_avg?.toFixed(2)}/partido)`);
  }
  
  lines.push('', '── TIROS ──');
  if (soccerData.home_shots_avg) {
    lines.push(`${soccerData.home_team}: ${soccerData.home_shots_avg} tiros/partido (${soccerData.home_shots_on_target_avg || '?'} a puerta)`);
  }
  if (soccerData.away_shots_avg) {
    lines.push(`${soccerData.away_team}: ${soccerData.away_shots_avg} tiros/partido (${soccerData.away_shots_on_target_avg || '?'} a puerta)`);
  }
  
  // Forma reciente
  if (soccerData.home_form && soccerData.home_form.length > 0) {
    lines.push('', `── FORMA RECIENTE ${soccerData.home_team} ──`);
    soccerData.home_form.forEach((match: any) => {
      lines.push(`[${match.date}] vs ${match.opponent}: ${match.result} (${match.goals_for}-${match.goals_against})`);
    });
  }
  
  if (soccerData.away_form && soccerData.away_form.length > 0) {
    lines.push('', `── FORMA RECIENTE ${soccerData.away_team} ──`);
    soccerData.away_form.forEach((match: any) => {
      lines.push(`[${match.date}] vs ${match.opponent}: ${match.result} (${match.goals_for}-${match.goals_against})`);
    });
  }
  
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// UNDERSTAT xG DATA (PYTHON)
// ═══════════════════════════════════════════════════════════════

const UNDERSTAT_LEAGUE_MAP: Record<string, string> = {
  'soccer_epl': 'EPL',
  'soccer_spain_la_liga': 'La_liga',
  'soccer_italy_serie_a': 'Serie_A',
  'soccer_germany_bundesliga': 'Bundesliga',
  'soccer_france_ligue_one': 'Ligue_1',
  'ESP-LaLiga': 'La_liga',
  'ENG-Premier-League': 'EPL',
  'ITA-Serie-A': 'Serie_A',
  'GER-Bundesliga': 'Bundesliga',
  'FRA-Ligue-1': 'Ligue_1'
};

async function fetchUnderstatData(
  matchName: string,
  sport: 'football' | 'basketball' | 'baseball'
): Promise<{ understatData: UnderstatXG | null; warning?: string }> {
  // Solo aplicar a fútbol
  if (sport !== 'football') {
    return { understatData: null, warning: 'Understat solo disponible para fútbol' };
  }

  try {
    // Parsear equipos del matchName
    const teams = matchName.split(/\s+vs\s+|\s+v\s+|\s*-vs-\s*|\s*-v-\s*/i);
    const homeTeam = teams[0]?.trim() || '';
    const awayTeam = teams[1]?.trim() || '';
    
    // Detectar liga (usar La_liga por defecto)
    const league = 'La_liga';
    
    // Ruta al script Python
    const scriptPath = path.join(process.cwd(), 'scripts', 'understat_xg.py');
    
    // Preparar input para el script
    const inputPayload = JSON.stringify({
      league,
      home_team: homeTeam,
      away_team: awayTeam,
      season: '2025'
    });
    
    // Ejecutar Python script con timeout de 30 segundos
    const { stdout, stderr } = await execAsync(
      `echo '${inputPayload}' | python3 "${scriptPath}"`,
      {
        timeout: 30000,
        maxBuffer: 1024 * 1024
      }
    );
    
    if (stderr && !stderr.includes('Warning')) {
      console.log(`⚠️ Understat stderr: ${stderr.substring(0, 200)}`);
    }
    
    const understatData: UnderstatXG = JSON.parse(stdout);
    
    if (understatData.fallback) {
      console.log(`⚠️ Understat fallback: ${understatData.error || 'Unknown error'}`);
      return { understatData, warning: understatData.error };
    }
    
    console.log(`✅ Understat fetched: ${homeTeam} vs ${awayTeam}`);
    return { understatData };
    
  } catch (error: any) {
    console.log(`⚠️ Understat not available: ${error.message}`);
    return { 
      understatData: null, 
      warning: 'Understat no disponible (Python script falló)' 
    };
  }
}

function formatUnderstatDataForPrompt(understat: UnderstatXG | null): string {
  if (!understat) {
    return 'DATOS DE UNDERSTAT NO DISPONIBLES';
  }
  
  if (understat.fallback) {
    return `UNDERSTAT FALLBACK: ${understat.error || 'Error desconocido'}`;
  }
  
  const lines: string[] = [
    '═══════════════════════════════════════════════',
    'DATOS OFICIALES xG DE UNDERSTAT',
    '═══════════════════════════════════════════════',
    '',
    `Liga: ${understat.league}`,
    `Temporada: ${understat.season}`,
    '',
    '── xG/xGA PROMEDIO ──',
  ];
  
  if (understat.home_xG_avg) {
    lines.push(`${understat.home_team}: xG ${understat.home_xG_avg}/partido`);
  }
  if (understat.home_xGA_avg) {
    lines.push(`${understat.home_team}: xGA ${understat.home_xGA_avg}/partido`);
  }
  if (understat.away_xG_avg) {
    lines.push(`${understat.away_team}: xG ${understat.away_xG_avg}/partido`);
  }
  if (understat.away_xGA_avg) {
    lines.push(`${understat.away_team}: xGA ${understat.away_xGA_avg}/partido`);
  }
  
  lines.push('', '── xG/xGA TOTALES ──');
  if (understat.home_xG_total) {
    lines.push(`${understat.home_team}: xG total: ${understat.home_xG_total} (${understat.home_matches || '?'} partidos)`);
  }
  if (understat.away_xG_total) {
    lines.push(`${understat.away_team}: xG total: ${understat.away_xG_total} (${understat.away_matches || '?'} partidos)`);
  }
  
  return lines.join('\n');
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

  // Initialize state with 5 steps (0-4)
  const initialState: AnalysisState = {
    currentStep: 0,
    steps: [
      { step: 0, status: 'pending', icon: '📊', message: 'SoccerData: Obteniendo stats oficiales (FBref/FotMob)...', progress: 10 },
      { step: 1, status: 'pending', icon: '🔍', message: 'Buscando cuotas en tiempo real...', progress: 20 },
      { step: 2, status: 'pending', icon: '📡', message: 'Búsqueda paralela (Gemini + Sonar Pro)...', progress: 45 },
      { step: 3, status: 'pending', icon: '🤖', message: 'Claude Sonnet analizando valor...', progress: 70 },
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
  // STEP 0: SOCCERDATA + UNDERSTAT (PYTHON) - OFFICIAL STATS
  // ═══════════════════════════════════════════════════════════════

  emitProgress(0, 'running');
  
  // Ejecutar SoccerData y Understat en paralelo
  const [soccerDataResult, understatResult] = await Promise.all([
    fetchSoccerData(matchName, sport),
    fetchUnderstatData(matchName, sport)
  ]);
  
  const { soccerData, warning: soccerDataWarning } = soccerDataResult;
  const { understatData, warning: understatWarning } = understatResult;
  
  const soccerDataContext = formatSoccerDataForPrompt(soccerData);
  
  if (soccerDataWarning) {
    console.log(`⚠️ Step 0 (SoccerData) warning: ${soccerDataWarning}`);
  }
  if (understatWarning) {
    console.log(`⚠️ Step 0 (Understat) warning: ${understatWarning}`);
  }
  
  console.log(`📊 SoccerData: ${soccerData ? 'OK' : 'FALLBACK'}`);
  console.log(`📊 Understat: ${understatData ? 'OK' : 'FALLBACK'}`);
  
  emitProgress(0, 'completed', soccerDataWarning || understatWarning);

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
  
  const { researchContext: webResearch, dataQuality, warning: researchWarning } = await runParallelResearch(matchName, sport, understatData);
  
  // Combinar SoccerData + Understat + Research Web
  const researchContext = `
${soccerDataContext}

${formatUnderstatDataForPrompt(understatData)}

${webResearch}
`;
  
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
