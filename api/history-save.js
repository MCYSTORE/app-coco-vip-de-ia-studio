/**
 * Coco VIP - History Save API Endpoint
 * Guarda análisis en Supabase (PostgreSQL)
 */

import { saveAnalysis } from '../lib/supabase.js';

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

  try {
    const body = req.body || {};
    const result = body.result || body;
    const userContext = body.userContext || '';

    if (!result || Object.keys(result).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'result is required' 
      });
    }

    console.log('📊 Guardando análisis en Supabase...');
    console.log('📊 Match:', result.matchName || result.match || 'Unknown');
    console.log('📊 Sport:', result.sport || 'football');

    // Detectar deporte para campos específicos
    const sport = result.sport || 'football';
    const isNBA = sport === 'basketball' || sport === 'NBA';
    const isFootball = sport === 'football' || sport === 'Football';

    // Preparar datos para Supabase
    const analysisData = {
      matchName: result.matchName || result.match || '',
      match: result.match || result.matchName || '',
      sport: sport,
      league: result.league || 'Otro',
      
      // Selección y mercado
      selection: result.selection || result.best_pick?.selection || '',
      bestMarket: result.bestMarket || result.best_pick?.market || '',
      
      // Odds y probabilidades
      odds: parseFloat(result.odds || result.best_pick?.odds || 0),
      estimated_prob: parseFloat(result.estimated_prob || result.best_pick?.probability || 0),
      implied_prob: parseFloat(result.implied_prob || (result.odds ? 1/result.odds : 0)),
      edgePercent: parseFloat(result.edgePercent || result.best_pick?.edge_percentage || result.edge_percentage || 0),
      
      // Confianza y calidad (convertir de 0-1 a 1-10)
      confidence: result.confidence || result.best_pick?.confidence_score || 0.5,
      tier: result.tier || result.best_pick?.tier || 'B',
      
      // Análisis
      analysisText: result.analysisText || result.analysis_text || result.best_pick?.analysis?.conclusion || '',
      deep_reasoning: result.deep_reasoning || '',
      researchContext: result.researchContext || '',
      supporting_factors: result.supporting_factors || [],
      risk_factors: result.risk_factors || [],
      
      // Kelly
      kellyStake: parseFloat(result.kellyStake || result.best_pick?.kelly_stake_units || result.kelly_stake_units || 0),
      
      // Contexto del usuario
      userContext: userContext,
      
      // Fuente
      source: result.source || 'manual',

      // FIX 3: NBA Stats específicas (si aplica)
      ...(isNBA && {
        homeStats: result.nbaStats?.homeStats || result.homeStats || null,
        awayStats: result.nbaStats?.awayStats || result.awayStats || null,
        homeTrends: result.homeTrends || null,
        awayTrends: result.awayTrends || null,
        home_ortg: result.nbaStats?.homeStats?.offensiveRating || null,
        home_drtg: result.nbaStats?.homeStats?.defensiveRating || null,
        home_pace: result.nbaStats?.homeStats?.pace || null,
        away_ortg: result.nbaStats?.awayStats?.offensiveRating || null,
        away_drtg: result.nbaStats?.awayStats?.defensiveRating || null,
        away_pace: result.nbaStats?.awayStats?.pace || null,
      }),

      // FIX 3: Fútbol Stats específicas (NO TOCAR)
      ...(isFootball && {
        xgStats: result.xgStats || null,
        xg_home: result.xgStats?.home?.avg_xg || null,
        xga_home: result.xgStats?.home?.avg_xga || null,
        xg_away: result.xgStats?.away?.avg_xg || null,
        xga_away: result.xgStats?.away?.avg_xga || null,
      }),
    };

    console.log('📊 Datos preparados:', JSON.stringify(analysisData).substring(0, 200));

    // Guardar en Supabase
    const saveResult = await saveAnalysis(analysisData);

    if (saveResult.success) {
      console.log('✅ Análisis guardado correctamente en Supabase');
      return res.status(200).json({
        success: true,
        id: saveResult.id,
        message: 'Análisis guardado en Supabase',
        savedAt: new Date().toISOString()
      });
    } else {
      console.error('❌ Error al guardar en Supabase:', saveResult.error);
      
      // Si la tabla no existe, devolver instrucciones
      if (saveResult.needsTableCreation) {
        return res.status(500).json({
          success: false,
          error: 'La tabla predictions no existe. Ejecuta el SQL de creación en Supabase.',
          sqlNeeded: true
        });
      }
      
      return res.status(500).json({
        success: false,
        error: saveResult.error || 'Error al guardar en Supabase'
      });
    }

  } catch (error) {
    console.error('❌ History Save API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error.message
    });
  }
}
