const path = require('path');
const fs = require('fs');
const generateChecklistPDF = require('../api/generateChecklistPDF');

(async () => {
  const sampleChecklist = {
    ChecklistID: 'MC-2025-001',
    CustomerName: 'ACME Manufacturing Corp',
    Model: 'HydraulicPress-5000X',
    SerialNumber: 'HP5000X-2024-789',
    TechnicianName: 'John Smith, Certified Technician',
    Date: '2025-09-17',
    Location: 'Factory Floor - Section A',
    // Sample checklist items
    oilLevelCheck: '✓ Oil level normal - 85%',
    pressureGaugeReading: '2400 PSI - Within normal range',
    hydraulicHosesInspection: true,
    electricalConnectionsCheck: true,
    safetySystemsTest: false,
    emergencyStopTest: true,
    filterCondition: 'Filter replaced - new filter installed',
    temperatureReading: '68°F - Normal operating temperature',
    noiseLevel: 'Normal operation - no unusual sounds',
    vibrationCheck: true,
    generalCleanliness: true,
    photoDocumentation: 'Multiple photos taken of key components',
    review: 'Equipment inspection completed successfully. All major systems functioning within normal parameters. Hydraulic fluid levels adequate, electrical connections secure. Safety stop button tested and working properly. Recommend next inspection in 6 months. Note: One pressure sensor reading slightly elevated but within acceptable range - monitor during next inspection.'
  };
  
  const samplePhotos = [
    { url: path.join(__dirname, 'sample-photo1.jpg'), description: 'Hydraulic pump and pressure gauge' },
    { url: path.join(__dirname, 'sample-photo2.jpg'), description: 'Control panel and safety systems' },
    { url: path.join(__dirname, 'sample-photo3.jpg'), description: 'Overall equipment condition' }
  ];
  
  const out = path.join(__dirname, 'sample.pdf');
  try {
    console.log('Generating enhanced PDF...');
    await generateChecklistPDF(sampleChecklist, samplePhotos, out);
    const stats = fs.statSync(out);
    console.log('Enhanced PDF generated:', out, 'size bytes:', stats.size);
    console.log('PDF should now include:');
    console.log('- Professional header with company branding');
    console.log('- Equipment information section');
    console.log('- Detailed checklist items with status indicators');
    console.log('- Technician review and signature section');
    console.log('- Photo documentation section with references');
    console.log('- Professional footer with page numbers');
  } catch (e) {
    console.error('Failed to generate PDF', e);
    process.exit(1);
  }
})();
