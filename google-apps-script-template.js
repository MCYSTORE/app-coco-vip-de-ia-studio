/**
 * GOOGLE APPS SCRIPT - Coco VIP Cache System
 *
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Crea un nuevo Google Sheet con estas columnas en la primera fila:
 *    date | sport | league | match_id | home_team | away_team | kickoff |
 *    market_type | selection | bookmaker | odds | implied_prob | stats_json | last_updated
 *
 * 2. Ve a Extensiones > Apps Script
 * 3. Pega este código completo
 * 4. Despliega como aplicación web:
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier persona
 * 5. Copia la URL del despliegue y ponla en GOOGLE_SHEETS_URL en .env
 */

const SHEET_NAME = 'Cache';

/**
 * Maneja las solicitudes GET
 */
function doGet(e) {
  const action = e.parameter.action;

  try {
    switch (action) {
      case 'getCache':
        return getCache(e.parameter);
      case 'getMetadata':
        return getMetadata();
      case 'writeCache':
        return writeCache(e.parameter);
      case 'clearOldCache':
        return clearOldCache(e.parameter);
      case 'saveResults':
        return saveResults(e.parameter);
      default:
        return jsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

/**
 * Respuesta JSON
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Obtener datos del caché
 */
function getCache(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ results: [] });
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return jsonResponse({ results: [] });
  }

  const headers = data[0];
  const results = [];

  // Parse filters
  const filterDate = params.date;
  const filterSport = params.sport;
  const filterMatchId = params.match_id;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const entry = {
      date: row[0],
      sport: row[1],
      league: row[2],
      match_id: row[3],
      home_team: row[4],
      away_team: row[5],
      kickoff: row[6],
      market_type: row[7],
      selection: row[8],
      bookmaker: row[9],
      odds: row[10],
      implied_prob: row[11],
      stats_json: row[12],
      last_updated: row[13]
    };

    // Apply filters
    if (filterDate && entry.date !== filterDate) continue;
    if (filterSport && entry.sport !== filterSport) continue;
    if (filterMatchId && entry.match_id !== filterMatchId) continue;

    results.push(entry);
  }

  return jsonResponse({ results });
}

/**
 * Obtener metadatos del caché
 */
function getMetadata() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return jsonResponse({
      hasCache: false,
      lastUpdated: null,
      totalEntries: 0,
      todayEntries: 0,
      sportsBreakdown: {}
    });
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return jsonResponse({
      hasCache: false,
      lastUpdated: null,
      totalEntries: 0,
      todayEntries: 0,
      sportsBreakdown: {}
    });
  }

  const today = new Date().toISOString().split('T')[0];
  let lastUpdated = null;
  let todayEntries = 0;
  const sportsBreakdown = { football: 0, basketball: 0, baseball: 0 };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const entryDate = row[0];
    const entrySport = row[1];
    const entryLastUpdated = row[13];

    // Count today's entries
    if (entryDate === today) {
      todayEntries++;
    }

    // Count by sport
    if (entrySport && sportsBreakdown.hasOwnProperty(entrySport)) {
      sportsBreakdown[entrySport]++;
    }

    // Track last updated
    if (entryLastUpdated) {
      if (!lastUpdated || new Date(entryLastUpdated) > new Date(lastUpdated)) {
        lastUpdated = entryLastUpdated;
      }
    }
  }

  return jsonResponse({
    hasCache: true,
    lastUpdated: lastUpdated,
    totalEntries: data.length - 1,
    todayEntries: todayEntries,
    sportsBreakdown: sportsBreakdown
  });
}

/**
 * Escribir datos al caché
 */
