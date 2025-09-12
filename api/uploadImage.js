const { google } = require('googleapis');
const { formidable } = require('formidable');
const fs = require('fs');

// This config is important for Vercel. It tells it to not use its default
// body parser, so we can parse the file stream with formidable.
module.exports.config = {
    api: {
        bodyParser: false,
    },
};

module.exports = async (request, response) => {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method not allowed' });
    }

    // Parse the incoming form data including file
    const form = formidable({ multiples: true });
    
    try {
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(request, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });
        
        const uploadedFile = files.file;
        if (!uploadedFile) {
            return response.status(400).json({ message: 'No file uploaded' });
        }

        // Set up Google Drive API
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // Read the file into a buffer
        const fileContent = fs.readFileSync(uploadedFile.filepath);

        // Upload to Google Drive
        const file = await drive.files.create({
            requestBody: {
                name: uploadedFile.originalFilename || 'maintenance_photo.jpg',
                mimeType: uploadedFile.mimetype,
                // THIS ID MUST BE FROM A SHARED DRIVE
                parents: ['0AEDpVAfYMWXCUk9PVA'] 
            },
            media: {
                mimeType: uploadedFile.mimetype,
                body: fileContent,
            },
        });

        // Get a direct download URL instead of webViewLink
        const directUrl = `https://drive.google.com/uc?export=view&id=${file.data.id}`;

        // Send the direct URL back to the frontend
        response.status(200).json({
            message: 'File uploaded successfully',
            url: directUrl
        });
    } catch (error) {
        console.error('Upload error:', error);
        response.status(500).json({ message: 'Failed to upload file' });
    }
};