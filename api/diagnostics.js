const { getSheetsClient } = require('./_sheetsClient');

module.exports = async (req, res) => {
  try {
    const { sheets } = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      return res.status(500).json({ ok: false, error: 'SPREADSHEET_ID not set' });
    }
    async function getHeader(range, sheetName) {
      try {
        const r = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        return (r.data.values || [])[0] || [];
      } catch (e) {
        return { error: `Failed to read ${sheetName}: ${e.message}` };
      }
    }
    const draftsHeader = await getHeader('Drafts!1:1', 'Drafts');
    const filterHeader = await getHeader('FilterTester!1:1', 'FilterTester');
    const customerHeader = await getHeader('CustomerList!1:1', 'CustomerList');

    function headerInfo(h) {
      if (Array.isArray(h)) {
        return {
          length: h.length,
          first10: h.slice(0, 10),
          hasDraftID: h.includes('DraftID'),
          hasChecklistID: h.includes('ChecklistID'),
          hasCustomerID: h.includes('CustomerID'),
          hasTechnicianID: h.includes('TechnicianID'),
          hasInspectedDate: h.includes('InspectedDate')
        };
      }
      return h; // error object
    }

    res.status(200).json({
      ok: true,
      drafts: headerInfo(draftsHeader),
      filterTester: headerInfo(filterHeader),
      customerList: headerInfo(customerHeader),
      env: {
        hasSpreadsheetId: !!process.env.SPREADSHEET_ID,
        hasAnyClientEmail: !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GCP_CLIENT_EMAIL),
        hasAnyPrivateKey: !!(process.env.GOOGLE_PRIVATE_KEY || process.env.GCP_PRIVATE_KEY)
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};
