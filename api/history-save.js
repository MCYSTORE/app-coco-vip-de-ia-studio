/**
 * Coco VIP - History Save API Endpoint
 * POST: Save new analysis to Google Sheets
 */

import { saveAnalysis, isSheetsConfigured } from '../lib/sheets.service.ts';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if Sheets is configured
  if (!isSheetsConfigured()) {
    return res.status(400).json({
      error: 'Google Sheets not configured',
      configured: false,
      hint: 'Add GOOGLE_SHEETS_PRIVATE_KEY and GOOGLE_SHEETS_CLIENT_EMAIL to Vercel environment variables'
    });
  }

  try {
    const { result, userContext } = req.body || {};

    if (!result) {
      return res.status(400).json({ error: 'result is required' });
    }

    // Generate unique ID
    const id = `analysis-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Prepare data for saving
    const analysisData = {
      id,
      matchName: result.matchName || result.match,
      sport: result.sport || 'football',
      league: result.league || extractLeague(result.matchName || result.match),
      dataQuality: result.dataQuality || result.data_quality || 'media',
      jsonResult: {
        best_pick: result.best_pick || {
          market: result.bestMarket,
          selection: result.selection,
          odds: result.odds,
          edge_percentage: result.edgePercent,
          confidence_score: result.confidence ? result.confidence / 10 : 0.5,
          tier: result.tier || 'B',
          kelly_stake_units: result.kellyStake || 0.05,
          value_bet: result.valueBet || false,
          analysis: {
            pros: result.supporting_factors || [],
            cons: result.risk_factors || [],
            conclusion: result.analysisText || ''
          },
          stats_highlights: result.stats_highlights || {}
        },
        mercados_completos: result.mercados_completos || {
          proyeccion_final: {
            resultado_probable: result.resultado_probable || '',
            marcador_estimado: result.marcador_estimado || '',
            rango_total: result.rango_goles || '',
            btts_probable: result.btts === 'Sí' || false
          }
        }
      },
      researchA: result.researchContext || result.contexto_tactico || '',
      researchB: result.researchContext || result.contexto_stats || '',
      deepThinking: result.deep_reasoning || result.razonamiento || '',
      modelAnalyst: result.modelo || 'Claude Sonnet 4 + Grok 4.1',
      source: 'manual_analysis'
    };

    // Save to Google Sheets
    const saved = await saveAnalysis(analysisData);

    if (saved) {
      return res.status(200).json({
        success: true,
        id,
        message: 'Análisis guardado en Google Sheets',
        savedAt: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        error: 'Failed to save analysis',
        saved: false
      });
    }

  } catch (error) {
    console.error('❌ History Save API error:', error);
    return res.status(500).json({
      error: 'Failed to save analysis',
      message: error.message
    });
  }
}

/**
 * Extract league from match name (basic extraction)
 */
function extractLeague(matchName) {
  if (!matchName) return '';
  
  const lower = matchName.toLowerCase();
  
  // Spanish teams
  if (lower.includes('real madrid') || lower.includes('barcelona') || 
      lower.includes('atletico') || lower.includes('sevilla') ||
      lower.includes('valencia') || lower.includes('villarreal') ||
      lower.includes('real betis') || lower.includes('athletic')) {
    return 'La Liga';
  }
  
  // English teams
  if (lower.includes('manchester') || lower.includes('liverpool') ||
      lower.includes('chelsea') || lower.includes('arsenal') ||
      lower.includes('tottenham') || lower.includes('city') ||
      lower.includes('united') || lower.includes('everton')) {
    return 'Premier League';
  }
  
  // Italian teams
  if (lower.includes('juventus') || lower.includes('milan') ||
      lower.includes('inter') || lower.includes('roma') ||
      lower.includes('napoli') || lower.includes('lazio')) {
    return 'Serie A';
  }
  
  // German teams
  if (lower.includes('bayern') || lower.includes('dortmund') ||
      lower.includes('leipzig') || lower.includes('leverkusen')) {
    return 'Bundesliga';
  }
  
  // French teams
  if (lower.includes('psg') || lower.includes('paris') ||
      lower.includes('marseille') || lower.includes('lyon')) {
    return 'Ligue 1';
  }
  
  // NBA
  if (lower.includes('lakers') || lower.includes('celtics') ||
      lower.includes('warriors') || lower.includes('bulls') ||
      lower.includes('heat') || lower.includes('nets')) {
    return 'NBA';
  }
  
  // MLB
  if (lower.includes('yankees') || lower.includes('dodgers') ||
      lower.includes('red sox') || lower.includes('cubs')) {
    return 'MLB';
  }
  
  return 'Otro';
}