function writeCache(params) {
  const sheet = getOrCreateSheet();
  const jsonData = params.data;

  if (!jsonData) {
    return jsonResponse({ success: false, error: 'No data provided' });
  }

  let entries;
  try {
    entries = JSON.parse(jsonData);
  } catch (e) {
    return jsonResponse({ success: false, error: 'Invalid JSON data' });
  }

  if (!Array.isArray(entries)) {
    entries = [entries];
  }

  // Prepare rows to append
  const rows = entries.map(entry => [
    entry.date || new Date().toISOString().split('T')[0],
    entry.sport || '',
    entry.league || '',
    entry.match_id || '',
    entry.home_team || '',
    entry.away_team || '',
    entry.kickoff || '',
    entry.market_type || '',
    entry.selection || '',
    entry.bookmaker || '',
    entry.odds || 0,
    entry.implied_prob || 0,
    typeof entry.stats_json === 'object' ? JSON.stringify(entry.stats_json) : (entry.stats_json || ''),
    entry.last_updated || new Date().toISOString()
  ]);

  // Append rows
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

  return jsonResponse({ success: true, entriesAdded: rows.length });
}

/**
 * Limpiar caché antiguo
 */
function clearOldCache(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() <= 1) {
    return jsonResponse({ success: true, deleted: 0 });
  }

  const beforeDate = params.before_date;
  if (!beforeDate) {
    return jsonResponse({ success: false, error: 'before_date parameter required' });
  }

  const data = sheet.getDataRange().getValues();
  const rowsToDelete = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] < beforeDate) {
      rowsToDelete.push(i + 1); // 1-indexed row number
    }
  }

  // Delete rows from bottom to top to maintain indices
  rowsToDelete.reverse().forEach(rowNum => {
    sheet.deleteRow(rowNum);
  });

  return jsonResponse({ success: true, deleted: rowsToDelete.length });
}

/**
 * Guardar resultados del Scanner (compatibilidad)
 */
function saveResults(params) {
  const jsonData = params.data;
  if (!jsonData) {
    return jsonResponse({ success: false, error: 'No data provided' });
  }

  let results;
  try {
    results = JSON.parse(jsonData);
  } catch (e) {
    return jsonResponse({ success: false, error: 'Invalid JSON data' });
  }

  if (!Array.isArray(results)) {
    results = [results];
  }

  const sheet = getOrCreateSheet();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  const rows = results.map(r => [
    today,
    r.sport ? r.sport.toLowerCase() : 'football',
    r.league || '',
    r.id || `scan-${Date.now()}`,
    r.match_name ? r.match_name.split(' vs ')[0] : '',
    r.match_name ? r.match_name.split(' vs ')[1] : '',
    now,
    r.market || '',
    r.selection || '',
    r.bookmaker || '',
    r.odds || 0,
    r.implied_prob || 0,
    JSON.stringify({ analysis: r.analysis_short, edge: r.estimated_edge }),
    now
  ]);

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

  return jsonResponse({ success: true, entriesAdded: rows.length });
}

/**
 * Obtener o crear hoja de caché
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Add headers
    sheet.appendRow([
      'date',
      'sport',
      'league',
      'match_id',
      'home_team',
      'away_team',
      'kickoff',
      'market_type',
      'selection',
      'bookmaker',
      'odds',
      'implied_prob',
      'stats_json',
      'last_updated'
    ]);
    sheet.getRange(1, 1, 1, 14).setFontWeight('bold');
  }

  return sheet;
}

/**
 * Función de prueba
 */
function testFunction() {
  Logger.log('Testing cache system...');

  // Test metadata
  const meta = getMetadata();
  Logger.log('Metadata: ' + JSON.stringify(meta));

  // Test write
  const testEntry = {
    date: new Date().toISOString().split('T')[0],
    sport: 'football',
    league: 'Test League',
    match_id: 'test-123',
    home_team: 'Home Team',
    away_team: 'Away Team',
    kickoff: new Date().toISOString(),
    market_type: '1X2',
    selection: 'Home',
    bookmaker: 'Test',
    odds: 1.85,
    implied_prob: 0.54,
    stats_json: { test: true }
  };

  const result = writeCache({ data: JSON.stringify([testEntry]) });
  Logger.log('Write result: ' + JSON.stringify(result));
}
