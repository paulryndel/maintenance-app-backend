const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testPdfEndpoint() {
  const exportChecklist = require('../api/exportChecklist');
  
  // Mock request and response objects
  const mockReq = {
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data' },
    // Create a simple form data stream
    on: function(event, callback) {
      if (event === 'data') {
        // Simple form data for testing
        const formData = `--boundary\r\nContent-Disposition: form-data; name="checklist"\r\n\r\n{"ChecklistID":"TEST-123","CustomerID":"CUST-1","TechnicianID":"TECH-9","review":"Test review"}\r\n--boundary--\r\n`;
        callback(Buffer.from(formData));
      } else if (event === 'end') {
        callback();
      }
    },
    headers: {
      'content-type': 'multipart/form-data; boundary=boundary'
    }
  };

  const mockRes = {
    status: function(code) {
      console.log(`Response status: ${code}`);
      return this;
    },
    json: function(data) {
      console.log('Response JSON:', data);
      return this;
    },
    send: function(data) {
      console.log('Response sent:', data);
      return this;
    },
    setHeader: function(name, value) {
      console.log(`Header set: ${name} = ${value}`);
      return this;
    },
    headersSent: false,
    end: function() {
      console.log('Response ended');
      return this;
    }
  };

  try {
    console.log('Testing PDF export endpoint...');
    await exportChecklist(mockReq, mockRes);
    console.log('Test completed');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testPdfEndpoint();