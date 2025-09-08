const { google } = require('googleapis');

module.exports = async (request, response) => {
    // --- Start of Request ---
    console.log("Login function initiated.");

    if (request.method !== 'POST') {
        console.log("Request rejected: Method not POST.");
        return response.status(405).send('Method Not Allowed');
    }

    try {
        const { username, password } = request.body;
        console.log(`Attempting login for user: "${username}"`);

        if (!username || !password) {
            console.log("Login failed: Username or password not provided in request.");
            return response.status(400).json({ status: 'fail', message: 'Username and password are required.' });
        }
        
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        console.log("Google Sheets authentication successful.");

        const sheetData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'TechnicianDetails!A:E',
        });
        console.log("Successfully fetched data from 'TechnicianDetails' sheet.");

        const rows = sheetData.data.values;
        if (!rows || rows.length <= 1) {
            console.log("Error: No data found in the sheet or only a header row exists.");
            return response.status(500).json({ status: 'error', message: 'No technician data found in the sheet.' });
        }

        let loginSuccess = false;
        let technicianName = null;
        let technicianId = null;
        let photoURL = null;

        // Start from row 1 to skip the header
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            // --- Enhanced Logging for each row ---
            console.log(`Checking row ${i + 1}:`, row);

            const sheetTechId = row[0];      // Column A
            const sheetTechName = row[1];    // Column B
            const sheetPhotoURL = row[2];    // Column C
            const sheetUsername = row[3];    // Column D
            const sheetPassword = row[4];    // Column E

            // Check if the username and password from the sheet are valid before comparing
            if (typeof sheetUsername !== 'string' || typeof sheetPassword !== 'string') {
                console.log(`Skipping row ${i + 1} due to invalid or empty username/password cells.`);
                continue;
            }
            
            if (sheetUsername.trim() === username && sheetPassword.trim() === password) {
                console.log(`SUCCESS: Match found for user "${username}" on row ${i + 1}.`);
                loginSuccess = true;
                technicianName = sheetTechName;
                technicianId = sheetTechId;
                photoURL = sheetPhotoURL || null;
                break; // Exit the loop once a match is found
            }
        }
        
        if (loginSuccess) {
            console.log("Login successful. Sending success response.");
            return response.status(200).json({ status: 'success', username: technicianName, technicianId: technicianId, photoURL: photoURL });
        } else {
            console.log(`Login failed for user "${username}". No matching credentials found in any row.`);
            return response.status(401).json({ status: 'fail', message: 'Invalid credentials.' });
        }

    } catch (error) {
        console.error('--- FATAL API ERROR ---:', error);
        return response.status(500).json({ status: 'error', message: 'An internal server error occurred.' });
    }
};