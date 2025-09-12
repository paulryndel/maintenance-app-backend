const { google } = require('googleapis');

const TECH_ID_HEADER_CANDIDATES = [
  'TechnicianID',
  'Technician Id',
  'Technician_ID',
  'Technician',
  'TechID',
  'Tech Id'
];

function findTechIdIndex(headerRow) {
  for (const name of TECH_ID_HEADER_CANDIDATES) {
    const idx = headerRow.indexOf(name);
    if (idx > -1) return idx;
  }
  return -1;
}

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

    const spreadsheetId = process.env.SPREADSHEET_ID;

    const [customerRes, draftRes, completedRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'CustomerList!A:E' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'Drafts' }),
      sheets.spreadsheets.values.get({ spreadsheetId, range: 'FilterTester' })
    ]);

    // Customers
    const customers = (customerRes.data.values || []).slice(1).map(row => ({
      CustomerID: row[0],
      CustomerName: row[1],
      Country: row[2],
      MachineType: row[3],
      SerialNo: row[4]
    }));
    const customerMap = new Map(customers.map(c => [c.CustomerID, c.CustomerName]));

    // Drafts
    const draftValues = draftRes.data.values || [];
    const draftHeader = draftValues[0] || [];
    const draftTechIdx = findTechIdIndex(draftHeader);

    let drafts = draftValues.slice(1)
      .filter(row => {
        if (draftTechIdx === -1) return true; // show all if no column found
        return row[draftTechIdx] === technicianId;
      })
      .map(row => {
        const obj = {};
        draftHeader.forEach((h, i) => obj[h] = row[i]);
        obj.CustomerName = customerMap.get(obj.CustomerID) || 'Unknown Customer';
        return obj;
      });

    // Completed
    const completedValues = completedRes.data.values || [];
    const completedHeader = completedValues[0] || [];
    const completedTechIdx = findTechIdIndex(completedHeader);

    const completed = completedValues.slice(1)
      .filter(row => {
        if (completedTechIdx === -1) return true;
        return row[completedTechIdx] === technicianId;
      })
      .map(row => {
        const obj = {};
        completedHeader.forEach((h, i) => obj[h] = row[i]);
        obj.CustomerName = customerMap.get(obj.CustomerID) || 'Unknown Customer';
        return obj;
      });

    const stats = {
      customersVisited: new Set(completed.map(c => c.CustomerID)).size,
      machinesChecked: completed.length,
      draftsMade: drafts.length
    };

    response.status(200).json({
      customers,
      drafts,
      completed,
      stats,
      meta: {
        draftHeader,
        completedHeader,
        draftTechIdx,
        completedTechIdx
      }
    });
  } catch (error) {
    console.error('API Error getHomepageData:', error);
    response.status(500).json({ message: 'Failed to fetch homepage data.' });
  }
};