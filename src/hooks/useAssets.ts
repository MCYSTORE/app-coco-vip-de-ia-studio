/**
 * useAssets Hook
 * 
 * React hook for fetching visual assets (logos, photos) from TheSportsDB
 * Uses internal cache to minimize API calls
 */

import { useState, useEffect, useCallback } from 'react';

interface TeamAssets {
  team_id: string;
  name: string;
  logo_url: string;
  banner_url?: string;
  primary_color?: string;
  secondary_color?: string;
  cached?: boolean;
}

interface PlayerAssets {
  player_id: string;
  name: string;
  photo_url: string;
  cutout_url?: string;
  position?: string;
  team?: string;
  cached?: boolean;
}

// Simple global cache
const assetCache = new Map<string, { data: any; expires: number }>();
const pendingRequests = new Map<string, Promise<any>>();

const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Fetch asset from API or cache
 */
async function fetchAsset(type: 'team' | 'player', name: string): Promise<any> {
  const cacheKey = `${type}:${name}`;
  
  // Check cache
  const cached = assetCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  // Check for pending request
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }
  
  // Make new request
  const promise = (async () => {
    try {
      const response = await fetch(
        `/api/assets?type=${type}&name=${encodeURIComponent(name)}`
      );
      
      if (!response.ok) return null;
      
      const result = await response.json();
      
      if (result.success && result.data) {
        // Cache the result
        assetCache.set(cacheKey, {
          data: result.data,
          expires: Date.now() + CACHE_DURATION
        });
        return result.data;
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching ${type} asset:`, error);
      return null;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();
  
  pendingRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Hook to fetch team assets (logo, colors)
 */
export function useTeamAssets(teamName: string | null) {
  const [assets, setAssets] = useState<TeamAssets | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!teamName) {
      setAssets(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    fetchAsset('team', teamName)
      .then(data => {
        setAssets(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [teamName]);
  
  return { assets, loading, error };
}

/**
 * Hook to fetch player assets (photo, cutout)
 */
export function usePlayerAssets(playerName: string | null) {
  const [assets, setAssets] = useState<PlayerAssets | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!playerName) {
      setAssets(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    fetchAsset('player', playerName)
      .then(data => {
        setAssets(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [playerName]);
  
  return { assets, loading, error };
}

/**
 * Hook to batch fetch multiple team assets
 */
export function useBatchTeamAssets(teamNames: string[]) {
  const [assets, setAssets] = useState<Map<string, TeamAssets>>(new Map());
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!teamNames.length) return;
    
    setLoading(true);
    
    // Filter out already cached items
    const uncached = teamNames.filter(name => !assetCache.has(`team:${name}`));
    
    if (uncached.length === 0) {
      // All cached, just collect from cache
      const cached = new Map<string, TeamAssets>();
      teamNames.forEach(name => {
        const cachedData = assetCache.get(`team:${name}`);
        if (cachedData?.data) {
          cached.set(name, cachedData.data);
        }
      });
      setAssets(cached);
      setLoading(false);
      return;
    }
    
    // Batch fetch uncached items
    fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'team', names: uncached })
    })
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          const newAssets = new Map<string, TeamAssets>();
          
          // Add newly fetched
          Object.entries(result.data).forEach(([name, data]) => {
            if (data) {
              newAssets.set(name, data as TeamAssets);
              assetCache.set(`team:${name}`, {
                data,
                expires: Date.now() + CACHE_DURATION
              });
            }
          });
          
          // Add from cache
          teamNames.forEach(name => {
            if (!newAssets.has(name)) {
              const cachedData = assetCache.get(`team:${name}`);
              if (cachedData?.data) {
                newAssets.set(name, cachedData.data);
              }
            }
          });
          
          setAssets(newAssets);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [teamNames.join(',')]);
  
  return { assets, loading };
}

/**
 * Clear the asset cache
 */
export function clearAssetCache() {
  assetCache.clear();
}

export default {
  useTeamAssets,
  usePlayerAssets,
  useBatchTeamAssets,
  clearAssetCache
};
