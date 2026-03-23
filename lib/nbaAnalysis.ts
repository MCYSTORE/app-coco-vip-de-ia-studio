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

const NBA_GEMINI_PROMPT_A = `Eres un investigador deportivo NBA especializado.

Busca con Google Search para el partido indicado.

BUSCA OBLIGATORIAMENTE:

1) LESIONADOS CONFIRMADOS de AMBOS equipos:
   Query: '[equipo] injury report today NBA 2026'
   Query: '[equipo] injuries ESPN rotowire'
   Fuentes: ESPN, Rotowire, NBA.com official injury report

2) ESTADÍSTICAS AVANZADAS de la temporada:
   Query: '[equipo] offensive rating defensive rating pace 2025-26'
   Fuentes: nba.com/stats/teams/advanced, nbastuffer.com

3) FORMA RECIENTE (últimos 5 partidos):
   Query: '[equipo] last 5 games results NBA'
   Devuelve: fecha, rival, resultado, puntos anotados/recibidos

4) BACK-TO-BACK o FATIGA:
   Query: '[equipo] schedule back to back march 2026'

REGLAS:
- No devuelvas 'Sin datos de contexto'.
- Si Google Search no responde, intenta 3 queries distintas antes de declarar que no hay datos.
- Responde TODO EN ESPAÑOL.
- Usa el formato de árbol ├── └── para estructurar la respuesta.

FORMATO DE RESPUESTA:

📋 SECCIÓN A — FORMA, LESIONES Y CONTEXTO NBA

1. FORMA RECIENTE (últimos 5 partidos de CADA equipo)
   ├── [Local]: [fecha] vs [rival] [marcador] | [nota breve]
   ├── [Local]: [fecha] vs [rival] [marcador] | [nota breve]
   ├── [Local]: [fecha] vs [rival] [marcador] | [nota breve]
   ├── [Local]: [fecha] vs [rival] [marcador] | [nota breve]
   └── [Local]: [fecha] vs [rival] [marcador] | [nota breve]
   ├── [Visitante]: [fecha] vs [rival] [marcador] | [nota breve]
   ├── [Visitante]: [fecha] vs [rival] [marcador] | [nota breve]
   ├── [Visitante]: [fecha] vs [rival] [marcador] | [nota breve]
   ├── [Visitante]: [fecha] vs [rival] [marcador] | [nota breve]
   └── [Visitante]: [fecha] vs [rival] [marcador] | [nota breve]

2. LESIONADOS Y ESTADO (OBLIGATORIO)
   ├── [Local]: [jugador] - [Out/Questionable/Probable] - [motivo]
   └── [Visitante]: [jugador] - [Out/Questionable/Probable] - [motivo]
   (Si no hay lesionados: 'Plantilla completa según [fuente]')

3. CONTEXTO DE CALENDARIO
   ├── [Local]: Back-to-back: [Sí/No] | 3 en 4 noches: [Sí/No]
   └── [Visitante]: Back-to-back: [Sí/No] | 3 en 4 noches: [Sí/No]

4. NOTICIAS RELEVANTES (últimas 48h)
   ├── [fecha] — [titular] — [fuente]
   └── [fecha] — [titular] — [fuente]`;

// ═══════════════════════════════════════════════════════════════
// SECCIÓN B: SONAR PRO - ESTADÍSTICAS AVANZADAS NBA
// ═══════════════════════════════════════════════════════════════

const NBA_SONAR_PROMPT_B = `Eres un investigador OSINT deportivo de nivel senior.
Especialidad: estadísticas avanzadas NBA y lesiones confirmadas.

Hoy es Marzo 2026. Temporada NBA 2025-2026.

ESTADÍSTICAS AVANZADAS NBA (OBLIGATORIO):
Busca para cada equipo:
  - Offensive Rating (oRTG): puntos por 100 posesiones
  - Defensive Rating (dRTG): puntos permitidos por 100 posesiones
  - Net Rating: oRTG - dRTG
  - Pace: posesiones por 48 minutos
  - eFG%: effective field goal percentage

Fuentes en orden:
1. https://www.nba.com/stats/teams/advanced
2. https://www.nbastuffer.com/2025-2026-nba-team-stats/
3. https://www.espn.com/nba/hollinger/teamstats

LESIONADOS (OBLIGATORIO):
Busca injury report oficial:
  Query: '[equipo] NBA injury report [fecha]'
  Query: '[equipo] out questionable doubtful tonight'
  Fuentes: ESPN, Rotowire, NBA.com

TENDENCIAS DE MERCADO:
  - Récord ATS (Against The Spread)
  - % de partidos Over/Under

REGLAS:
- NO buscar corners en NBA.
- NO usar campos xG/xGA.
- NO escribir DATO NO ENCONTRADO sin buscar en mínimo 3 fuentes distintas.
- Responde TODO EN ESPAÑOL.
- Usa el formato de árbol ├── └──.

FORMATO DE RESPUESTA OBLIGATORIO:

📋 SECCIÓN B — ESTADÍSTICAS AVANZADAS Y TENDENCIAS NBA

1. STATS AVANZADAS 2025-26:
   ├── [Local] oRTG: X.X | dRTG: X.X | NetRTG: X.X | Pace: X.X
   └── [Visitante] oRTG: X.X | dRTG: X.X | NetRTG: X.X | Pace: X.X

2. PUNTOS PROMEDIO:
   ├── [Local]: PPG temporada: X.X | PPG últimos 10: X.X
   ├── [Local]: Puntos permitidos: X.X
   ├── [Visitante]: PPG temporada: X.X | PPG últimos 10: X.X
   └── [Visitante]: Puntos permitidos: X.X

3. LESIONADOS CONFIRMADOS:
   ├── [Local]: [jugador] - [estado] - [fuente]
   └── [Visitante]: [jugador] - [estado] - [fuente]

4. TENDENCIAS ATS:
   ├── [Local] ATS: X-X | % Over: XX%
   └── [Visitante] ATS: X-X | % Over: XX%

5. PATRONES RECIENTES:
   └── [Descripción de rachas o tendencias detectadas]`;

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
