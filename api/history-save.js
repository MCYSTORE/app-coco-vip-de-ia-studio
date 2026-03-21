/**
 * Coco VIP - History Save API Endpoint
 * Guarda análisis en Google Sheets via Apps Script
 */

// URL del Apps Script
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxcWdq_8gRgF90qKo7NfKfkZvHeGnxeG1wL0-CDBdD6CHXv3Lf5wfU5lN4MyOJFnqgrww/exec';

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
    const { result, userContext } = req.body || {};

    if (!result) {
      return res.status(400).json({ error: 'result is required' });
    }

    console.log('📊 Guardando análisis en Google Sheets...');
    console.log('📊 Match:', result.matchName || result.match);

    // Preparar datos para enviar
    const payload = {
      result: {
        matchName: result.matchName || result.match || '',
        match: result.match || result.matchName || '',
        sport: result.sport || 'football',
        league: result.league || 'Otro',
        dataQuality: result.dataQuality || result.data_quality || 'media',
        selection: result.selection || '',
        bestMarket: result.bestMarket || result.best_market || '',
        odds: result.odds || 0,
        edgePercent: result.edgePercent || result.edge_percentage || 0,
        confidence: result.confidence || 5,
        tier: result.tier || 'B',
        kellyStake: result.kellyStake || result.kelly_stake_units || 0,
        analysisText: result.analysisText || result.analysis_text || '',
        deep_reasoning: result.deep_reasoning || '',
        researchContext: result.researchContext || '',
        supporting_factors: result.supporting_factors || [],
        risk_factors: result.risk_factors || [],
        best_pick: result.best_pick || null
      },
      userContext: userContext || ''
    };

    // Codificar los datos como parámetro URL (método más compatible con Apps Script)
    const encodedData = encodeURIComponent(JSON.stringify(payload));
    const urlWithParams = `${APPS_SCRIPT_URL}?data=${encodedData}`;

    console.log('📊 Enviando a Apps Script...');

    // Usar GET con parámetros (Apps Script maneja mejor esto desde externo)
    const response = await fetch(urlWithParams, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    const responseText = await response.text();
    console.log('📊 Response status:', response.status);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.log('📊 Raw response:', responseText.substring(0, 200));
      if (responseText.includes('success') || response.status === 200) {
        data = { success: true };
      } else {
        data = { success: false, error: 'Respuesta inválida' };
      }
    }

    if (data.success) {
      console.log('✅ Análisis guardado correctamente');
      return res.status(200).json({
        success: true,
        id: data.id || `analysis-${Date.now()}`,
        message: 'Análisis guardado en Google Sheets',
        savedAt: new Date().toISOString()
      });
    } else {
      console.error('❌ Error:', data.error);
      return res.status(500).json({
        success: false,
        error: data.error || 'Error al guardar'
      });
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
