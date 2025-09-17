const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Test the export endpoint with simulated data
async function testExportEndpoint() {
    // Start the server for testing
    const app = require('../app.js');
    const server = app.listen(3001, () => {
        console.log('Test server started on port 3001');
    });

    try {
        // Create form data similar to what frontend would send
        const form = new FormData();
        
        // Test checklist data
        const checklistData = {
            ChecklistID: 'TEST-001',
            CustomerName: 'Test Customer Inc',
            Model: 'TestModel-2000',
            SerialNumber: 'TM2000-123456',
            TechnicianName: 'John Doe',
            Date: '2025-09-17',
            Location: 'Main Factory',
            // Sample checklist items
            oilLevelCheck: true,
            pressureTest: false,
            electricalSafety: true,
            emergencyStop: true,
            generalCondition: 'Good condition, minor wear on components',
            review: 'Equipment passed most checks. Pressure test failed - needs investigation.'
        };
        
        form.append('checklist', JSON.stringify(checklistData));
        
        // Make request to export endpoint
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/exportChecklist',
            method: 'POST',
            headers: form.getHeaders()
        };

        const req = http.request(options, (res) => {
            console.log('Response status:', res.statusCode);
            console.log('Response headers:', res.headers);
            
            if (res.statusCode === 200) {
                const pdfPath = path.join(__dirname, 'test-export.pdf');
                const writeStream = fs.createWriteStream(pdfPath);
                res.pipe(writeStream);
                
                writeStream.on('finish', () => {
                    const stats = fs.statSync(pdfPath);
                    console.log(`✅ PDF exported successfully: ${pdfPath} (${stats.size} bytes)`);
                    server.close();
                });
            } else {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    console.log('❌ Export failed:', data);
                    server.close();
                });
            }
        });

        req.on('error', (e) => {
            console.error('Request error:', e);
            server.close();
        });

        form.pipe(req);
        
    } catch (error) {
        console.error('Test error:', error);
        server.close();
    }
}

// Check if FormData is available
try {
    testExportEndpoint();
} catch (e) {
    console.log('FormData not available, testing basic PDF generation instead...');
    // Just test the PDF generation directly
    const generateChecklistPDF = require('../api/generateChecklistPDF');
    const testData = {
        ChecklistID: 'DIRECT-TEST-001',
        CustomerName: 'Direct Test Customer',
        Model: 'DirectTestModel',
        SerialNumber: 'DTM-123',
        TechnicianName: 'Test Technician',
        oilCheck: true,
        pressureTest: false,
        review: 'Direct test of PDF generation'
    };
    
    generateChecklistPDF(testData, [], path.join(__dirname, 'direct-test.pdf'))
        .then(() => console.log('✅ Direct PDF test successful'))
        .catch(err => console.error('❌ Direct PDF test failed:', err));
}