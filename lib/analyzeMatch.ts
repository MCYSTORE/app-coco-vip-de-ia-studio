/**
 * Coco VIP - AI-Driven Match Analysis Pipeline
 * 
 * 3-Step Pipeline:
 * 1. The Odds API - Real-time odds from major bookmakers
 * 2. Perplexity (via OpenRouter) - Research agent for live web data
 * 3. DeepSeek R1 (via OpenRouter) - Quant/Sniper agent for value calculation
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
// DEEPSEEK SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════

const DEEPSEEK_SYSTEM_PROMPT = `Eres Coco, el motor de Inteligencia Artificial Avanzada de Coco VIP, operando como Senior Quant Analyst de fútbol y NBA. Responde ÚNICAMENTE con JSON válido parseable por JSON.parse(). Sin markdown, sin texto fuera del JSON.

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
// PERPLEXITY SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════

const PERPLEXITY_SYSTEM_PROMPT = `Today is March 2026. You are a sports research assistant with real-time web search. Search for the latest news about the requested match.

Find and return ONLY confirmed data from 2025/2026:
- Injuries and suspensions (confirmed starting XI if available)
- Team motivation and standings context
- Fatigue or back-to-back schedule
- Advanced stats: xG, xGA, PPDA from 2025/2026 season
- Recent form: last 5 matches with exact scores
- Head-to-head record (2024/2025 and 2025/2026 only)
- Relevant tactical news or manager quotes

DO NOT hallucinate.
DO NOT use data from 2024 season or earlier.
If specific data is not found, state clearly: 'No data found for [item]'.

Respond in Spanish with a concise factual summary.`;

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
// STEP 2: PERPLEXITY RESEARCH AGENT
// ═══════════════════════════════════════════════════════════════

async function fetchResearchContext(
  matchName: string,
  sport: 'football' | 'basketball' | 'baseball'
): Promise<{ context: string; warning?: string }> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

  if (!OPENROUTER_API_KEY) {
    return { 
      context: 'Sin contexto web disponible.', 
      warning: 'OPENROUTER_API_KEY no configurada' 
    };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': APP_URL,
        'X-Title': 'Coco VIP Research'
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-pro',
        temperature: 0.1,
        max_tokens: 1000,
        messages: [
          { role: 'system', content: PERPLEXITY_SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `Investiga el partido: ${matchName}\nDeporte: ${sport}\nFecha: Marzo 2026` 
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const context = data.choices?.[0]?.message?.content || 'Sin contexto web disponible.';
    
    console.log(`✅ Research context fetched (${context.length} chars)`);
    return { context };

  } catch (error) {
    console.error('Research agent error:', error);
    return { 
      context: 'Sin contexto web disponible.', 
      warning: 'Búsqueda web fallida' 
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP 3: DEEPSEEK QUANT/SNIPER AGENT
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
        model: 'deepseek/deepseek-r1',
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
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

    console.log(`✅ Quant analysis completed for ${matchName}`);
    return result;

  } catch (error) {
    console.error('Quant agent error:', error);
    throw error;
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
      { step: 2, status: 'pending', icon: '📡', message: 'Investigando la web (Lesiones, xG, Noticias)...', progress: 45 },
      { step: 3, status: 'pending', icon: '🤖', message: 'DeepSeek calculando Edge y valor matemático...', progress: 80 }
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
  // STEP 2: PERPLEXITY RESEARCH
  // ═══════════════════════════════════════════════════════════════

  emitProgress(2, 'running');
  
  const { context: researchContext, warning: researchWarning } = await fetchResearchContext(matchName, sport);
  
  if (researchWarning) {
    console.log(`⚠️ Step 2 warning: ${researchWarning}`);
  }
  
  emitProgress(2, 'completed', researchWarning);

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: DEEPSEEK QUANT ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  emitProgress(3, 'running');
  
  const result = await runQuantAnalysis(matchName, sport, oddsPayload, researchContext);
  
  // Emit final completed state
  if (onProgress) {
    const finalState: AnalysisState = {
      currentStep: 3,
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
