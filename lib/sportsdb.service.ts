/**
 * TheSportsDB Service
 * 
 * Fetches visual assets (logos, photos, banners) for teams and players
 * Uses Supabase cache with 7-day TTL to minimize API calls
 * 
 * IMPORTANT: This service is ONLY for visual assets, NOT for stats or picks
 */

import { SPORTSDB_CONFIG, TeamAssets, PlayerAssets, AssetCacheEntry } from '../config/sportsdb.config';

// Supabase configuration
const SUPABASE_URL = typeof import.meta !== 'undefined' 
  ? (import.meta as any).env?.VITE_SUPABASE_URL 
  : process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = typeof import.meta !== 'undefined' 
  ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY 
  : process.env.SUPABASE_ANON_KEY;

// Simple in-memory cache for client-side
const memoryCache = new Map<string, { data: any; expires: number }>();

/**
 * Fetch with rate limiting and error handling
 */
async function fetchFromSportsDB(endpoint: string): Promise<any> {
  const url = `${SPORTSDB_CONFIG.BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`TheSportsDB API error: ${response.status}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error(`TheSportsDB fetch error:`, error);
    return null;
  }
}

/**
 * Get cached asset from Supabase
 */
async function getCachedAsset(
  entityType: 'team' | 'player', 
  entityName: string
): Promise<AssetCacheEntry | null> {
  // Check memory cache first (client-side)
  const memoryKey = `${entityType}:${entityName}`;
  const memoryCached = memoryCache.get(memoryKey);
  
  if (memoryCached && memoryCached.expires > Date.now()) {
    return memoryCached.data;
  }

  // Check Supabase cache
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/assets_cache?entity_type=eq.${entityType}&entity_name=eq.${encodeURIComponent(entityName)}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data && data.length > 0) {
      const cached = data[0];
      
      // Check if cache is expired
      const expiresAt = new Date(cached.expires_at).getTime();
      if (expiresAt > Date.now()) {
        // Store in memory cache
        memoryCache.set(memoryKey, {
          data: cached,
          expires: expiresAt
        });
        return cached;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting cached asset:', error);
    return null;
  }
}

/**
 * Save asset to Supabase cache
 */
async function saveCachedAsset(entry: AssetCacheEntry): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const memoryKey = `${entry.entity_type}:${entry.entity_name}`;
  
  // Update memory cache
  memoryCache.set(memoryKey, {
    data: entry,
    expires: Date.now() + (SPORTSDB_CONFIG.CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000)
  });

  try {
    // Upsert to Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/assets_cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        entity_type: entry.entity_type,
        entity_name: entry.entity_name,
        sportsdb_id: entry.sportsdb_id,
        logo_url: entry.logo_url,
        photo_url: entry.photo_url,
        extra_data: entry.extra_data,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + SPORTSDB_CONFIG.CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
      })
    });
  } catch (error) {
    console.error('Error saving cached asset:', error);
  }
}

/**
 * Normalize team name for search
 * Handles common variations like "Man United" -> "Manchester United"
 */
function normalizeTeamName(name: string): string {
  const normalizations: Record<string, string> = {
    'man united': 'Manchester United',
    'man utd': 'Manchester United',
    'manchester utd': 'Manchester United',
    'man city': 'Manchester City',
    'spurs': 'Tottenham',
    'tottenham hotspur': 'Tottenham',
    'newcastle': 'Newcastle United',
    'newcastle utd': 'Newcastle United',
    'wolves': 'Wolverhampton',
    'wolverhampton wanderers': 'Wolverhampton',
    'brighton': 'Brighton Hove Albion',
    'brighton & hove': 'Brighton Hove Albion',
    'real madrid': 'Real Madrid',
    'barcelona': 'Barcelona',
    'fc barcelona': 'Barcelona',
    'atletico': 'Atletico Madrid',
    'atletico madrid': 'Atletico Madrid',
    'psg': 'Paris Saint Germain',
    'paris sg': 'Paris Saint Germain',
    'bayern': 'Bayern Munich',
    'bayern munchen': 'Bayern Munich',
    'juventus': 'Juventus',
    'juve': 'Juventus',
    'inter': 'Inter Milan',
    'inter milan': 'Inter Milan',
    'ac milan': 'AC Milan',
    'milan': 'AC Milan',
    // NBA teams
    'lakers': 'Los Angeles Lakers',
    'la lakers': 'Los Angeles Lakers',
    'celtics': 'Boston Celtics',
    'warriors': 'Golden State Warriors',
    'gsw': 'Golden State Warriors',
    'nets': 'Brooklyn Nets',
    'knicks': 'New York Knicks',
    'heat': 'Miami Heat',
    'bulls': 'Chicago Bulls',
    'spurs': 'San Antonio Spurs',
    'rockets': 'Houston Rockets',
    'nuggets': 'Denver Nuggets',
    'bucks': 'Milwaukee Bucks',
    'suns': 'Phoenix Suns',
    '76ers': 'Philadelphia 76ers',
    'sixers': 'Philadelphia 76ers',
    'raptors': 'Toronto Raptors',
    'mavericks': 'Dallas Mavericks',
    'mavs': 'Dallas Mavericks',
    'blazers': 'Portland Trail Blazers',
    'trail blazers': 'Portland Trail Blazers',
    'cavaliers': 'Cleveland Cavaliers',
    'cavs': 'Cleveland Cavaliers',
    'clippers': 'LA Clippers',
    'la clippers': 'LA Clippers',
    'pelicans': 'New Orleans Pelicans',
    'kings': 'Sacramento Kings',
    'magic': 'Orlando Magic',
    'hornets': 'Charlotte Hornets',
    'pacers': 'Indiana Pacers',
    'pistons': 'Detroit Pistons',
    'wizards': 'Washington Wizards',
    'hawks': 'Atlanta Hawks',
    'thunder': 'Oklahoma City Thunder',
    'jazz': 'Utah Jazz',
    'grizzlies': 'Memphis Grizzlies',
    'timberwolves': 'Minnesota Timberwolves',
    'wolves': 'Minnesota Timberwolves'
  };
  
  const lower = name.toLowerCase().trim();
  return normalizations[lower] || name;
}

