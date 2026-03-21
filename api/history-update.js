/**
 * Coco VIP - History Update API Endpoint
 * POST: Update analysis result (won/lost/void)
 */

import { updateAnalysisStatus, getAnalysisById } from '../lib/supabase.js';

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
    const { id, status, resultadoReal, result_home_score, result_away_score } = req.body || {};

    // Validate required fields
    if (!status || !['won', 'lost', 'void', 'pending'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: pending, won, lost, or void'
      });
    }

    if (!id) {
      return res.status(400).json({
        error: 'id is required'
      });
    }

    // Verify the analysis exists
    const existingResult = await getAnalysisById(id);
    if (!existingResult.success) {
      return res.status(404).json({
        error: 'Analysis not found',
        message: existingResult.error
      });
    }

    // Update the status in Supabase
    const result = await updateAnalysisStatus(id, status);

    if (result.success) {
      return res.status(200).json({
        success: true,
        id,
        status,
        result_home_score: result_home_score || null,
        result_away_score: result_away_score || null,
        message: 'Analysis updated successfully'
      });
    } else {
      return res.status(500).json({
        error: 'Failed to update result',
        message: result.error
      });
    }

  } catch (error) {
    console.error('❌ History Update API error:', error);
    return res.status(500).json({
      error: 'Failed to update result',
      message: error.message
    });
  }
}
