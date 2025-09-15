const { getSheetsClient } = require('./_sheetsClient');

module.exports = async (request, response) => {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }
    try {
        const { username, password } = request.body;
        const { sheets } = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
        const sheetData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'TechnicianDetails!A:E',
        });
        const rows = sheetData.data.values;
        let loginSuccess = false;
        let technicianName = null;
        let technicianId = null;
        let photoURL = null;

        if (rows && rows.length > 0) {
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const sheetTechId = row[0];
                const sheetTechName = row[1];
                const sheetPhotoURL = row[2];
                const sheetUsername = row[3];
                const sheetPassword = row[4];
                if (sheetUsername === username && sheetPassword === password) {
                    loginSuccess = true;
                    technicianName = sheetTechName;
                    technicianId = sheetTechId;
                    photoURL = sheetPhotoURL || null;
                    break;
                }
            }
        }
        if (loginSuccess) {
            response.status(200).json({ status: 'success', username: technicianName, technicianId: technicianId, photoURL: photoURL });
        } else {
            response.status(401).json({ status: 'fail', message: 'Invalid credentials.' });
        }
    } catch (error) {
        if (error.code === 'MISSING_GOOGLE_CREDENTIALS') {
            console.error('[login] Missing credentials:', error.message);
            return response.status(500).json({ status: 'error', message: error.message });
        }
        console.error('API Error (login):', error);
        response.status(500).json({ status: 'error', message: 'Internal Server Error.' });
    }
};