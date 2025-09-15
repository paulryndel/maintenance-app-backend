const { getSheetsClient, SHEET_NAMES } = require('./_sheetsClient');

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
        const draftData = request.body || {};
        if (!draftData.CustomerID || !draftData.TechnicianID) {
            return response.status(400).json({ message: 'Missing CustomerID or TechnicianID.' });
        }
        if (!draftData.InspectedDate) {
            draftData.InspectedDate = new Date().toISOString().split('T')[0];
        }
        // Stringify nested objects/arrays
        Object.keys(draftData).forEach(k => {
            if (draftData[k] && typeof draftData[k] === 'object') {
                try { draftData[k] = JSON.stringify(draftData[k]); } catch (_) { /* ignore */ }
            }
        });

        const { sheets } = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
        const draftsTitle = SHEET_NAMES.DRAFTS; // actual tab name
        const sheetData = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.SPREADSHEET_ID, range: draftsTitle });
        const header = (sheetData.data.values || [])[0];
        if (!header || header.length === 0) {
            return response.status(500).json({ message: `${draftsTitle} sheet header missing.` });
        }
        const draftIdColIndex = header.indexOf('DraftID');
        if (draftIdColIndex === -1) {
            return response.status(500).json({ message: 'DraftID column not found in draft sheet.' });
        }
        const newRow = header.map(col => (draftData[col] !== undefined ? draftData[col] : ''));

        if (draftData.DraftID) {
            const rows = sheetData.data.values;
            const rowIndex = rows.findIndex(row => row[draftIdColIndex] === draftData.DraftID);
            if (rowIndex >= 1) {
                console.log(`[saveDraft] Updating draft ${draftData.DraftID} at row ${rowIndex + 1} (tab=${draftsTitle})`);
                await sheets.spreadsheets.values.update({
                    spreadsheetId: process.env.SPREADSHEET_ID,
                    range: `${draftsTitle}!A${rowIndex + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [newRow] },
                });
                return response.status(200).json({ status: 'updated', draftID: draftData.DraftID });
            }
        }

        const newDraftID = `DRAFT-${Date.now()}`;
        newRow[draftIdColIndex] = newDraftID;
        console.log(`[saveDraft] Creating new draft ${newDraftID} (tab=${draftsTitle})`);

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: `${draftsTitle}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [newRow] },
        });
        response.status(200).json({ status: 'created', draftID: newDraftID });
    } catch (error) {
        if (error.code === 'MISSING_GOOGLE_CREDENTIALS') {
            console.error('[saveDraft] Missing credentials:', error.message);
            return response.status(500).json({ message: error.message });
        }
        console.error('API Error (saveDraft):', { message: error.message, stack: error.stack, data: error.response?.data });
        response.status(500).json({ message: 'Failed to save draft.', error: process.env.NODE_ENV === 'production' ? undefined : error.message });
    }
};