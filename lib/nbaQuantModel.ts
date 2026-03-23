/**
 * Coco VIP - NBA Quantitative Model
 * 
 * MODELO CUANTITATIVO NBA - Step independiente del pipeline.
 * Recibe: Informe de investigación NBA + Odds del partido
 * Produce: JSON estructurado con proyecciones de apuestas
 * 
 * NO modifica los steps existentes del pipeline de fútbol.
 */

// ═══════════════════════════════════════════════════════════════
// INTERFACES - SCHEMA NBA
// ═══════════════════════════════════════════════════════════════

export interface NBAATSRecord {
  wins: number;
  losses: number;
  pushes: number;
}

export interface NBAOverUnderRecord {
  over: number;
  under: number;
  push: number;
}

export interface NBATeamStatsQuant {
  pace_season: number;
  pace_last10: number;
  off_rating_season: number;
  def_rating_season: number;
  net_rating_season: number;
  points_avg_season: number;
  points_avg_last10: number;
  points_allowed_season: number;
  points_allowed_last10: number;
  ats_record: NBAATSRecord;
  over_under_record: NBAOverUnderRecord;
  injuries_key: string[];
  back_to_back: boolean;
}

export interface NBAGameTotalMarket {
  book_line: number;
  model_projection: number;
  prob_over: number;
  prob_under: number;
  edge_over: number;
  kelly_over: number;
  recommended_side: 'over' | 'under' | 'none';
}

export interface NBATeamTotalMarket {
  book_line: number;
  projection: number;
  prob_over: number;
  edge_over: number;
}

export interface NBATotalsMarkets {
  game_total: NBAGameTotalMarket;
  team_totals: {
    home: NBATeamTotalMarket;
    away: NBATeamTotalMarket;
  };
}

export interface NBASpreadMarket {
  book_spread_home: number;
  model_fair_spread: number;
  prob_home_cover: number;
  prob_away_cover: number;
  edge_home: number;
  kelly_home: number;
  recommended_side: 'home' | 'away' | 'none';
}

export interface NBAPlayerProp {
  player_name: string;
  team: string;
  prop_type: 'points' | 'rebounds' | 'assists' | 'rebounds_assists' | 'pra' | 'threes';
  book_line: number;
  avg_season: number;
  avg_last10: number;
  minutes_last10: number;
  projection: number;
  prob_over: number;
  edge_over: number;
  recommended_side: 'over' | 'under' | 'none';
}

export interface NBABestPick {
  market_type: 'game_total' | 'spread' | 'team_total' | 'player_prop';
  description: string;
  odds: number;
  edge: number;
  kelly_fraction: number;
  confidence_score: number; // SIEMPRE entre 0.0 y 1.0
}

export interface NBAQuantResult {
  league: string;
  game_id: string;
  home_team: string;
  away_team: string;
  game_date_utc: string;
  teams_stats: {
    home: NBATeamStatsQuant;
    away: NBATeamStatsQuant;
  };
  totals_markets: NBATotalsMarkets;
  spread_market: NBASpreadMarket;
  player_props: NBAPlayerProp[];
  best_pick: NBABestPick;
}

