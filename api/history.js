/**
 * Coco VIP - History API Endpoint
 * GET: Retrieve analysis history from Supabase
 */

import { getAnalyses, getAnalysisById } from '../lib/supabase.js';

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
          item: result.data,
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

    const items = result.data || [];

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
 * Calculate ROI from items
 */
function calculateROI(items) {
  const settled = items.filter(i => i.status === 'won' || i.status === 'lost');
  if (settled.length === 0) return 0;

  let totalStake = 0;
  let totalReturn = 0;

  settled.forEach(item => {
    const stake = item.kelly_stake || 1;
    totalStake += stake;
    
    if (item.status === 'won') {
      const odds = item.odds || 1;
      totalReturn += stake * odds;
    }
  });

  if (totalStake === 0) return 0;
  return ((totalReturn - totalStake) / totalStake * 100).toFixed(2);
}
