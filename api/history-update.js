/**
 * Coco VIP - History Update API Endpoint
 * POST: Update analysis result (won/lost/void)
 */

import { updateResult, getHistoryById, isSheetsConfigured } from '../lib/sheets.service.ts';

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
      configured: false
    });
  }

  try {
    const { rowIndex, status, resultadoReal, id } = req.body || {};

    // Validate required fields
    if (!status || !['won', 'lost', 'void'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: won, lost, or void'
      });
    }

    // If we have an ID instead of rowIndex, find the row
    let targetRowIndex = rowIndex;
    if (!targetRowIndex && id) {
      const item = await getHistoryById(id);
      if (!item) {
        return res.status(404).json({ error: 'Analysis not found' });
      }
      targetRowIndex = item.rowIndex;
    }

    if (!targetRowIndex) {
      return res.status(400).json({
        error: 'rowIndex or id is required'
      });
    }

    // Update the result
    const success = await updateResult(targetRowIndex, status, resultadoReal);

    if (success) {
      return res.status(200).json({
        success: true,
        rowIndex: targetRowIndex,
        status,
        resultadoReal: resultadoReal || ''
      });
    } else {
      return res.status(500).json({
        error: 'Failed to update result'
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
