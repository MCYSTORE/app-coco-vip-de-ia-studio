/**
 * Assets API Endpoint
 * 
 * GET /api/assets?type=team|player&name={name}
 * POST /api/assets with body: { type, names: string[] } for batch requests
 * 
 * Fetches visual assets (logos, photos) from TheSportsDB
 * Uses Supabase cache with 7-day TTL
 */

const SPORTSDB_BASE_URL = "https://www.thesportsdb.com/api/v1/json/3";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CACHE_DURATION_DAYS = 7;

// In-memory cache for this serverless function instance
const localCache = new Map();

/**
 * Fetch from TheSportsDB API
 */
async function fetchFromSportsDB(endpoint) {
  try {
    const response = await fetch(`${SPORTSDB_BASE_URL}${endpoint}`, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.error(`TheSportsDB error: ${response.status}`);
      return null;
    }
    
    return response.json();
  } catch (error) {
    console.error(`TheSportsDB fetch error:`, error.message);
    return null;
  }
}

/**
 * Get cached asset from Supabase
 */
async function getCachedAsset(entityType, entityName) {
  // Check local cache first
  const localKey = `${entityType}:${entityName}`;
  const localCached = localCache.get(localKey);
  if (localCached && localCached.expires > Date.now()) {
    return localCached.data;
  }
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/assets_cache?entity_type=eq.${entityType}&entity_name=eq.${encodeURIComponent(entityName)}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const cached = data[0];
      const expiresAt = new Date(cached.expires_at).getTime();
      
      if (expiresAt > Date.now()) {
        // Store in local cache
        localCache.set(localKey, { data: cached, expires: expiresAt });
        return cached;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cached asset:', error.message);
    return null;
  }
}

/**
 * Save asset to Supabase cache
 */
async function saveCachedAsset(entry) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  
  const localKey = `${entry.entity_type}:${entry.entity_name}`;
  localCache.set(localKey, {
    data: entry,
    expires: Date.now() + CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000
  });
  
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/assets_cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        entity_type: entry.entity_type,
        entity_name: entry.entity_name,
        entity_sport: entry.entity_sport,
        sportsdb_id: entry.sportsdb_id,
        logo_url: entry.logo_url,
        photo_url: entry.photo_url,
        cutout_url: entry.cutout_url,
        banner_url: entry.banner_url,
        jersey_url: entry.jersey_url,
        primary_color: entry.primary_color,
        secondary_color: entry.secondary_color,
        extra_data: entry.extra_data || {},
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
      })
    });
  } catch (error) {
    console.error('Error saving cached asset:', error.message);
  }
}

/**
 * Normalize team name for better search results
 */
function normalizeTeamName(name) {
  const normalizations = {
    'man united': 'Manchester United',
    'man utd': 'Manchester United',
    'man city': 'Manchester City',
    'spurs': 'Tottenham',
    'newcastle': 'Newcastle United',
    'wolves': 'Wolverhampton',
    'brighton': 'Brighton',
    'real madrid': 'Real Madrid',
    'barcelona': 'Barcelona',
    'psg': 'Paris Saint Germain',
    'bayern': 'Bayern Munich',
    'juventus': 'Juventus',
    'inter milan': 'Inter Milan',
    'ac milan': 'Milan',
    // NBA
    'lakers': 'Los Angeles Lakers',
    'la lakers': 'Los Angeles Lakers',
    'celtics': 'Boston Celtics',
    'warriors': 'Golden State Warriors',
    'gsw': 'Golden State Warriors',
    'heat': 'Miami Heat',
    'bulls': 'Chicago Bulls',
    'rockets': 'Houston Rockets',
    'nuggets': 'Denver Nuggets',
    'bucks': 'Milwaukee Bucks',
    'suns': 'Phoenix Suns',
    'knicks': 'New York Knicks',
    'nets': 'Brooklyn Nets',
    '76ers': 'Philadelphia 76ers',
    'sixers': 'Philadelphia 76ers',
    'cavaliers': 'Cleveland Cavaliers',
    'cavs': 'Cleveland Cavaliers',
    'clippers': 'LA Clippers',
    'raptors': 'Toronto Raptors',
    'mavericks': 'Dallas Mavericks',
    'mavs': 'Dallas Mavericks',
    'trail blazers': 'Portland Trail Blazers',
    'blazers': 'Portland Trail Blazers',
    'thunder': 'Oklahoma City Thunder',
    'pelicans': 'New Orleans Pelicans',
    'kings': 'Sacramento Kings',
    'magic': 'Orlando Magic',
    'hornets': 'Charlotte Hornets',
    'pacers': 'Indiana Pacers',
    'pistons': 'Detroit Pistons',
    'wizards': 'Washington Wizards',
    'hawks': 'Atlanta Hawks',
    'jazz': 'Utah Jazz',
    'grizzlies': 'Memphis Grizzlies',
    'timberwolves': 'Minnesota Timberwolves',
    'spurs': 'San Antonio Spurs'
  };
  
  const lower = name.toLowerCase().trim();
  return normalizations[lower] || name;
}

/**
 * Get team assets from TheSportsDB
 */
