/**
 * Coco VIP - API Endpoint for AI-Driven Analysis
 * 
 * 3-Step Pipeline:
 * 1. The Odds API - Real-time odds from major bookmakers
 * 2. Perplexity (via OpenRouter) - Research agent for live web data
 * 3. DeepSeek R1 (via OpenRouter) - Quant/Sniper agent for value calculation
 */

import { analyzeMatch, saveAnalysisToSheets } from '../lib/analyzeMatch.ts';

/**
 * @typedef {Object} AnalysisRequest
 * @property {string} matchName - Match name in format "Team A vs Team B"
 * @property {'football'|'basketball'|'baseball'} sport - Sport type
 */

/**
 * @typedef {Object} AnalysisResponse
 * @property {string} sport - 'Football' | 'NBA' | 'MLB'
 * @property {string} match - Match name
 * @property {string} data_quality - 'alta' | 'media' | 'baja'
 * @property {boolean} estimated_odds - Whether odds were estimated
 * @property {Object} best_pick - Best pick recommendation
 * @property {Object} mercados_completos - Complete market analysis
 * @property {Array} picks_con_value - All value picks found
 * @property {Array} supporting_factors - Factors supporting the pick
 * @property {Array} risk_factors - Risk factors
 * @property {Array} ajustes_aplicados - Adjustments applied
 * @property {Array} fuentes_contexto - Context sources
 * @property {string} timestamp - ISO timestamp
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Validate request body
  const { matchName, sport = 'football' } = req.body;

  if (!matchName) {
    return res.status(400).json({ 
      error: 'matchName is required',
      message: 'Por favor ingresa el nombre del partido (ej: "Real Madrid vs Barcelona")'
    });
  }

  // Validate sport
  const validSports = ['football', 'basketball', 'baseball'];
  if (!validSports.includes(sport)) {
    return res.status(400).json({ 
      error: `Invalid sport. Must be one of: ${validSports.join(', ')}`
    });
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🎯 INICIANDO ANÁLISIS: ${matchName}`);
  console.log(`📊 Deporte: ${sport}`);
  console.log(`⏰ ${new Date().toLocaleString('es-ES')}`);
  console.log(`${'═'.repeat(50)}\n`);

  try {
    // Run the 3-step analysis pipeline
    const result = await analyzeMatch({
      matchName,
      sport,
      onProgress: (state) => {
        // Log progress for server-side monitoring
        const currentStep = state.steps.find(s => s.step === state.currentStep);
        if (currentStep) {
          console.log(`  [Step ${currentStep.step}] ${currentStep.icon} ${currentStep.message} - ${currentStep.status}`);
          if (currentStep.warning) {
            console.log(`    ⚠️ Warning: ${currentStep.warning}`);
          }
        }
      }
    });

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`✅ ANÁLISIS COMPLETADO`);
    console.log(`📌 Best Pick: ${result.best_pick?.selection} en ${result.best_pick?.market}`);
    console.log(`📊 Edge: ${result.best_pick?.edge_percentage}% | Confidence: ${result.best_pick?.confidence_score}`);
    console.log(`🏷️ Tier: ${result.best_pick?.tier}`);
    console.log(`${'═'.repeat(50)}\n`);

    // Save to Google Sheets (async, don't wait)
    saveAnalysisToSheets(result).then(saved => {
      if (saved) {
        console.log('💾 Analysis saved to Google Sheets');
      }
    }).catch(err => {
      console.error('❌ Failed to save to Google Sheets:', err.message);
    });

    // Return the analysis result
    return res.status(200).json(result);

  } catch (error) {
    console.error('\n❌ ANALYSIS FAILED:', error);
    
    // Return error with helpful message
    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message || 'Error desconocido durante el análisis',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      // Provide fallback structure for UI
      fallback: {
        sport: sport === 'football' ? 'Football' : sport === 'basketball' ? 'NBA' : 'MLB',
        match: matchName,
        data_quality: 'baja',
        estimated_odds: true,
        best_pick: null,
        mercados_completos: null,
        picks_con_value: [],
        supporting_factors: [],
        risk_factors: ['Error en el análisis - intentar nuevamente'],
        ajustes_aplicados: [],
        fuentes_contexto: [],
        timestamp: new Date().toISOString()
      }
    });
  }
}
