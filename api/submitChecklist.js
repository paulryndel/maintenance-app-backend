// Import the Google Auth and Google Sheets libraries
const { google } = require('googleapis');

// This is the main function Vercel will run to submit the checklist
module.exports = async (request, response) => {
    // We only want to handle POST requests
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        const data = request.body;

        // --- AUTHENTICATION WITH GOOGLE SHEETS ---
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            // IMPORTANT: The scope must be changed to allow writing to the sheet
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Define the exact order of columns in your 'FilterTester' sheet
        const columnOrder = [
            'CustomerID', 'TechnicianID', 'Technician', 'InspectedDate',
            'Motor_Check', 'Motor_Gear_Oil', 'Motor_Gear_Condition', 'Pump_Seal',
            'Material_Leakage', 'Shaft_Joint', 'Pump_Rotation', 'Motor_Mounting',
            'Filter_Retainer', 'Pump_Cleanliness', 'Shaft_Safety_Pin', 'Heater_Condition',
            'Thermocouple_Check', 'Temp_Controller', 'Heater_Cable_Insulation',
            'Heater_Cable_Connection', 'Motor_Inverter', 'Pressure_Control_Loop',
            'Motor_Overload_Breaker', 'Pressure_Transducer', 'Indicator_Lamps',
            'Switches_Check', 'PC_Condition', 'Low_Temp_Alarm', 'Pressure_Alarms',
            'Buzzer_Check', 'Emergency_Stop'
        ];
        
        // Create a new row array with data in the correct order
        const newRow = columnOrder.map(colId => data[colId] || ''); // Use data from request or default to empty string

        // Use the append method to add the new row to the 'FilterTester' sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'FilterTester!A1', // Appending to this sheet
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [newRow],
            },
        });
        
        response.status(200).json({ status: 'success', message: 'Checklist submitted successfully.' });

    } catch (error) {
        console.error('API Error:', error);
        response.status(500).json({ status: 'error', message: 'Internal Server Error.' });
    }
};