/**
 * Get team assets (logo, banner, colors)
 * 
 * @param teamName - Team name to search for
 * @param sport - Optional sport filter ('Soccer', 'Basketball', 'Baseball')
 * @returns TeamAssets or null if not found
 */
export async function getTeamAssets(
  teamName: string, 
  sport?: string
): Promise<TeamAssets | null> {
  const normalizedName = normalizeTeamName(teamName);
  
  // Check cache first
  const cached = await getCachedAsset('team', normalizedName);
  if (cached) {
    return {
      team_id: cached.sportsdb_id,
      name: normalizedName,
      short_name: cached.extra_data?.short_name || '',
      alternate_name: cached.extra_data?.alternate_name || '',
      logo_url: cached.logo_url || SPORTSDB_CONFIG.FALLBACKS.teamLogo,
      banner_url: cached.extra_data?.banner_url || '',
      jersey_url: cached.extra_data?.jersey_url || '',
      stadium_thumb: cached.extra_data?.stadium_thumb || '',
      stadium_name: cached.extra_data?.stadium_name || '',
      primary_color: cached.extra_data?.primary_color || '',
      secondary_color: cached.extra_data?.secondary_color || '',
      league: cached.extra_data?.league || '',
      country: cached.extra_data?.country || ''
    };
  }

  // Fetch from TheSportsDB
  let endpoint = `/searchteams.php?t=${encodeURIComponent(normalizedName)}`;
  if (sport) {
    endpoint += `&s=${encodeURIComponent(sport)}`;
  }

  const data = await fetchFromSportsDB(endpoint);
  
  if (!data?.teams || data.teams.length === 0) {
    // Try searching without sport filter if specified
    if (sport) {
      return getTeamAssets(teamName);
    }
    return null;
  }

  // Find best match
  const team = data.teams[0];
  
  const assets: TeamAssets = {
    team_id: team.idTeam,
    name: team.strTeam,
    short_name: team.strTeamShort || '',
    alternate_name: team.strAlternate || '',
    logo_url: team.strTeamBadge || SPORTSDB_CONFIG.FALLBACKS.teamLogo,
    banner_url: team.strTeamBanner || '',
    jersey_url: team.strTeamJersey || '',
    stadium_thumb: team.strStadiumThumb || '',
    stadium_name: team.strStadium || '',
    primary_color: team.strColour1 || '',
    secondary_color: team.strColour2 || '',
    league: team.strLeague || '',
    country: team.strCountry || ''
  };

  // Cache the result
  await saveCachedAsset({
    entity_type: 'team',
    entity_name: normalizedName,
    sportsdb_id: team.idTeam,
    logo_url: assets.logo_url,
    extra_data: {
      short_name: assets.short_name,
      alternate_name: assets.alternate_name,
      banner_url: assets.banner_url,
      jersey_url: assets.jersey_url,
      stadium_thumb: assets.stadium_thumb,
      stadium_name: assets.stadium_name,
      primary_color: assets.primary_color,
      secondary_color: assets.secondary_color,
      league: assets.league,
      country: assets.country
    },
    cached_at: new Date().toISOString()
  });

  return assets;
}

/**
 * Get player assets (photo, cutout, position)
 * 
 * @param playerName - Player name to search for
 * @returns PlayerAssets or null if not found
 */
