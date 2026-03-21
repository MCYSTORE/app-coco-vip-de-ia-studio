/**
 * Coco VIP - Sniper Picks API (LIGHT Pipeline)
 * GET: Get top 3 sniper picks for a sport
 * 
 * Cost: ~$0.006/pick (100x cheaper than full analysis)
 * Pipeline: Odds API → Perplexity Sonar (800 tokens) → DeepSeek V3 (1500 tokens)
 */

import { isSheetsConfigured } from '../lib/sheets.client.js';

// Simple in-memory history for sniper picks (fallback when Sheets not available)
const localHistory = [];

function getHistoryFromSheets(filters) {
  // Return empty array - actual implementation uses Google Sheets
  return [];
}

// Cache simple en memoria (1 hora)
const cache = new Map<string, { data: any; expires: number }>();

// Sport key mapping for The Odds API
const SPORT_KEY_MAP = {
  football: ['soccer_spain_la_liga', 'soccer_epl', 'soccer_italy_serie_a', 'soccer_germany_bundesliga', 'soccer_uefa_champs_league'],
  basketball: ['basketball_nba'],
  baseball: ['baseball_mlb']
};

const SPORT_NAMES = {
  football: 'Fútbol',
  basketball: 'NBA',
  baseball: 'MLB'
};

// ═══════════════════════════════════════════════════════════════
// STEP B: PERPLEXITY SONAR LIGHT (800 tokens)
// ═══════════════════════════════════════════════════════════════

const PERPLEXITY_LIGHT_PROMPT = `🚨 Responder EXCLUSIVAMENTE en español neutro.
Si encuentras fuentes en otros idiomas, traduce al español.

Eres un investigador deportivo rápido. Para cada partido, proporciona SOLO:
1. Lesiones confirmadas clave (máximo 2 por equipo)
2. Forma reciente (últimos 3 partidos con resultado)
3. Motivación/contexto (1 frase)

Formato compacto:
PARTIDO: [nombre]
LESIONES: [jugador - lesión] o "Plantilla completa"
FORMA: [G-E-P] con marcadores breves
MOTIVACIÓN: [1 frase]

Sin texto adicional. Solo datos estructurados.`;

// ═══════════════════════════════════════════════════════════════
// STEP C: DEEPSEEK V3 LIGHT (1500 tokens)
// ═══════════════════════════════════════════════════════════════

