/**
 * Coco VIP - History API Endpoint
 * GET: Retrieve analysis history from Supabase
 */

import { getAnalyses, getAnalysisById } from '../lib/supabase.js';

/**
 * Transform Supabase column names to frontend expected format
 */
function transformItem(item) {
  return {
    rowIndex: 0,
    id: item.id,
    fecha: item.date || item.created_at?.split('T')[0] || '',
    hora: item.created_at?.split('T')[1]?.substring(0, 5) || '',
    sport: item.sport || 'Football',
    partido: item.match_name || item.match || '',
    liga: item.league || 'Otro',
    data_quality: item.data_quality || 'media',
    mercado: item.best_market || item.market || '',
    seleccion: item.selection || '',
    cuota: parseFloat(item.odds) || 1.85,
    edge: parseFloat(item.edge_percent) || 0,
    confianza: Math.round((item.confidence || 5)),
    tier: item.quality_tier || item.tier || 'B',
    kelly: parseFloat(item.kelly_stake) || 0,
    resultado_probable: item.resultado_probable || '',
    marcador_estimado: item.marcador_estimado || '',
    rango_goles: item.rango_goles || '',
    btts: item.btts || '',
    pros: item.supporting_factors || [],
    contras: Array.isArray(item.risk_factors) ? item.risk_factors.join(', ') : (item.risk_factors || ''),
    conclusion: item.analysis_text || item.conclusion || '',
    stats: item.stats || [],
    razonamiento: item.deep_reasoning || item.razonamiento || '',
    contexto_tactico: item.contexto_tactico || '',
    contexto_stats: item.research_context || item.contexto_stats || '',
    modelo: item.modelo || 'AI Pipeline',
    source: item.source || 'manual',
    status: item.status || 'pending',
    resultado_real: item.resultado_real || '',
    notas: item.notas || '',
    // Additional fields that might be useful
    created_at: item.created_at,
    settled_at: item.settled_at,
    estimated_prob: item.estimated_prob,
    implied_prob: item.implied_prob
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sport, status, limit, offset, id, statsOnly, date } = req.query || {};

    // If requesting by ID
    if (id) {
      const result = await getAnalysisById(id);
      if (result.success) {
        return res.status(200).json({
          item: transformItem(result.data),
          configured: true
        });
      } else {
        return res.status(404).json({
          error: 'Analysis not found',
          message: result.error
        });
      }
    }

    // Build options for query
    const options = {};
    if (sport) options.sport = sport;
    if (status) options.status = status;
    if (limit) options.limit = parseInt(limit, 10);
    if (offset) options.offset = parseInt(offset, 10);
    if (date) options.date = date;

    // Get history from Supabase
    const result = await getAnalyses(options);

    if (!result.success) {
      // If table doesn't exist, return empty with message
      if (result.error?.includes('relation') || result.error?.includes('does not exist')) {
        return res.status(200).json({
          items: [],
          stats: { total: 0, won: 0, lost: 0, pending: 0, void: 0, roi: 0 },
          configured: true,
          message: 'La tabla predictions no existe. Ejecuta el SQL de creación.',
          needsTableCreation: true
        });
      }
      
      return res.status(500).json({
        error: 'Failed to fetch history',
        message: result.error
      });
    }

    const rawItems = result.data || [];

    // Transform items to match frontend expected format
    const items = rawItems.map(transformItem);

    // Calculate stats from items
    const stats = {
      total: items.length,
      won: items.filter(i => i.status === 'won').length,
      lost: items.filter(i => i.status === 'lost').length,
      pending: items.filter(i => i.status === 'pending').length,
      void: items.filter(i => i.status === 'void').length,
      roi: calculateROI(items)
    };

    // If requesting stats only
    if (statsOnly === 'true') {
      return res.status(200).json({
        stats,
        configured: true
      });
    }

    return res.status(200).json({
      items,
      stats,
      configured: true,
      count: items.length
    });

  } catch (error) {
    console.error('❌ History API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch history',
      message: error.message
    });
  }
}

/**
 * Calculate ROI from items (uses transformed field names)
 */
function calculateROI(items) {
  const settled = items.filter(i => i.status === 'won' || i.status === 'lost');
  if (settled.length === 0) return 0;

  let totalStake = 0;
  let totalReturn = 0;

  settled.forEach(item => {
    const stake = item.kelly || 1;
    totalStake += stake;
    
    if (item.status === 'won') {
      const odds = item.cuota || 1;
      totalReturn += stake * odds;
    }
  });

  if (totalStake === 0) return 0;
  return ((totalReturn - totalStake) / totalStake * 100).toFixed(2);
}
