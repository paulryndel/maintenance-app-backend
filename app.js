require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

// Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.post('/api/uploadImage', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
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
        const rows = response.data.values || [];
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
    } catch (e) {
        console.error('Login error:', e);
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
        const customersHeader = customersRes.data.values?.[0] || [];
        const customers = (customersRes.data.values || []).slice(1).map(r => {
            const o = {}; customersHeader.forEach((h,i)=>o[h]=r[i]); return o;
        });
        const draftHeader = draftsRes.data.values?.[0] || [];
        const drafts = (draftsRes.data.values || []).slice(1)
            .filter(r => r[draftHeader.indexOf('TechnicianID')] === technicianId)
            .map(r => {
                const o={}; draftHeader.forEach((h,i)=> {
                    try { o[h]=JSON.parse(r[i]); } catch { o[h]=r[i]; }
                }); return o;
            });
        const completedHeader = completedRes.data.values?.[0] || [];
        const completed = (completedRes.data.values || []).slice(1)
            .filter(r => r[completedHeader.indexOf('TechnicianID')] === technicianId)
            .map(r => {
                const o={}; completedHeader.forEach((h,i)=>o[h]=r[i]); return o;
            });
        const stats = {
            customersVisited: new Set(completed.map(c => c.CustomerID)).size,
            machinesChecked: completed.length,
            draftsMade: drafts.length
        };
        res.json({ customers, drafts, completed, stats });
    } catch (e) {
        console.error('Error fetching homepage data:', e);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/createCustomer', async (req, res) => {
    const { CustomerName, Country, MachineType, SerialNo } = req.body;
    if (!CustomerName || !Country || !MachineType || !SerialNo)
        return res.status(400).json({ message: 'All fields are required.' });
    try {
        const auth = await getAuthClient();
        const existing = await sheets.spreadsheets.values.get({
            auth, spreadsheetId: SPREADSHEET_ID, range: 'Customers!A:A'
        });
        const newID = `CUST${1000 + ((existing.data.values || []).length)}`;
        await sheets.spreadsheets.values.append({
            auth, spreadsheetId: SPREADSHEET_ID, range: 'Customers!A1',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[newID, CustomerName, Country, MachineType, SerialNo]] }
        });
        res.status(201).json({ message: 'Customer created', customerID: newID });
    } catch (e) {
        console.error('Error creating customer:', e);
        res.status(500).json({ message: 'Failed to create customer.' });
    }
});

async function saveOrSubmit(sheetName, data, res) {
    try {
        const auth = await getAuthClient();
        const headerRes = await sheets.spreadsheets.values.get({
            auth, spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1:AZ1`
        });
        const headers = headerRes.data.values[0];
        Object.keys(data).forEach(k => {
            if (typeof data[k] === 'object' && data[k] !== null) data[k] = JSON.stringify(data[k]);
        });
        const row = headers.map(h => data[h] || '');

        if (sheetName === 'Drafts' && data.DraftID) {
            const all = await sheets.spreadsheets.values.get({
                auth, spreadsheetId: SPREADSHEET_ID, range: 'Drafts'
            });
            const draftHeader = all.data.values[0];
            const idxCol = draftHeader.indexOf('DraftID');
            const rowIndex = all.data.values.findIndex(r => r[idxCol] === data.DraftID);
            if (rowIndex > 0) {
                await sheets.spreadsheets.values.update({
                    auth, spreadsheetId: SPREADSHEET_ID,
                    range: `Drafts!A${rowIndex + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [row] }
                });
                return res.json({ message: 'Draft updated', draftID: data.DraftID });
            }
        }

        if (sheetName === 'Drafts' && !data.DraftID) {
            const idSource = await sheets.spreadsheets.values.get({
                auth, spreadsheetId: SPREADSHEET_ID, range: 'Drafts!A:A'
            });
            const newDraftID = `DRAFT${1000 + ((idSource.data.values || []).length)}`;
            row[headers.indexOf('DraftID')] = newDraftID;
            data.DraftID = newDraftID;
        }

        await sheets.spreadsheets.values.append({
            auth, spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        });

        res.status(201).json({ message: `${sheetName.slice(0,-1)} saved`, draftID: data.DraftID });
    } catch (e) {
        console.error(`Error saving to ${sheetName}:`, e);
        res.status(500).json({ message: `Failed to save ${sheetName.slice(0,-1)}` });
    }
}

app.post('/api/saveDraft', (req, res) => saveOrSubmit('Drafts', req.body, res));
app.post('/api/submitChecklist', (req, res) => saveOrSubmit('Completed', req.body, res));

app.listen(PORT, () => {
    console.log(`Server running http://localhost:${PORT}`);
});