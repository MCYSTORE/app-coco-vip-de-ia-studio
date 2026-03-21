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

      // Confianza y calidad
      confidence: Math.round((analysisData.confidence || analysisData.best_pick?.confidence_score || 0.5) * 10),
      quality_tier: analysisData.tier || analysisData.best_pick?.tier || 'B',

      // Análisis
      analysis_text: analysisData.analysisText || analysisData.analysis_text || analysisData.best_pick?.analysis?.conclusion || '',
      risk_factors: analysisData.risk_factors || [],

      // Contexto adicional
      deep_reasoning: analysisData.deep_reasoning || '',
      research_context: analysisData.researchContext || analysisData.research_context || '',
      supporting_factors: analysisData.supporting_factors || [],

      // Kelly
      kelly_stake: parseFloat(analysisData.kellyStake || analysisData.best_pick?.kelly_stake_units || analysisData.kelly_stake_units || 0),

      // Fuente
      source: analysisData.source || 'manual',
      status: 'pending',
      date: new Date().toISOString().split('T')[0]
    };

    console.log('📊 Datos preparados para insertar:', JSON.stringify(insertData).substring(0, 300));

    // Insertar en la tabla predictions
    const { data, error } = await supabase
      .from('predictions')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error de Supabase:', error);
      
      // Si la tabla no existe, intentar crearla
      if (error.code === '42P01') {
        console.log('📊 La tabla no existe. Proporciona el SQL para crearla.');
        return {
          success: false,
          error: 'La tabla predictions no existe. Ejecuta el SQL de creación.',
          needsTableCreation: true
        };
      }
      
      return {
        success: false,
        error: error.message
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
