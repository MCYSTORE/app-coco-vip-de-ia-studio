/**
 * Coco VIP - Combined API Router
 *
 * Combines multiple endpoints into a single serverless function
 * to stay under Vercel's 12 function limit on Hobby plan.
 *
 * Routes:
 * - GET /api/index?action=cache-status → Cache status
 * - GET /api/index?action=assets → Assets
 * - GET /api/index?action=top-picks → Top picks
 * - GET /api/index?action=scanner → Scanner
 * - GET /api/index?action=daily-refresh → Daily refresh
 * - GET /api/index?action=refresh-odds → Refresh odds
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'cache-status': {
        const { default: cacheStatus } = await import('./cache-status.js');
        return cacheStatus(req, res);
      }

      case 'assets': {
        const { default: assets } = await import('./assets.js');
        return assets(req, res);
      }

      case 'top-picks': {
        const { default: topPicks } = await import('./google-sheets.js');
        return fetchFromCache({ date: today }).then(entries => {
          const picks = entries.map(entry => parseCacheEntry(entry));
          return res.json(picks);
        }).catch(err => {
          return res.json([]);
        });
      }

      case 'scanner': {
        const { default: scanner } = await import('./scanner.js');
        return scanner(req, res);
      }

      case 'daily-refresh': {
        const { default: dailyRefresh } = await import('./daily-refresh.js');
        return dailyRefresh(req, res);
      }

      case 'refresh-odds': {
        const { default: refreshOdds } = await import('./refresh-odds.js');
        return refreshOdds(req, res);
      }

      default:
        return res.status(400).json({
          error: 'Invalid action',
          availableActions: [
            'cache-status',
            'assets',
            'top-picks',
            'scanner',
            'daily-refresh',
            'refresh-odds'
          ],
          usage: '/api/index?action=<action_name>'
        });
    }
  } catch (error) {
    console.error(`Error in combined API for action ${action}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      action,
      message: error.message
    });
  }
}
