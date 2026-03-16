const SPORTS_API_KEY = process.env.SPORTS_API_KEY;

// List of bookmakers for odds simulation
const BOOKMAKERS = [
  'Bet365', 'Pinnacle', 'Bwin', '1xBet', 'William Hill', 
  'Betfair', 'DraftKings', 'FanDuel', 'BetMGM', 'Caesars'
];

// Generate all odds from different bookmakers
function generateAllOdds(baseOdds, numBookmakers = 5) {
  const allOdds = [];
  const selectedBookmakers = BOOKMAKERS.sort(() => 0.5 - Math.random()).slice(0, numBookmakers);
  
  for (const bookmaker of selectedBookmakers) {
    // Variation between -5% and +8% from base odds
    const variation = -0.05 + Math.random() * 0.13;
    const odds = +(baseOdds * (1 + variation)).toFixed(2);
    allOdds.push({ bookmaker, odds });
  }
  
  return allOdds.sort((a, b) => b.odds - a.odds);
}

// Get best odd from array
function getBestOdd(allOdds) {
  if (!allOdds || allOdds.length === 0) return null;
  return allOdds[0];
}

// Calculate line movement
function calculateLineMovement(currentOdd, openingOdd) {
  if (!currentOdd || !openingOdd) {
    return { percent: 0, direction: 'stable' };
  }
  
  const percent = ((currentOdd - openingOdd) / openingOdd) * 100;
  
  if (Math.abs(percent) < 0.5) {
    return { percent: 0, direction: 'stable' };
  }
  
  return {
    percent: Math.round(percent * 100) / 100,
    direction: percent > 0 ? 'up' : 'down'
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pick } = req.body;

  if (!pick || !pick.id) {
    return res.status(400).json({ error: 'Pick data is required' });
  }

  try {
    const openingOdd = pick.openingOdd || pick.odds || 1.85;
    const now = new Date().toISOString();
    
    // Simulate line movement based on time elapsed
    // In production, this would fetch real odds from an API
    const timeSinceOpening = pick.openingOddTimestamp 
      ? Date.now() - new Date(pick.openingOddTimestamp).getTime()
      : 0;
    
    // More time = more potential movement (simulated)
    const hoursSinceOpening = timeSinceOpening / (1000 * 60 * 60);
    const movementFactor = Math.min(hoursSinceOpening * 0.02, 0.10); // Max 10% movement
    
    // Random movement direction weighted by time
    const randomMovement = (Math.random() - 0.4) * movementFactor; // Slight bias toward up
    const newOdds = +(openingOdd * (1 + randomMovement)).toFixed(2);
    
    // Ensure odds stay within reasonable bounds
    const currentOdd = Math.max(1.01, Math.min(newOdds, openingOdd * 1.15));
    
    // Generate all odds for odds shopping
    const allOdds = generateAllOdds(currentOdd);
    const best = getBestOdd(allOdds);
    
    // Calculate line movement
    const lineMovement = calculateLineMovement(currentOdd, openingOdd);
    
    const updatedPick = {
      ...pick,
      currentOdd,
      currentOddTimestamp: now,
      lineMovementPercent: lineMovement.percent,
      lineMovementDirection: lineMovement.direction,
      // Update odds shopping
      allOdds,
      bestBookmaker: best?.bookmaker,
      bestOdd: best?.odds
    };
    
    return res.status(200).json({
      success: true,
      pick: updatedPick,
      lineMovement: {
        openingOdd,
        currentOdd,
        movement: lineMovement.percent,
        direction: lineMovement.direction,
        timestamp: now
      }
    });
  } catch (error) {
    console.error("Refresh odds error:", error);
    return res.status(500).json({ error: 'Failed to refresh odds' });
  }
}
