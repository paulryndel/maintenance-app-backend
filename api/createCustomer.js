const { google } = require('googleapis');

function createCombinedKey(customerData) {
    const { CustomerName, Country, MachineType, SerialNo } = customerData;
    const combined = `${CustomerName}${Country}${MachineType}${SerialNo}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return combined;
}

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
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const customerListData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'CustomerList!A:E', 
        });
        const rows = customerListData.data.values || [];
        const newCustomerKey = createCombinedKey(customerData);

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const existingCustomer = {
                CustomerID: row[0], CustomerName: row[1], Country: row[2], MachineType: row[3], SerialNo: row[4],
            };
            const existingKey = createCombinedKey(existingCustomer);
            if (existingKey === newCustomerKey) {
                return response.status(200).json({ status: 'exists', customerID: existingCustomer.CustomerID });
            }
        }
        
        const newCustomerID = newCustomerKey.slice(0, 20) + Date.now();
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
        return errorHandler(error, response);
    }
};