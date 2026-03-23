/**
 * Coco VIP - NBA Research Module
 * 
 * Step independiente para análisis de partidos NBA.
 * NO modifica los steps existentes del pipeline de fútbol.
 * 
 * Este módulo genera un informe de datos en texto plano que
 * otro modelo usará para construir proyecciones de apuestas.
 * 
 * Modelo usado: Perplexity Sonar Pro (web search en tiempo real)
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
  threePAR: number | null;
  FTAR: number | null;
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
// NBA RESEARCH SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════

const NBA_RESEARCH_PROMPT = `Eres un agente de INVESTIGACIÓN NBA.

OBJETIVO:
Devolver un INFORME DE DATOS en texto plano (no JSON) que otro modelo usará
para construir las proyecciones de apuestas. Todo debe estar en ESPAÑOL.

Sigue este plan paso a paso:

1) FORMA RECIENTE (últimos 5 partidos por equipo)
   - Usa nba.com/stats, ESPN y Yahoo Sports.
   - Para cada equipo devuelve una tabla con:
     - Fecha
     - Rival
     - Local/Visitante
     - Resultado final (ej: 118-112)
     - Puntos anotados y recibidos
     - Si cubrió el spread (si el dato está disponible).

2) ESTADÍSTICAS AVANZADAS DE EQUIPO
   Fuentes:
     - https://www.nba.com/stats/teams/advanced
     - https://www.nbastuffer.com/2025-2026-nba-team-stats/
     - https://www.espn.com/nba/hollinger/teamstats

   Para CADA equipo devuelve:
     - Offensive Rating (temporada y últimos 10)
     - Defensive Rating
     - Net Rating
     - Pace (posesiones por 48)
     - Puntos promedio anotados (temporada / últimos 10)
     - Puntos promedio recibidos (temporada / últimos 10)
     - eFG%, 3PAr y FTr si están disponibles.

3) LESIONADOS Y DESCANSO
   - Busca en ESPN, Rotowire, NBA.com:
     "[equipo] injuries"
   - Lista:
     - Jugadores Fuera, Cuestionables, Probables
     - Motivo (lesión, descanso, etc.)
   - Indica si es:
     - back-to-back
     - 3 en 4 noches
     - 4 en 6 noches

4) TENDENCIAS DE MERCADO
   - Porcentaje Over/Under de cada equipo
   - Récord ATS de cada equipo
   - Patrones relevantes de totales recientes.

5) RESUMEN PARA MODELO CUANTITATIVO
   - Ritmo esperado del partido
   - Nivel ofensivo y defensivo de cada equipo
   - Impacto de lesiones y descanso
   - Patrones fuertes: rachas Over/Under, ATS, etc.

REGLAS:
- No inventes números. Si falta un dato, dilo explícitamente.
- Usa fuentes oficiales primero (nba.com, ESPN, NBAstuffer).
- Responde solo con el informe en texto, sin JSON.
- Idioma: ESPAÑOL.

ANCLA TEMPORAL:
Hoy es Marzo 2026. Temporada NBA 2025-2026.
Todo análisis se basa EXCLUSIVAMENTE en datos de la temporada 2025-2026.
PROHIBIDO usar datos de temporadas anteriores.`;

// ═══════════════════════════════════════════════════════════════
// MAIN FUNCTION: NBA RESEARCH
// ═══════════════════════════════════════════════════════════════

export async function runNBAResearch(
  options: NBAAnalysisOptions
): Promise<NBAResearchResult> {
  const { matchName, date, onProgress } = options;
  
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  
  if (!OPENROUTER_API_KEY) {
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
      error: 'OPENROUTER_API_KEY no configurada'
    };
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
    
    // Usar Perplexity Sonar Pro para búsqueda web en tiempo real
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "perplexity/sonar-pro",
        search_type: "pro",
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: NBA_RESEARCH_PROMPT
          },
          {
            role: "user",
            content: `Partido: ${matchName}
Fecha: ${gameDate}
Liga: NBA Regular Season

Busca información en tiempo real sobre este partido y genera el informe completo.
Recuerda usar fuentes oficiales y responder en ESPAÑOL.`
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Sonar Pro API error: ${response.status}`);
    }
    
    const data = await response.json();
    const report = data.choices?.[0]?.message?.content ?? '';
    
    // Extraer fuentes citadas (Perplexity las incluye)
    const sources: string[] = [];
    if (data.citations) {
      sources.push(...data.citations);
    }
    
    onProgress?.(`✅ Investigación completada (${report.length} caracteres)`);
    
    // Parsear el reporte en texto plano a datos estructurados
    const parsedData = parseNBAReport(report, homeTeam, awayTeam);
    
    return {
      success: true,
      report,
      data: parsedData,
      sources,
      timestamp: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error('NBA Research error:', error);
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
      error: error.message
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER: PARSE NBA REPORT TO STRUCTURED DATA
// ═══════════════════════════════════════════════════════════════

function parseNBAReport(
  report: string, 
  homeTeam: string, 
  awayTeam: string
): NBAResearchResult['data'] {
  // Estructura base
  const result: NBAResearchResult['data'] = {
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
  
  // El reporte en texto ya contiene toda la información
  // que el modelo de análisis cuantitativo usará directamente.
  // El parsing estructurado es opcional para uso futuro.
  
  return result;
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
  
  return `
═══════════════════════════════════════════════
INFORME DE INVESTIGACIÓN NBA
Partido: ${nbaResult.data.homeTeam} vs ${nbaResult.data.awayTeam}
Fecha: ${new Date(nbaResult.timestamp).toLocaleDateString('es-ES')}
═══════════════════════════════════════════════

${nbaResult.report}

═══════════════════════════════════════════════
FUENTES CONSULTADAS
═══════════════════════════════════════════════
${nbaResult.sources.length > 0 
  ? nbaResult.sources.map((s, i) => `${i + 1}. ${s}`).join('\n')
  : 'Fuentes: nba.com, ESPN, NBAstuffer, Rotowire'
}
`;
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FOR PIPELINE INTEGRATION
// ═══════════════════════════════════════════════════════════════

/**
 * Función de conveniencia para integrar NBA research
 * en el pipeline principal de análisis.
 * 
 * USO:
 * const nbaData = await fetchNBAResearch("Lakers vs Celtics");
 * // nbaData es texto plano para pasar a Claude/Grok
 */
export async function fetchNBAResearch(
  matchName: string,
  date?: string
): Promise<string> {
  const result = await runNBAResearch({ matchName, date });
  return formatNBAReportForPipeline(result);
}
