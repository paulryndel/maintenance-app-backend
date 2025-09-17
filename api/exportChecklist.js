const generateChecklistPDF = require('./generateChecklistPDF');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const os = require('os');
const formidable = require('formidable');
const { IncomingForm } = formidable;

// Utility: safely unlink a file if it exists
function safeUnlink(filePath) {
    if (!filePath) return;
    fs.promises.unlink(filePath).catch(() => {/* ignore */});
}

// Utility: parse request body if not already parsed
async function parseBody(req) {
    if (req.body !== undefined) {
        return req.body;
    }
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        return new Promise((resolve, reject) => {
            const form = new IncomingForm();
            form.parse(req, (err, fields) => {
                if (err) reject(err);
                else resolve(fields);
            });
        });
    }
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const parsed = body ? JSON.parse(body) : {};
                resolve(parsed);
            } catch (e) {
                // Try URL encoded parsing
                const urlencoded = new URLSearchParams(body);
                const result = Object.fromEntries(urlencoded);
                resolve(result);
            }
        });
    });
}

// Enable JSON body parsing for this endpoint
module.exports.config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
    },
};

// Google Sheets configuration (same as main app)
const sheets = google.sheets('v4');
const SHEET_NAMES = {
    COMPLETED: process.env.SHEET_COMPLETED || 'FilterTester'
};

const SERVICE_ACCOUNT_EMAIL = process.env.GCP_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let SERVICE_ACCOUNT_KEY = process.env.GCP_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '';
if (SERVICE_ACCOUNT_KEY) {
    SERVICE_ACCOUNT_KEY = SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n');
}
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

