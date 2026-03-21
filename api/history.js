/**
 * Coco VIP - History API Endpoint
 * GET: Retrieve analysis history from Google Sheets
 */

import { getHistory, getHistoryStats, getHistoryById, isSheetsConfigured } from '../lib/sheets.service.js';

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

  // Check if Sheets is configured
  if (!isSheetsConfigured()) {
    return res.status(200).json({
      items: [],
      stats: { total: 0, won: 0, lost: 0, pending: 0, void: 0, roi: 0 },
      configured: false,
      message: 'Google Sheets not configured. Add environment variables.'
    });
  }

  try {
    const { sport, status, limit, id, statsOnly } = req.query || {};

    // If requesting by ID
    if (id) {
      const item = await getHistoryById(id);
      return res.status(200).json({
        item,
        configured: true
      });
    }

    // If requesting stats only
    if (statsOnly === 'true') {
      const stats = await getHistoryStats();
      return res.status(200).json({
        stats,
        configured: true
      });
    }

    // Build filters
    const filters = {};
    if (sport) filters.sport = sport;
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit, 10);

    // Get history
    const items = await getHistory(Object.keys(filters).length > 0 ? filters : undefined);
    const stats = await getHistoryStats();

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
