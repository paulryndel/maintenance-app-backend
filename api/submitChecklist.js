const { google } = require('googleapis');

// --- ADD THIS CONFIG BLOCK ---
module.exports.config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};
// --- END OF ADDED BLOCK ---

async function deleteDraft(sheets, spreadsheetId, draftID) {
    if (!draftID) return;
    try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Drafts' });
        const rows = res.data.values;
        if (!rows) return;
        const draftIdColIndex = (rows[0] || []).indexOf('DraftID');
        if (draftIdColIndex === -1) return;
        const rowIndex = rows.findIndex(row => row[draftIdColIndex] === draftID);
        if (rowIndex === -1) return;
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === 'Drafts');
        if (!sheet) return;
        const sheetId = sheet.properties.sheetId;
        
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex,
                            endIndex: rowIndex + 1
                        }
                    }
                }]
            }
        });
    } catch (err) {
        console.error(`Failed to delete draft ${draftID}`, err);
    }
}

module.exports = async (request, response) => {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }
    try {
        const data = request.body;
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const headerRes = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'FilterTester!A1:AF1',
        });
        const header = headerRes.data.values[0];
        const newRow = header.map(col => data[col] || '');

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'FilterTester!A1',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [newRow] },
        });

        await deleteDraft(sheets, process.env.SPREADSHEET_ID, data.DraftID);
        
        response.status(200).json({ status: 'success', message: 'Checklist submitted successfully.' });
    } catch (error) {
        console.error('API Error:', error);
        response.status(500).json({ status: 'error', message: 'Internal Server Error.' });
    }
};