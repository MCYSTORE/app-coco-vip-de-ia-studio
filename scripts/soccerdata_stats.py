#!/usr/bin/env python3
"""
SoccerData Stats - Step 0 del Pipeline Coco VIP
Obtiene estadísticas oficiales de FBref y FotMob antes del análisis.
"""

import json
import sys
from datetime import datetime

# SoccerData library
try:
    import soccerdata as sd
    import pandas as pd
    SOCCERDATA_AVAILABLE = True
except ImportError:
    SOCCERDATA_AVAILABLE = False

# Mapeo de códigos de liga
LEAGUE_CODES = {
    'ESP-LaLiga': 'ESP-LaLiga',
    'ITA-Serie-A': 'ITA-SerieA',
    'ENG-Premier-League': 'ENG-PremierLeague',
    'GER-Bundesliga': 'GER-Bundesliga',
    'FRA-Ligue-1': 'FRA-Ligue1',
    'ESP-LaLiga2': 'ESP-LaLiga2',
    'ENG-Championship': 'ENG-Championship'
}

def get_soccer_stats(league_code: str, home_team: str, away_team: str, season: str = '2025') -> dict:
    """
    Obtiene estadísticas de SoccerData para ambos equipos.
    
    Args:
        league_code: Código de liga (ESP-LaLiga, ITA-Serie-A, etc.)
        home_team: Nombre del equipo local
        away_team: Nombre del equipo visitante
        season: Temporada (default 2025 para 2025/26)
    
    Returns:
        dict con estadísticas de ambos equipos
    """
    
    if not SOCCERDATA_AVAILABLE:
        return {
            'error': 'soccerdata library not installed',
            'fallback': True,
            'source': 'none'
        }
    
    try:
        # Normalizar código de liga
        fbref_league = LEAGUE_CODES.get(league_code, league_code)
        
        # Inicializar FBref
        fbref = sd.FBref(fbref_league, season)
        
        stats = {
            'source': 'soccerdata_fbref',
            'timestamp': datetime.now().isoformat(),
            'home_team': home_team,
            'away_team': away_team,
            'league': league_code,
            'season': season
        }
        
        # ========== ESTADÍSTICAS DE TEMPORADA ==========
        try:
            # Team season stats
            home_season = fbref.read_team_season_stats(home_team)
            away_season = fbref.read_team_season_stats(away_team)
            
            # xG/xGA promedio
            if 'xG' in home_season.columns:
                stats['home_xG_avg'] = round(float(home_season['xG'].mean()), 2)
            if 'xGA' in home_season.columns:
                stats['home_xGA_avg'] = round(float(home_season['xGA'].mean()), 2)
            if 'xG' in away_season.columns:
                stats['away_xG_avg'] = round(float(away_season['xG'].mean()), 2)
            if 'xGA' in away_season.columns:
                stats['away_xGA_avg'] = round(float(away_season['xGA'].mean()), 2)
            
            # Corners
            if 'Corners' in home_season.columns:
                stats['home_corners_avg'] = round(float(home_season['Corners'].mean()), 1)
            if 'Corners' in away_season.columns:
                stats['away_corners_avg'] = round(float(away_season['Corners'].mean()), 1)
            
            # Goles
            if 'Gls' in home_season.columns:
                stats['home_goals_total'] = int(home_season['Gls'].sum())
            if 'Gls' in away_season.columns:
                stats['away_goals_total'] = int(away_season['Gls'].sum())
            
            # Partidos jugados
            stats['home_matches'] = int(len(home_season)) if home_season is not None else 0
            stats['away_matches'] = int(len(away_season)) if away_season is not None else 0
            
        except Exception as e:
            stats['season_stats_error'] = str(e)
        
        # ========== FORMA RECIENTE (últimos 5) ==========
        try:
            home_matches = fbref.read_team_match_stats(home_team)
            away_matches = fbref.read_team_match_stats(away_team)
            
            if home_matches is not None and len(home_matches) > 0:
                home_recent = home_matches.tail(5)
                stats['home_form'] = []
                for _, row in home_recent.iterrows():
                    stats['home_form'].append({
                        'date': str(row.get('Date', '')),
                        'opponent': str(row.get('Opponent', '')),
                        'result': str(row.get('Result', '')),
                        'goals_for': int(row.get('GF', 0)),
                        'goals_against': int(row.get('GA', 0))
                    })
            
            if away_matches is not None and len(away_matches) > 0:
                away_recent = away_matches.tail(5)
                stats['away_form'] = []
                for _, row in away_recent.iterrows():
                    stats['away_form'].append({
                        'date': str(row.get('Date', '')),
                        'opponent': str(row.get('Opponent', '')),
                        'result': str(row.get('Result', '')),
                        'goals_for': int(row.get('GF', 0)),
                        'goals_against': int(row.get('GA', 0))
                    })
                    
        except Exception as e:
            stats['form_error'] = str(e)
        
        # ========== ESTADÍSTICAS DE TIROS ==========
        try:
            home_shooting = fbref.read_team_match_stats(home_team, stat_type='shooting')
            away_shooting = fbref.read_team_match_stats(away_team, stat_type='shooting')
            
            if home_shooting is not None:
                stats['home_shots_avg'] = round(float(home_shooting['Sh'].mean()), 1) if 'Sh' in home_shooting.columns else 0
                stats['home_shots_on_target_avg'] = round(float(home_shooting['SoT'].mean()), 1) if 'SoT' in home_shooting.columns else 0
            
            if away_shooting is not None:
                stats['away_shots_avg'] = round(float(away_shooting['Sh'].mean()), 1) if 'Sh' in away_shooting.columns else 0
                stats['away_shots_on_target_avg'] = round(float(away_shooting['SoT'].mean()), 1) if 'SoT' in away_shooting.columns else 0
                
        except Exception as e:
            stats['shooting_error'] = str(e)
        
        # ========== CLASIFICACIÓN ==========
        try:
            league_table = fbref.read_league_table()
            if league_table is not None:
                for idx, row in league_table.iterrows():
                    team_name = str(row.get('team', ''))
                    if home_team.lower() in team_name.lower() or team_name.lower() in home_team.lower():
                        stats['home_position'] = int(row.get('Rk', 0))
                        stats['home_points'] = int(row.get('Pts', 0))
                    if away_team.lower() in team_name.lower() or team_name.lower() in away_team.lower():
                        stats['away_position'] = int(row.get('Rk', 0))
                        stats['away_points'] = int(row.get('Pts', 0))
        except Exception as e:
            stats['table_error'] = str(e)
        
        # Calcular promedios de goles si tenemos datos
        if stats.get('home_goals_total') and stats.get('home_matches'):
            stats['home_goals_avg'] = round(stats['home_goals_total'] / stats['home_matches'], 2)
        if stats.get('away_goals_total') and stats.get('away_matches'):
            stats['away_goals_avg'] = round(stats['away_goals_total'] / stats['away_matches'], 2)
        
        stats['fallback'] = False
        return stats
        
    except Exception as e:
        return {
            'error': str(e),
            'fallback': True,
            'source': 'soccerdata_fbref',
            'timestamp': datetime.now().isoformat()
        }


def main():
    """Main entry point para llamadas desde Node.js"""
    
    # Leer argumentos desde stdin
    try:
        input_data = json.loads(sys.stdin.read())
    except:
        input_data = {}
    
    league = input_data.get('league', 'ESP-LaLiga')
    home_team = input_data.get('home_team', '')
    away_team = input_data.get('away_team', '')
    season = input_data.get('season', '2025')
    
    if not home_team or not away_team:
        result = {
            'error': 'home_team and away_team are required',
            'fallback': True
        }
    else:
        result = get_soccer_stats(league, home_team, away_team, season)
    
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
