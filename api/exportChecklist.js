const generateChecklistPDF = require('./generateChecklistPDF');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const os = require('os');
const formidable = require('formidable');

// Utility: safely unlink a file if it exists
function safeUnlink(filePath) {
    if (!filePath) return;
    fs.promises.unlink(filePath).catch(() => {/* ignore */});
}

// Utility: parse request body if not already parsed
async function parseBody(req) {
    if (req.body !== undefined) {
        console.log('[PDF Export] Body already parsed by framework:', req.body);
        return req.body;
    }
    
    // Check if it's multipart/form-data
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        console.log('[PDF Export] Detected multipart/form-data, using formidable...');
        return parseMultipartForm(req);
    }
    
    return new Promise((resolve) => {
        let body = '';
        console.log('[PDF Export] Manually parsing request body...');
        req.on('data', chunk => {
            body += chunk.toString();
            console.log('[PDF Export] Received chunk:', chunk.toString());
        });
        req.on('end', () => {
            console.log('[PDF Export] Raw body string:', body);
            try {
                const parsed = body ? JSON.parse(body) : {};
                console.log('[PDF Export] Parsed body:', parsed);
                resolve(parsed);
            } catch (e) {
                console.log('[PDF Export] JSON parse error:', e.message);
                console.log('[PDF Export] Trying to parse as URL encoded...');
                // Try URL encoded parsing
                const urlencoded = new URLSearchParams(body);
                const result = Object.fromEntries(urlencoded);
                console.log('[PDF Export] URL encoded result:', result);
                resolve(result);
            }
        });
    });
}

// Utility: parse multipart form data
async function parseMultipartForm(req) {
    return new Promise((resolve, reject) => {
        const form = formidable({
            multiples: true,
            keepExtensions: true
        });
        
        form.parse(req, (err, fields, files) => {
            if (err) {
                console.log('[PDF Export] Formidable parse error:', err);
                resolve({});
                return;
            }
            
            console.log('[PDF Export] Formidable fields:', fields);
            console.log('[PDF Export] Formidable files:', Object.keys(files));
            
            // Flatten the fields (formidable returns arrays)
            const flatFields = {};
            Object.keys(fields).forEach(key => {
                const value = fields[key];
                flatFields[key] = Array.isArray(value) ? value[0] : value;
            });
            
            console.log('[PDF Export] Flattened fields:', flatFields);
            resolve(flatFields);
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
        console.log(`[PDF Export] GET query params:`, req.query);
        if (!checklistId) {
            console.error('[PDF Export] Missing checklistId parameter in GET request');
            return res.status(400).json({ status: 'error', message: 'Missing required parameter: checklistId' });
        }
    } else if (req.method === 'POST') {
        // Parse body if not already parsed by Vercel
        req.body = await parseBody(req);
        
        // Handle POST request - try to extract checklistId from multiple possible sources
        console.log('[PDF Export] === POST REQUEST DEBUGGING ===');
        console.log('[PDF Export] Headers:', JSON.stringify(req.headers, null, 2));
        console.log('[PDF Export] Content-Type:', req.headers['content-type']);
        console.log('[PDF Export] POST body type:', typeof req.body);
        console.log('[PDF Export] POST body received:', JSON.stringify(req.body, null, 2));
        console.log('[PDF Export] POST body keys:', Object.keys(req.body || {}));
        console.log('[PDF Export] Query params:', JSON.stringify(req.query || {}, null, 2));
        console.log('[PDF Export] URL:', req.url);
        
        // Also check if data might be in query params for some reason
        if (req.query && Object.keys(req.query).length > 0) {
            console.log('[PDF Export] Found data in query params, checking for checklistId...');
        }
        
        // Ensure req.body exists, if not initialize as empty object
        if (!req.body) {
            req.body = {};
            console.log('[PDF Export] POST body was undefined, initialized as empty object');
        }
        
        checklistId = req.body?.checklistId || 
                     req.body?.ChecklistID || 
                     req.body?.id || 
                     req.body?.ID ||
                     req.body?.checklist?.ChecklistID ||
                     req.body?.checklist?.checklistId ||
                     req.body?.checklist?.id ||
                     req.query?.checklistId ||  // Fallback to query params
                     req.query?.ChecklistID ||
                     req.query?.id;
        
        console.log(`[PDF Export] Extracted checklistId: ${checklistId}`);
        
        // If still no checklistId found, try to extract from nested data
        if (!checklistId && req.body?.checklist) {
            try {
                const checklistData = typeof req.body.checklist === 'string' 
                    ? JSON.parse(req.body.checklist) 
                    : req.body.checklist;
                checklistId = checklistData?.ChecklistID || checklistData?.checklistId || checklistData?.id;
            } catch (e) {
                console.log('[PDF Export] Failed to parse nested checklist data:', e.message);
            }
        }
        
        // If still no ID, try to find any field that looks like an ID
        if (!checklistId && req.body && typeof req.body === 'object') {
            const possibleIds = Object.entries(req.body).find(([key, value]) => 
                key.toLowerCase().includes('id') && value && typeof value === 'string'
            );
            if (possibleIds) {
                checklistId = possibleIds[1];
                console.log(`[PDF Export] Using fallback ID from field '${possibleIds[0]}': ${checklistId}`);
            }
        }
        
        console.log(`[PDF Export] Extracted checklistId: ${checklistId}`);
        
        if (!checklistId) {
            console.error('[PDF Export] Missing checklistId in POST body');
            console.error('[PDF Export] Available fields in body:', Object.keys(req.body));
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

        // Find the checklist by ID
        const headers = rows[0];
        console.log(`[PDF Export] Sheet headers:`, headers);
        
        const checklistRow = rows.find(row => row[0] === checklistId); // Assuming ChecklistID is in first column
        if (!checklistRow) {
            console.error(`[PDF Export] Checklist not found: ${checklistId}`);
            return res.status(404).json({ status: 'error', message: `Checklist ${checklistId} not found in completed records` });
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
        const enhancedChecklist = {
            ...checklist,
            ChecklistID: checklist.ChecklistID || checklist.checklistId || checklistId,
            CustomerName: checklist.CustomerName || checklist.Customer || checklist.customerName || 'Unknown Customer',
            TechnicianName: checklist.TechnicianName || checklist.Technician || checklist.technicianName || 'Unknown Technician',
            Date: checklist.Date || checklist.date || new Date().toLocaleDateString(),
            Model: checklist.Model || checklist.model || checklist.EquipmentModel || 'Not specified',
            SerialNumber: checklist.SerialNumber || checklist.serialNumber || checklist.Serial || 'Not specified',
            Location: checklist.Location || checklist.location || 'Not specified'
        };

        console.log(`[PDF Export] Enhanced checklist data:`, JSON.stringify(enhancedChecklist, null, 2));

        // For now, no photos since they're not stored in sheets
        // TODO: Implement photo retrieval if photos are stored separately
        const photos = [];

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
