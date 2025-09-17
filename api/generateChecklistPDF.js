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
                doc.fontSize(28).font('Helvetica-Bold').fillColor('white')
                   .text('MAINTENANCE CHECKLIST', 60, 75, { align: 'center', width: 475 });
                   
                doc.fontSize(12).font('Helvetica').fillColor('white')
                   .text(`Report ID: ${checklist.ChecklistID}`, 60, 105, { align: 'center', width: 475 });
            }
            
            function drawEquipmentInfo() {
                const startY = 160;
                
                // Section header
                doc.fontSize(18).font('Helvetica-Bold').fillColor(primaryColor)
                   .text('EQUIPMENT INFORMATION', 50, startY);
                   
                drawBox(50, startY + 25, 495, 2, primaryColor);
                
                // Equipment details in a nice grid
                const fields = [
                    { label: 'Customer Name', value: checklist.CustomerName || checklist.Customer || checklist.CustomerID || 'Not specified' },
                    { label: 'Equipment Model', value: checklist.Model || checklist.EquipmentModel || 'Not specified' },
                    { label: 'Serial Number', value: checklist.SerialNumber || checklist.Serial || 'Not specified' },
                    { label: 'Technician', value: checklist.TechnicianName || checklist.Technician || checklist.TechnicianID || 'Not specified' },
                    { label: 'Date', value: checklist.Date || new Date().toLocaleDateString() },
                    { label: 'Location', value: checklist.Location || 'Not specified' }
                ];
                
                let currentY = startY + 40;
                for (let i = 0; i < fields.length; i += 2) {
                    // Left column
                    drawBox(50, currentY, 240, 40, lightGray);
                    doc.fontSize(10).font('Helvetica-Bold').fillColor(secondaryColor)
                       .text(fields[i].label.toUpperCase(), 60, currentY + 8);
                    doc.fontSize(12).font('Helvetica').fillColor('#1f2937')
                       .text(fields[i].value, 60, currentY + 22);
                    
                    // Right column (if exists)
                    if (fields[i + 1]) {
                        drawBox(305, currentY, 240, 40, lightGray);
                        doc.fontSize(10).font('Helvetica-Bold').fillColor(secondaryColor)
                           .text(fields[i + 1].label.toUpperCase(), 315, currentY + 8);
                        doc.fontSize(12).font('Helvetica').fillColor('#1f2937')
                           .text(fields[i + 1].value, 315, currentY + 22);
                    }
                    
                    currentY += 50;
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
                
                // Process checklist items
                Object.entries(checklist).forEach(([key, value]) => {
                    // Skip metadata fields
                    if (['ChecklistID', 'CustomerID', 'TechnicianID', 'CustomerName', 'Model', 'SerialNumber', 'TechnicianName', 'Date', 'Location'].includes(key)) {
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
                    drawBox(50, currentY, 495, 45, '#ffffff');
                    
                    // Item label
                    doc.fontSize(12).font('Helvetica-Bold').fillColor('#374151')
                       .text(formatFieldName(key), 60, currentY + 10);
                    
                    // Item value/status
                    let itemValue = value;
                    let valueColor = '#1f2937';
                    
                    // Special formatting for different types of values
                    if (typeof value === 'boolean') {
                        itemValue = value ? '✓ PASSED' : '✗ FAILED';
                        valueColor = value ? '#059669' : '#dc2626';
                    } else if (value && value.toString().toLowerCase().includes('photo')) {
                        itemValue = `${value} (See Photo ${photoRefIndex} on page ${getPhotoPageNumber()})`;
                        valueColor = accentColor;
                        photoRefIndex++;
                    }
                    
                    doc.fontSize(11).font('Helvetica').fillColor(valueColor)
                       .text(itemValue.toString() || 'Not checked', 60, currentY + 28, { width: 420 });
                    
                    // Add checkbox or status indicator
                    if (typeof value === 'boolean') {
                        const checkboxX = 500;
                        const checkboxY = currentY + 15;
                        drawBox(checkboxX, checkboxY, 15, 15, value ? '#059669' : '#dc2626');
                        if (value) {
                            doc.fontSize(12).font('Helvetica-Bold').fillColor('white')
                               .text('✓', checkboxX + 3, checkboxY + 1);
                        } else {
                            doc.fontSize(12).font('Helvetica-Bold').fillColor('white')
                               .text('✗', checkboxX + 3, checkboxY + 1);
                        }
                    }
                    
                    currentY += 50;
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
                
                photos.forEach((photo, idx) => {
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
