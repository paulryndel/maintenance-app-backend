// This file does not need changes, but is included for completeness.
const { google } = require('googleapis');

module.exports = async (request, response) => {
    if (request.method !== 'POST') {
        return response.status(405).send('Method Not Allowed');
    }

    try {
        const data = request.body;
        if (!data.CustomerID) {
            return response.status(400).json({ status: 'fail', message: 'CustomerID is missing from the checklist data.' });
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

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
        
        const newRow = columnOrder.map(colId => data[colId] || '');

        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'FilterTester!A1',
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