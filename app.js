require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- INCREASED REQUEST LIMITS ---
// This is the fix for the "Failed to save Draft" and "Internal Server Error" issues.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// --- END OF FIX ---

app.use(express.static('public'));

const sheets = google.sheets('v4');

// Sheet name mapping (logical -> actual tab title). Allows adapting to varying sheet tab names.
// You can override any of these via environment variables, e.g. SHEET_TECHNICIANS=TechnicianDetails
const SHEET_NAMES = {
    TECHNICIANS: process.env.SHEET_TECHNICIANS || 'TechnicianDetails',
    CUSTOMERS: process.env.SHEET_CUSTOMERS || 'CustomerList',
    DRAFTS: process.env.SHEET_DRAFTS || 'Drafts',
    COMPLETED: process.env.SHEET_COMPLETED || 'FilterTester'
};

// Support both naming conventions documented vs implemented previously
const SERVICE_ACCOUNT_EMAIL = process.env.GCP_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let SERVICE_ACCOUNT_KEY = process.env.GCP_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '';
if (SERVICE_ACCOUNT_KEY) {
    // Replace escaped newlines only if present
    SERVICE_ACCOUNT_KEY = SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n');
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

function assertEnv() {
    const missing = [];
    if (!SPREADSHEET_ID) missing.push('SPREADSHEET_ID');
    if (!SERVICE_ACCOUNT_EMAIL) missing.push('GCP_CLIENT_EMAIL or GOOGLE_SERVICE_ACCOUNT_EMAIL');
    if (!SERVICE_ACCOUNT_KEY) missing.push('GCP_PRIVATE_KEY or GOOGLE_PRIVATE_KEY');
    if (missing.length) {
        console.error('[CONFIG] Missing required environment variables:', missing.join(', '));
    }
}
assertEnv();

async function getAuthClient() {
    if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY) {
        throw new Error('Service account credentials not configured.');
    }
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: SERVICE_ACCOUNT_EMAIL,
            private_key: SERVICE_ACCOUNT_KEY,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return await auth.getClient();
}

// Helper to retrieve sheetId by title for dimension operations (e.g., deleting rows)
async function getSheetIdByTitle(auth, title) {
    const meta = await sheets.spreadsheets.get({ auth, spreadsheetId: SPREADSHEET_ID });
    const sheet = meta.data.sheets.find(s => s.properties.title === title);
    return sheet ? sheet.properties.sheetId : undefined;
}

