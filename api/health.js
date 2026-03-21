/**
 * Simple test endpoint to verify Vercel deployment
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  return res.status(200).json({
    status: 'ok',
    message: 'API is working',
    timestamp: new Date().toISOString(),
    env_check: {
      has_openrouter: !!process.env.OPENROUTER_API_KEY,
      has_odds: !!process.env.ODDS_API_KEY
    }
  });
}
