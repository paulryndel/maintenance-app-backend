// Import the Google Auth and Google Sheets libraries
const { google } = require('googleapis');

// This is the main function Vercel will run
module.exports = async (request, response) => {
    // We only want to handle POST requests for security
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        // Get the username and password from the request body
        const { username, password } = request.body;
        
        // --- AUTHENTICATION WITH GOOGLE SHEETS ---
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        
        const sheets = google.sheets({ version: 'v4', auth });

        // Fetch data from the "TechnicianDetails" sheet
        const sheetData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'TechnicianDetails!A:E', 
        });

        const rows = sheetData.data.values;
        let loginSuccess = false;
        let loggedInUsername = null;

        if (rows && rows.length > 0) {
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const sheetUsername = row[3]; // Column D for User
                const sheetPassword = row[4]; // Column E for Password
                
                if (sheetUsername === username && sheetPassword === password) {
                    loginSuccess = true;
                    loggedInUsername = sheetUsername; // Store the username
                    break;
                }
            }
        }
        
        if (loginSuccess) {
            // Send username back to the frontend on successful login
            response.status(200).json({ status: 'success', username: loggedInUsername });
        } else {
            response.status(401).json({ status: 'fail', message: 'Invalid credentials.' });
        }

    } catch (error) {
        console.error('API Error:', error);
        response.status(500).json({ status: 'error', message: 'Internal Server Error.' });
    }
};