#!/usr/bin/env node

/**
 * Test the health endpoint to verify VS Code extension is running
 */

const http = require('http');

async function testHealth() {
  console.log('🏥 Testing VS Code extension health...\n');

  try {
    const response = await makeRequest('GET', 'http://localhost:3001/health');
    console.log('✅ Health check response:', response.status, response.data);
    
    if (response.status === 200) {
      console.log('🎉 VS Code extension webhook server is running!');
    } else {
      console.log('❌ VS Code extension webhook server returned unexpected status');
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.log('💡 Make sure VS Code is open with the RayDaemon extension active');
  }
}

function makeRequest(method, url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            data: parsedData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Run the test
testHealth().catch(console.error);