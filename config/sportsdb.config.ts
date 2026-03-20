/**
 * TheSportsDB API Configuration
 * 
 * FREE API for visual assets only (logos, photos, banners)
 * NOT used for stats or picks - purely for UI enhancement
 * 
 * API Key "3" is the free public key for non-commercial use
 * Rate limit: ~1 request/second for free tier
 */

export const SPORTSDB_CONFIG = {
  // Free public API key "3" for non-commercial use
  BASE_URL: "https://www.thesportsdb.com/api/v1/json/3",
  
  // Cache settings
  CACHE_DURATION_DAYS: 7,
  
  // Supported sports IDs in TheSportsDB
  SPORTS: {
    FOOTBALL: "Soccer",      // TheSportsDB uses "Soccer" for football
    BASKETBALL: "Basketball",
    BASEBALL: "Baseball"
  },
  
  // API Endpoints
  ENDPOINTS: {
    // Search team by name
    teamByName: "/searchteams.php?t={team_name}",
    
    // Get team by ID
    teamById: "/lookupteam.php?id={team_id}",
    
    // Get all players from a team
    playersByTeam: "/lookup_all_players.php?id={team_id}",
    
    // Get player by ID
    playerById: "/lookupplayer.php?id={player_id}",
    
    // Search player by name
    playerByName: "/searchplayers.php?p={player_name}",
    
    // Search team by name and sport
    teamByNameAndSport: "/searchteams.php?t={team_name}&s={sport}"
  },
  
  // Fallback images when asset not found
  FALLBACKS: {
    teamLogo: "/assets/default-team-logo.svg",
    playerPhoto: "/assets/default-player-photo.svg",
    teamBanner: null
  }
} as const;

/**
 * Team asset fields returned by TheSportsDB
 */
export interface TeamAssets {
  team_id: string;
  name: string;
  short_name: string;
  alternate_name: string;
  logo_url: string;          // strTeamBadge
  banner_url: string;        // strTeamBanner
  jersey_url: string;        // strTeamJersey
  stadium_thumb: string;     // strStadiumThumb
  stadium_name: string;
  primary_color: string;     // strColour1
  secondary_color: string;   // strColour2
  league: string;
  country: string;
}

/**
 * Player asset fields returned by TheSportsDB
 */
export interface PlayerAssets {
  player_id: string;
  name: string;
  photo_url: string;         // strThumb
  cutout_url: string;        // strCutout (transparent background)
  position: string;          // strPosition
  team: string;
  team_id: string;
  nationality: string;
  height: string;
  weight: string;
  birth_date: string;
  signing_date: string;
}

/**
 * Cache entry for Supabase
 */
export interface AssetCacheEntry {
  entity_type: 'team' | 'player';
  entity_name: string;
  sportsdb_id: string;
  logo_url?: string;
  photo_url?: string;
  extra_data: Record<string, unknown>;
  cached_at: string;
}

export default SPORTSDB_CONFIG;
