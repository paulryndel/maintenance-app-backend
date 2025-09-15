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

async function deleteDraft(sheets, spreadsheetId, draftID) {
    if (!draftID) return;
    try {
        const draftsTitle = SHEET_NAMES.DRAFTS;
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: draftsTitle });
        const rows = res.data.values;
        if (!rows) return;
        const draftIdColIndex = (rows[0] || []).indexOf('DraftID');
        if (draftIdColIndex === -1) return;
        const rowIndex = rows.findIndex(row => row[draftIdColIndex] === draftID);
        if (rowIndex === -1) return;
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = sheetInfo.data.sheets.find(s => s.properties.title === draftsTitle);
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
        if (!data.CustomerID || !data.TechnicianID) {
            return response.status(400).json({ status: 'error', message: 'Missing CustomerID or TechnicianID.' });
        }
        if (!data.ChecklistID) {
            data.ChecklistID = `CHK-${Date.now()}`;
        }
        if (!data.InspectedDate) {
            data.InspectedDate = new Date().toISOString().split('T')[0];
        }
        // Stringify nested objects for sheet storage
        Object.keys(data).forEach(k => {
            if (data[k] && typeof data[k] === 'object') {
                try { data[k] = JSON.stringify(data[k]); } catch (_) { /* ignore */ }
            }
        });
        const { sheets } = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
        const completedTitle = SHEET_NAMES.COMPLETED; // e.g., FilterTester
        const headerRes = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: `${completedTitle}!1:1`,
        });
        const header = (headerRes.data.values || [])[0];
        if (!header) {
            return response.status(500).json({ status: 'error', message: `${completedTitle} header row missing.` });
        }
        const newRow = header.map(col => (data[col] !== undefined ? data[col] : ''));
        console.log(`[submitChecklist] Appending checklist ${data.ChecklistID} (draft=${data.DraftID ? 'yes' : 'no'}) with ${header.length} columns to tab ${completedTitle}.`);

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: `${completedTitle}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [newRow] },
        });

        await deleteDraft(sheets, process.env.SPREADSHEET_ID, data.DraftID);
        
        response.status(200).json({ status: 'success', message: 'Checklist submitted successfully.', checklistID: data.ChecklistID });
    } catch (error) {
        if (error.code === 'MISSING_GOOGLE_CREDENTIALS') {
            console.error('[submitChecklist] Missing credentials:', error.message);
            return response.status(500).json({ status: 'error', message: error.message });
        }
        console.error('API Error (submitChecklist):', { message: error.message, stack: error.stack, data: error.response?.data });
        response.status(500).json({ status: 'error', message: 'Internal Server Error.', error: process.env.NODE_ENV === 'production' ? undefined : error.message });
    }
};