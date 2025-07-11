const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testPreviewAPI() {
  try {
    // First, we need to login to get a token
    console.log('1. Logging in...');
    const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'testuser@test.com',
      password: 'testuser123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful');
    
    // Create a test BMP file (just a small one for testing)
    const testBmpPath = path.join(__dirname, 'test.bmp');
    
    // Check if we have a BMP file, if not use a PNG
    const testFile = fs.existsSync(testBmpPath) ? testBmpPath : path.join(__dirname, 'test-image.png');
    
    console.log(`\n2. Testing preview API with file: ${testFile}`);
    
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile));
    
    const response = await axios.post('http://localhost:5001/api/preview/generate', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      },
      responseType: 'arraybuffer'
    });
    
    console.log('✓ Preview API responded successfully');
    console.log(`  Response size: ${response.data.byteLength} bytes`);
    console.log(`  Content-Type: ${response.headers['content-type']}`);
    
    // Save the preview to verify it worked
    const outputPath = path.join(__dirname, 'preview-output.png');
    fs.writeFileSync(outputPath, response.data);
    console.log(`✓ Preview saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('✗ Error testing preview API:', error.response?.data || error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Headers:', error.response.headers);
    }
  }
}

testPreviewAPI();