const { google } = require('googleapis');

// Central sheet name mapping with env overrides so serverless functions stay in sync.
const SHEET_NAMES = {
  TECHNICIANS: process.env.SHEET_TECHNICIANS || 'TechnicianDetails',
  CUSTOMERS: process.env.SHEET_CUSTOMERS || 'CustomerList',
  DRAFTS: process.env.SHEET_DRAFTS || 'Drafts',
  COMPLETED: process.env.SHEET_COMPLETED || 'FilterTester'
};

/**
 * Returns an authenticated Google Sheets client with environment variable fallbacks.
 * Supports either GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY or GCP_CLIENT_EMAIL/GCP_PRIVATE_KEY.
 * Throws a descriptive error if credentials are missing.
 * @param {string[]} scopes
 */
function getSheetsClient(scopes = ['https://www.googleapis.com/auth/spreadsheets']) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GCP_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || process.env.GCP_PRIVATE_KEY;
  if (!clientEmail || !rawKey) {
    const missing = [];
    if (!clientEmail) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL or GCP_CLIENT_EMAIL');
    if (!rawKey) missing.push('GOOGLE_PRIVATE_KEY or GCP_PRIVATE_KEY');
    const message = `[auth] Missing required env var(s): ${missing.join(', ')}`;
    const error = new Error(message);
    error.code = 'MISSING_GOOGLE_CREDENTIALS';
    throw error;
  }
  const privateKey = rawKey.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({ credentials: { client_email: clientEmail, private_key: privateKey }, scopes });
  const sheets = google.sheets({ version: 'v4', auth });
  return { auth, sheets };
}
module.exports = { getSheetsClient, SHEET_NAMES };
