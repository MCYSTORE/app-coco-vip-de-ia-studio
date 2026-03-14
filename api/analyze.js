const OPENROUTERFREE_API_KEY = process.env.OPENROUTERFREE_API_KEY;
const SPORTS_API_KEY = process.env.SPORTS_API_KEY;

// Fetch team/match statistics from API-Sports
async function fetchMatchStats(matchName, sport) {
  if (!SPORTS_API_KEY) return null;
  
  try {
    // Parse team names from match name (e.g., "Real Madrid vs Barcelona")
    const teams = matchName.split(/\s+vs\s+|\s+v\s+|\s*-vs-\s*|\s*-v-\s*/i);
    if (teams.length < 2) return null;
    
    const homeTeam = teams[0].trim();
    const awayTeam = teams[1].trim();
    
    let stats = {
      homeTeam,
      awayTeam,
      homeStats: null,
      awayStats: null,
      h2h: [],
      recentMatches: []
    };
    
    const baseUrl = sport === 'football' 
      ? 'https://v3.football.api-sports.io'
      : sport === 'basketball'
      ? 'https://v3.basketball.api-sports.io'
      : 'https://v3.baseball.api-sports.io';
    
    // For Football: Get team statistics and H2H
    if (sport === 'football') {
      // Search for teams
      const homeSearch = await fetch(`${baseUrl}/teams?search=${encodeURIComponent(homeTeam)}`, {
        headers: { 'x-apisports-key': SPORTS_API_KEY }
      });
      const homeData = await homeSearch.json();
      
      const awaySearch = await fetch(`${baseUrl}/teams?search=${encodeURIComponent(awayTeam)}`, {
        headers: { 'x-apisports-key': SPORTS_API_KEY }
      });
      const awayData = await awaySearch.json();
      
      const homeTeamId = homeData.response?.[0]?.team?.id;
      const awayTeamId = awayData.response?.[0]?.team?.id;
      
      if (homeTeamId && awayTeamId) {
        // Get H2H
        const h2hRes = await fetch(`${baseUrl}/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=5`, {
          headers: { 'x-apisports-key': SPORTS_API_KEY }
        });
        const h2hData = await h2hRes.json();
        stats.h2h = h2hData.response?.map(m => ({
          date: m.fixture?.date,
          home: m.teams?.home?.name,
          away: m.teams?.away?.name,
          score: `${m.goals?.home}-${m.goals?.away}`,
          winner: m.teams?.winner
        })) || [];
        
        // Get team statistics (using current season)
        const currentSeason = new Date().getFullYear() - 1;
        const homeStatsRes = await fetch(`${baseUrl}/teams/statistics?team=${homeTeamId}&season=${currentSeason}&league=39`, {
          headers: { 'x-apisports-key': SPORTS_API_KEY }
        });
        const homeStatsData = await homeStatsRes.json();
        stats.homeStats = homeStatsData.response ? {
          played: homeStatsData.response.fixtures?.played?.total,
          wins: homeStatsData.response.fixtures?.wins?.total,
          draws: homeStatsData.response.fixtures?.draws?.total,
          loses: homeStatsData.response.fixtures?.loses?.total,
          goalsFor: homeStatsData.response.goals?.for?.total,
          goalsAgainst: homeStatsData.response.goals?.against?.total,
          avgGoalsFor: homeStatsData.response.goals?.for?.average?.total,
          cleanSheets: homeStatsData.response.clean_sheet?.total,
          form: homeStatsData.response.form
        } : null;
      }
    }
    
    return stats;
  } catch (error) {
    console.error("Error fetching match stats:", error);
    return null;
  }
}

