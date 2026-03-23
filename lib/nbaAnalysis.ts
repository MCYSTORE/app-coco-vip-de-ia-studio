/**
 * Coco VIP - NBA Research Module
 * 
 * Step independiente para análisis de partidos NBA.
 * NO modifica los steps existentes del pipeline de fútbol.
 * 
 * Pipeline NBA:
 * - Sección A: Gemini 2.5 Pro (Google Search) - Forma, lesiones, contexto
 * - Sección B: Perplexity Sonar Pro - Estadísticas avanzadas
 * 
 * Modelo usado: Gemini 2.5 Pro + Perplexity Sonar Pro (parallel calls)
 */

// ═══════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface NBAAnalysisOptions {
  /** Formato: "Lakers vs Celtics" o "Los Angeles Lakers vs Boston Celtics" */
  matchName: string;
  /** Fecha del partido (opcional, default: fecha actual) */
  date?: string;
  /** Callback para progreso */
  onProgress?: (message: string) => void;
}

export interface NBATeamForm {
  team: string;
  last5Games: Array<{
    date: string;
    opponent: string;
    venue: 'Home' | 'Away';
    result: string; // "118-112"
    pointsFor: number;
    pointsAgainst: number;
    coveredSpread?: boolean;
  }>;
}

export interface NBATeamStats {
  team: string;
  offensiveRating: number | null;
  offensiveRatingLast10: number | null;
  defensiveRating: number | null;
  netRating: number | null;
  pace: number | null;
  avgPointsScored: number | null;
  avgPointsAllowed: number | null;
  avgPointsScoredLast10: number | null;
  avgPointsAllowedLast10: number | null;
  eFGPercent: number | null;
}

export interface NBAInjuryReport {
  team: string;
  players: Array<{
    name: string;
    status: 'Out' | 'Questionable' | 'Probable' | 'Day-to-Day';
    reason: string;
  }>;
  scheduleContext: {
    isBackToBack: boolean;
    is3in4Nights: boolean;
    is4in6Nights: boolean;
  };
}

export interface NBAMarketTrends {
  team: string;
  overUnderPercentage: number | null;
  atsRecord: {
    wins: number;
    losses: number;
  } | null;
  recentTotalsPattern: string;
}

