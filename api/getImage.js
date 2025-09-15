const { google } = require('googleapis');

module.exports = async (request, response) => {
    const { fileId } = request.query;

    if (!fileId || fileId === 'null') {
        // Return a default image or error if fileId is missing/null
        return response.status(400).json({ error: 'File ID is required and cannot be null.' });
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // Set response headers for image content
        response.setHeader('Content-Type', 'image/png'); // Assuming png, adjust if other types are used

        // Get the file media from Google Drive
        const fileResponse = await drive.files.get(
            { fileId: fileId, alt: 'media', supportsAllDrives: true },
            { responseType: 'stream' }
        );

        // Pipe the image stream directly to the client response
        fileResponse.data
            .on('end', () => {
                // Stream finished
                response.end();
            })
            .on('error', (err) => {
                console.error('Error streaming file from Google Drive:', err);
                response.status(500).json({ error: 'Failed to stream file.' });
            })
            .pipe(response);

    } catch (error) {
        console.error('Error fetching image from Google Drive:', error);
        response.status(500).json({ error: 'A server error occurred while fetching the image.' });
    }
};
