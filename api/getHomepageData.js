const { google } = require('googleapis');

module.exports = async (request, response) => {
    try {
        const { technicianId } = request.query;
        if (!technicianId) {
            return response.status(400).json({ message: 'Technician ID is required.' });
        }
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        const [customerRes, draftRes, completedRes] = await Promise.all([
            sheets.spreadsheets.values.get({ spreadsheetId: process.env.SPREADSHEET_ID, range: 'CustomerList!A:E' }),
            sheets.spreadsheets.values.get({ spreadsheetId: process.env.SPREADSHEET_ID, range: 'Drafts' }),
            sheets.spreadsheets.values.get({ spreadsheetId: process.env.SPREADSHEET_ID, range: 'FilterTester' })
        ]);

        const customers = (customerRes.data.values || []).slice(1).map(row => ({
            CustomerID: row[0], CustomerName: row[1], Country: row[2], MachineType: row[3], SerialNo: row[4]
        }));
        const customerMap = new Map(customers.map(c => [c.CustomerID, c.CustomerName]));

        const draftHeader = (draftRes.data.values || [[]])[0];
        const technicianIdColIndex = draftHeader.indexOf('TechnicianID');
        const drafts = (draftRes.data.values || []).slice(1)
            .filter(row => row[technicianIdColIndex] === technicianId)
            .map(row => {
                let draftObj = {};
                draftHeader.forEach((header, index) => { draftObj[header] = row[index]; });
                const customer = customers.find(c => c.CustomerID === draftObj.CustomerID);
                draftObj.CustomerName = customer ? customer.CustomerName : 'Unknown Customer';
                draftObj.MachineType = customer ? customer.MachineType : 'N/A';
                draftObj.SerialNo = customer ? customer.SerialNo : 'N/A';
                return draftObj;
            });

        const completedHeader = (completedRes.data.values || [[]])[0];
        const completed = (completedRes.data.values || []).slice(1)
            .filter(row => row[technicianIdColIndex] === technicianId)
            .map(row => {
                 let itemObj = {};
                completedHeader.forEach((header, index) => { itemObj[header] = row[index]; });
                itemObj.CustomerName = customerMap.get(itemObj.CustomerID) || 'Unknown Customer';
                return itemObj;
            });

        const stats = {
            customersVisited: new Set(completed.map(c => c.CustomerID)).size,
            machinesChecked: completed.length,
            draftsMade: drafts.length
        };
        response.status(200).json({ customers, drafts, completed, stats });
    } catch (error) {
        console.error("API Error:", error);
        response.status(500).json({ message: 'Failed to fetch homepage data.' });
    }
};