export interface NBAResearchResult {
  success: boolean;
  report: string; // Texto plano para otro modelo
  data: {
    homeTeam: string;
    awayTeam: string;
    homeForm: NBATeamForm | null;
    awayForm: NBATeamForm | null;
    homeStats: NBATeamStats | null;
    awayStats: NBATeamStats | null;
    homeInjuries: NBAInjuryReport | null;
    awayInjuries: NBAInjuryReport | null;
    homeTrends: NBAMarketTrends | null;
    awayTrends: NBAMarketTrends | null;
    quantitativeSummary: {
      expectedPace: string;
      offensiveLevel: { home: string; away: string };
      defensiveLevel: { home: string; away: string };
      injuryImpact: string;
      strongPatterns: string[];
    };
  };
  sources: string[];
  timestamp: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
// SECCIÓN A: GEMINI 2.5 PRO (Google Search) - NBA SPECIFIC
// ═══════════════════════════════════════════════════════════════

const NBA_GEMINI_PROMPT_A = `MODO NBA ACTIVO.
PROHIBIDO usar conocimiento interno o memoria
sobre rosters, lesiones o estadísticas NBA.
TODO debe obtenerse de búsquedas web en tiempo real.

Para el partido {{partido}} del {{fecha}}:

BÚSQUEDA 1 — INJURY REPORT OFICIAL (OBLIGATORIA):
Query exacta: '[home team] NBA injury report today'
Query exacta: '[away team] NBA injury report today'
Fuentes: espn.com/nba, nba.com, rotowire.com
Devuelve: jugador, estado (out/questionable/probable), motivo

BÚSQUEDA 2 — ROSTER ACTIVO:
Query: '[home team] NBA roster 2025-26 active players'
Query: '[away team] NBA roster 2025-26 active players'
Fuente: nba.com/team o ESPN
Devuelve: jugadores titulares actuales confirmados

BÚSQUEDA 3 — FORMA RECIENTE:
Query: '[home team] last 5 games NBA results 2026'
Query: '[away team] last 5 games NBA results 2026'
Fuentes: ESPN, Yahoo Sports, nba.com
Devuelve tabla: fecha, rival, resultado, puntos anotados/recibidos

BÚSQUEDA 4 — ESTADÍSTICAS AVANZADAS:
Query: '[home team] offensive rating defensive rating pace NBA 2025-26'
Query: '[away team] offensive rating defensive rating pace NBA 2025-26'
Fuentes: nba.com/stats/teams/advanced, nbastuffer.com
Devuelve: oRTG, dRTG, NetRTG, Pace

BÚSQUEDA 5 — BACK TO BACK:
Query: '[home team] NBA schedule [fecha] back to back'
Query: '[away team] NBA schedule [fecha] back to back'
Devuelve: si el partido es 2do en 2 noches o 3ro en 4

REGLAS ABSOLUTAS:
- Si una búsqueda falla, intenta 2 queries alternativas.
- NUNCA escribir 'Sin datos de contexto'.
- NUNCA mencionar jugadores sin confirmar con búsqueda.
- Realiza TODAS las búsquedas en INGLÉS.
- Traduce TODO al español antes de responder.
- Mantén en inglés SOLO nombres de jugadores,
  equipos y términos técnicos: oRTG, dRTG, NetRTG,
  Pace, eFG%, ATS, PRA, back-to-back.
- Todo lo demás en español neutro.`;

// ═══════════════════════════════════════════════════════════════
// SECCIÓN B: SONAR PRO - ESTADÍSTICAS AVANZADAS NBA
// ═══════════════════════════════════════════════════════════════

const NBA_SONAR_PROMPT_B = `MODO NBA ACTIVO.
PROHIBIDO usar memoria interna sobre rosters
o estadísticas. TODO desde búsquedas reales.

BÚSQUEDAS EN INGLÉS — RESPUESTA EN ESPAÑOL.

BÚSQUEDA 1 — ESTADÍSTICAS AVANZADAS:
Query: '[home team] offensive rating defensive rating pace 2025-26'
Query: '[away team] offensive rating defensive rating pace 2025-26'
Fuentes en orden:
1. nba.com/stats/teams/advanced
2. nbastuffer.com/2025-2026-nba-team-stats
3. espn.com/nba/hollinger/teamstats

BÚSQUEDA 2 — LESIONADOS OFICIALES:
Query: '[home team] NBA injury report [fecha]'
Query: '[away team] NBA injury report [fecha]'
Query: '[home team] out questionable tonight NBA'
Query: '[away team] out questionable tonight NBA'
Fuentes en orden:
1. rotowire.com/basketball/nba-lineups
2. espn.com/nba (injury report)
3. nba.com (official status)

BÚSQUEDA 3 — TENDENCIAS DE MERCADO:
Query: '[home team] NBA over under record 2025-26'
Query: '[away team] NBA ATS record 2025-26'
Fuentes: covers.com, teamrankings.com

FORMATO OBLIGATORIO DE RESPUESTA:
STATS AVANZADAS:
├── [Local] oRTG: X.X | dRTG: X.X | NetRTG: X.X | Pace: X.X
└── [Visitante] oRTG: X.X | dRTG: X.X | NetRTG: X.X | Pace: X.X

LESIONADOS:
├── [Local]: jugador - estado - fuente
└── [Visitante]: jugador - estado - fuente

TENDENCIAS:
├── [Local] Over/Under record: XX-XX
└── [Visitante] Over/Under record: XX-XX

REGLAS ABSOLUTAS:
- PROHIBIDO campos xG, xGA, BTTS, corners en NBA.
- PROHIBIDO usar datos de memoria sin búsqueda.
- PROHIBIDO mencionar jugadores sin verificar roster.
- Si un dato falla en fuente 1, ir a fuente 2 y 3.
- Solo escribir DATO NO ENCONTRADO si fallaron
  todas las fuentes disponibles.
- Búsquedas en INGLÉS, respuesta en ESPAÑOL.
- Mantén en inglés solo: nombres de jugadores,
  equipos y términos técnicos (oRTG, dRTG, Pace,
  eFG%, ATS, PRA, back-to-back).`;

// ═══════════════════════════════════════════════════════════════
// MAIN FUNCTION: NBA RESEARCH (PARALLEL CALLS)
// ═══════════════════════════════════════════════════════════════

export async function runNBAResearch(
  options: NBAAnalysisOptions
): Promise<NBAResearchResult> {
  const { matchName, date, onProgress } = options;
  
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  
  if (!OPENROUTER_API_KEY) {
    return createErrorResult('OPENROUTER_API_KEY no configurada');
  }
  
  try {
    // Parsear equipos del matchName
    const teams = matchName.split(/\s+vs\s+|\s+v\s+/i);
    const homeTeam = teams[0]?.trim() || '';
    const awayTeam = teams[1]?.trim() || '';
    
    const gameDate = date || new Date().toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    onProgress?.(`🔍 Iniciando investigación NBA: ${homeTeam} vs ${awayTeam}`);
    
    // ═══════════════════════════════════════════════════════════════
    // PARALLEL CALLS: Gemini 2.5 Pro + Sonar Pro
    // ═══════════════════════════════════════════════════════════════
    
    const [researchA, researchB] = await Promise.all([
      
      // ── LLAMADA A: Gemini 2.5 Pro (forma, lesiones, contexto)
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro-exp-03-25",
          max_tokens: 2500,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: NBA_GEMINI_PROMPT_A
            },
            {
              role: "user",
              content: `Partido: ${matchName}
Fecha: ${gameDate}
Liga: NBA Regular Season
Equipo Local: ${homeTeam}
Equipo Visitante: ${awayTeam}

Busca información en tiempo real con Google Search.
Responde SOLO en español con la estructura pedida.`
            }
          ]
        })
      }).then(r => r.json())
        .then(r => r.choices?.[0]?.message?.content ?? "Sin datos de forma y lesiones")
        .catch(() => "Sin datos de forma y lesiones (error Gemini)"),
      
      // ── LLAMADA B: Perplexity Sonar Pro (estadísticas avanzadas)
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "perplexity/sonar-pro",
          search_type: "pro",
          max_tokens: 2000,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: NBA_SONAR_PROMPT_B
            },
            {
              role: "user",
              content: `Partido: ${matchName}
Fecha: ${gameDate}
Equipo Local: ${homeTeam}
Equipo Visitante: ${awayTeam}

Busca estadísticas avanzadas y lesiones en tiempo real.
NO busques corners ni xG (eso es fútbol).
Responde SOLO en español con la estructura pedida.`
            }
          ]
        })
      }).then(r => r.json())
        .then(r => r.choices?.[0]?.message?.content ?? "Sin datos estadísticos")
        .catch(() => "Sin datos estadísticos (error Sonar Pro)")
      
    ]);
    
    // Combinar las respuestas
    const report = `
═══════════════════════════════════════════════
INFORME DE INVESTIGACIÓN NBA
Partido: ${homeTeam} vs ${awayTeam}
Fecha: ${gameDate}
═══════════════════════════════════════════════

═══════════════════════════════════════════════
SECCIÓN A: FORMA, LESIONES Y CONTEXTO
(Fuente: Gemini 2.5 Pro con Google Search)
═══════════════════════════════════════════════

${researchA}

═══════════════════════════════════════════════
SECCIÓN B: ESTADÍSTICAS AVANZADAS Y TENDENCIAS
(Fuente: Perplexity Sonar Pro)
═══════════════════════════════════════════════

${researchB}
`;
    
    onProgress?.(`✅ Investigación completada (${report.length} caracteres)`);
    
    // Parsear datos estructurados
    const parsedData = parseNBAReport(report, homeTeam, awayTeam);
    
    return {
      success: true,
      report,
      data: parsedData,
      sources: ['nba.com/stats', 'ESPN', 'NBAstuffer', 'Rotowire'],
      timestamp: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error('NBA Research error:', error);
    return createErrorResult(error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER: CREATE ERROR RESULT
// ═══════════════════════════════════════════════════════════════

function createErrorResult(errorMsg: string): NBAResearchResult {
  return {
    success: false,
    report: '',
    data: {
      homeTeam: '',
      awayTeam: '',
      homeForm: null,
      awayForm: null,
      homeStats: null,
      awayStats: null,
      homeInjuries: null,
      awayInjuries: null,
      homeTrends: null,
      awayTrends: null,
      quantitativeSummary: {
        expectedPace: '',
        offensiveLevel: { home: '', away: '' },
        defensiveLevel: { home: '', away: '' },
        injuryImpact: '',
        strongPatterns: []
      }
    },
    sources: [],
    timestamp: new Date().toISOString(),
    error: errorMsg
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPER: PARSE NBA REPORT TO STRUCTURED DATA
// ═══════════════════════════════════════════════════════════════

function parseNBAReport(
  report: string, 
  homeTeam: string, 
  awayTeam: string
): NBAResearchResult['data'] {
  return {
    homeTeam,
    awayTeam,
    homeForm: null,
    awayForm: null,
    homeStats: null,
    awayStats: null,
    homeInjuries: null,
    awayInjuries: null,
    homeTrends: null,
    awayTrends: null,
    quantitativeSummary: {
      expectedPace: '',
      offensiveLevel: { home: '', away: '' },
      defensiveLevel: { home: '', away: '' },
      injuryImpact: '',
      strongPatterns: []
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// UTILITY: FORMAT REPORT FOR PIPELINE
// ═══════════════════════════════════════════════════════════════

export function formatNBAReportForPipeline(
  nbaResult: NBAResearchResult
): string {
  if (!nbaResult.success) {
    return `═══════════════════════════════════════════════
INVESTIGACIÓN NBA NO DISPONIBLE
═══════════════════════════════════════════════

Error: ${nbaResult.error || 'Error desconocido'}
Se recomienda usar datos estimados.`;
  }
  
  return nbaResult.report;
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FOR PIPELINE INTEGRATION
// ═══════════════════════════════════════════════════════════════

export async function fetchNBAResearch(
  matchName: string,
  date?: string
): Promise<string> {
  const result = await runNBAResearch({ matchName, date });
  return formatNBAReportForPipeline(result);
}
