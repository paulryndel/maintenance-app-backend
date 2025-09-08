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

        // Fetch all necessary columns from the "TechnicianDetails" sheet
        const sheetData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'TechnicianDetails!A:E', // Read columns A through E
        });

        const rows = sheetData.data.values;
        let loginSuccess = false;
        let technicianName = null;
        let technicianId = null;
        let photoURL = null;

        if (rows && rows.length > 0) {
            for (let i = 1; i < rows.length; i++) { // Start at 1 to skip header row
                const row = rows[i];
                
                // --- Match the new column order ---
                const sheetTechId = row[0];      // Column A: TechnicianID
                const sheetTechName = row[1];    // Column B: Name
                const sheetPhotoURL = row[2];    // Column C: Photo
                const sheetUsername = row[3];    // Column D: User (for login)
                const sheetPassword = row[4];    // Column E: Password (for login)
                
                if (sheetUsername === username && sheetPassword === password) {
                    loginSuccess = true;
                    technicianName = sheetTechName; // The name to display
                    technicianId = sheetTechId;     // The ID to use for filtering
                    photoURL = sheetPhotoURL || null;
                    break;
                }
            }
        }
        
        if (loginSuccess) {
            // Send the correct data back to the frontend
            response.status(200).json({ status: 'success', username: technicianName, technicianId: technicianId, photoURL: photoURL });
        } else {
            response.status(401).json({ status: 'fail', message: 'Invalid credentials.' });
        }

    } catch (error) {
        console.error('API Error:', error);
        response.status(500).json({ status: 'error', message: 'Internal Server Error.' });
    }
};