export async function getPlayerAssets(playerName: string): Promise<PlayerAssets | null> {
  // Check cache first
  const cached = await getCachedAsset('player', playerName);
  if (cached) {
    return {
      player_id: cached.sportsdb_id,
      name: playerName,
      photo_url: cached.photo_url || SPORTSDB_CONFIG.FALLBACKS.playerPhoto,
      cutout_url: cached.extra_data?.cutout_url || '',
      position: cached.extra_data?.position || '',
      team: cached.extra_data?.team || '',
      team_id: cached.extra_data?.team_id || '',
      nationality: cached.extra_data?.nationality || '',
      height: cached.extra_data?.height || '',
      weight: cached.extra_data?.weight || '',
      birth_date: cached.extra_data?.birth_date || '',
      signing_date: cached.extra_data?.signing_date || ''
    };
  }

  // Fetch from TheSportsDB
  const endpoint = `/searchplayers.php?p=${encodeURIComponent(playerName)}`;
  const data = await fetchFromSportsDB(endpoint);
  
  if (!data?.player || data.player.length === 0) {
    return null;
  }

  // Find best match
  const player = data.player[0];
  
  const assets: PlayerAssets = {
    player_id: player.idPlayer,
    name: player.strPlayer,
    photo_url: player.strThumb || SPORTSDB_CONFIG.FALLBACKS.playerPhoto,
    cutout_url: player.strCutout || '',
    position: player.strPosition || '',
    team: player.strTeam || '',
    team_id: player.idTeam || '',
    nationality: player.strNationality || '',
    height: player.strHeight || '',
    weight: player.strWeight || '',
    birth_date: player.dateBorn || '',
    signing_date: player.dateSigned || ''
  };

  // Cache the result
  await saveCachedAsset({
    entity_type: 'player',
    entity_name: playerName,
    sportsdb_id: player.idPlayer,
    photo_url: assets.photo_url,
    extra_data: {
      cutout_url: assets.cutout_url,
      position: assets.position,
      team: assets.team,
      team_id: assets.team_id,
      nationality: assets.nationality,
      height: assets.height,
      weight: assets.weight,
      birth_date: assets.birth_date,
      signing_date: assets.signing_date
    },
    cached_at: new Date().toISOString()
  });

  return assets;
}

/**
 * Get all players from a team with their photos
 * 
 * @param teamId - TheSportsDB team ID
 * @returns Array of PlayerAssets
 */
export async function getPlayersByTeam(teamId: string): Promise<PlayerAssets[]> {
  const endpoint = `/lookup_all_players.php?id=${teamId}`;
  const data = await fetchFromSportsDB(endpoint);
  
  if (!data?.player || !Array.isArray(data.player)) {
    return [];
  }

  return data.player.map((player: any) => ({
    player_id: player.idPlayer,
    name: player.strPlayer,
    photo_url: player.strThumb || SPORTSDB_CONFIG.FALLBACKS.playerPhoto,
    cutout_url: player.strCutout || '',
    position: player.strPosition || '',
    team: player.strTeam || '',
    team_id: player.idTeam || '',
    nationality: player.strNationality || '',
    height: player.strHeight || '',
    weight: player.strWeight || '',
    birth_date: player.dateBorn || '',
    signing_date: player.dateSigned || ''
  }));
}

/**
 * Get team by TheSportsDB ID
 * 
 * @param teamId - TheSportsDB team ID
 * @returns TeamAssets or null
 */
export async function getTeamById(teamId: string): Promise<TeamAssets | null> {
  const endpoint = `/lookupteam.php?id=${teamId}`;
  const data = await fetchFromSportsDB(endpoint);
  
  if (!data?.teams || data.teams.length === 0) {
    return null;
  }

  const team = data.teams[0];
  
  return {
    team_id: team.idTeam,
    name: team.strTeam,
    short_name: team.strTeamShort || '',
    alternate_name: team.strAlternate || '',
    logo_url: team.strTeamBadge || SPORTSDB_CONFIG.FALLBACKS.teamLogo,
    banner_url: team.strTeamBanner || '',
    jersey_url: team.strTeamJersey || '',
    stadium_thumb: team.strStadiumThumb || '',
    stadium_name: team.strStadium || '',
    primary_color: team.strColour1 || '',
    secondary_color: team.strColour2 || '',
    league: team.strLeague || '',
    country: team.strCountry || ''
  };
}

/**
 * Batch fetch team assets for multiple teams
 * Useful for loading all team logos for a match list
 */
export async function batchGetTeamAssets(teamNames: string[]): Promise<Map<string, TeamAssets>> {
  const results = new Map<string, TeamAssets>();
  
  // Process in parallel with a concurrency limit
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < teamNames.length; i += BATCH_SIZE) {
    const batch = teamNames.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (name) => {
      const assets = await getTeamAssets(name);
      if (assets) {
        results.set(name, assets);
      }
    });
    
    await Promise.all(promises);
    
    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < teamNames.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * Clear the memory cache (useful for testing or force refresh)
 */
export function clearAssetsCache(): void {
  memoryCache.clear();
}

// Export all functions
export default {
  getTeamAssets,
  getPlayerAssets,
  getPlayersByTeam,
  getTeamById,
  batchGetTeamAssets,
  clearAssetsCache
};