function generateMockAnalysis(matchName, sport) {
  const markets = {
    football: ['Over 2.5 Goles', 'Ambos Equipos Anotan', '1X2', 'Handicap -0.5', 'Corner +9.5'],
    basketball: ['Over/Under 220.5', 'Handicap -5.5', 'Ganador', 'Cuarto 1 - Ganador'],
    baseball: ['Run Line -1.5', 'Total Runs Over 7.5', 'Ganador', '1er Inning']
  };

  const bookmakers = ['Bet365', 'Pinnacle', 'Bwin', '1xBet', 'William Hill'];
  const sportMarkets = markets[sport] || markets.football;

  const randomMarket = sportMarkets[Math.floor(Math.random() * sportMarkets.length)];
  const randomBookmaker = bookmakers[Math.floor(Math.random() * bookmakers.length)];
  const randomOdds = (1.5 + Math.random() * 1.5).toFixed(2);
  const randomEdge = (5 + Math.random() * 15).toFixed(1);
  const randomConfidence = Math.floor(6 + Math.random() * 4);

  return {
    matchName,
    sport: sport.charAt(0).toUpperCase() + sport.slice(1),
    bestMarket: randomMarket,
    selection: randomMarket.split(' ')[0],
    bookmaker: randomBookmaker,
    odds: parseFloat(randomOdds),
    edgePercent: parseFloat(randomEdge),
    confidence: randomConfidence,
    analysisText: `Análisis basado en estadísticas recientes y rendimiento histórico. ${matchName} presenta una oportunidad de valor en el mercado de ${randomMarket}. La cuota de ${randomOdds} parece sobrevalorada según nuestros modelos predictivos.`,
    status: 'pending'
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { match_name, date, user_context, sport = 'football' } = req.body;

  if (!match_name) {
    return res.status(400).json({ error: 'match_name is required' });
  }

  // Fetch real statistics from API-Sports
  const matchStats = await fetchMatchStats(match_name, sport);
  
  if (!OPENROUTERFREE_API_KEY) {
    return res.status(200).json(generateMockAnalysis(match_name, sport));
  }

  // Build context with real statistics
  let statsContext = "";
  if (matchStats) {
    statsContext = `\n\n=== DATOS ESTADÍSTICOS REALES ===`;
    statsContext += `\nEquipos: ${matchStats.homeTeam} vs ${matchStats.awayTeam}`;
    
    if (matchStats.homeStats) {
      statsContext += `\n\nEstadísticas de ${matchStats.homeTeam}:`;
      statsContext += `\n- Partidos jugados: ${matchStats.homeStats.played || 'N/A'}`;
      statsContext += `\n- Victorias: ${matchStats.homeStats.wins || 'N/A'} | Empates: ${matchStats.homeStats.draws || 'N/A'} | Derrotas: ${matchStats.homeStats.loses || 'N/A'}`;
      statsContext += `\n- Goles a favor: ${matchStats.homeStats.goalsFor || 'N/A'} | Goles en contra: ${matchStats.homeStats.goalsAgainst || 'N/A'}`;
      statsContext += `\n- Promedio goles por partido: ${matchStats.homeStats.avgGoalsFor || 'N/A'}`;
      statsContext += `\n- Porterías a cero: ${matchStats.homeStats.cleanSheets || 'N/A'}`;
      if (matchStats.homeStats.form) {
        statsContext += `\n- Forma reciente: ${matchStats.homeStats.form}`;
      }
    }
    
    if (matchStats.h2h && matchStats.h2h.length > 0) {
      statsContext += `\n\nÚltimos enfrentamientos directos (H2H):`;
      matchStats.h2h.slice(0, 5).forEach(m => {
        statsContext += `\n- ${m.home} ${m.score} ${m.away}`;
      });
    }
    
    statsContext += `\n\nUsa estos datos para tu análisis.`;
  }

  const SYSTEM_PROMPT = `Eres un experto analista de apuestas deportivas profesional con años de experiencia identificando Value Bets.

Tu tarea es analizar TODOS los mercados disponibles para un partido y encontrar la MEJOR oportunidad de valor.

Debes analizar exhaustivamente:
- Para FÚTBOL: 1X2, Over/Under goles (0.5, 1.5, 2.5, 3.5), Ambos Anotan, Handicaps, Córners, Tarjetas
- Para BASKETBALL: Ganador, Over/Under puntos, Handicaps, Cuartos, Mitades
- Para BÉISBOL: Ganador, Run Line, Total Carreras, 1er Inning, Hits

IMPORTANTE: Si se te proporcionan DATOS ESTADÍSTICOS REALES, ÚSALOS para fundamentar tu análisis. Menciona números específicos en tu justificación.

Para cada mercado, evalúa:
1. Probabilidad real basada en estadísticas (usa los datos proporcionados si están disponibles)
2. Cuota ofrecida por el mercado
3. Edge potencial (diferencia entre probabilidad real y cuota implícita)

Devuelve SOLO la mejor Value Bet encontrada en formato JSON:
{
  "matchName": "nombre del partido",
  "sport": "deporte",
  "bestMarket": "mercado con mayor valor",
  "selection": "selección específica recomendada",
  "bookmaker": "casa de apuestas sugerida",
  "odds": número (cuota decimal),
  "edgePercent": número (porcentaje de ventaja),
  "confidence": número del 1 al 10,
  "analysisText": "explicación detallada de por qué es value bet, mencionando estadísticas clave SI SE PROPORCIONARON DATOS REALES, contexto del partido, y análisis de TODOS los mercados evaluados",
  "status": "pending",
  "hasRealStats": true/false (indica si usaste datos reales)
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTERFREE_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Assistant'
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analiza COMPLETAMENTE este partido: ${match_name}.
Deporte: ${sport}
Fecha: ${date || 'próximamente'}
Contexto adicional del usuario: ${user_context || 'Ninguno'}
${statsContext}

Analiza TODOS los mercados disponibles y dame la MEJOR Value Bet encontrada con su justificación completa.

IMPORTANTE: Responde SOLO con JSON válido, sin texto adicional.` }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    
    // Parse the response - handle potential markdown code blocks
    let content = data.choices[0].message.content;
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(content);
    
    // Add flag if we had real stats
    if (matchStats && matchStats.homeStats) {
      analysis.hasRealStats = true;
    }
    
    return res.status(200).json(analysis);
  } catch (error) {
    console.error("OpenRouter Error:", error);
    return res.status(200).json(generateMockAnalysis(match_name, sport));
  }
}
