const { google } = require('googleapis');

// Google Sheets configuration (same as main app)
const sheets = google.sheets('v4');
const SHEET_NAMES = {
    COMPLETED: process.env.SHEET_COMPLETED || 'FilterTester'
};

const SERVICE_ACCOUNT_EMAIL = process.env.GCP_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let SERVICE_ACCOUNT_KEY = process.env.GCP_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '';
if (SERVICE_ACCOUNT_KEY) {
    SERVICE_ACCOUNT_KEY = SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n');
}
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function getAuthClient() {
    if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY) {
        throw new Error('Missing Google Cloud credentials');
    }
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: SERVICE_ACCOUNT_EMAIL,
            private_key: SERVICE_ACCOUNT_KEY,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return await auth.getClient();
}

module.exports = async (req, res) => {
    console.log(`[List Checklists] Request received at ${new Date().toISOString()}`);
    
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        // Get authentication client
        const auth = await getAuthClient();
        
        // Fetch data from FilterTester sheet
        console.log(`[List Checklists] Reading from sheet: ${SHEET_NAMES.COMPLETED}`);
        const response = await sheets.spreadsheets.values.get({
            auth,
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAMES.COMPLETED}!A:E`, // Get first few columns only for listing
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            return res.json({ checklists: [] });
        }

        const headers = rows[0];
        const checklists = rows.slice(1).map(row => {
            const checklist = {};
            headers.forEach((header, index) => {
                if (header && row[index] !== undefined) {
                    checklist[header] = row[index];
                }
            });
            return {
                id: checklist.ChecklistID || checklist.checklistId || row[0],
                customer: checklist.CustomerName || checklist.Customer || 'Unknown',
                technician: checklist.TechnicianName || checklist.Technician || 'Unknown',
                date: checklist.Date || checklist.date || 'Unknown',
                status: 'Completed'
            };
        }).filter(item => item.id); // Only return items with valid IDs

        console.log(`[List Checklists] Found ${checklists.length} completed checklists`);
        res.json({ checklists });

    } catch (error) {
        console.error('[List Checklists] Error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Failed to fetch checklist list',
            error: error.message 
        });
    }
};