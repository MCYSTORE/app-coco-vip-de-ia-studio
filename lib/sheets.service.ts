/**
 * Google Sheets Service for Coco VIP
 * Handles saving, reading, and updating analysis history
 */

import { getSheetsClient, getSpreadsheetId, isSheetsConfigured } from './sheets.client.js';

// Types
export interface AnalysisData {
  id: string;
  matchName: string;
  sport: string;
  league: string;
  dataQuality: string;
  jsonResult: any;
  researchA: string;
  researchB: string;
  deepThinking: string;
  modelAnalyst: string;
  source: string;
}

export interface HistoryItem {
  rowIndex: number;
  id: string;
  fecha: string;
  hora: string;
  sport: string;
  partido: string;
  liga: string;
  data_quality: string;
  mercado: string;
  seleccion: string;
  cuota: number;
  edge: number;
  confianza: number;
  tier: string;
  kelly: number;
  resultado_probable: string;
  marcador_estimado: string;
  rango_goles: string;
  btts: string;
  pros: string[];
  contras: string;
  conclusion: string;
  stats: string[];
  razonamiento: string;
  contexto_tactico: string;
  contexto_stats: string;
  modelo: string;
  source: string;
  status: string;
  resultado_real: string;
  notas: string;
}

export interface HistoryFilters {
  sport?: string;
  status?: string;
  limit?: number;
}

/**
 * Save analysis to Google Sheets
 */
export async function saveAnalysis(data: AnalysisData): Promise<boolean> {
  if (!isSheetsConfigured()) {
    console.log('⚠️ Google Sheets not configured, skipping save');
    return false;
  }

  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    
    const bp = data.jsonResult?.best_pick || {};
    const pf = data.jsonResult?.mercados_completos?.proyeccion_final || {};
    const stats = bp.stats_highlights || {};

    // Build row data matching the spreadsheet columns A-AH
    const row = [
      data.id,                                                                    // A: id
      new Date().toLocaleDateString('es-CL'),                                     // B: fecha
      new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }), // C: hora
      data.sport,                                                                 // D: deporte
      data.matchName,                                                             // E: partido
      data.league,                                                                // F: liga
      data.dataQuality,                                                           // G: data_quality
      bp.market || '',                                                            // H: mercado
      bp.selection || '',                                                         // I: seleccion
      bp.odds || '',                                                              // J: cuota
      bp.edge_percentage || '',                                                   // K: edge_pct
      (bp.confidence_score * 10).toFixed(1),                                      // L: confianza
      bp.tier || '',                                                              // M: tier
      bp.kelly_stake_units || '',                                                 // N: kelly
      pf.resultado_probable || '',                                                // O: resultado_probable
      pf.marcador_estimado || '',                                                 // P: marcador_estimado
      pf.rango_total || '',                                                       // Q: rango_goles
      pf.btts_probable ? 'Sí' : 'No',                                             // R: btts
      bp.analysis?.pros?.[0] || '',                                               // S: pros_1
      bp.analysis?.pros?.[1] || '',                                               // T: pros_2
      bp.analysis?.pros?.[2] || '',                                               // U: pros_3
      bp.analysis?.cons?.[0] || '',                                               // V: contras
      bp.analysis?.conclusion || '',                                              // W: conclusion
      stats.metric_1 || '',                                                       // X: stat_1
      stats.metric_2 || '',                                                       // Y: stat_2
      stats.metric_3 || '',                                                       // Z: stat_3
      data.deepThinking,                                                          // AA: razonamiento
      data.researchA,                                                             // AB: contexto_tactico
      data.researchB,                                                             // AC: contexto_stats
      data.modelAnalyst,                                                          // AD: modelo_analista
      data.source,                                                                // AE: source
      'pending',                                                                  // AF: status
      '',                                                                         // AG: resultado_real
      ''                                                                          // AH: notas
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Historial!A:AH',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] }
    });

    console.log('✅ Analysis saved to Google Sheets');
    return true;
  } catch (error) {
    console.error('❌ Error saving to Google Sheets:', error);
    return false;
  }
}

