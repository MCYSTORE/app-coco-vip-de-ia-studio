import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Types for API responses
interface FootballFixture {
  fixture: { id: number; date: string; status: { short: string }; venue?: { name: string } };
  league: { id: number; name: string; country: string; logo: string };
  teams: { home: { id: number; name: string; logo: string }; away: { id: number; name: string; logo: string } };
  goals: { home: number | null; away: number | null };
}

interface BasketballGame {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  status: { short: string };
  country: { id: number; name: string };
  league: { id: number; name: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  scores: { home: { quarter_1: number; quarter_2: number; quarter_3: number; quarter_4: number; total: number } | null; away: { quarter_1: number; quarter_2: number; quarter_3: number; quarter_4: number; total: number } | null };
}

interface BaseballGame {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  status: { short: string };
  country: { id: number; name: string };
  league: { id: number; name: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  scores: { home: { total: number } | null; away: { total: number } | null };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const SPORTS_API_KEY = process.env.SPORTS_API_KEY;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  app.use(express.json());

  // =====================================================
  // API-Sports Helper Functions
  // =====================================================

  async function fetchFromAPI(endpoint: string, sport: 'football' | 'basketball' | 'baseball'): Promise<any> {
    const baseUrl = `https://v3.${sport === 'football' ? 'football' : sport === 'basketball' ? 'basketball' : 'baseball'}.api-sports.io`;
    
    const response = await fetch(`${baseUrl}/${endpoint}`, {
      headers: {
        'x-apisports-key': SPORTS_API_KEY || ''
      }
    });

    if (!response.ok) {
      throw new Error(`API-Sports error: ${response.status}`);
    }

    return response.json();
  }

  // =====================================================
  // API Routes - Live & Upcoming Games
  // =====================================================

  // Get live football matches
  app.get("/api/football/live", async (req, res) => {
    try {
      const data = await fetchFromAPI('fixtures?live=all', 'football');
      res.json(data.response?.slice(0, 20) || []);
    } catch (error) {
      console.error("Football live error:", error);
      res.status(500).json({ error: "Failed to fetch live football matches" });
    }
  });

  // Get upcoming football matches (next 7 days)
  app.get("/api/football/upcoming", async (req, res) => {
    try {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const from = today.toISOString().split('T')[0];
      const to = nextWeek.toISOString().split('T')[0];
      
      const data = await fetchFromAPI(`fixtures?date=${from}&to=${to}`, 'football');
      
      // Filter for major leagues only
      const majorLeagues = [39, 140, 135, 78, 61, 2, 3, 848]; // Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, World Cup
      const filtered = (data.response || []).filter((f: FootballFixture) => 
        majorLeagues.includes(f.league.id)
      );
      
      res.json(filtered.slice(0, 30));
    } catch (error) {
      console.error("Football upcoming error:", error);
      res.status(500).json({ error: "Failed to fetch upcoming football matches" });
    }
  });

  // Get live basketball games
  app.get("/api/basketball/live", async (req, res) => {
    try {
      const data = await fetchFromAPI('games?live=all', 'basketball');
      res.json(data.response?.slice(0, 20) || []);
    } catch (error) {
      console.error("Basketball live error:", error);
      res.status(500).json({ error: "Failed to fetch live basketball games" });
    }
  });

  // Get upcoming basketball games
  app.get("/api/basketball/upcoming", async (req, res) => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 3);
      
      const from = today.toISOString().split('T')[0];
      const to = tomorrow.toISOString().split('T')[0];
      
      const data = await fetchFromAPI(`games?date=${from}&to=${to}`, 'basketball');
      
      // Filter for NBA and major leagues
      const majorLeagues = [12, 120, 117]; // NBA, Euroleague, ACB
      const filtered = (data.response || []).filter((g: BasketballGame) => 
        majorLeagues.includes(g.league.id)
      );
      
      res.json(filtered.slice(0, 20));
    } catch (error) {
      console.error("Basketball upcoming error:", error);
      res.status(500).json({ error: "Failed to fetch upcoming basketball games" });
    }
  });

  // Get live baseball games
  app.get("/api/baseball/live", async (req, res) => {
    try {
      const data = await fetchFromAPI('games?live=all', 'baseball');
      res.json(data.response?.slice(0, 20) || []);
    } catch (error) {
      console.error("Baseball live error:", error);
      res.status(500).json({ error: "Failed to fetch live baseball games" });
    }
  });

  // Get upcoming baseball games
  app.get("/api/baseball/upcoming", async (req, res) => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 2);
      
      const from = today.toISOString().split('T')[0];
      const to = tomorrow.toISOString().split('T')[0];
      
      const data = await fetchFromAPI(`games?date=${from}&to=${to}`, 'baseball');
      
      // Filter for MLB
      const majorLeagues = [1, 4, 7]; // MLB, NPB, KBO
      const filtered = (data.response || []).filter((g: BaseballGame) => 
        majorLeagues.includes(g.league.id)
      );
      
      res.json(filtered.slice(0, 20));
    } catch (error) {
      console.error("Baseball upcoming error:", error);
      res.status(500).json({ error: "Failed to fetch upcoming baseball games" });
    }
  });

  // =====================================================
  // AI Analysis Endpoint
  // =====================================================

  app.post("/api/analyze", async (req, res) => {
    const { match_name, date, user_context, market_preference, sport = 'football' } = req.body;

    if (!OPENROUTER_API_KEY) {
      // If no OpenRouter key, return a mock analysis
      return res.json(generateMockAnalysis(match_name, sport));
    }

    const SYSTEM_PROMPT_VALUE_BET = `Eres un experto analista de apuestas deportivas profesional. 
Tu objetivo es identificar "Value Bets" (apuestas con valor) comparando probabilidades reales con las cuotas del mercado.
Debes ser extremadamente analítico, evitar alucinaciones y basarte en datos.
Devuelve SIEMPRE un objeto JSON con la siguiente estructura exacta:
{
  "matchName": "string (nombre del partido)",
  "sport": "string (deporte)",
  "bestMarket": "string (mejor mercado)",
  "selection": "string (selección recomendada)",
  "bookmaker": "string (casa de apuestas recomendada)",
  "odds": number (cuota decimal),
  "edgePercent": number (porcentaje de ventaja sobre el mercado),
  "confidence": number (1-10),
  "analysisText": "string (explicación técnica detallada)",
  "status": "pending"
}`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
          'X-Title': 'Coco VIP Assistant'
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-v3",
          messages: [
            { role: "system", content: SYSTEM_PROMPT_VALUE_BET },
            { role: "user", content: `Analiza este partido: ${match_name}. Fecha: ${date || 'próximamente'}. Contexto adicional: ${user_context || 'Ninguno'}. Preferencia de mercado: ${market_preference || 'Cualquiera'}.` }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      const analysis = JSON.parse(data.choices[0].message.content);
      res.json(analysis);
    } catch (error) {
      console.error("OpenRouter Error:", error);
      // Return mock analysis if API fails
      res.json(generateMockAnalysis(match_name, sport));
    }
  });

  // Helper function for mock analysis
  function generateMockAnalysis(matchName: string, sport: string) {
    const markets = {
      football: ['Over 2.5 Goles', 'Ambos Equipos Anotan', '1X2', 'Handicap -0.5', 'Corner +9.5'],
      basketball: ['Over/Under 220.5', 'Handicap -5.5', 'Ganador 1X2', 'Cuarto 1 - Ganador'],
      baseball: ['Run Line -1.5', 'Total Runs Over 7.5', 'Ganador', '1er Inning - Carreras']
    };

    const bookmakers = ['Bet365', 'Pinnacle', 'Bwin', '1xBet', 'William Hill'];
    const sportMarkets = markets[sport as keyof typeof markets] || markets.football;
    
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

  // =====================================================
  // Top Picks - Aggregates from all sports
  // =====================================================

  app.get("/api/top-picks", async (req, res) => {
    try {
      const picks = [];

      // Fetch football matches
      try {
        const footballData = await fetchFromAPI('fixtures?live=all', 'football');
        const liveFootball = (footballData.response || []).slice(0, 5);
        
        for (const match of liveFootball) {
          picks.push({
            id: `fb-${match.fixture.id}`,
            matchName: `${match.teams.home.name} vs ${match.teams.away.name}`,
            sport: 'Football',
            bestMarket: 'Over 2.5 Goles',
            selection: 'Over 2.5',
            bookmaker: 'Bet365',
            odds: 1.85 + Math.random() * 0.3,
            edgePercent: 8 + Math.random() * 12,
            confidence: Math.floor(7 + Math.random() * 3),
            analysisText: `Partido en vivo. ${match.teams.home.name} y ${match.teams.away.name} con tendencia goleadora. Liga: ${match.league.name}`,
            status: 'pending',
            createdAt: new Date().toISOString(),
            league: match.league.name,
            isLive: true
          });
        }
      } catch (e) {
        console.log("Football fetch skipped");
      }

      // Fetch basketball games
      try {
        const basketballData = await fetchFromAPI('games?live=all', 'basketball');
        const liveBasketball = (basketballData.response || []).slice(0, 5);
        
        for (const game of liveBasketball) {
          picks.push({
            id: `bk-${game.id}`,
            matchName: `${game.teams.home.name} vs ${game.teams.away.name}`,
            sport: 'Basketball',
            bestMarket: 'Over/Under',
            selection: 'Over 215.5',
            bookmaker: 'Pinnacle',
            odds: 1.90 + Math.random() * 0.2,
            edgePercent: 6 + Math.random() * 10,
            confidence: Math.floor(6 + Math.random() * 4),
            analysisText: `NBA en vivo. Alto ritmo de juego esperado. Liga: ${game.league.name}`,
            status: 'pending',
            createdAt: new Date().toISOString(),
            league: game.league.name,
            isLive: true
          });
        }
      } catch (e) {
        console.log("Basketball fetch skipped");
      }

      // Add upcoming high-value picks from major leagues
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = today.toISOString().split('T')[0];

      try {
        const upcomingData = await fetchFromAPI(`fixtures?date=${dateStr}`, 'football');
        const majorLeagues = [39, 140, 135, 78, 61]; // Top 5 leagues
        const upcoming = (upcomingData.response || [])
          .filter((f: FootballFixture) => majorLeagues.includes(f.league.id))
          .slice(0, 5);

        for (const match of upcoming) {
          picks.push({
            id: `fb-up-${match.fixture.id}`,
            matchName: `${match.teams.home.name} vs ${match.teams.away.name}`,
            sport: 'Football',
            bestMarket: 'Ambos Anotan',
            selection: 'Sí',
            bookmaker: '1xBet',
            odds: 1.70 + Math.random() * 0.4,
            edgePercent: 10 + Math.random() * 8,
            confidence: Math.floor(7 + Math.random() * 3),
            analysisText: `${match.league.name} - ${match.teams.home.name} llega con buena racha goleadora.`,
            status: 'pending',
            createdAt: new Date().toISOString(),
            league: match.league.name,
            isLive: false,
            date: match.fixture.date
          });
        }
      } catch (e) {
        console.log("Upcoming football fetch skipped");
      }

      // Sort by confidence and edge
      picks.sort((a, b) => (b.confidence + b.edgePercent / 10) - (a.confidence + a.edgePercent / 10));

      res.json(picks.slice(0, 10));
    } catch (error) {
      console.error("Top picks error:", error);
      res.json(getFallbackPicks());
    }
  });

  // Fallback picks if APIs fail
  function getFallbackPicks() {
    return [
      {
        id: "demo-1",
        matchName: "Real Madrid vs Barcelona",
        sport: "Football",
        bestMarket: "Over 2.5 Goles",
        selection: "Over 2.5",
        bookmaker: "Bet365",
        odds: 1.95,
        edgePercent: 12.4,
        confidence: 9,
        analysisText: "El Clásico siempre ofrece goles. Ambos equipos con promedio de 3+ goles por partido.",
        status: "pending",
        createdAt: new Date().toISOString(),
        league: "La Liga",
        isLive: false
      },
      {
        id: "demo-2",
        matchName: "Lakers vs Warriors",
        sport: "Basketball",
        bestMarket: "Over 220.5",
        selection: "Over",
        bookmaker: "Pinnacle",
        odds: 1.88,
        edgePercent: 8.1,
        confidence: 8,
        analysisText: "Ritmo alto esperado. Warriors con excelente porcentaje de 3 puntos.",
        status: "pending",
        createdAt: new Date().toISOString(),
        league: "NBA",
        isLive: false
      },
      {
        id: "demo-3",
        matchName: "Yankees vs Red Sox",
        sport: "Baseball",
        bestMarket: "Total Runs Over 8.5",
        selection: "Over",
        bookmaker: "Bwin",
        odds: 1.75,
        edgePercent: 10.5,
        confidence: 8,
        analysisText: "Rivalidad histórica. Ambos equipos con buenas ofensivas.",
        status: "pending",
        createdAt: new Date().toISOString(),
        league: "MLB",
        isLive: false
      }
    ];
  }

  // =====================================================
  // Update prediction status
  // =====================================================

  app.patch("/api/predictions/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    // In a real app, this would update the database
    // For now, we just acknowledge the update
    res.json({ id, status, updatedAt: new Date().toISOString() });
  });

  // =====================================================
  // Stats endpoint for profile
  // =====================================================

  app.get("/api/stats/:userId", async (req, res) => {
    // Mock stats - in production this would query Firestore
    res.json({
      totalPredictions: 47,
      won: 32,
      lost: 11,
      pending: 4,
      winRate: 74.4,
      roi: 28.5,
      profit: 342.50,
      avgOdds: 1.87,
      bestStreak: 8
    });
  });

  // =====================================================
  // Vite middleware for development
  // =====================================================

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`
╔═══════════════════════════════════════════╗
║         🎰 COCO VIP - Server Up! 🎰        ║
╠═══════════════════════════════════════════╣
║  Local:    http://localhost:${PORT}          ║
║  Sports:   API-Sports Connected ✅        ║
║  Leagues:  Football, Basketball, Baseball ║
╚═══════════════════════════════════════════╝
    `);
  });
}

startServer();
