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

const NBA_GEMINI_PROMPT_A = `MODO NBA. PROHIBIDO usar memoria interna.
Busca en inglés, responde en español.

Para {{partido}} del {{fecha}}:

Query 1: '[home team] NBA injury report today site:espn.com'
Query 2: '[away team] NBA injury report today site:espn.com'
Query 3: '[home team] last 5 games NBA 2026 site:espn.com'
Query 4: '[away team] last 5 games NBA 2026 site:espn.com'
Query 5: '[home team] offensive rating pace 2025-26 site:nba.com'
Query 6: '[away team] offensive rating pace 2025-26 site:nba.com'

Formato respuesta (en español):
LESIONADOS [Local]: jugador - estado - fuente
LESIONADOS [Visitante]: jugador - estado - fuente
FORMA [Local]: fecha | rival | resultado | pts anotados | pts recibidos
FORMA [Visitante]: fecha | rival | resultado | pts anotados | pts recibidos
STATS [Local]: oRTG: X | dRTG: X | NetRTG: X | Pace: X
STATS [Visitante]: oRTG: X | dRTG: X | NetRTG: X | Pace: X

NUNCA escribir 'Sin datos de contexto'.
NUNCA mencionar jugadores sin verificar con búsqueda.

Si no encuentras datos con la primera búsqueda,
intenta estas queries alternativas:
- '[home team] NBA stats 2026'
- '[away team] NBA stats 2026'
- '[home team] vs [away team] NBA preview'
- '[home team] basketball reference stats 2026'
- '[away team] basketball reference stats 2026'
NUNCA devolver 'Sin datos de contexto'
sin haber intentado mínimo 3 queries distintas.`;

// ═══════════════════════════════════════════════════════════════
// SECCIÓN B: SONAR PRO - ESTADÍSTICAS AVANZADAS NBA
// ═══════════════════════════════════════════════════════════════

const NBA_SONAR_PROMPT_B = `MODO NBA. Busca en inglés, responde en español.
PROHIBIDO: xG, xGA, BTTS, corners, goles.
SOLO estadísticas de baloncesto.

Para {{partido}}:

Query 1: '[home team] NBA injury report [fecha]'
Query 2: '[away team] NBA injury report [fecha]'
Query 3: '[home team] offensive defensive rating NBA 2025-26'
Query 4: '[away team] offensive defensive rating NBA 2025-26'
Query 5: '[home team] NBA over under record 2025-26'
Query 6: '[away team] NBA ATS record 2025-26'

Fuentes: rotowire.com, nba.com/stats, nbastuffer.com,
espn.com/nba, teamrankings.com

Formato respuesta (en español):
STATS AVANZADAS:
[Local] oRTG: X | dRTG: X | NetRTG: X | Pace: X
[Visitante] oRTG: X | dRTG: X | NetRTG: X | Pace: X

LESIONADOS:
[Local]: jugador - estado - fuente
[Visitante]: jugador - estado - fuente

TENDENCIAS:
[Local] Over/Under record: XX-XX
[Visitante] ATS record: XX-XX`;

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
      
      // ── LLAMADA A: Gemini 2.5 Pro (forma, lesiones, contexto) CON FALLBACK
      (async () => {
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
          });
          
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          
          // FIX 2: Si respuesta vacía o muy corta, reintento con query alternativa
          if (!content || content.length < 50 || content.includes('Sin datos')) {
            console.log('⚠️ Gemini respuesta vacía, reintentando con query alternativa...');
            
            const retryResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
                    content: `Busca estadísticas NBA en basketball-reference.com, nba.com/stats, espn.com.
Responde en español con cualquier dato que encuentres.`
                  },
                  {
                    role: "user",
                    content: `${homeTeam} vs ${awayTeam} NBA ${gameDate} stats injuries`
                  }
                ]
              })
            });
            
            const retryData = await retryResponse.json();
            const retryContent = retryData.choices?.[0]?.message?.content;
            
            return retryContent || content || 'No se encontraron datos tras 2 intentos';
          }
          
          return content;
        } catch (error) {
          console.error('Error en Gemini:', error);
          return 'Error en búsqueda de contexto NBA';
        }
      })(),
      
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
// FIX 1: Ahora parsea realmente los datos del reporte de texto
// ═══════════════════════════════════════════════════════════════