/**
 * Get history from Google Sheets with optional filters
 */
export async function getHistory(filters?: HistoryFilters): Promise<HistoryItem[]> {
  if (!isSheetsConfigured()) {
    console.log('⚠️ Google Sheets not configured');
    return [];
  }

  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Historial!A2:AH1000'
    });

    const rows = res.data.values || [];

    // Convert each row to object
    let items: HistoryItem[] = rows.map((r, index) => ({
      rowIndex: index + 2,  // +2 because we start from row 2 (skip header)
      id: r[0] || '',
      fecha: r[1] || '',
      hora: r[2] || '',
      sport: r[3] || '',
      partido: r[4] || '',
      liga: r[5] || '',
      data_quality: r[6] || '',
      mercado: r[7] || '',
      seleccion: r[8] || '',
      cuota: parseFloat(r[9]) || 0,
      edge: parseFloat(r[10]) || 0,
      confianza: parseFloat(r[11]) || 0,
      tier: r[12] || '',
      kelly: parseFloat(r[13]) || 0,
      resultado_probable: r[14] || '',
      marcador_estimado: r[15] || '',
      rango_goles: r[16] || '',
      btts: r[17] || '',
      pros: [r[18], r[19], r[20]].filter(Boolean),
      contras: r[21] || '',
      conclusion: r[22] || '',
      stats: [r[23], r[24], r[25]].filter(Boolean),
      razonamiento: r[26] || '',
      contexto_tactico: r[27] || '',
      contexto_stats: r[28] || '',
      modelo: r[29] || '',
      source: r[30] || '',
      status: r[31] || 'pending',
      resultado_real: r[32] || '',
      notas: r[33] || ''
    }));

    // Apply filters
    items = items.reverse(); // Most recent first

    if (filters?.sport && filters.sport !== 'Todos') {
      items = items.filter(i => i.sport.toLowerCase() === filters.sport!.toLowerCase());
    }
    if (filters?.status && filters.status !== 'Todos') {
      items = items.filter(i => i.status.toLowerCase() === filters.status!.toLowerCase());
    }
    if (filters?.limit) {
      items = items.slice(0, filters.limit);
    }

    return items;
  } catch (error) {
    console.error('❌ Error reading from Google Sheets:', error);
    return [];
  }
}

/**
 * Update result in Google Sheets
 */
export async function updateResult(
  rowIndex: number,
  status: 'won' | 'lost' | 'void',
  resultadoReal?: string
): Promise<boolean> {
  if (!isSheetsConfigured()) {
    console.log('⚠️ Google Sheets not configured');
    return false;
  }

  try {
    const sheets = getSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    // Update columns AF (status) and AG (resultado_real)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Historial!AF${rowIndex}:AG${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[status, resultadoReal || '']]
      }
    });

    console.log(`✅ Updated row ${rowIndex} to status: ${status}`);
    return true;
  } catch (error) {
    console.error('❌ Error updating Google Sheets:', error);
    return false;
  }
}

/**
 * Get history stats
 */
export async function getHistoryStats(): Promise<{
  total: number;
  won: number;
  lost: number;
  pending: number;
  void: number;
  roi: number;
}> {
  const items = await getHistory();
  
  const won = items.filter(i => i.status === 'won').length;
  const lost = items.filter(i => i.status === 'lost').length;
  const pending = items.filter(i => i.status === 'pending').length;
  const voidCount = items.filter(i => i.status === 'void').length;
  const total = items.length;
  
  // ROI = (won - lost) / (won + lost) * 100
  const settled = won + lost;
  const roi = settled > 0 ? ((won - lost) / settled) * 100 : 0;

  return { total, won, lost, pending, void: voidCount, roi };
}

/**
 * Get single history item by ID
 */
export async function getHistoryById(id: string): Promise<HistoryItem | null> {
  const items = await getHistory();
  return items.find(i => i.id === id) || null;
}
