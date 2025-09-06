// Import the Google Auth and Google Sheets libraries
const { google } = require('googleapis');

// Function to generate a unique Customer ID
function generateCustomerID(allCustomerIDs) {
    const prefix = "CUST";
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    let newID;
    let sequence = 1;

    do {
        const sequenceStr = sequence.toString().padStart(4, '0');
        newID = `${prefix}${year}${month}${sequenceStr}`;
        sequence++;
    } while (allCustomerIDs.has(newID)); // Ensure the new ID is unique

    return newID;
}

// This is the main function Vercel will run to create a new customer
module.exports = async (request, response) => {
    // We only want to handle POST requests
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        const { CustomerName, Country, MachineType, SerialNo } = request.body;
        if (!CustomerName || !Country || !MachineType || !SerialNo) {
             return response.status(400).json({ status: 'fail', message: 'All customer fields are required.' });
        }

        // --- AUTHENTICATION WITH GOOGLE SHEETS ---
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Read and Write access
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Step 1: Read all existing CustomerIDs from the sheet to ensure uniqueness
        const idColumnData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'CustomerList!A:A', // Assuming CustomerID is in Column A
        });

        const existingIDs = new Set(idColumnData.data.values ? idColumnData.data.values.flat() : []);
        
        // Step 2: Generate a new, unique CustomerID
        const newCustomerID = generateCustomerID(existingIDs);

        // Step 3: Prepare the new row to be inserted
        const newRow = [newCustomerID, CustomerName, Country, MachineType, SerialNo];
        
        // Step 4: Append the new row to the 'CustomerList' sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'CustomerList!A1',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [newRow],
            },
        });
        
        // Step 5: Send the new CustomerID back to the frontend
        response.status(200).json({ status: 'success', customerID: newCustomerID });

    } catch (error) {
        console.error('API Error:', error);
        response.status(500).json({ status: 'error', message: 'Internal Server Error while creating customer.' });
    }
};