// Multer setup for image uploads
// Ensure uploads directory exists (Note: On platforms like Vercel this is ephemeral per invocation)
const uploadsDir = path.join(__dirname, 'public', 'uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {/* ignore */}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.post('/api/uploadImage', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }
    // Construct the URL to be returned to the client
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const auth = await getAuthClient();
        const response = await sheets.spreadsheets.values.get({
            auth,
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAMES.TECHNICIANS}!A:D`,
        });
        const rows = response.data.values;
        const user = rows.find(row => row[1] === username && row[2] === password);
        if (user) {
            res.json({ 
                message: 'Login successful', 
                technicianId: user[0], 
                username: user[1],
                photoURL: user[3] || null 
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/getHomepageData', async (req, res) => {
    const { technicianId } = req.query;
    if (!technicianId) return res.status(400).json({ message: 'Technician ID is required.' });

    try {
        const auth = await getAuthClient();
        const [customersRes, draftsRes, completedRes] = await Promise.all([
            sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: SHEET_NAMES.CUSTOMERS }),
            sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: SHEET_NAMES.DRAFTS }),
            sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: SHEET_NAMES.COMPLETED })
        ]);

        const customerHeaders = customersRes.data.values[0];
        const customers = customersRes.data.values.slice(1).map(row => {
            let obj = {};
            customerHeaders.forEach((header, i) => obj[header] = row[i]);
            return obj;
        });

        const draftHeaders = draftsRes.data.values[0];
        const drafts = draftsRes.data.values.slice(1)
            .filter(row => row[draftHeaders.indexOf('TechnicianID')] === technicianId)
            .map(row => {
                let obj = {};
                draftHeaders.forEach((header, i) => {
                    try {
                        // Attempt to parse fields that might be JSON
                        obj[header] = JSON.parse(row[i]);
                    } catch (e) {
                        obj[header] = row[i];
                    }
                });
                return obj;
            });

        const completedHeaders = completedRes.data.values[0];
        const completed = completedRes.data.values.slice(1)
            .filter(row => row[completedHeaders.indexOf('TechnicianID')] === technicianId)
            .map(row => {
                let obj = {};
                completedHeaders.forEach((header, i) => obj[header] = row[i]);
                return obj;
            });

        const stats = {
            customersVisited: new Set(completed.map(c => c.CustomerID)).size,
            machinesChecked: completed.length,
            draftsMade: drafts.length
        };

        res.json({ customers, drafts, completed, stats });
    } catch (error) {
        console.error('Error fetching homepage data:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/createCustomer', async (req, res) => {
    const { CustomerName, Country, MachineType, SerialNo } = req.body;
    if (!CustomerName || !Country || !MachineType || !SerialNo) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    try {
        const auth = await getAuthClient();
    const response = await sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAMES.CUSTOMERS}!A:A` });
        const newID = `CUST${1000 + (response.data.values ? response.data.values.length : 0)}`;
        
        await sheets.spreadsheets.values.append({
            auth, spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAMES.CUSTOMERS}!A1`, valueInputOption: 'USER_ENTERED',
            resource: { values: [[newID, CustomerName, Country, MachineType, SerialNo]] }
        });
        res.status(201).json({ message: 'Customer created', customerID: newID });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ message: 'Failed to create customer.' });
    }
});

async function saveOrSubmit(logicalSheetName, data, res) {
    try {
        // Resolve actual sheet tab name
        const sheetName = logicalSheetName === 'Drafts' ? SHEET_NAMES.DRAFTS : (logicalSheetName === 'Completed' ? SHEET_NAMES.COMPLETED : logicalSheetName);
        const auth = await getAuthClient();
        const response = await sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1:AZ1` });
        const headers = response.data.values[0];

        if (!headers || !Array.isArray(headers)) {
            throw new Error(`Header row not found for sheet ${sheetName}`);
        }

        // Stringify any object/array values (e.g., nested JSON, photo arrays)
        Object.keys(data).forEach(key => {
            if (typeof data[key] === 'object' && data[key] !== null) {
                try {
                    data[key] = JSON.stringify(data[key]);
                } catch (e) { /* ignore stringify error */ }
            }
        });

        const values = [headers.map(header => (data[header] !== undefined ? data[header] : ''))];

        if (logicalSheetName === 'Drafts' && data.DraftID) {
            // Update existing draft row if present
            const draftsRes = await sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: SHEET_NAMES.DRAFTS });
            const draftIDIndex = draftsRes.data.values[0].indexOf('DraftID');
            const rowIndex = draftsRes.data.values.findIndex(row => row[draftIDIndex] === data.DraftID); // 0-based (header = 0)
            if (rowIndex > 0) { // skip header row
                await sheets.spreadsheets.values.update({
                    auth,
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEET_NAMES.DRAFTS}!A${rowIndex + 1}`, // 1-based row number
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                return res.json({ message: 'Draft updated successfully', draftID: data.DraftID });
            }
        }

        if (logicalSheetName === 'Drafts' && !data.DraftID) {
            // Create new DraftID
            const draftsRes = await sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAMES.DRAFTS}!A:A` });
            const newDraftID = `DRAFT${1000 + (draftsRes.data.values ? draftsRes.data.values.length : 0)}`;
            const draftIdCol = headers.indexOf('DraftID');
            if (draftIdCol !== -1) {
                values[0][draftIdCol] = newDraftID;
                data.DraftID = newDraftID;
            }
        }

        if (logicalSheetName === 'Completed' && data.DraftID) {
            // Delete original draft row after successful submission
            const draftsRes = await sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: SHEET_NAMES.DRAFTS });
            const draftIDIndex = draftsRes.data.values[0].indexOf('DraftID');
            const rowIndex = draftsRes.data.values.findIndex(row => row[draftIDIndex] === data.DraftID); // 0-based
            if (rowIndex > 0) {
                const draftSheetId = await getSheetIdByTitle(auth, SHEET_NAMES.DRAFTS);
                if (draftSheetId !== undefined) {
                    await sheets.spreadsheets.batchUpdate({
                        auth,
                        spreadsheetId: SPREADSHEET_ID,
                        resource: {
                            requests: [{
                                deleteDimension: {
                                    range: { sheetId: draftSheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 }
                                }
                            }]
                        }
                    });
                }
            }
        }

        await sheets.spreadsheets.values.append({
            auth,
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });

        res.status(201).json({ message: `${logicalSheetName === 'Drafts' ? 'Draft' : 'Checklist'} saved successfully`, draftID: data.DraftID });
    } catch (error) {
        console.error(`Error saving to ${logicalSheetName}:`, {
            message: error.message,
            stack: error.stack,
            responseData: error.response?.data
        });
        res.status(500).json({
            message: `Failed to save ${logicalSheetName === 'Drafts' ? 'draft' : 'checklist'}`,
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
    }
}

app.post('/api/saveDraft', (req, res) => saveOrSubmit('Drafts', req.body, res));
app.post('/api/submitChecklist', (req, res) => saveOrSubmit('Completed', req.body, res));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});