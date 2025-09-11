require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- INCREASED REQUEST LIMITS ---
// This is the fix for the "Failed to save Draft" and "Internal Server Error" issues.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// --- END OF FIX ---

app.use(express.static('public'));

const sheets = google.sheets('v4');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function getAuthClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GCP_CLIENT_EMAIL,
            private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return await auth.getClient();
}

// Multer setup for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
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
            range: 'Technicians!A:D',
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
            sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: 'Customers' }),
            sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: 'Drafts' }),
            sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: 'Completed' })
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
        const response = await sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: 'Customers!A:A' });
        const newID = `CUST${1000 + (response.data.values ? response.data.values.length : 0)}`;
        
        await sheets.spreadsheets.values.append({
            auth, spreadsheetId: SPREADSHEET_ID, range: 'Customers!A1', valueInputOption: 'USER_ENTERED',
            resource: { values: [[newID, CustomerName, Country, MachineType, SerialNo]] }
        });
        res.status(201).json({ message: 'Customer created', customerID: newID });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ message: 'Failed to create customer.' });
    }
});

async function saveOrSubmit(sheetName, data, res) {
    try {
        const auth = await getAuthClient();
        const response = await sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1:AZ1` });
        const headers = response.data.values[0];

        // Stringify any object values (like our new item data with photos)
        Object.keys(data).forEach(key => {
            if (typeof data[key] === 'object' && data[key] !== null) {
                data[key] = JSON.stringify(data[key]);
            }
        });
        
        const values = [headers.map(header => data[header] || '')];

        if (sheetName === 'Drafts' && data.DraftID) {
            // Find and update existing draft
            const draftsRes = await sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: 'Drafts' });
            const draftIDIndex = draftsRes.data.values[0].indexOf('DraftID');
            const rowIndex = draftsRes.data.values.findIndex(row => row[draftIDIndex] === data.DraftID);

            if (rowIndex > 0) {
                await sheets.spreadsheets.values.update({
                    auth, spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A${rowIndex + 1}`, valueInputOption: 'USER_ENTERED',
                    resource: { values }
                });
                return res.json({ message: 'Draft updated successfully', draftID: data.DraftID });
            }
        }
        
        // If it's a new draft, add a DraftID
        if (sheetName === 'Drafts' && !data.DraftID) {
            const draftsRes = await sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: 'Drafts!A:A' });
            const newDraftID = `DRAFT${1000 + (draftsRes.data.values ? draftsRes.data.values.length : 0)}`;
            values[0][headers.indexOf('DraftID')] = newDraftID;
            data.DraftID = newDraftID;
        }

        // If submitting, delete from drafts if it exists
        if (sheetName === 'Completed' && data.DraftID) {
             const draftsRes = await sheets.spreadsheets.values.get({ auth, spreadsheetId: SPREADSHEET_ID, range: 'Drafts' });
             const draftIDIndex = draftsRes.data.values[0].indexOf('DraftID');
             const rowIndex = draftsRes.data.values.findIndex(row => row[draftIDIndex] === data.DraftID);
             if (rowIndex > 0) {
                 await sheets.spreadsheets.batchUpdate({
                     auth, spreadsheetId: SPREADSHEET_ID,
                     resource: { requests: [{ deleteDimension: { range: { sheetId: draftsRes.data.values[0].sheetId || 125283533, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 } } }] }
                 });
             }
        }

        await sheets.spreadsheets.values.append({
            auth, spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED',
            resource: { values }
        });

        res.status(201).json({ message: `${sheetName.slice(0, -1)} saved successfully`, draftID: data.DraftID });

    } catch (error) {
        console.error(`Error saving to ${sheetName}:`, error);
        res.status(500).json({ message: `Failed to save ${sheetName.slice(0, -1)}` });
    }
}

app.post('/api/saveDraft', (req, res) => saveOrSubmit('Drafts', req.body, res));
app.post('/api/submitChecklist', (req, res) => saveOrSubmit('Completed', req.body, res));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});