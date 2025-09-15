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

module.exports = async (request, response) => {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }
    
    try {
        const draftData = request.body;
        // Ensure required identifiers
        if (!draftData.CustomerID || !draftData.TechnicianID) {
            return response.status(400).json({ message: 'Missing CustomerID or TechnicianID.' });
        }
        // Provide a default inspected date if not present
        if (!draftData.InspectedDate) {
            draftData.InspectedDate = new Date().toISOString().split('T')[0];
        }
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const range = 'Drafts';
        const sheetData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: range,
        });
        const header = sheetData.data.values[0];
        if (!header || header.length === 0) {
            return response.status(500).json({ message: 'Drafts sheet header missing.' });
        }
        const newRow = header.map(col => draftData[col] || '');

        if (draftData.DraftID) {
            const rows = sheetData.data.values;
            const draftIdColIndex = header.indexOf('DraftID');
            if (draftIdColIndex === -1) {
                return response.status(500).json({ message: 'DraftID column not found in Drafts sheet.' });
            }
            const rowIndex = rows.findIndex(row => row[draftIdColIndex] === draftData.DraftID);
            // rowIndex 0 is header; valid data rows start at index 1
            if (rowIndex >= 1) {
                console.log(`[saveDraft] Updating draft ${draftData.DraftID} at row ${rowIndex + 1}`);
                await sheets.spreadsheets.values.update({
                    spreadsheetId: process.env.SPREADSHEET_ID,
                    range: `Drafts!A${rowIndex + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [newRow] },
                });
                return response.status(200).json({ status: 'updated', draftID: draftData.DraftID });
            }
        }
        
        const newDraftID = `DRAFT-${Date.now()}`;
        newRow[header.indexOf('DraftID')] = newDraftID;
        console.log(`[saveDraft] Creating new draft ${newDraftID}`);

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'Drafts!A1',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [newRow] },
        });
        response.status(200).json({ status: 'created', draftID: newDraftID });
    } catch (error) {
        console.error('API Error:', error);
        response.status(500).json({ message: 'Failed to save draft.' });
    }
};