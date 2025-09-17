const PDFDocument = require('pdfkit');
const fs = require('fs');

/**
 * Generate a professional maintenance checklist PDF
 * @param {Object} checklist - Checklist data
 * @param {Array} photos - Array of photo objects { url, description }
 * @param {string} outputPath - Path to save the PDF
 */
function generateChecklistPDF(checklist, photos, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                margin: 50, 
                size: 'A4',
                info: {
                    Title: `Maintenance Checklist - ${checklist.ChecklistID}`,
                    Author: 'Maintenance App',
                    Subject: 'Equipment Maintenance Report'
                }
            });
            const writeStream = fs.createWriteStream(outputPath);
            writeStream.on('finish', () => resolve());
            writeStream.on('error', (err) => reject(err));
            doc.pipe(writeStream);

            // Colors and styling
            const primaryColor = '#2563eb';
            const secondaryColor = '#64748b';
            const accentColor = '#f59e0b';
            const lightGray = '#f8fafc';
            
            // Helper functions
            function drawBox(x, y, width, height, fillColor = null, strokeColor = '#e2e8f0') {
                if (fillColor) {
                    doc.rect(x, y, width, height).fillAndStroke(fillColor, strokeColor);
                } else {
                    doc.rect(x, y, width, height).stroke(strokeColor);
                }
            }
            
            function drawHeader() {
                     // Header background
                     drawBox(50, 50, 495, 80, primaryColor);
                     // Title
                     doc.fontSize(18).font('Helvetica-Bold').fillColor('white')
                         .text('MAINTENANCE CHECKLIST', 60, 75, { align: 'center', width: 475 });
                     doc.fontSize(9).font('Helvetica').fillColor('white')
                         .text(`Report ID: ${checklist.ChecklistID}`, 60, 105, { align: 'center', width: 475 });
            }
            
            function drawEquipmentInfo() {
                const startY = 160;
                
                // Section header
                     doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor)
                         .text('EQUIPMENT INFORMATION', 50, startY);
                     drawBox(50, startY + 25, 495, 2, primaryColor);
                     // Equipment details in a nice grid
                    // Always show these fields in this order
                    const fields = [
                        { label: 'Customer', value: checklist.CustomerName || 'Not specified' },
                        { label: 'Location', value: checklist.Country || 'Not specified' },
                        { label: 'Equipment Model', value: checklist.MachineType || 'Not specified' },
                        { label: 'Serial Number', value: checklist.SerialNo || 'Not specified' },
                    ];
                    // Add technician and date below
                    const extraFields = [
                        { label: 'Technician', value: checklist.TechnicianName || 'Not specified' },
                        { label: 'Date', value: checklist.Date || new Date().toLocaleDateString() }
                    ];
                         let currentY = startY + 40;
                         for (let i = 0; i < fields.length; i += 2) {
                              // Left column
                              drawBox(50, currentY, 240, 30, lightGray);
                              doc.fontSize(8).font('Helvetica-Bold').fillColor(secondaryColor)
                                  .text(fields[i].label.toUpperCase(), 60, currentY + 4);
                              doc.fontSize(9).font('Helvetica').fillColor('#1f2937')
                                  .text(fields[i].value, 60, currentY + 14);
                              // Right column (if exists)
                              if (fields[i + 1]) {
                                    drawBox(305, currentY, 240, 30, lightGray);
                                    doc.fontSize(8).font('Helvetica-Bold').fillColor(secondaryColor)
                                        .text(fields[i + 1].label.toUpperCase(), 315, currentY + 4);
                                    doc.fontSize(9).font('Helvetica').fillColor('#1f2937')
                                        .text(fields[i + 1].value, 315, currentY + 14);
                              }
                              currentY += 35;
                         }
                         // Extra fields (technician, date)
                         for (let i = 0; i < extraFields.length; i += 2) {
                              drawBox(50, currentY, 240, 30, lightGray);
                              doc.fontSize(8).font('Helvetica-Bold').fillColor(secondaryColor)
                                  .text(extraFields[i].label.toUpperCase(), 60, currentY + 4);
                              doc.fontSize(9).font('Helvetica').fillColor('#1f2937')
                                  .text(extraFields[i].value, 60, currentY + 14);
                              if (extraFields[i + 1]) {
                                    drawBox(305, currentY, 240, 30, lightGray);
                                    doc.fontSize(8).font('Helvetica-Bold').fillColor(secondaryColor)
                                        .text(extraFields[i + 1].label.toUpperCase(), 315, currentY + 4);
                                    doc.fontSize(9).font('Helvetica').fillColor('#1f2937')
                                        .text(extraFields[i + 1].value, 315, currentY + 14);
                              }
                              currentY += 35;
                         }
                         return currentY;
            }
            
            function drawChecklistItems(startY) {
                // Section header
                doc.fontSize(18).font('Helvetica-Bold').fillColor(primaryColor)
                   .text('CHECKLIST ITEMS', 50, startY);
                   
                drawBox(50, startY + 25, 495, 2, primaryColor);
                
                let currentY = startY + 40;
                let photoRefIndex = 1;
                let itemCount = 0;
                
                // Checklist result code mapping
                const codeMap = { N: 'Normal', A: 'Adjusted', C: 'Clean', R: 'Replace', I: 'Improve' };

                // Table header
                drawBox(50, currentY, 495, 30, lightGray);
                     doc.fontSize(9).font('Helvetica-Bold').fillColor(primaryColor)
                         .text('Item', 60, currentY + 8)
                         .text('Status', 300, currentY + 8)
                         .text('Result', 400, currentY + 8);
                     currentY += 25;

                // Process checklist items
                Object.entries(checklist).forEach(([key, value]) => {
                    // Skip metadata fields
                    if ([
                        'ChecklistID', 'CustomerID', 'TechnicianID', 'CustomerName', 'MachineType', 'SerialNo',
                        'TechnicianName', 'Date', 'Country', 'Review', 'Notes', 'Photos', 'Photo', 'Equipment Model', 'Serial Number', 'Technician', 'Customer', 'Location', 'Model', 'SerialNumber'
                    ].includes(key)) {
                        return;
                    }
                    // Skip empty or null values
                    if (value === null || value === undefined || value === '') {
                        return;
                    }
                    itemCount++;
                    // Check if we need a new page
                    if (currentY > 700) {
                        doc.addPage();
                        currentY = 50;
                    }
                    // Item box with fixed height
                    drawBox(50, currentY, 495, 20, '#ffffff');
                    // Item label
                    doc.fontSize(8).font('Helvetica').fillColor('#374151')
                       .text(formatFieldName(key), 60, currentY + 4, { width: 180 });
                    // Status and Result columns
                    let statusText = 'N/A';
                    let resultText = '';
                    let parsed = value;
                    if (typeof value === 'string' && value.trim().startsWith('{')) {
                        try {
                            parsed = JSON.parse(value);
                        } catch (e) { /* not JSON */ }
                    }
                    if (parsed && typeof parsed === 'object') {
                        // Status
                        if (parsed.status) {
                            const codes = parsed.status.split(/[, ]+/).filter(Boolean);
                            statusText = codes.map(code => codeMap[code] || code).join(', ');
                        }
                        // Result
                        if (parsed.result) {
                            resultText = parsed.result;
                        }
                    } else if (typeof value === 'string') {
                        // If value is a code string
                        const codes = value.split(/[, ]+/).filter(Boolean);
                        if (codes.length > 0 && codes.some(code => codeMap[code])) {
                            statusText = codes.map(code => codeMap[code] || code).join(', ');
                        }
                    }
                        doc.fontSize(8).font('Helvetica-Bold').fillColor('#1f2937')
                       .text(statusText, 300, currentY + 4, { width: 90 })
                       .text(resultText || 'N/A', 400, currentY + 4, { width: 130 });
                    currentY += 20;
                });
                
                // If no checklist items were found, show a message
                if (itemCount === 0) {
                    drawBox(50, currentY, 495, 60, '#f9fafb');
                    doc.fontSize(14).font('Helvetica-Oblique').fillColor('#9ca3af')
                       .text('No checklist items found in the submitted data.', 60, currentY + 20, { 
                           width: 475, 
                           align: 'center' 
                       });
                    doc.fontSize(12).font('Helvetica').fillColor('#6b7280')
                       .text('Please ensure checklist data is properly submitted with the request.', 60, currentY + 40, { 
                           width: 475, 
                           align: 'center' 
                       });
                    currentY += 70;
                }
                
                return currentY;
            }
            
            function drawSummarySection(startY) {
                // Check if we need a new page
                if (startY > 600) {
                    doc.addPage();
                    startY = 50;
                }
                
                // Section header
                doc.fontSize(18).font('Helvetica-Bold').fillColor(primaryColor)
                   .text('TECHNICIAN REVIEW', 50, startY);
                   
                drawBox(50, startY + 25, 495, 2, primaryColor);
                
                // Review box
                drawBox(50, startY + 40, 495, 100, '#f9fafb');
                
                doc.fontSize(12).font('Helvetica').fillColor('#374151');
                if (checklist.review || checklist.Review || checklist.notes || checklist.Notes) {
                    const reviewText = checklist.review || checklist.Review || checklist.notes || checklist.Notes;
                    doc.text(reviewText, 60, startY + 55, { width: 475, align: 'left' });
                } else {
                    doc.font('Helvetica-Oblique').fillColor('#9ca3af')
                       .text('No review comments provided.', 60, startY + 80, { width: 475, align: 'center' });
                }
                
                // Signature section
                const sigY = startY + 170;
                drawBox(50, sigY, 240, 60, '#ffffff');
                drawBox(305, sigY, 240, 60, '#ffffff');
                
                doc.fontSize(10).font('Helvetica-Bold').fillColor(secondaryColor)
                   .text('TECHNICIAN SIGNATURE', 60, sigY + 10)
                   .text('DATE COMPLETED', 315, sigY + 10);
                   
                doc.fontSize(12).font('Helvetica').fillColor('#1f2937')
                   .text(checklist.TechnicianName || checklist.Technician || checklist.TechnicianID || '', 60, sigY + 35)
                   .text(checklist.Date || new Date().toLocaleDateString(), 315, sigY + 35);
                
                return sigY + 80;
            }
            
            function drawPhotosSection() {
                if (!photos || photos.length === 0) return;
                
                doc.addPage();
                
                // Photos section header
                doc.fontSize(24).font('Helvetica-Bold').fillColor(primaryColor)
                   .text('PHOTOGRAPHIC DOCUMENTATION', 50, 50, { align: 'center', width: 495 });
                   
                drawBox(50, 85, 495, 2, primaryColor);
                
                let currentY = 110;
                let photoNum = 1;
                
                // Deduplicate photos by file path
                const seen = new Set();
                photos.forEach((photo, idx) => {
                    if (seen.has(photo.url)) return;
                    seen.add(photo.url);
                    try {
                        // Check if we need a new page
                        if (currentY > 500) {
                            doc.addPage();
                            currentY = 50;
                        }
                        
                        // Photo header
                        drawBox(50, currentY, 495, 30, lightGray);
                        doc.fontSize(14).font('Helvetica-Bold').fillColor('#374151')
                           .text(`Photo ${photoNum}: ${photo.description || 'Equipment Documentation'}`, 60, currentY + 8);
                        
                        currentY += 40;
                        
                        // Photo image
                        if (photo.url && fs.existsSync(photo.url)) {
                            const imageWidth = 400;
                            const imageHeight = 300;
                            const imageX = (595 - imageWidth) / 2; // Center on page
                            
                            drawBox(imageX - 5, currentY - 5, imageWidth + 10, imageHeight + 10, '#ffffff');
                            doc.image(photo.url, imageX, currentY, { 
                                fit: [imageWidth, imageHeight],
                                align: 'center'
                            });
                            currentY += imageHeight + 30;
                        } else {
                            // Placeholder for missing image
                            drawBox(97.5, currentY, 400, 200, '#f3f4f6');
                            doc.fontSize(14).font('Helvetica-Oblique').fillColor('#9ca3af')
                               .text('Image not available', 97.5, currentY + 95, { 
                                   width: 400, 
                                   align: 'center' 
                               });
                            currentY += 230;
                        }
                        
                        photoNum++;
                    } catch (imgErr) {
                        console.error(`Error processing photo ${idx + 1}:`, imgErr);
                        // Error placeholder
                        drawBox(97.5, currentY, 400, 100, '#fee2e2');
                        doc.fontSize(12).font('Helvetica').fillColor('#dc2626')
                           .text(`Error loading Photo ${photoNum}`, 97.5, currentY + 45, { 
                               width: 400, 
                               align: 'center' 
                           });
                        currentY += 120;
                        photoNum++;
                    }
                });
            }
            
            function drawFooter() {
                // Get current page and add footer before ending document
                const currentPage = doc.bufferedPageRange().start;
                const pageCount = doc.bufferedPageRange().count;
                
                // Add footer to current page
                doc.fontSize(9).font('Helvetica').fillColor(secondaryColor);
                
                // Footer line
                drawBox(50, 770, 495, 1, secondaryColor);
                
                // Footer text
                doc.text('Generated by Maintenance Management System', 50, 780)
                   .text(`Page 1 of ${pageCount}`, 450, 780, { width: 95, align: 'right' })
                   .text(`Generated on ${new Date().toLocaleString()}`, 50, 790);
            }
            
            function formatFieldName(fieldName) {
                return fieldName
                    .replace(/([A-Z])/g, ' $1')
                    .replace(/^./, str => str.toUpperCase())
                    .trim();
            }
            
            function getPhotoPageNumber() {
                // Estimate which page photos will start on (simplified)
                return 2; // Photos typically start on page 2 or 3
            }
            
            // Generate the PDF
            drawHeader();
            const equipmentY = drawEquipmentInfo();
            const checklistY = drawChecklistItems(equipmentY + 30);
            drawSummarySection(checklistY + 30);
            drawPhotosSection();
            drawFooter();
            
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = generateChecklistPDF;
