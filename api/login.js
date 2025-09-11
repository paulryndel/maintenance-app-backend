const { google } = require('googleapis');

const errorHandler = (error, response) => {
  console.error('API Error:', error);
  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';
  response.status(status).json({ status: 'error', message });
};

module.exports = async (request, response) => {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }
    try {
        const { username, password } = request.body;
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
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
        return errorHandler(error, response);
    }
};