const DEEPSEEK_LIGHT_PROMPT = `🚨 INSTRUCCIONES CRÍTICAS DE IDIOMA (OBLIGATORIO):
1. TODA la respuesta debe ser EXCLUSIVAMENTE en ESPAÑOL.
2. Si encuentras texto en otro idioma, TRADUCE al español.
3. NO incluyas texto en otros idiomas.

Eres Coco, generador de picks sniper. Genera máximo 3 picks de alta calidad.

REGLAS ESTRICTAS:
- Solo picks con edge >= 4%
- Solo mercados con cuota entre 1.60 y 2.50 (evitar favoritos extremos)
- Tier A+: confidence >= 0.80
- Tier B: confidence >= 0.65

JSON de respuesta (sin backticks, sin markdown):
{
  "picks": [
    {
      "match": "Equipo A vs Equipo B",
      "league": "Liga",
      "kickoff": "HH:MM",
      "market": "Resultado|Over/Under|BTTS",
      "selection": "descripción corta",
      "odds": 1.85,
      "edge_percentage": 5.5,
      "confidence_score": 0.78,
      "tier": "A+|B",
      "kelly_stake": 0.10,
      "reason": "razón breve en español (máx 15 palabras)"
    }
  ]
}`;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sport = 'football' } = req.query || {};
  
  if (!['football', 'basketball', 'baseball'].includes(sport)) {
    return res.status(400).json({ error: 'Invalid sport. Use: football, basketball, or baseball' });
  }

  console.log(`\n🎯 SNIPER PICKS REQUEST: ${sport}`);
  console.log(`⏰ ${new Date().toISOString()}`);

  // Check cache (1 hour)
  const cacheKey = `sniper-${sport}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    console.log(`✅ Returning cached sniper picks for ${sport}`);
    return res.status(200).json(cached.data);
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const ODDS_API_KEY = process.env.ODDS_API_KEY;

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
  }

  try {
    let picks = [];

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Try to get picks from Google Sheets History (TODAY)
    // ═══════════════════════════════════════════════════════════════
    
    if (isSheetsConfigured()) {
      console.log('📊 Checking Google Sheets for today\'s picks...');
      
      try {
        const today = new Date().toLocaleDateString('es-CL');
        const historyItems = await getHistory({ sport, status: 'pending' });
        
        // Filter for today
        const todayPicks = historyItems.filter(item => {
          const isToday = item.fecha === today;
          const hasGoodTier = item.tier === 'A+' || item.tier === 'B';
          const hasGoodEdge = item.edge >= 4;
          return isToday && hasGoodTier && hasGoodEdge;
        });
        
        // Take top 3 by edge
        const topPicks = todayPicks
          .sort((a, b) => b.edge - a.edge)
          .slice(0, 3);
        
        if (topPicks.length >= 3) {
          console.log(`✅ Found ${topPicks.length} picks in Sheets history`);
          
          picks = topPicks.map(item => ({
            id: item.id,
            match: item.partido,
            league: item.liga,
            kickoff: item.hora,
            market: item.mercado,
            selection: item.seleccion,
            odds: item.cuota,
            edge_percentage: item.edge,
            confidence_score: item.confianza / 10,
            tier: item.tier,
            kelly_stake: item.kelly,
            reason: item.conclusion?.substring(0, 100) || '',
            source: 'sheets'
          }));
          
          const result = { sport, picks, source: 'sheets', generated_at: new Date().toISOString() };
          cache.set(cacheKey, { data: result, expires: Date.now() + 3600000 });
          
          return res.status(200).json(result);
        }
        
        console.log(`⚠️ Only ${topPicks.length} picks in Sheets, generating more...`);
        picks = topPicks.map(item => ({
          id: item.id,
          match: item.partido,
          league: item.liga,
          kickoff: item.hora,
          market: item.mercado,
          selection: item.seleccion,
          odds: item.cuota,
          edge_percentage: item.edge,
          confidence_score: item.confianza / 10,
          tier: item.tier,
          kelly_stake: item.kelly,
          reason: item.conclusion?.substring(0, 100) || '',
          source: 'sheets'
        }));
      } catch (sheetsError) {
        console.log('⚠️ Sheets error:', sheetsError.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP A: THE ODDS API - Get today's matches
    // ═══════════════════════════════════════════════════════════════
    
    console.log('\n📊 STEP A: Fetching odds from The Odds API...');
    
    let matchesData = [];
    const sportKeys = SPORT_KEY_MAP[sport] || [];
    
    if (ODDS_API_KEY) {
      for (const sportKey of sportKeys) {
        try {
          const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals&oddsFormat=decimal&bookmakers=bet365,pinnacle`;
          const oddsRes = await fetch(oddsUrl);
          
          if (!oddsRes.ok) continue;
          
          const odds = await oddsRes.json();
          
          // Filter matches starting in next 24h
          const now = Date.now();
          const next24h = now + 24 * 60 * 60 * 1000;
          
          const relevantMatches = odds.filter(match => {
            const commenceTime = new Date(match.commence_time).getTime();
            return commenceTime >= now && commenceTime <= next24h;
          }).map(match => {
            const bm = match.bookmakers?.[0];
            const h2h = bm?.markets?.find(m => m.key === 'h2h');
            const totals = bm?.markets?.find(m => m.key === 'totals');
            
            const homeOdds = h2h?.outcomes?.find(o => o.name === match.home_team)?.price || 0;
            const awayOdds = h2h?.outcomes?.find(o => o.name === match.away_team)?.price || 0;
            const drawOdds = h2h?.outcomes?.find(o => o.name === 'Draw')?.price || 0;
            
            // Calculate balance (avoid extreme favorites)
            const minOdds = Math.min(homeOdds, awayOdds, drawOdds || Infinity);
            const maxOdds = Math.max(homeOdds, awayOdds);
            const balance = maxOdds / minOdds;
            
            return {
              home_team: match.home_team,
              away_team: match.away_team,
              commence_time: match.commence_time,
              league: sportKey.replace(/_/g, ' ').replace('soccer ', ''),
              h2h: { home: homeOdds, draw: drawOdds, away: awayOdds },
              totals: totals ? {
                line: totals.outcomes?.[0]?.point,
                over: totals.outcomes?.find(o => o.name === 'Over')?.price,
                under: totals.outcomes?.find(o => o.name === 'Under')?.price
              } : null,
              balance // Lower = more balanced = better for betting
            };
          });
          
          // Sort by balance (most balanced first) and take top 5
          relevantMatches.sort((a, b) => a.balance - b.balance);
          matchesData.push(...relevantMatches.slice(0, 5));
          
        } catch (e) {
          console.log(`⚠️ Odds API error for ${sportKey}:`, e.message);
        }
      }
    }

    if (matchesData.length === 0) {
      console.log('⚠️ No matches found, returning existing picks');
      
      if (picks.length > 0) {
        return res.status(200).json({ sport, picks, source: 'partial', generated_at: new Date().toISOString() });
      }
      
      return res.status(200).json({
        sport,
        picks: [],
        message: 'No hay partidos disponibles hoy con cuotas equilibradas',
        generated_at: new Date().toISOString()
      });
    }

    console.log(`✅ Found ${matchesData.length} matches with balanced odds`);

    // ═══════════════════════════════════════════════════════════════
    // STEP B: PERPLEXITY SONAR LIGHT (800 tokens)
    // ═══════════════════════════════════════════════════════════════
    
    console.log('\n📡 STEP B: Perplexity Sonar LIGHT researching...');
    
    const matchNames = matchesData.slice(0, 5).map(m => `${m.home_team} vs ${m.away_team}`).join(', ');
    
    let researchContext = '';
    
    try {
      const perplexityRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
          'X-Title': 'Coco VIP Sniper'
        },
        body: JSON.stringify({
          model: 'perplexity/sonar',
          messages: [
            { role: 'system', content: PERPLEXITY_LIGHT_PROMPT },
            { role: 'user', content: `Partidos: ${matchNames}\nDeporte: ${SPORT_NAMES[sport]}\nFecha: ${new Date().toLocaleDateString('es-CL')}\n\nResponde SOLO en español.` }
          ],
          max_tokens: 800
        })
      });

      if (perplexityRes.ok) {
        const pData = await perplexityRes.json();
        researchContext = pData.choices?.[0]?.message?.content || '';
        console.log(`✅ Perplexity research: ${researchContext.length} chars`);
      } else {
        console.log(`⚠️ Perplexity error: ${perplexityRes.status}`);
      }
    } catch (e) {
      console.log('⚠️ Perplexity failed:', e.message);
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP C: DEEPSEEK V3 LIGHT (1500 tokens)
    // ═══════════════════════════════════════════════════════════════
    
    console.log('\n🧠 STEP C: DeepSeek V3 generating picks...');
    
    const oddsInfo = matchesData.map(m => 
      `${m.home_team} vs ${m.away_team} (${m.league}): 1=${m.h2h.home} X=${m.h2h.draw || 'N/A'} 2=${m.h2h.away}`
    ).join('\n');

    const deepseekRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-coco-vip-de-ia-studio.vercel.app',
        'X-Title': 'Coco VIP Sniper'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: DEEPSEEK_LIGHT_PROMPT },
          { role: 'user', content: `Genera picks sniper para estos partidos:

CUOTAS:
${oddsInfo}

CONTEXTO:
${researchContext || 'Sin contexto adicional'}

Reglas:
- Máximo 3 picks
- Solo edge >= 4%
- Solo cuotas entre 1.60 y 2.50
- Español puro` }
        ],
        max_tokens: 1500
      })
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      console.log(`⚠️ DeepSeek error: ${deepseekRes.status}`);
      
      if (picks.length > 0) {
        return res.status(200).json({ sport, picks, source: 'partial', generated_at: new Date().toISOString() });
      }
      
      return res.status(200).json({
        sport,
        picks: [],
        message: 'Error generando picks sniper',
        generated_at: new Date().toISOString()
      });
    }

    const dsData = await deepseekRes.json();
    let content = dsData.choices?.[0]?.message?.content || '';
    
    // Clean markdown
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let generatedPicks = [];
    
    try {
      const parsed = JSON.parse(content);
      generatedPicks = (parsed.picks || []).map((pick, idx) => ({
        id: `sniper-${Date.now()}-${idx}`,
        match: pick.match,
        league: pick.league,
        kickoff: pick.kickoff,
        market: pick.market,
        selection: pick.selection,
        odds: pick.odds,
        edge_percentage: pick.edge_percentage,
        confidence_score: pick.confidence_score,
        tier: pick.tier,
        kelly_stake: pick.kelly_stake,
        reason: pick.reason,
        source: 'generated'
      }));
      
      console.log(`✅ Generated ${generatedPicks.length} sniper picks`);
      
    } catch (parseError) {
      console.log('⚠️ JSON parse error:', parseError.message);
    }

    // Combine existing picks from Sheets with generated picks
    const allPicks = [...picks, ...generatedPicks]
      .filter(pick => pick.edge_percentage >= 4)
      .filter(pick => pick.odds >= 1.60 && pick.odds <= 2.50)
      .sort((a, b) => b.edge_percentage - a.edge_percentage)
      .slice(0, 3);

    const result = {
      sport,
      picks: allPicks,
      source: allPicks.some(p => p.source === 'sheets') ? 'mixed' : 'generated',
      generated_at: new Date().toISOString()
    };

    // Cache for 1 hour
    cache.set(cacheKey, { data: result, expires: Date.now() + 3600000 });

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`✅ SNIPER PICKS COMPLETE: ${allPicks.length} picks`);
    allPicks.forEach(p => console.log(`   🎯 ${p.match}: ${p.selection} @ ${p.odds} (+${p.edge_percentage}%)`));
    console.log(`${'═'.repeat(50)}\n`);

    return res.status(200).json(result);

  } catch (error) {
    console.error('\n❌ SNIPER PICKS ERROR:', error);
    
    return res.status(500).json({
      error: 'Failed to generate sniper picks',
      message: error.message,
      sport,
      generated_at: new Date().toISOString()
    });
  }
}