export interface NBAQuantInput {
  researchReport: string; // Texto del informe de investigación
  oddsPayload: {
    match: string;
    commence_time: string;
    bookmakers: {
      h2h: { home: number; draw: number | null; away: number };
      totals: { line: number; over: number; under: number } | null;
      spreads: { point: number; home: number; away: number } | null;
    };
  } | null;
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT FOR CLAUDE (QUANT MODEL)
// ═══════════════════════════════════════════════════════════════

const NBA_QUANT_SYSTEM_PROMPT = `Eres el MODELO CUANTITATIVO NBA de COCO VIP.

Recibes:
1) INFORME DE INVESTIGACIÓN NBA en texto
2) ODDS DEL PARTIDO en JSON

OBJETIVO:
Construir un OBJETO JSON COMPLETO con el schema especificado.

INSTRUCCIONES DE CÁLCULO:

1) Rellena todos los campos con los datos del informe.
   Si falta un dato, aproxima desde el texto disponible.
   Solo usa null si es imposible estimarlo.

2) TOTAL DE PARTIDO:
   model_projection = pace_medio × (offRtg_home/100 + offRtg_away/100) × ajuste
   Edge = (prob_over × cuota_over) - 1
   Kelly = (prob_over × cuota_over - 1) / (cuota_over - 1)

3) TOTALES POR EQUIPO:
   Proyecta puntos por equipo por separado.
   Compara con book_line para edge_over.

4) SPREAD:
   model_fair_spread = Net Rating home − Net Rating away + 3 (ventaja local)
   Calcula prob_home_cover y edge_home.

5) PLAYER PROPS:
   Selecciona 2–4 jugadores relevantes.
   Ajusta proyección por: ritmo, minutos, defensa rival, lesiones.
   Calcula prob_over y edge_over.

6) BEST PICK:
   Elige el mercado con mejor combinación:
   - Edge >= 3%
   - Probabilidad razonable (0.55–0.75)
   - Datos respaldados en el informe.
   - confidence_score SIEMPRE entre 0.0 y 1.0.

REGLAS:
- Devuelve SOLO el JSON, sin texto adicional.
- No cambies el nombre de ningún campo del schema.
- confidence_score SIEMPRE entre 0.0 y 1.0.
  Ejemplos correctos: 0.68, 0.72, 0.81.
  Ejemplos PROHIBIDOS: 7, 72, 8.1, 810.
- game_id debe ser un string único (ej: "NBA_2026-03-24_LAL_BOS")
- Si book_line no está disponible, estima una línea razonable.
- kelly_fraction máximo: 0.25`;

// ═══════════════════════════════════════════════════════════════
// MAIN FUNCTION: RUN NBA QUANT MODEL
// ═══════════════════════════════════════════════════════════════

export async function runNBAQuantModel(
  input: NBAQuantInput
): Promise<NBAQuantResult> {
  const { researchReport, oddsPayload } = input;
  
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY no configurada');
  }
  
  // Parsear equipos del match
  const matchName = oddsPayload?.match || 'Unknown vs Unknown';
  const teams = matchName.split(/\s+vs\s+|\s+v\s+/i);
  const homeTeam = teams[0]?.trim() || 'Home';
  const awayTeam = teams[1]?.trim() || 'Away';
  
  // Generar game_id
  const gameDate = oddsPayload?.commence_time 
    ? new Date(oddsPayload.commence_time).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  
  const homeAbbr = getTeamAbbreviation(homeTeam);
  const awayAbbr = getTeamAbbreviation(awayTeam);
  const gameId = `NBA_${gameDate}_${homeAbbr}_${awayAbbr}`;
  
