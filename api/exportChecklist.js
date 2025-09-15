const generateChecklistPDF = require('./generateChecklistPDF');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

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
    if (req.method !== 'POST') {
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
        if (err) {
            console.error('Form parse error:', err);
            return res.status(400).json({ status: 'error', message: 'Form parse error.' });
        }

        let checklistRaw = fields.checklist || '{}';
        let checklist;
        try {
            checklist = typeof checklistRaw === 'string' ? JSON.parse(checklistRaw) : checklistRaw;
        } catch (e) {
            return res.status(400).json({ status: 'error', message: 'Invalid checklist JSON.' });
        }

        // Basic required field validation (adjust keys as needed)
        const requiredFields = ['ChecklistID', 'CustomerID', 'TechnicianID'];
        const missing = requiredFields.filter(k => !checklist[k]);
        if (missing.length) {
            return res.status(400).json({ status: 'error', message: `Missing required field(s): ${missing.join(', ')}` });
        }

        // Uploaded photos processing
        const photos = [];
        const tempFiles = []; // track to cleanup
        try {
            if (files.photos) {
                const photoFiles = Array.isArray(files.photos) ? files.photos : [files.photos];
                for (const file of photoFiles) {
                    const photoPath = path.join('/tmp', file.newFilename);
                    fs.renameSync(file.filepath, photoPath);
                    photos.push({ url: photoPath, description: file.originalFilename });
                    tempFiles.push(photoPath);
                }
            }
        } catch (fileErr) {
            console.error('Photo handling error:', fileErr);
            tempFiles.forEach(safeUnlink);
            return res.status(500).json({ status: 'error', message: 'Failed to process uploaded photos.' });
        }

        const pdfPath = path.join('/tmp', `Checklist_${checklist.ChecklistID || Date.now()}.pdf`);
        let pdfGenerated = false;
        try {
            await generateChecklistPDF(checklist, photos, pdfPath);
            pdfGenerated = true;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Checklist_${checklist.ChecklistID || 'export'}.pdf`);
            const stream = fs.createReadStream(pdfPath);
            stream.on('error', (streamErr) => {
                console.error('Stream error:', streamErr);
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
                console.log(`PDF export completed in ${ms}ms (ChecklistID=${checklist.ChecklistID})`);
            });
            stream.pipe(res);
        } catch (pdfErr) {
            console.error('PDF generation error:', pdfErr);
            if (!res.headersSent) {
                res.status(500).json({ status: 'error', message: 'PDF generation failed.' });
            }
            // cleanup even on failure
            if (!pdfGenerated) safeUnlink(pdfPath);
            tempFiles.forEach(safeUnlink);
        }
    });
};
