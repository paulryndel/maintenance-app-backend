const { google } = require('googleapis');

module.exports = async (request, response) => {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }
    
    try {
        const draftData = request.body;
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
        const newRow = header.map(col => draftData[col] || '');

        if (draftData.DraftID) {
            const rows = sheetData.data.values;
            const draftIdColIndex = header.indexOf('DraftID');
            const rowIndex = rows.findIndex(row => row[draftIdColIndex] === draftData.DraftID);
            
            if (rowIndex > 0) {
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