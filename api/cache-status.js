/**
 * Cache Status Endpoint
 * Returns metadata about the Google Sheets cache
 * 
 * GET /api/cache-status
 */

import { getCacheMetadata } from './google-sheets.js';

export default async function handler(req, res) {
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
    const metadata = await getCacheMetadata();
    return res.status(200).json(metadata);
  } catch (error) {
    console.error("Cache status error:", error);
    return res.status(200).json({
      hasCache: false,
      error: error.message
    });
  }
}
