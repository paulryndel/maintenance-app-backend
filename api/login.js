const { google } = require('googleapis');

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
            range: 'TechnicianDetails!A:F', 
        });

        const rows = sheetData.data.values;
        let loginSuccess = false;
        let loggedInUsername = null;
        let technicianId = null;
        let photoURL = null;

        if (rows && rows.length > 0) {
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                // Assuming C=TechnicianID, D=User, E=Password, F=Photo
                const sheetTechId = row[2]; 
                const sheetUsername = row[3];
                const sheetPassword = row[4];
                
                if (sheetUsername === username && sheetPassword === password) {
                    loginSuccess = true;
                    loggedInUsername = sheetUsername;
                    technicianId = sheetTechId;
                    photoURL = row[5] || null;
                    break;
                }
            }
        }
        
        if (loginSuccess) {
            response.status(200).json({ status: 'success', username: loggedInUsername, technicianId: technicianId, photoURL: photoURL });
        } else {
            response.status(401).json({ status: 'fail', message: 'Invalid credentials.' });
        }

    } catch (error) {
        console.error('API Error:', error);
        response.status(500).json({ status: 'error', message: 'Internal Server Error.' });
    }
};