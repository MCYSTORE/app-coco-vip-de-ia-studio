/**
 * Coco VIP - History Save API Endpoint
 * POST: Save new analysis to Google Sheets via Apps Script
 */

// URL del Apps Script desplegado
const APPS_SCRIPT_URL = process.env.GOOGLE_SHEETS_URL || 'https://script.google.com/macros/s/AKfycbzrbn4TvV-NhSBvqb-f_l0j51FG2_dzghRX4fDGOlW9iZsZLdVUQLJqO2qu-2oAmuorWg/exec';

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

    // Preparar datos para enviar al Apps Script
    const payload = {
      result: result,
      userContext: userContext || ''
    };

    // Llamar al Apps Script
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Análisis guardado correctamente:', data.id);
      return res.status(200).json({
        success: true,
        id: data.id,
        message: 'Análisis guardado en Google Sheets',
        savedAt: new Date().toISOString()
      });
    } else {
      console.error('❌ Error del Apps Script:', data.error);
      return res.status(500).json({
        success: false,
        error: data.error || 'Error al guardar en Google Sheets'
      });
    }

  } catch (error) {
    console.error('❌ History Save API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error de conexión con Google Sheets',
      message: error.message
    });
  }
}
