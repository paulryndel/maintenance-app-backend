// Import the Google Auth and Google Sheets libraries
const { google } = require('googleapis');

// This is the main function Vercel will run
module.exports = async (request, response) => {
    // We only want to handle POST requests for security
    if (request.method !== 'POST') {
        response.status(405).send('Method Not Allowed');
        return;
    }

    try {
        // Get the username and password from the request body
        const { username, password } = request.body;
        
        // --- AUTHENTICATION WITH GOOGLE SHEETS ---
        // These credentials come from your Vercel Environment Variables
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Fix for Vercel env var
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Read-only access
        });
        
        const sheets = google.sheets({ version: 'v4', auth });

        // Fetch data from the "TechnicianDetails" sheet
        const sheetData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            // Updated Range: Fetch columns up to E to get User and Password
            range: 'TechnicianDetails!A:E', 
        });

        const rows = sheetData.data.values;
        let loginSuccess = false;

        // Check if we got any rows from the sheet
        if (rows && rows.length > 0) {
            // Loop through each row (skipping the header) to find a match
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                // Updated Column Indices: D is index 3, E is index 4
                const sheetUsername = row[3]; // Column D for User
                const sheetPassword = row[4]; // Column E for Password
                
                if (sheetUsername === username && sheetPassword === password) {
                    loginSuccess = true;
                    break;
                }
            }
        }
        
        // --- SEND RESPONSE ---
        if (loginSuccess) {
            response.status(200).json({ status: 'success' });
        } else {
            response.status(401).json({ status: 'fail', message: 'Invalid credentials.' });
        }

    } catch (error) {
        console.error('API Error:', error);
        response.status(500).json({ status: 'error', message: 'Internal Server Error.' });
    }
};

