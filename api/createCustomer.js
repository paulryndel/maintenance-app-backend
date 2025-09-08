// Import the Google Auth and Google Sheets libraries
const { google } = require('googleapis');

// Function to create a sanitized, combined Customer ID
function createCombinedID(customerData) {
    const { CustomerName, Country, MachineType, SerialNo } = customerData;
    // Combine, convert to uppercase, and remove non-alphanumeric characters
    const combined = `${CustomerName}${Country}${MachineType}${SerialNo}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return combined;
}

module.exports = async (request, response) => {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        const customerData = request.body;
        const { CustomerName, Country, MachineType, SerialNo } = customerData;
        if (!CustomerName || !Country || !MachineType || !SerialNo) {
             return response.status(400).json({ status: 'fail', message: 'All customer fields are required.' });
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Read and Write access
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Step 1: Read all existing customers to check for duplicates
        const customerListData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            // Assuming CustomerID, CustomerName, Country, MachineType, SerialNo are in columns A-E
            range: 'CustomerList!A:E', 
        });
        
        const rows = customerListData.data.values || [];
        const newCustomerCombinedID = createCombinedID(customerData);

        for (let i = 1; i < rows.length; i++) { // Start at 1 to skip header
            const row = rows[i];
            const existingCustomer = {
                CustomerID: row[0],
                CustomerName: row[1],
                Country: row[2],
                MachineType: row[3],
                SerialNo: row[4],
            };
            const existingCombinedID = createCombinedID(existingCustomer);

            if (existingCombinedID === newCustomerCombinedID) {
                // Customer already exists, return the existing ID
                return response.status(200).json({ status: 'exists', customerID: existingCustomer.CustomerID });
            }
        }
        
        // Step 2: If no duplicate found, create a new customer
        const newCustomerID = `CUST-${Date.now()}`; // A simple unique ID
        const newRow = [newCustomerID, CustomerName, Country, MachineType, SerialNo];
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'CustomerList!A1',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [newRow],
            },
        });
        
        response.status(200).json({ status: 'created', customerID: newCustomerID });

    } catch (error) {
        console.error('API Error:', error);
        response.status(500).json({ status: 'error', message: 'Internal Server Error while creating customer.' });
    }
};