  try {
    // Construir el prompt con el informe y las odds
    const userPrompt = `
INFORME DE INVESTIGACIÓN NBA:
═══════════════════════════════════════════════
${researchReport}
═══════════════════════════════════════════════

ODDS DEL PARTIDO (JSON):
${JSON.stringify(oddsPayload, null, 2)}

DATOS DEL PARTIDO:
- Partido: ${matchName}
- Fecha UTC: ${gameDate}
- game_id: ${gameId}
- home_team: ${homeTeam}
- away_team: ${awayTeam}

Construye el JSON completo con todos los campos del schema.
Devuelve SOLO el JSON, sin texto adicional ni markdown.
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
        max_tokens: 3000,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: NBA_QUANT_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }
    
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    
    // Limpiar markdown si existe
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Parsear el JSON resultante
    const result: NBAQuantResult = JSON.parse(content);
    
    // Validar y normalizar confidence_score
    if (result.best_pick && result.best_pick.confidence_score > 1) {
      result.best_pick.confidence_score = result.best_pick.confidence_score / 10;
    }
    
    // Asegurar que confidence_score esté en rango
    if (result.best_pick) {
      result.best_pick.confidence_score = Math.min(
        Math.max(result.best_pick.confidence_score, 0),
        1
      );
    }
    
    // Asegurar campos requeridos
    result.league = result.league || 'NBA';
    result.game_id = result.game_id || gameId;
    result.home_team = result.home_team || homeTeam;
    result.away_team = result.away_team || awayTeam;
    result.game_date_utc = result.game_date_utc || gameDate;
    
    console.log(`✅ NBA Quant Model completed for ${homeTeam} vs ${awayTeam}`);
    
    return result;
    
  } catch (error: any) {
    console.error('NBA Quant Model error:', error);
    
    // Retornar objeto con valores por defecto en caso de error
    return createDefaultNBAQuantResult(gameId, homeTeam, awayTeam, gameDate, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getTeamAbbreviation(teamName: string): string {
  const abbreviations: Record<string, string> = {
    'Lakers': 'LAL',
    'Celtics': 'BOS',
    'Warriors': 'GSW',
    'Nets': 'BKN',
    'Heat': 'MIA',
    'Bucks': 'MIL',
    'Suns': 'PHX',
    '76ers': 'PHI',
    'Nuggets': 'DEN',
    'Clippers': 'LAC',
    'Mavericks': 'DAL',
    'Grizzlies': 'MEM',
    'Cavaliers': 'CLE',
    'Knicks': 'NYK',
    'Hawks': 'ATL',
    'Raptors': 'TOR',
    'Bulls': 'CHI',
    'Pelicans': 'NOP',
    'Spurs': 'SAS',
    'Trail Blazers': 'POR',
    'Kings': 'SAC',
    'Pacers': 'IND',
    'Hornets': 'CHA',
    'Magic': 'ORL',
    'Pistons': 'DET',
    'Wizards': 'WAS',
    'Rockets': 'HOU',
    'Thunder': 'OKC',
    'Jazz': 'UTA',
    'Timberwolves': 'MIN'
  };
  
  // Buscar coincidencia
  for (const [name, abbr] of Object.entries(abbreviations)) {
    if (teamName.toLowerCase().includes(name.toLowerCase())) {
      return abbr;
    }
  }
  
  // Si no encuentra, usar primeras 3 letras
  return teamName.substring(0, 3).toUpperCase();
}

function createDefaultNBAQuantResult(
  gameId: string,
  homeTeam: string,
  awayTeam: string,
  gameDate: string,
  error: string
): NBAQuantResult {
  const defaultTeamStats: NBATeamStatsQuant = {
    pace_season: 100,
    pace_last10: 100,
    off_rating_season: 115,
    def_rating_season: 115,
    net_rating_season: 0,
    points_avg_season: 115,
    points_avg_last10: 115,
    points_allowed_season: 115,
    points_allowed_last10: 115,
    ats_record: { wins: 0, losses: 0, pushes: 0 },
    over_under_record: { over: 0, under: 0, push: 0 },
    injuries_key: [],
    back_to_back: false
  };
  
  return {
    league: 'NBA',
    game_id: gameId,
    home_team: homeTeam,
    away_team: awayTeam,
    game_date_utc: gameDate,
    teams_stats: {
      home: { ...defaultTeamStats },
      away: { ...defaultTeamStats }
    },
    totals_markets: {
      game_total: {
        book_line: 230,
        model_projection: 230,
        prob_over: 0.5,
        prob_under: 0.5,
        edge_over: 0,
        kelly_over: 0,
        recommended_side: 'none'
      },
      team_totals: {
        home: {
          book_line: 115,
          projection: 115,
          prob_over: 0.5,
          edge_over: 0
        },
        away: {
          book_line: 115,
          projection: 115,
          prob_over: 0.5,
          edge_over: 0
        }
      }
    },
    spread_market: {
      book_spread_home: 0,
      model_fair_spread: 0,
      prob_home_cover: 0.5,
      prob_away_cover: 0.5,
      edge_home: 0,
      kelly_home: 0,
      recommended_side: 'none'
    },
    player_props: [],
    best_pick: {
      market_type: 'game_total',
      description: `Error: ${error}`,
      odds: 1.90,
      edge: 0,
      kelly_fraction: 0,
      confidence_score: 0
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// UTILITY: FORMAT FOR DISPLAY
// ═══════════════════════════════════════════════════════════════

export function formatNBAQuantResult(result: NBAQuantResult): string {
  const lines: string[] = [
    `═══════════════════════════════════════════════`,
    `NBA QUANTITATIVE MODEL OUTPUT`,
    `═══════════════════════════════════════════════`,
    ``,
    `📅 Game: ${result.home_team} vs ${result.away_team}`,
    `🏆 League: ${result.league}`,
    `🆔 Game ID: ${result.game_id}`,
    ``,
    `── TEAM STATS ──`,
    ``,
    `HOME (${result.home_team}):`,
    `  Pace: ${result.teams_stats.home.pace_season} (Last 10: ${result.teams_stats.home.pace_last10})`,
    `  OffRtg: ${result.teams_stats.home.off_rating_season} | DefRtg: ${result.teams_stats.home.def_rating_season}`,
    `  NetRtg: ${result.teams_stats.home.net_rating_season}`,
    `  PPG: ${result.teams_stats.home.points_avg_season} (Last 10: ${result.teams_stats.home.points_avg_last10})`,
    `  Opp PPG: ${result.teams_stats.home.points_allowed_season}`,
    `  ATS: ${result.teams_stats.home.ats_record.wins}-${result.teams_stats.home.ats_record.losses}-${result.teams_stats.home.ats_record.pushes}`,
    `  Back-to-back: ${result.teams_stats.home.back_to_back ? '⚠️ YES' : '✅ No'}`,
    ``,
    `AWAY (${result.away_team}):`,
    `  Pace: ${result.teams_stats.away.pace_season} (Last 10: ${result.teams_stats.away.pace_last10})`,
    `  OffRtg: ${result.teams_stats.away.off_rating_season} | DefRtg: ${result.teams_stats.away.def_rating_season}`,
    `  NetRtg: ${result.teams_stats.away.net_rating_season}`,
    `  PPG: ${result.teams_stats.away.points_avg_season} (Last 10: ${result.teams_stats.away.points_avg_last10})`,
    `  Opp PPG: ${result.teams_stats.away.points_allowed_season}`,
    `  ATS: ${result.teams_stats.away.ats_record.wins}-${result.teams_stats.away.ats_record.losses}-${result.teams_stats.away.ats_record.pushes}`,
    `  Back-to-back: ${result.teams_stats.away.back_to_back ? '⚠️ YES' : '✅ No'}`,
    ``,
    `── TOTALS MARKET ──`,
    ``,
    `Game Total:`,
    `  Book Line: ${result.totals_markets.game_total.book_line}`,
    `  Model Projection: ${result.totals_markets.game_total.model_projection.toFixed(1)}`,
    `  Prob Over: ${(result.totals_markets.game_total.prob_over * 100).toFixed(1)}%`,
    `  Edge Over: ${(result.totals_markets.game_total.edge_over * 100).toFixed(1)}%`,
    `  Kelly: ${(result.totals_markets.game_total.kelly_over * 100).toFixed(1)}%`,
    `  Recommendation: ${result.totals_markets.game_total.recommended_side.toUpperCase()}`,
    ``,
    `Team Totals:`,
    `  ${result.home_team}: ${result.totals_markets.team_totals.home.projection.toFixed(1)} (Book: ${result.totals_markets.team_totals.home.book_line})`,
    `  ${result.away_team}: ${result.totals_markets.team_totals.away.projection.toFixed(1)} (Book: ${result.totals_markets.team_totals.away.book_line})`,
    ``,
    `── SPREAD MARKET ──`,
    ``,
    `Book Spread: ${result.spread_market.book_spread_home > 0 ? '+' : ''}${result.spread_market.book_spread_home} (${result.home_team})`,
    `Model Fair Spread: ${result.spread_market.model_fair_spread > 0 ? '+' : ''}${result.spread_market.model_fair_spread}`,
    `Prob Home Cover: ${(result.spread_market.prob_home_cover * 100).toFixed(1)}%`,
    `Edge Home: ${(result.spread_market.edge_home * 100).toFixed(1)}%`,
    `Recommendation: ${result.spread_market.recommended_side.toUpperCase()}`,
    ``,
    `── BEST PICK ──`,
    ``,
    `Market: ${result.best_pick.market_type}`,
    `Description: ${result.best_pick.description}`,
    `Odds: ${result.best_pick.odds}`,
    `Edge: ${(result.best_pick.edge * 100).toFixed(1)}%`,
    `Kelly: ${(result.best_pick.kelly_fraction * 100).toFixed(1)}%`,
    `Confidence: ${result.best_pick.confidence_score.toFixed(2)}/1.0`,
    ``,
    `═══════════════════════════════════════════════`
  ];
  
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// UTILITY: CONVERT TO ANALYSIS RESULT FORMAT
// ═══════════════════════════════════════════════════════════════

import { AnalysisResult } from './analyzeMatch';

export function convertNBAQuantToAnalysisResult(
  quantResult: NBAQuantResult,
  oddsPayload: NBAQuantInput['oddsPayload'],
  researchReport: string
): AnalysisResult {
  // Determinar selección del total
  const totalSelection = quantResult.totals_markets.game_total.recommended_side === 'over' ? 'over' :
                         quantResult.totals_markets.game_total.recommended_side === 'under' ? 'under' : 'over';
  
  // Construir resultado en formato AnalysisResult
  return {
    sport: 'NBA',
    match: `${quantResult.home_team} vs ${quantResult.away_team}`,
    data_quality: quantResult.best_pick.confidence_score >= 0.7 ? 'alta' : 
                  quantResult.best_pick.confidence_score >= 0.5 ? 'media' : 'baja',
    estimated_odds: !oddsPayload,
    best_pick: {
      market: quantResult.best_pick.market_type === 'game_total' ? 'Total' :
              quantResult.best_pick.market_type === 'spread' ? 'Handicap' :
              quantResult.best_pick.market_type === 'player_prop' ? 'Player Prop' : 'Total',
      selection: quantResult.best_pick.description,
      odds: quantResult.best_pick.odds,
      edge_percentage: quantResult.best_pick.edge * 100,
      confidence_score: quantResult.best_pick.confidence_score,
      tier: quantResult.best_pick.edge >= 0.08 ? 'A+' : 'B',
      kelly_stake_units: quantResult.best_pick.kelly_fraction,
      value_bet: quantResult.best_pick.edge >= 0.03 && quantResult.best_pick.confidence_score >= 0.65,
      analysis: {
        pros: [
          `Edge: +${(quantResult.best_pick.edge * 100).toFixed(1)}%`,
          `Kelly: ${(quantResult.best_pick.kelly_fraction * 100).toFixed(1)}%`,
          `Model projection: ${quantResult.totals_markets.game_total.model_projection.toFixed(1)}`
        ],
        cons: quantResult.teams_stats.home.back_to_back || quantResult.teams_stats.away.back_to_back ?
          ['Back-to-back detectado'] : ['Mercado competitivo'],
        conclusion: quantResult.best_pick.description
      },
      stats_highlights: {
        metric_1: `Pace: ${quantResult.teams_stats.home.pace_season} vs ${quantResult.teams_stats.away.pace_season}`,
        metric_2: `NetRtg: ${quantResult.teams_stats.home.net_rating_season} vs ${quantResult.teams_stats.away.net_rating_season}`,
        metric_3: `PPG: ${quantResult.teams_stats.home.points_avg_season} vs ${quantResult.teams_stats.away.points_avg_season}`
      }
    },
    mercados_completos: {
      resultado: {
        seleccion: quantResult.spread_market.recommended_side === 'home' ? 'home' : 'away',
        prob_estimada: quantResult.spread_market.prob_home_cover,
        prob_implicita_normalizada: 0.5,
        odds: quantResult.spread_market.recommended_side === 'home' ? 
              oddsPayload?.bookmakers?.spreads?.home || 1.90 : 
              oddsPayload?.bookmakers?.spreads?.away || 1.90,
        edge_percentage: Math.abs(quantResult.spread_market.edge_home) * 100,
        value_bet: Math.abs(quantResult.spread_market.edge_home) >= 0.03,
        confidence_score: quantResult.best_pick.confidence_score * 0.9,
        analisis: `Spread ${quantResult.spread_market.book_spread_home > 0 ? '+' : ''}${quantResult.spread_market.book_spread_home} favorece ${quantResult.spread_market.recommended_side}`
      },
      total: {
        xg_o_pts_estimado: quantResult.totals_markets.game_total.model_projection,
        seleccion: totalSelection,
        linea: quantResult.totals_markets.game_total.book_line,
        odds: totalSelection === 'over' ? 
              oddsPayload?.bookmakers?.totals?.over || 1.90 :
              oddsPayload?.bookmakers?.totals?.under || 1.90,
        edge_percentage: quantResult.totals_markets.game_total.edge_over * 100,
        value_bet: quantResult.totals_markets.game_total.edge_over >= 0.03,
        confidence_score: quantResult.best_pick.confidence_score,
        analisis: `Proyección modelo: ${quantResult.totals_markets.game_total.model_projection.toFixed(1)} vs línea ${quantResult.totals_markets.game_total.book_line}`
      },
      ambos_anotan: {
        aplica: false,
        seleccion: 'yes',
        prob_btts_estimada: 0,
        odds: 1.90,
        edge_percentage: 0,
        value_bet: false,
        confidence_score: 0,
        analisis: 'N/A para NBA'
      },
      corners: {
        aplica: false,
        total_estimado: 0,
        tendencia: 'media',
        linea: null,
        seleccion: 'sin_cuota',
        odds: null,
        edge_percentage: null,
        value_bet: false,
        confidence_score: 0,
        analisis: 'N/A para NBA'
      },
      handicap: {
        aplica: true,
        linea: quantResult.spread_market.book_spread_home,
        seleccion: quantResult.spread_market.recommended_side === 'home' ? 'home' : 'away',
        odds: quantResult.spread_market.recommended_side === 'home' ?
              oddsPayload?.bookmakers?.spreads?.home || 1.90 :
              oddsPayload?.bookmakers?.spreads?.away || 1.90,
        edge_percentage: Math.abs(quantResult.spread_market.edge_home) * 100,
        value_bet: Math.abs(quantResult.spread_market.edge_home) >= 0.03,
        confidence_score: quantResult.best_pick.confidence_score * 0.9,
        analisis: `Model fair spread: ${quantResult.spread_market.model_fair_spread > 0 ? '+' : ''}${quantResult.spread_market.model_fair_spread.toFixed(1)}`
      },
      proyeccion_final: {
        resultado_probable: quantResult.spread_market.recommended_side === 'home' ? 
                           quantResult.home_team : quantResult.away_team,
        marcador_estimado: `${Math.round(quantResult.totals_markets.team_totals.home.projection)}-${Math.round(quantResult.totals_markets.team_totals.away.projection)}`,
        rango_total: `${Math.round(quantResult.totals_markets.game_total.model_projection - 5)}-${Math.round(quantResult.totals_markets.game_total.model_projection + 5)}`,
        btts_probable: false,
        banker_double_viable: quantResult.best_pick.edge >= 0.05 && quantResult.best_pick.confidence_score >= 0.7,
        banker_double_cuota_minima: 1.35,
        resumen: quantResult.best_pick.description,
        mejor_pick_resumen: {
          market: quantResult.best_pick.market_type,
          selection: quantResult.best_pick.description,
          odds: quantResult.best_pick.odds,
          edge_percentage: quantResult.best_pick.edge * 100,
          kelly_stake_units: quantResult.best_pick.kelly_fraction
        }
      }
    },
    picks_con_value: quantResult.player_props
      .filter(prop => prop.edge_over >= 0.03)
      .map(prop => ({
        market: `Player Prop - ${prop.prop_type}`,
        selection: `${prop.player_name} ${prop.recommended_side} ${prop.book_line}`,
        odds: 1.90,
        edge_percentage: prop.edge_over * 100,
        confidence_score: 0.65,
        tier: 'B' as const
      })),
    supporting_factors: [
      `Pace combinado: ${((quantResult.teams_stats.home.pace_season + quantResult.teams_stats.away.pace_season) / 2).toFixed(1)}`,
      `Net Rating differential: ${(quantResult.teams_stats.home.net_rating_season - quantResult.teams_stats.away.net_rating_season).toFixed(1)}`,
      `Injuries key: ${quantResult.teams_stats.home.injuries_key.length + quantResult.teams_stats.away.injuries_key.length} jugadores`
    ],
    risk_factors: [
      ...(quantResult.teams_stats.home.back_to_back ? [`${quantResult.home_team} en back-to-back`] : []),
      ...(quantResult.teams_stats.away.back_to_back ? [`${quantResult.away_team} en back-to-back`] : []),
      ...(quantResult.teams_stats.home.injuries_key.length > 0 ? [`Lesiones ${quantResult.home_team}: ${quantResult.teams_stats.home.injuries_key.join(', ')}`] : []),
      ...(quantResult.teams_stats.away.injuries_key.length > 0 ? [`Lesiones ${quantResult.away_team}: ${quantResult.teams_stats.away.injuries_key.join(', ')}`] : [])
    ],
    ajustes_aplicados: [
      'Proyección basada en offensive/defensive rating',
      'Ajuste por pace combinado',
      'Factor ventaja local aplicado (+3 pts)'
    ],
    fuentes_contexto: ['nba.com/stats', 'ESPN', 'NBAstuffer', 'Rotowire'],
    oddsPayload: oddsPayload || undefined,
    researchContext: researchReport,
    timestamp: new Date().toISOString()
  };
}
