const generateChecklistPDF = require('./generateChecklistPDF');
const formidable = require('formidable').formidable;
const fs = require('fs');
const path = require('path');
const os = require('os');

// Utility: safely unlink a file if it exists
function safeUnlink(filePath) {
    if (!filePath) return;
    fs.promises.unlink(filePath).catch(() => {/* ignore */});
}

module.exports.config = {
    api: {
        bodyParser: false,
    },
};

module.exports = async (req, res) => {
    const startTime = Date.now();
    console.log(`[PDF Export] Starting export request at ${new Date().toISOString()}`);
    
    if (req.method !== 'POST') {
        console.log(`[PDF Export] Method not allowed: ${req.method}`);
        return res.status(405).send('Method Not Allowed');
    }

    const form = formidable({
        multiples: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB per photo
        filter: part => {
            if (part.mimetype && !part.mimetype.startsWith('image/')) {
                part.emit('error', new Error('Only image uploads are allowed.'));
                return false;
            }
            return true;
        }
    });

    form.parse(req, async (err, fields, files) => {
        console.log(`[PDF Export] Form parsing completed`);
        console.log(`[PDF Export] Fields received:`, Object.keys(fields));
        console.log(`[PDF Export] Files received:`, Object.keys(files));
        if (err) {
            console.error('[PDF Export] Form parse error:', err);
            return res.status(400).json({ status: 'error', message: 'Form parse error.' });
        }

        let checklistRaw = fields.checklist || '{}';
        // Handle case where formidable returns an array
        if (Array.isArray(checklistRaw)) {
            checklistRaw = checklistRaw[0] || '{}';
        }
        let checklist;
        try {
            checklist = typeof checklistRaw === 'string' ? JSON.parse(checklistRaw) : checklistRaw;
            console.log(`[PDF Export] Checklist parsed successfully:`, Object.keys(checklist));
            console.log(`[PDF Export] Full checklist data:`, JSON.stringify(checklist, null, 2));
        } catch (e) {
            console.error('[PDF Export] JSON parse error:', e);
            console.error('[PDF Export] Raw checklist data:', checklistRaw);
            return res.status(400).json({ status: 'error', message: 'Invalid checklist JSON.' });
        }

        // More flexible field validation - check for variations of field names
        const checklistId = checklist.ChecklistID || checklist.checklistId || checklist.id || checklist.ID || `PDF-${Date.now()}`;
        const customerId = checklist.CustomerID || checklist.customerId || checklist.customer || checklist.Customer || 'Unknown';
        const technicianId = checklist.TechnicianID || checklist.technicianId || checklist.technician || checklist.Technician || 'Unknown';
        
        // Update checklist with normalized field names
        checklist.ChecklistID = checklistId;
        checklist.CustomerID = customerId;
        checklist.TechnicianID = technicianId;
        
        console.log(`[PDF Export] Normalized IDs - Checklist: ${checklistId}, Customer: ${customerId}, Technician: ${technicianId}`);

        // Uploaded photos processing
        const photos = [];
        const tempFiles = []; // track to cleanup
        try {
            if (files.photos) {
                const photoFiles = Array.isArray(files.photos) ? files.photos : [files.photos];
                for (const file of photoFiles) {
                    // Use os.tmpdir() for better cross-platform compatibility
                    const photoPath = path.join(os.tmpdir(), file.newFilename);
                    fs.renameSync(file.filepath, photoPath);
                    photos.push({ url: photoPath, description: file.originalFilename });
                    tempFiles.push(photoPath);
                }
            }
        } catch (fileErr) {
            console.error('[PDF Export] Photo handling error:', fileErr);
            tempFiles.forEach(safeUnlink);
            return res.status(500).json({ status: 'error', message: 'Failed to process uploaded photos.' });
        }

        // Use os.tmpdir() instead of /tmp for better compatibility
        const pdfPath = path.join(os.tmpdir(), `Checklist_${checklist.ChecklistID || Date.now()}.pdf`);
        console.log(`[PDF Export] PDF will be generated at: ${pdfPath}`);
        console.log(`[PDF Export] Processing ${photos.length} photos`);
        let pdfGenerated = false;
        try {
            console.log(`[PDF Export] Starting PDF generation...`);
            await generateChecklistPDF(checklist, photos, pdfPath);
            pdfGenerated = true;
            console.log(`[PDF Export] PDF generated successfully`);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Checklist_${checklist.ChecklistID || 'export'}.pdf`);
            const stream = fs.createReadStream(pdfPath);
            stream.on('error', (streamErr) => {
                console.error('[PDF Export] Stream error:', streamErr);
                if (!res.headersSent) {
                    res.status(500).json({ status: 'error', message: 'Failed to read generated PDF.' });
                } else {
                    res.end();
                }
            });
            stream.on('close', () => {
                // Cleanup after streaming finishes
                safeUnlink(pdfPath);
                tempFiles.forEach(safeUnlink);
                const ms = Date.now() - startTime;
                console.log(`[PDF Export] PDF export completed in ${ms}ms (ChecklistID=${checklist.ChecklistID})`);
            });
            stream.pipe(res);
        } catch (pdfErr) {
            console.error('[PDF Export] PDF generation error:', pdfErr);
            console.error('[PDF Export] Error stack:', pdfErr.stack);
            if (!res.headersSent) {
                res.status(500).json({ status: 'error', message: 'PDF generation failed.', error: pdfErr.message });
            }
            // cleanup even on failure
            if (!pdfGenerated) safeUnlink(pdfPath);
            tempFiles.forEach(safeUnlink);
        }
    });
};