function parseNBAReport(
  report: string, 
  homeTeam: string, 
  awayTeam: string
): NBAResearchResult['data'] {
  
  // Helper para extraer números de texto
  const extractNumber = (text: string, pattern: RegExp): number | null => {
    const match = text.match(pattern);
    return match ? parseFloat(match[1]) : null;
  };
  
  // Helper para extraer records ATS y O/U
  const extractRecord = (text: string, pattern: RegExp): { wins: number; losses: number } | null => {
    const match = text.match(pattern);
    if (match) {
      return { wins: parseInt(match[1]), losses: parseInt(match[2]) };
    }
    return null;
  };
  
  // Parsear STATS del reporte - buscar patrones como "oRTG: 115.2"
  const homeStats: NBATeamStats = {
    team: homeTeam,
    offensiveRating: extractNumber(report, /(?:oRTG|offensive rating|ORTG)[\s:]+(\d+\.?\d*)/i) ||
                      extractNumber(report, new RegExp(`${homeTeam}[^\n]*oRTG[\s:]+(\d+\.?\d*)`, 'i')),
    offensiveRatingLast10: null,
    defensiveRating: extractNumber(report, /(?:dRTG|defensive rating|DRTG)[\s:]+(\d+\.?\d*)/i) ||
                      extractNumber(report, new RegExp(`${homeTeam}[^\n]*dRTG[\s:]+(\d+\.?\d*)`, 'i')),
    netRating: extractNumber(report, /(?:NetRTG|net rating)[\s:]+(-?\d+\.?\d*)/i) ||
               extractNumber(report, new RegExp(`${homeTeam}[^\n]*NetRTG[\s:]+(-?\d+\.?\d*)`, 'i')),
    pace: extractNumber(report, /(?:Pace)[\s:]+(\d+\.?\d*)/i) ||
          extractNumber(report, new RegExp(`${homeTeam}[^\n]*Pace[\s:]+(\d+\.?\d*)`, 'i')),
    avgPointsScored: extractNumber(report, /(?:PPG|pts.*anotados|points.*scored)[\s:]*(\d+\.?\d*)/i),
    avgPointsAllowed: extractNumber(report, /(?:pts.*recibidos|points.*allowed)[\s:]*(\d+\.?\d*)/i),
    avgPointsScoredLast10: null,
    avgPointsAllowedLast10: null,
    eFGPercent: null
  };
  
  const awayStats: NBATeamStats = {
    team: awayTeam,
    offensiveRating: extractNumber(report, new RegExp(`${awayTeam}[^\n]*oRTG[\s:]+(\d+\.?\d*)`, 'i')) ||
                      extractNumber(report, /(?:oRTG|offensive rating|ORTG)[\s:]+(\d+\.?\d*)/gi)?.[1] || null,
    offensiveRatingLast10: null,
    defensiveRating: extractNumber(report, new RegExp(`${awayTeam}[^\n]*dRTG[\s:]+(\d+\.?\d*)`, 'i')) ||
                      null,
    netRating: extractNumber(report, new RegExp(`${awayTeam}[^\n]*NetRTG[\s:]+(-?\d+\.?\d*)`, 'i')) ||
               null,
    pace: extractNumber(report, new RegExp(`${awayTeam}[^\n]*Pace[\s:]+(\d+\.?\d*)`, 'i')) ||
          null,
    avgPointsScored: null,
    avgPointsAllowed: null,
    avgPointsScoredLast10: null,
    avgPointsAllowedLast10: null,
    eFGPercent: null
  };
  
  // Parsear records ATS y O/U
  const homeATSMatch = report.match(new RegExp(`${homeTeam}[^\n]*ATS[^\n]*(\d+)-(\d+)`, 'i'));
  const awayATSMatch = report.match(new RegExp(`${awayTeam}[^\n]*ATS[^\n]*(\d+)-(\d+)`, 'i'));
  const homeOUMatch = report.match(new RegExp(`${homeTeam}[^\n]*(?:O\/U|Over\/Under)[^\n]*(\d+)-(\d+)`, 'i'));
  const awayOUMatch = report.match(new RegExp(`${awayTeam}[^\n]*(?:O\/U|Over\/Under)[^\n]*(\d+)-(\d+)`, 'i'));
  
  const homeTrends: NBAMarketTrends = {
    team: homeTeam,
    overUnderPercentage: null,
    atsRecord: homeATSMatch ? { wins: parseInt(homeATSMatch[1]), losses: parseInt(homeATSMatch[2]) } : null,
    recentTotalsPattern: ''
  };
  
  const awayTrends: NBAMarketTrends = {
    team: awayTeam,
    overUnderPercentage: null,
    atsRecord: awayATSMatch ? { wins: parseInt(awayATSMatch[1]), losses: parseInt(awayATSMatch[2]) } : null,
    recentTotalsPattern: ''
  };
  
  // Calcular quantitative summary si hay datos
  const quantitativeSummary = {
    expectedPace: homeStats.pace && awayStats.pace 
      ? ((homeStats.pace + awayStats.pace) / 2).toFixed(1)
      : '',
    offensiveLevel: {
      home: homeStats.offensiveRating ? (homeStats.offensiveRating > 115 ? 'Alto' : homeStats.offensiveRating > 110 ? 'Medio' : 'Bajo') : '',
      away: awayStats.offensiveRating ? (awayStats.offensiveRating > 115 ? 'Alto' : awayStats.offensiveRating > 110 ? 'Medio' : 'Bajo') : ''
    },
    defensiveLevel: {
      home: homeStats.defensiveRating ? (homeStats.defensiveRating < 110 ? 'Fuerte' : homeStats.defensiveRating < 115 ? 'Medio' : 'Débil') : '',
      away: awayStats.defensiveRating ? (awayStats.defensiveRating < 110 ? 'Fuerte' : awayStats.defensiveRating < 115 ? 'Medio' : 'Débil') : ''
    },
    injuryImpact: '',
    strongPatterns: []
  };
  
  console.log('📊 NBA Stats parseadas:', {
    home: { oRTG: homeStats.offensiveRating, dRTG: homeStats.defensiveRating, Pace: homeStats.pace },
    away: { oRTG: awayStats.offensiveRating, dRTG: awayStats.defensiveRating, Pace: awayStats.pace }
  });
  
  return {
    homeTeam,
    awayTeam,
    homeForm: null,
    awayForm: null,
    homeStats,
    awayStats,
    homeInjuries: null,
    awayInjuries: null,
    homeTrends,
    awayTrends,
    quantitativeSummary
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
