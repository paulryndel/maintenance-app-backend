const { getSheetsClient } = require('./_sheetsClient');

module.exports = async (request, response) => {
    try {
        const { technicianId } = request.query;
        if (!technicianId) {
            return response.status(400).json({ message: 'Technician ID is required.' });
        }
        const { sheets } = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);

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
        const completedTechnicianIdColIndex = completedHeader.indexOf('TechnicianID');
        const completed = (completedRes.data.values || []).slice(1)
            .filter(row => row[completedTechnicianIdColIndex] === technicianId)
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
        if (error.code === 'MISSING_GOOGLE_CREDENTIALS') {
            console.error('[getHomepageData] Missing credentials:', error.message);
            return response.status(500).json({ message: error.message });
        }
        console.error('[getHomepageData] API Error:', error);
        response.status(500).json({ message: 'Failed to fetch homepage data.' });
    }
};