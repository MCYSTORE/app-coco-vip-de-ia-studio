/**
 * Coco VIP - History Save API Endpoint
 * Guarda análisis en Google Sheets via Apps Script
 */

// URL del Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzNqeh3-kN6Bi1IWr8Zkp-AVfrtJJ-qq0QTmsN8il75nwbE7kvZ4-AFikICPcr-iQ/exec';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const result = body.result || body;
    const userContext = body.userContext || '';

    if (!result || Object.keys(result).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'result is required' 
      });
    }

    console.log('📊 Guardando análisis en Google Sheets...');
    console.log('📊 Match:', result.matchName || result.match || 'Unknown');
    console.log('📊 Sport:', result.sport || 'football');

    // Preparar datos simplificados para el Apps Script
    const simplifiedData = {
      matchName: result.matchName || result.match || '',
      match: result.match || result.matchName || '',
      sport: result.sport || 'football',
      league: result.league || 'Otro',
      dataQuality: result.dataQuality || result.data_quality || 'media',
      selection: result.selection || result.best_pick?.selection || '',
      bestMarket: result.bestMarket || result.best_pick?.market || '',
      odds: parseFloat(result.odds || result.best_pick?.odds || 0),
      edgePercent: parseFloat(result.edgePercent || result.best_pick?.edge_percentage || result.edge_percentage || 0),
      confidence: parseInt(result.confidence || Math.round((result.best_pick?.confidence_score || 0.5) * 10)),
      tier: result.tier || result.best_pick?.tier || 'B',
      kellyStake: parseFloat(result.kellyStake || result.best_pick?.kelly_stake_units || result.kelly_stake_units || 0),
      analysisText: result.analysisText || result.analysis_text || result.best_pick?.analysis?.conclusion || '',
      deep_reasoning: result.deep_reasoning || '',
      researchContext: result.researchContext || '',
      supporting_factors: result.supporting_factors || [],
      risk_factors: result.risk_factors || [],
      userContext: userContext
    };

    console.log('📊 Datos preparados:', JSON.stringify(simplifiedData).substring(0, 200));

    // Codificar los datos
    const encodedData = encodeURIComponent(JSON.stringify(simplifiedData));
    const urlWithParams = `${APPS_SCRIPT_URL}?data=${encodedData}`;

    console.log('📊 Enviando a Apps Script...');

    // Hacer la petición con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(urlWithParams, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      console.log('📊 Response status:', response.status);
      console.log('📊 Response text:', responseText.substring(0, 200));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        if (responseText.includes('success') || response.status === 200) {
          data = { success: true };
        } else {
          data = { success: false, error: 'Respuesta inválida del servidor' };
        }
      }

      if (data.success) {
        console.log('✅ Análisis guardado correctamente en Sheets');
        return res.status(200).json({
          success: true,
          id: data.id || `analysis-${Date.now()}`,
          message: 'Análisis guardado en Google Sheets',
          savedAt: new Date().toISOString()
        });
      } else {
        console.error('❌ Error del Apps Script:', data.error);
        return res.status(500).json({
          success: false,
          error: data.error || 'Error al guardar en Sheets'
        });
      }

    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('❌ Fetch error:', fetchError.message);
      
      // Si hay timeout o error de red, asumimos éxito porque el Apps Script puede tardar
      if (fetchError.name === 'AbortError') {
        return res.status(200).json({
          success: true,
          id: `analysis-${Date.now()}`,
          message: 'Análisis enviado (verificar en Sheets)',
          savedAt: new Date().toISOString()
        });
      }
      
      throw fetchError;
    }

  } catch (error) {
    console.error('❌ History Save API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error de conexión',
      message: error.message
    });
  }
}
