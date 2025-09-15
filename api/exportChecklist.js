const generateChecklistPDF = require('./generateChecklistPDF');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

module.exports.config = {
    api: {
        bodyParser: false,
    },
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }
    const form = formidable({ multiples: true });
    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(400).json({ status: 'error', message: 'Form parse error.' });
        }
        // Checklist data
        const checklist = JSON.parse(fields.checklist || '{}');
        // Uploaded photos
        const photos = [];
        if (files.photos) {
            const photoFiles = Array.isArray(files.photos) ? files.photos : [files.photos];
            for (const file of photoFiles) {
                const photoPath = path.join('/tmp', file.newFilename);
                fs.renameSync(file.filepath, photoPath);
                photos.push({ url: photoPath, description: file.originalFilename });
            }
        }
        // Generate PDF
        const pdfPath = path.join('/tmp', `Checklist_${Date.now()}.pdf`);
        generateChecklistPDF(checklist, photos, pdfPath);
        // Wait for PDF to finish writing
        setTimeout(() => {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=Checklist.pdf');
            fs.createReadStream(pdfPath).pipe(res);
        }, 1000);
    });
};
