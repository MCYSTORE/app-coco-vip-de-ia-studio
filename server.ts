import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    const { match_name, date, user_context, market_preference } = req.body;
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });
    }

    // Mock data for stats/odds if real APIs aren't provided
    const mockStats = {
      homeTeam: match_name.split(' vs ')[0] || 'Home',
      awayTeam: match_name.split(' vs ')[1] || 'Away',
      recentForm: "W-D-W-L-W",
      injuries: "None reported",
      h2h: "Home leads 3-1-1"
    };

    const SYSTEM_PROMPT_VALUE_BET = `Eres un experto analista de apuestas deportivas profesional. 
Tu objetivo es identificar "Value Bets" (apuestas con valor) comparando probabilidades reales con las cuotas del mercado.
Debes ser extremadamente analítico, evitar alucinaciones y basarte en datos.
Devuelve SIEMPRE un objeto JSON con la siguiente estructura:
{
  "match_name": "string",
  "sport": "string",
  "best_market": "string",
  "selection": "string",
  "bookmaker": "string",
  "odds": number,
  "edge_percent": number,
  "confidence": number (1-10),
  "analysis_text": "string (explicación técnica breve)",
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
          model: "deepseek/deepseek-v3", // Using v3 as requested (or latest available)
          messages: [
            { role: "system", content: SYSTEM_PROMPT_VALUE_BET },
            { role: "user", content: `Analiza este partido: ${match_name}. Fecha: ${date}. Contexto: ${user_context}. Preferencia: ${market_preference}. Datos adicionales: ${JSON.stringify(mockStats)}` }
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
      res.status(500).json({ error: "Failed to analyze match" });
    }
  });

  app.get("/api/top-picks", async (req, res) => {
    // In a real app, this would fetch current events and analyze them
    // For this demo, we'll return high-quality mock picks that look real
    const topPicks = [
      {
        id: "1",
        match_name: "Real Madrid vs Man City",
        sport: "Football",
        best_market: "Over 2.5 Goles",
        selection: "Over 2.5",
        bookmaker: "Bet365",
        odds: 1.95,
        edge_percent: 12.4,
        confidence: 9,
        analysis_text: "Ambos equipos tienen un promedio goleador alto en Champions. El mercado subestima la capacidad ofensiva del Madrid en casa.",
        status: "pending",
        createdAt: new Date().toISOString()
      },
      {
        id: "2",
        match_name: "Lakers vs Warriors",
        sport: "Basketball",
        best_market: "Handicap -4.5",
        selection: "Lakers -4.5",
        bookmaker: "Pinnacle",
        odds: 1.88,
        edge_percent: 8.1,
        confidence: 8,
        analysis_text: "Warriors vienen de B2B. Lakers descansados y con plantilla completa.",
        status: "pending",
        createdAt: new Date().toISOString()
      },
      {
        id: "3",
        match_name: "Alcaraz vs Sinner",
        sport: "Tennis",
        best_market: "Ganador Set 1",
        selection: "Alcaraz",
        bookmaker: "Bwin",
        odds: 1.65,
        edge_percent: 15.2,
        confidence: 9.5,
        analysis_text: "Alcaraz suele empezar muy agresivo en estas superficies. Sinner ha mostrado dudas en el primer set recientemente.",
        status: "pending",
        createdAt: new Date().toISOString()
      }
    ];
    res.json(topPicks);
  });

  // Vite middleware for development
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
