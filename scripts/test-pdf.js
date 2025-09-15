const path = require('path');
const fs = require('fs');
const generateChecklistPDF = require('../api/generateChecklistPDF');

(async () => {
  const sampleChecklist = {
    ChecklistID: 'TEST-123',
    CustomerID: 'CUST-1',
    TechnicianID: 'TECH-9',
    review: 'All systems checked and operating within nominal parameters.'
  };
  const photos = []; // No photos for quick test
  const out = path.join(__dirname, 'sample.pdf');
  try {
    await generateChecklistPDF(sampleChecklist, photos, out);
    const stats = fs.statSync(out);
    console.log('PDF generated:', out, 'size bytes:', stats.size);
  } catch (e) {
    console.error('Failed to generate PDF', e);
    process.exit(1);
  }
})();
