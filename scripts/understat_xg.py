#!/usr/bin/env python3
"""
Understat xG Data - Step 0 del Pipeline Coco VIP
Obtiene xG/xGA oficiales de Understat antes del análisis.
"""

import json
import sys
import asyncio
from datetime import datetime

# Understat API client
try:
    import understatapi
    UNDERSTAT_AVAILABLE = True
except ImportError:
    UNDERSTAT_AVAILABLE = False

# Códigos de liga para Understat
LEAGUE_CODES = {
    'La_liga': 'La_liga',
    'EPL': 'EPL',
    'Bundesliga': 'Bundesliga',
    'Serie_A': 'Serie_A',
    'Ligue_1': 'Ligue_1',
    'La_liga': 'La_liga',
    'ESP-LaLiga': 'La_liga',
    'ENG-Premier-League': 'EPL',
    'GER-Bundesliga': 'Bundesliga',
    'ITA-Serie-A': 'Serie_A',
    'FRA-Ligue-1': 'Ligue_1'
}

async def get_understat_xg_async(league: str, home_team: str, away_team: str, season: str = '2025') -> dict:
    """
    Obtiene xG/xGA de Understat para ambos equipos.
    
    Args:
        league: Código de liga (La_liga, EPL, Bundesliga, Serie_A, Ligue_1)
        home_team: Nombre del equipo local
        away_team: Nombre del equipo visitante
        season: Temporada (default 2025 para 2025/26)
    
    Returns:
        dict con xG/xGA de ambos equipos
    """
    
    if not UNDERSTAT_AVAILABLE:
        return {
            'error': 'understatapi library not installed',
            'fallback': True,
            'source': 'understat'
        }
    
    try:
        # Normalizar código de liga
        understat_league = LEAGUE_CODES.get(league, league)
        
        # Inicializar Understat client
        understat = understatapi.Understat()
        
        result = {
            'source': 'understat',
            'timestamp': datetime.now().isoformat(),
            'league': understat_league,
            'home_team': home_team,
            'away_team': away_team,
            'season': season,
            'fallback': False
        }
        
        # Obtener datos de la liga
        league_data = await understat.get_league_data(understat_league, season)
        
        home_data = None
        away_data = None
        
        # Buscar equipos (match fuzzy)
        if 'teamsData' in league_data:
            for team_name, team_data in league_data['teamsData'].items():
                if home_team.lower() in team_name.lower() or team_name.lower() in home_team.lower():
                    home_data = team_data
                    result['home_team_official'] = team_name
                if away_team.lower() in team_name.lower() or team_name.lower() in away_team.lower():
                    away_data = team_data
                    result['away_team_official'] = team_name
        
        # Procesar datos del equipo local
        if home_data:
            result['home_xG_total'] = float(home_data.get('xG', 0))
            result['home_xGA_total'] = float(home_data.get('xGA', 0))
            result['home_matches'] = int(home_data.get('games', 0))
            result['home_goals_total'] = int(home_data.get('scored', 0))
            result['home_conceded_total'] = int(home_data.get('missed', 0))
            result['home_points'] = int(home_data.get('pts', 0))
            result['home_position'] = int(home_data.get('position', 0))
            
            if result['home_matches'] > 0:
                result['home_xG_avg'] = round(result['home_xG_total'] / result['home_matches'], 2)
                result['home_xGA_avg'] = round(result['home_xGA_total'] / result['home_matches'], 2)
                result['home_goals_avg'] = round(result['home_goals_total'] / result['home_matches'], 2)
        else:
            result['home_xG_total'] = 'NO ENCONTRADO'
            result['home_xGA_total'] = 'NO ENCONTRADO'
            result['home_matches'] = 0
        
        # Procesar datos del equipo visitante
        if away_data:
            result['away_xG_total'] = float(away_data.get('xG', 0))
            result['away_xGA_total'] = float(away_data.get('xGA', 0))
            result['away_matches'] = int(away_data.get('games', 0))
            result['away_goals_total'] = int(away_data.get('scored', 0))
            result['away_conceded_total'] = int(away_data.get('missed', 0))
            result['away_points'] = int(away_data.get('pts', 0))
            result['away_position'] = int(away_data.get('position', 0))
            
            if result['away_matches'] > 0:
                result['away_xG_avg'] = round(result['away_xG_total'] / result['away_matches'], 2)
                result['away_xGA_avg'] = round(result['away_xGA_total'] / result['away_matches'], 2)
                result['away_goals_avg'] = round(result['away_goals_total'] / result['away_matches'], 2)
        else:
            result['away_xG_total'] = 'NO ENCONTRADO'
            result['away_xGA_total'] = 'NO ENCONTRADO'
            result['away_matches'] = 0
        
        return result
        
    except Exception as e:
        return {
            'error': str(e),
            'fallback': True,
            'source': 'understat',
            'timestamp': datetime.now().isoformat()
        }


def get_understat_xg(league: str, home_team: str, away_team: str, season: str = '2025') -> dict:
    """Wrapper síncrono para la función async."""
    return asyncio.run(get_understat_xg_async(league, home_team, away_team, season))


def main():
    """Main entry point para llamadas desde Node.js"""
    
    # Leer argumentos desde stdin
    try:
        input_data = json.loads(sys.stdin.read())
    except:
        input_data = {}
    
    league = input_data.get('league', 'La_liga')
    home_team = input_data.get('home_team', '')
    away_team = input_data.get('away_team', '')
    season = input_data.get('season', '2025')
    
    if not home_team or not away_team:
        result = {
            'error': 'home_team and away_team are required',
            'fallback': True,
            'source': 'understat'
        }
    else:
        result = get_understat_xg(league, home_team, away_team, season)
    
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