async function getAuthClient() {
    if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY) {
        throw new Error('Missing Google Cloud credentials');
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

module.exports = async (req, res) => {
    const startTime = Date.now();
    console.log(`[PDF Export] Starting export request at ${new Date().toISOString()}`);
    console.log(`[PDF Export] Method: ${req.method}`);
    console.log(`[PDF Export] Headers:`, req.headers);
    
    if (req.method !== 'GET' && req.method !== 'POST') {
        console.log(`[PDF Export] Method not allowed: ${req.method}`);
        return res.status(405).send('Method Not Allowed - Use GET with checklistId parameter or POST');
    }

    let checklistId;
    
    // Handle both GET and POST methods
    if (req.method === 'GET') {
        checklistId = req.query.checklistId;
        if (!checklistId) {
            return res.status(400).json({ status: 'error', message: 'Missing required parameter: checklistId' });
        }
    } else if (req.method === 'POST') {
        req.body = await parseBody(req);
        checklistId = req.body.checklistId || (req.body.checklist && (req.body.checklist.ChecklistID || req.body.checklist.checklistId || req.body.checklist.id));
        if (!checklistId) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing required field: checklistId. Please include checklistId in the request body.',
                receivedFields: Object.keys(req.body || {}),
                receivedData: req.body,
                hint: 'Send as: {"checklistId": "YOUR_CHECKLIST_ID"}'
            });
        }
    }

    console.log(`[PDF Export] Fetching checklist data for ID: ${checklistId}`);

    try {
        // Get authentication client
        const auth = await getAuthClient();
        
        // Fetch data from FilterTester sheet
        console.log(`[PDF Export] Reading from sheet: ${SHEET_NAMES.COMPLETED}`);
        const response = await sheets.spreadsheets.values.get({
            auth,
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAMES.COMPLETED}!A:ZZ`, // Get all columns
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            console.error('[PDF Export] No data found in FilterTester sheet');
            return res.status(404).json({ status: 'error', message: 'No completed checklists found' });
        }

        // Find the checklist by ID (dynamically find the ChecklistID column)
        const headers = rows[0];
        console.log(`[PDF Export] Sheet headers:`, headers);
        // Find the column index for ChecklistID (case-insensitive, fallback to any header containing 'id')
        let idColIndex = headers.findIndex(h => h.trim().toLowerCase() === 'checklistid');
        if (idColIndex === -1) {
            idColIndex = headers.findIndex(h => h.trim().toLowerCase().includes('id'));
        }
        if (idColIndex === -1) {
            console.error('[PDF Export] Could not find ChecklistID column in sheet headers:', headers);
            return res.status(500).json({ status: 'error', message: 'Could not find ChecklistID column in sheet headers', headers });
        }
        console.log(`[PDF Export] Using ChecklistID column index: ${idColIndex} (header: ${headers[idColIndex]})`);
        const allIds = rows.slice(1).map(row => row[idColIndex]);
        console.log(`[PDF Export] All checklist IDs in sheet:`, allIds);
        const checklistRow = rows.find((row, idx) => idx > 0 && row[idColIndex] === checklistId);
        if (!checklistRow) {
            console.error(`[PDF Export] Checklist not found: ${checklistId}`);
            // Log all row data for further debugging
            rows.forEach((row, idx) => {
                console.log(`[PDF Export] Row ${idx}:`, row);
            });
            return res.status(404).json({ status: 'error', message: `Checklist ${checklistId} not found in completed records`, allIds });
        }

        console.log(`[PDF Export] Found checklist data:`, checklistRow);

        // Convert row data to checklist object
        const checklist = {};
        headers.forEach((header, index) => {
            if (header && checklistRow[index] !== undefined) {
                checklist[header] = checklistRow[index];
            }
        });

        console.log(`[PDF Export] Converted checklist object:`, JSON.stringify(checklist, null, 2));

        // Enhance checklist data with proper field mapping
        // Fetch CustomerName from CustomerList sheet if CustomerID is present
        let customerName = checklist.CustomerName || checklist.Customer || checklist.customerName || checklist['Customer Name'] || '';
        if (checklist.CustomerID) {
            try {
                const customerListResp = await sheets.spreadsheets.values.get({
                    auth,
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'CustomerList!A:ZZ',
                });
                const customerRows = customerListResp.data.values;
                if (customerRows && customerRows.length > 1) {
                    const customerHeaders = customerRows[0];
                    const idIdx = customerHeaders.findIndex(h => h.trim().toLowerCase() === 'customerid');
                    const nameIdx = customerHeaders.findIndex(h => h.trim().toLowerCase().includes('name'));
                    const found = customerRows.find((row, idx) => idx > 0 && row[idIdx] === checklist.CustomerID);
                    if (found && nameIdx !== -1) {
                        customerName = found[nameIdx];
                    }
                }
            } catch (e) {
                console.error('[PDF Export] Failed to fetch CustomerList sheet:', e);
            }
        }
        const enhancedChecklist = {
            ...checklist,
            ChecklistID: checklist.ChecklistID || checklist.checklistId || checklistId,
            CustomerName: customerName || 'Unknown Customer',
            MachineType: checklist.MachineType || checklist['Equipment Model'] || checklist.Model || checklist.EquipmentModel || 'Not specified',
            SerialNo: checklist.SerialNo || checklist['Serial Number'] || checklist.SerialNumber || checklist.Serial || 'Not specified',
            Country: checklist.Country || checklist.Location || checklist.location || 'Not specified',
            TechnicianName: checklist.TechnicianName || checklist.Technician || checklist.technicianName || 'Unknown Technician',
            Date: checklist.Date || checklist.date || new Date().toLocaleDateString(),
        };

        console.log(`[PDF Export] Enhanced checklist data:`, JSON.stringify(enhancedChecklist, null, 2));


        // Extract status and photos from JSON fields, and download photos
        const photos = [];
        const fetch = require('node-fetch');
        const photoSet = new Set();
        for (const [key, value] of Object.entries(enhancedChecklist)) {
            let parsed = value;
            // Try to parse JSON if value looks like an object
            if (typeof value === 'string' && value.trim().startsWith('{')) {
                try {
                    parsed = JSON.parse(value);
                } catch (e) { /* not JSON */ }
            }
            // If parsed object has photos, download them
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.photos)) {
                for (const url of parsed.photos) {
                    if (photoSet.has(url)) continue;
                    photoSet.add(url);
                    try {
                        const fileIdMatch = url.match(/fileId=([^&]+)/);
                        const fileId = fileIdMatch ? fileIdMatch[1] : Date.now();
                        const imgPath = path.join(os.tmpdir(), `photo_${fileId}_${Date.now()}.jpg`);
                        const resImg = await fetch(url.startsWith('http') ? url : `https://${req.headers.host}${url}`);
                        if (!resImg.ok) throw new Error('Failed to fetch image');
                        const dest = fs.createWriteStream(imgPath);
                        await new Promise((resolve, reject) => {
                            resImg.body.pipe(dest);
                            resImg.body.on('error', reject);
                            dest.on('finish', resolve);
                        });
                        photos.push({ url: imgPath, description: `${key} (photo)` });
                    } catch (err) {
                        console.error(`[PDF Export] Failed to download photo for ${key}:`, err);
                    }
                }
            }
        }

        // Generate PDF
        const pdfPath = path.join(os.tmpdir(), `Checklist_${checklistId}_${Date.now()}.pdf`);
        console.log(`[PDF Export] Generating PDF at: ${pdfPath}`);

        await generateChecklistPDF(enhancedChecklist, photos, pdfPath);
        console.log(`[PDF Export] PDF generated successfully`);

        // Stream PDF to response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Checklist_${checklistId}.pdf`);
        
        const stream = fs.createReadStream(pdfPath);
        stream.on('error', (streamErr) => {
            console.error('[PDF Export] Stream error:', streamErr);
            if (!res.headersSent) {
                res.status(500).json({ status: 'error', message: 'Failed to read generated PDF.' });
            } else {
                res.end();
            }
            safeUnlink(pdfPath);
        });
        
        stream.on('close', () => {
            safeUnlink(pdfPath);
            const ms = Date.now() - startTime;
            console.log(`[PDF Export] PDF export completed in ${ms}ms (ChecklistID=${checklistId})`);
        });
        
        stream.pipe(res);

    } catch (error) {
        console.error('[PDF Export] Error fetching checklist data:', error);
        console.error('[PDF Export] Error stack:', error.stack);
        if (!res.headersSent) {
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to fetch checklist data from sheet',
                error: error.message 
            });
        }
    }
};
