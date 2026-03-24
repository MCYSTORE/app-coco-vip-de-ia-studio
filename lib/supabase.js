/**
 * Coco VIP - Supabase Client
 * Cliente de Supabase para almacenar análisis de partidos
 */

import { createClient } from '@supabase/supabase-js';

// Credenciales de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hrsjwpbamfszaldctbgv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc2p3cGJhbWZzemFsZGN0Ymd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjY0NzMsImV4cCI6MjA4OTcwMjQ3M30.a7kbfUdnsbJlLdiX401F42E3S9r0d3-8JiYG0ODPWPw';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc2p3cGJhbWZzemFsZGN0Ymd2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEyNjQ3MywiZXhwIjoyMDg5NzAyNDczfQ.r15rYy9j6cvd9JXFzQSc4uAWI4V7Qqg_AkheWkzbzDY';

// Crear cliente con service_role para operaciones del servidor
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Cliente con anon key para operaciones públicas
export const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Guarda un análisis en la tabla predictions
 * @param {Object} analysisData - Datos del análisis
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function saveAnalysis(analysisData) {
  try {
    console.log('📊 Guardando análisis en Supabase...');
    console.log('📊 Match:', analysisData.matchName || analysisData.match || 'Unknown');
    console.log('📊 Sport:', analysisData.sport || 'football');

    // Preparar datos para insertar (solo columnas que existen en la tabla)
    const insertData = {
      match_name: analysisData.matchName || analysisData.match || '',
      sport: analysisData.sport || 'football',
      league: analysisData.league || 'Otro',

      // Selección y mercado
      selection: analysisData.selection || analysisData.best_pick?.selection || '',
      best_market: analysisData.bestMarket || analysisData.best_pick?.market || '',

      // Odds y probabilidades
      odds: parseFloat(analysisData.odds || analysisData.best_pick?.odds || 0),
      edge_percent: parseFloat(analysisData.edgePercent || analysisData.best_pick?.edge_percentage || analysisData.edge_percentage || 0),

      // Confianza y calidad (convertir de 0-1 a 1-10 si viene como decimal)
      confidence: typeof (analysisData.confidence) === 'number' && analysisData.confidence <= 1 
        ? Math.round(analysisData.confidence * 10) 
        : (analysisData.confidence || Math.round((analysisData.best_pick?.confidence_score || 0.5) * 10)),
      quality_tier: analysisData.tier || analysisData.best_pick?.tier || analysisData.quality_tier || 'B',

      // Análisis
      analysis_text: analysisData.analysisText || analysisData.analysis_text || analysisData.best_pick?.analysis?.conclusion || '',
      risk_factors: Array.isArray(analysisData.risk_factors) ? analysisData.risk_factors : [],

      // Contexto adicional
      deep_reasoning: analysisData.deep_reasoning || '',
      research_context: (analysisData.researchContext || analysisData.research_context || '').substring(0, 5000), // Limitar tamaño
      supporting_factors: Array.isArray(analysisData.supporting_factors) ? analysisData.supporting_factors : [],

      // Kelly
      kelly_stake: parseFloat(analysisData.kellyStake || analysisData.best_pick?.kelly_stake_units || analysisData.kelly_stake_units || 0),

      // Fuente
      source: analysisData.source || 'manual',
      status: 'pending',
      date: new Date().toISOString().split('T')[0]
    };

    // FIX 3: Añadir campos específicos por deporte con spread condicional
    const sport = analysisData.sport || 'football';
    const isNBA = sport === 'basketball' || sport === 'NBA';
    const isFootball = sport === 'football' || sport === 'Football';

    // Campos específicos NBA
    const nbaFields = isNBA ? {
      // NBA Advanced Stats
      home_ortg: analysisData.homeStats?.offensiveRating || analysisData.home_ortg || null,
      home_drtg: analysisData.homeStats?.defensiveRating || analysisData.home_drtg || null,
      home_pace: analysisData.homeStats?.pace || analysisData.home_pace || null,
      home_net_rating: analysisData.homeStats?.netRating || analysisData.home_net_rating || null,
      away_ortg: analysisData.awayStats?.offensiveRating || analysisData.away_ortg || null,
      away_drtg: analysisData.awayStats?.defensiveRating || analysisData.away_drtg || null,
      away_pace: analysisData.awayStats?.pace || analysisData.away_pace || null,
      away_net_rating: analysisData.awayStats?.netRating || analysisData.away_net_rating || null,
      // Records
      home_ats_record: analysisData.homeTrends?.atsRecord ? 
        `${analysisData.homeTrends.atsRecord.wins}-${analysisData.homeTrends.atsRecord.losses}` : null,
      away_ats_record: analysisData.awayTrends?.atsRecord ?
        `${analysisData.awayTrends.atsRecord.wins}-${analysisData.awayTrends.atsRecord.losses}` : null,
    } : {};

    // Campos específicos Fútbol (NO TOCAR)
    const footballFields = isFootball ? {
      xg_home: analysisData.xgStats?.home?.avg_xg || analysisData.xg_home || null,
      xga_home: analysisData.xgStats?.home?.avg_xga || analysisData.xga_home || null,
      xg_away: analysisData.xgStats?.away?.avg_xg || analysisData.xg_away || null,
      xga_away: analysisData.xgStats?.away?.avg_xga || analysisData.xga_away || null,
      corners_home: analysisData.cornersData?.corners_local_casa || null,
      corners_away: analysisData.cornersData?.corners_visitante_fuera || null,
    } : {};

    // Combinar datos base con campos específicos por deporte
    const finalInsertData = {
      ...insertData,
      ...nbaFields,
      ...footballFields
    };

    console.log('📊 Datos preparados para insertar:', JSON.stringify(finalInsertData).substring(0, 500));
    console.log('📊 Deporte:', sport, '| NBA fields:', Object.keys(nbaFields).filter(k => nbaFields[k] !== null).length, '| Football fields:', Object.keys(footballFields).filter(k => footballFields[k] !== null).length);

    // Insertar en la tabla predictions
    const { data, error } = await supabase
      .from('predictions')
      .insert(finalInsertData)
      .select('id')
      .single();

    if (error) {
      // FIX 3: Log detallado del error exacto
      console.error('═══════════════════════════════════════════════');
      console.error('❌ ERROR DE SUPABASE - DETALLE COMPLETO:');
      console.error('═══════════════════════════════════════════════');
      console.error('❌ Código:', error.code);
      console.error('❌ Mensaje:', error.message);
      console.error('❌ Detalles:', error.details);
      console.error('❌ Hint:', error.hint);
      console.error('❌ Tabla: predictions');
      console.error('❌ Deporte:', sport);
      console.error('❌ Datos enviados:', JSON.stringify(finalInsertData, null, 2).substring(0, 1000));
      console.error('═══════════════════════════════════════════════');
      
      // Si la tabla no existe, intentar crearla
      if (error.code === '42P01') {
        console.log('📊 La tabla no existe. Proporciona el SQL para crearla.');
        return {
          success: false,
          error: 'La tabla predictions no existe. Ejecuta el SQL de creación.',
          needsTableCreation: true
        };
      }
      
      // Si es error de columna no existe
      if (error.code === '42703') {
        const missingColumn = error.message.match(/column "([^"]+)"/)?.[1] || 'desconocida';
        return {
          success: false,
          error: `Columna '${missingColumn}' no existe en Supabase. El schema necesita actualizarse para soportar campos de ${isNBA ? 'NBA' : isFootball ? 'fútbol' : 'este deporte'}.`,
          hint: `Añade la columna ${missingColumn} a la tabla predictions o ignora este campo.`
        };
      }
      
      // Si es error de tipo de dato
      if (error.code === '22P02') {
        return {
          success: false,
          error: `Error de tipo de dato: ${error.message}. Verifica que los valores coincidan con el schema.`
        };
      }
      
      // Si es error de RLS (Row Level Security)
      if (error.code === '42501' || error.message?.includes('policy')) {
        return {
          success: false,
          error: 'Error de permisos RLS. Verifica las políticas de la tabla predictions.'
        };
      }
      
      return {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details
      };
    }

    console.log('✅ Análisis guardado correctamente en Supabase');
    console.log('✅ ID:', data.id);

    return {
      success: true,
      id: data.id,
      message: 'Análisis guardado en Supabase'
    };

  } catch (error) {
    console.error('❌ Error en saveAnalysis:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtiene análisis de la tabla predictions
 * @param {Object} options - Opciones de consulta
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function getAnalyses(options = {}) {
  try {
    const {
      limit = 50,
      offset = 0,
      status = null,
      sport = null,
      date = null,
      orderBy = 'created_at',
      ascending = false
    } = options;

    let query = supabase
      .from('predictions')
      .select('*')
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (sport) {
      query = query.eq('sport', sport);
    }
    if (date) {
      query = query.eq('date', date);
    }

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data: data || []
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtiene un análisis por ID
 * @param {string} id - ID del análisis
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function getAnalysisById(id) {
  try {
    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Actualiza el estado de un análisis
 * @param {string} id - ID del análisis
 * @param {string} status - Nuevo estado (pending, won, lost, void)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateAnalysisStatus(id, status) {
  try {
    const { error } = await supabase
      .from('predictions')
      .update({ status, settled_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  supabase,
  supabasePublic,
  saveAnalysis,
  getAnalyses,
  getAnalysisById,
  updateAnalysisStatus
};
