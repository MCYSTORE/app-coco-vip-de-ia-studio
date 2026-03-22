/**
 * Google Sheets Client for Coco VIP
 * Uses Google Service Account authentication
 */

import { google } from 'googleapis';

export function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  
  return google.sheets({ version: 'v4', auth });
}

export function getSpreadsheetId() {
  return process.env.GOOGLE_SHEETS_ID || '';
}

export function isSheetsConfigured() {
  return !!(
    process.env.GOOGLE_SHEETS_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}
