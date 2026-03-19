/**
 * TeamLogo Component
 * 
 * Displays team logo with fallback styling
 * Uses TheSportsDB assets via useTeamAssets hook
 */

import React, { useState } from 'react';
import { useTeamAssets } from '../hooks/useAssets';

interface TeamLogoProps {
  teamName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showName?: boolean;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16'
};

const textSizeClasses = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm'
};

export function TeamLogo({ teamName, size = 'md', className = '', showName = false }: TeamLogoProps) {
  const { assets, loading } = useTeamAssets(teamName);
  const [imageError, setImageError] = useState(false);
  
  const logoUrl = assets?.logo_url;
  const primaryColor = assets?.primary_color;
  const secondaryColor = assets?.secondary_color;
  
  // Generate initials for fallback
  const initials = teamName
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  
  // Background gradient using team colors or default
  const bgGradient = primaryColor 
    ? `linear-gradient(135deg, ${primaryColor}${secondaryColor ? `, ${secondaryColor}` : ''})`
    : 'linear-gradient(135deg, #3B82F6, #8B5CF6)';
  
  if (loading) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-[var(--color-bg-secondary)] animate-pulse ${className}`} />
    );
  }
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center overflow-hidden shadow-lg`}
        style={{ background: logoUrl && !imageError ? 'transparent' : bgGradient }}
      >
        {logoUrl && !imageError ? (
          <img
            src={logoUrl}
            alt={teamName}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <span className="text-white font-bold" style={{ fontSize: size === 'sm' ? '8px' : size === 'md' ? '10px' : '14px' }}>
            {initials}
          </span>
        )}
      </div>
      {showName && (
        <span className={`font-medium text-[var(--color-text-primary)] ${textSizeClasses[size]}`}>
          {teamName}
        </span>
      )}
    </div>
  );
}

/**
 * TeamLogosMatch Component
 * 
 * Displays both team logos for a match side by side
 */

interface TeamLogosMatchProps {
  homeTeam: string;
  awayTeam: string;
  size?: 'sm' | 'md' | 'lg';
  showNames?: boolean;
  className?: string;
}

export function TeamLogosMatch({ 
  homeTeam, 
  awayTeam, 
  size = 'md', 
  showNames = false,
  className = '' 
}: TeamLogosMatchProps) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <TeamLogo teamName={homeTeam} size={size} showName={showNames} />
      <span className="text-[var(--color-text-secondary)] font-bold text-xs">VS</span>
      <TeamLogo teamName={awayTeam} size={size} showName={showNames} />
    </div>
  );
}

/**
 * PlayerPhoto Component
 * 
 * Displays player photo with cutout or fallback avatar
 */

interface PlayerPhotoProps {
  playerName: string;
  teamName?: string;
  size?: 'sm' | 'md' | 'lg';
  showPosition?: boolean;
  className?: string;
}

export function PlayerPhoto({ 
  playerName, 
  teamName, 
  size = 'md', 
  showPosition = false,
  className = '' 
}: PlayerPhotoProps) {
  const { assets, loading } = usePlayerAssets(playerName);
  const [imageError, setImageError] = useState(false);
  
  const photoUrl = assets?.cutout_url || assets?.photo_url;
  const position = assets?.position;
  
  // Generate initials for fallback
  const initials = playerName
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  
  if (loading) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-[var(--color-bg-secondary)] animate-pulse ${className}`} />
    );
  }
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-orange-500 to-amber-600`}
      >
        {photoUrl && !imageError ? (
          <img
            src={photoUrl}
            alt={playerName}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <span className="text-white font-bold" style={{ fontSize: size === 'sm' ? '8px' : size === 'md' ? '10px' : '14px' }}>
            {initials}
          </span>
        )}
      </div>
      {showPosition && position && (
        <span className="text-xs text-[var(--color-text-secondary)]">
          {position}
        </span>
      )}
    </div>
  );
}

/**
 * MatchHeaderWithLogos Component
 * 
 * Complete match header with team logos and match info
 */

interface MatchHeaderWithLogosProps {
  homeTeam: string;
  awayTeam: string;
  league?: string;
  kickoff?: string;
  sport?: string;
  className?: string;
}

export function MatchHeaderWithLogos({
  homeTeam,
  awayTeam,
  league,
  kickoff,
  sport = 'football',
  className = ''
}: MatchHeaderWithLogosProps) {
  const sportEmoji = {
    football: '⚽',
    basketball: '🏀',
    baseball: '⚾'
  }[sport.toLowerCase()] || '🎯';
  
  const sportColor = {
    football: 'var(--color-success)',
    basketball: 'var(--color-warning)',
    baseball: '#007AFF'
  }[sport.toLowerCase()] || 'var(--color-accent-primary)';
  
  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{sportEmoji}</span>
          {league && (
            <span className="text-xs text-[var(--color-text-secondary)]">{league}</span>
          )}
        </div>
        {kickoff && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {new Date(kickoff).toLocaleString('es-ES', { 
              day: 'numeric', 
              month: 'short',
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        )}
      </div>
      
      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-center text-center flex-1">
          <TeamLogo teamName={homeTeam} size="lg" />
          <span className="mt-2 text-sm font-bold text-[var(--color-text-primary)] text-center leading-tight">
            {homeTeam}
          </span>
        </div>
        
        <div className="flex flex-col items-center">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs"
            style={{ backgroundColor: sportColor }}
          >
            VS
          </div>
        </div>
        
        <div className="flex flex-col items-center text-center flex-1">
          <TeamLogo teamName={awayTeam} size="lg" />
          <span className="mt-2 text-sm font-bold text-[var(--color-text-primary)] text-center leading-tight">
            {awayTeam}
          </span>
        </div>
      </div>
    </div>
  );
}

export default {
  TeamLogo,
  TeamLogosMatch,
  PlayerPhoto,
  MatchHeaderWithLogos
};
