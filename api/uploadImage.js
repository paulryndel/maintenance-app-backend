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
        return response.status(405).send('Method Not Allowed');
    }

    try {
        // 1. Authenticate with Google
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            // We need permission to upload files to Google Drive
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // 2. Parse the incoming file from the request
        const form = formidable({});
        const [fields, files] = await form.parse(request);

        const imageFile = files.image?.[0];

        if (!imageFile) {
            return response.status(400).json({ error: 'No image file uploaded.' });
        }

        // 3. Prepare file metadata for Google Drive
        const fileMetadata = {
            name: `${Date.now()}-${imageFile.originalFilename}`,
            // IMPORTANT: For better organization, create a folder in your Google Drive
            // and put its ID here. e.g., parents: ['YOUR_FOLDER_ID_HERE']
            parents: ['1UQL31Mfv8-0FYa7trV1h4tXb8RHDqKQv'] // <-- PASTE YOUR FOLDER ID HERE
        };

        const media = {
            mimeType: imageFile.mimetype,
            body: fs.createReadStream(imageFile.filepath),
        };

        // 4. Upload the file to Google Drive
        const file = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
            // Add this line to enable Shared Drive support
            supportsAllDrives: true,
        });

        // 5. Make the file publicly readable
        await drive.permissions.create({
            fileId: file.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        // 6. Send the public link back to the frontend
        response.status(200).json({
            message: 'File uploaded successfully',
            url: file.data.webViewLink,
        });

    } catch (error) {
        console.error('Error uploading to Google Drive:', error);
        // Send a more detailed error message back to the client for debugging
        response.status(500).json({ 
            error: 'A server error occurred during file upload.', 
            // Include details from the actual error object
            details: error.message,
            // Include the error code if it's a Google API error
            code: error.code 
        });
    }
};