async function getTeamAssets(teamName, sport = null) {
  const normalizedName = normalizeTeamName(teamName);
  
  // Check cache
  const cached = await getCachedAsset('team', normalizedName);
  if (cached) {
    return {
      team_id: cached.sportsdb_id,
      name: normalizedName,
      logo_url: cached.logo_url,
      banner_url: cached.banner_url,
      jersey_url: cached.jersey_url,
      primary_color: cached.primary_color,
      secondary_color: cached.secondary_color,
      cached: true
    };
  }
  
  // Fetch from API
  let endpoint = `/searchteams.php?t=${encodeURIComponent(normalizedName)}`;
  if (sport) {
    endpoint += `&s=${encodeURIComponent(sport)}`;
  }
  
  const data = await fetchFromSportsDB(endpoint);
  
  if (!data?.teams || data.teams.length === 0) {
    if (sport) {
      // Retry without sport filter
      return getTeamAssets(teamName);
    }
    return null;
  }
  
  const team = data.teams[0];
  
  const assets = {
    team_id: team.idTeam,
    name: team.strTeam,
    logo_url: team.strTeamBadge || '/assets/default-team-logo.svg',
    banner_url: team.strTeamBanner || null,
    jersey_url: team.strTeamJersey || null,
    primary_color: team.strColour1 || null,
    secondary_color: team.strColour2 || null,
    cached: false
  };
  
  // Cache the result
  await saveCachedAsset({
    entity_type: 'team',
    entity_name: normalizedName,
    entity_sport: sport || 'unknown',
    sportsdb_id: team.idTeam,
    logo_url: assets.logo_url,
    banner_url: assets.banner_url,
    jersey_url: assets.jersey_url,
    primary_color: assets.primary_color,
    secondary_color: assets.secondary_color,
    extra_data: {
      short_name: team.strTeamShort,
      alternate_name: team.strAlternate,
      stadium_name: team.strStadium,
      league: team.strLeague,
      country: team.strCountry
    }
  });
  
  return assets;
}

/**
 * Get player assets from TheSportsDB
 */
async function getPlayerAssets(playerName) {
  // Check cache
  const cached = await getCachedAsset('player', playerName);
  if (cached) {
    return {
      player_id: cached.sportsdb_id,
      name: playerName,
      photo_url: cached.photo_url,
      cutout_url: cached.cutout_url,
      position: cached.extra_data?.position,
      team: cached.extra_data?.team,
      cached: true
    };
  }
  
  // Fetch from API
  const endpoint = `/searchplayers.php?p=${encodeURIComponent(playerName)}`;
  const data = await fetchFromSportsDB(endpoint);
  
  if (!data?.player || data.player.length === 0) {
    return null;
  }
  
  const player = data.player[0];
  
  const assets = {
    player_id: player.idPlayer,
    name: player.strPlayer,
    photo_url: player.strThumb || '/assets/default-player-photo.svg',
    cutout_url: player.strCutout || null,
    position: player.strPosition || null,
    team: player.strTeam || null,
    cached: false
  };
  
  // Cache the result
  await saveCachedAsset({
    entity_type: 'player',
    entity_name: playerName,
    sportsdb_id: player.idPlayer,
    photo_url: assets.photo_url,
    cutout_url: assets.cutout_url,
    extra_data: {
      position: assets.position,
      team: assets.team,
      team_id: player.idTeam,
      nationality: player.strNationality,
      height: player.strHeight,
      weight: player.strWeight
    }
  });
  
  return assets;
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const startTime = Date.now();
  
  try {
    // GET request - single asset
    if (req.method === 'GET') {
      const { type, name, sport } = req.query;
      
      if (!type || !name) {
        return res.status(400).json({ 
          error: 'Missing required parameters: type and name' 
        });
      }
      
      if (type === 'team') {
        const assets = await getTeamAssets(name, sport);
        return res.status(200).json({
          success: !!assets,
          data: assets,
          execution_time_ms: Date.now() - startTime
        });
      } else if (type === 'player') {
        const assets = await getPlayerAssets(name);
        return res.status(200).json({
          success: !!assets,
          data: assets,
          execution_time_ms: Date.now() - startTime
        });
      } else {
        return res.status(400).json({ error: 'Invalid type. Must be "team" or "player"' });
      }
    }
    
    // POST request - batch assets
    if (req.method === 'POST') {
      const { type, names, sport } = req.body;
      
      if (!type || !names || !Array.isArray(names)) {
        return res.status(400).json({
          error: 'Missing required parameters: type and names (array)'
        });
      }
      
      const results = {};
      
      if (type === 'team') {
        for (const name of names) {
          results[name] = await getTeamAssets(name, sport);
        }
      } else if (type === 'player') {
        for (const name of names) {
          results[name] = await getPlayerAssets(name);
        }
      } else {
        return res.status(400).json({ error: 'Invalid type. Must be "team" or "player"' });
      }
      
      return res.status(200).json({
        success: true,
        data: results,
        count: Object.keys(results).length,
        execution_time_ms: Date.now() - startTime
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Assets API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      execution_time_ms: Date.now() - startTime
    });
  }
}
