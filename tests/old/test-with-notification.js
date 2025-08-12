#!/usr/bin/env node

/**
 * Test that will trigger VS Code notifications so we can see if commands are executing
 */

const http = require('http');

async function testWithNotification() {
  console.log('🔔 Testing with VS Code notifications...\n');

  // Test with a simple ping command that should show a notification
  const testData = {
    action: 'test',
    message: 'Testing command execution with notification',
    command_calls: [
      {
        command: 'ping',
        args: []
      },
      {
        command: 'status',
        args: []
      }
    ]
  };

  try {
    console.log('📤 Sending test with ping and status commands...');
    console.log('Data:', JSON.stringify(testData, null, 2));
    
    const response = await sendToWebhook(testData);
    console.log('✅ Response:', response.status, response.data);
    
    console.log('\n💡 Check VS Code for:');
    console.log('   - Notifications/messages');
    console.log('   - Developer Console (Ctrl+Shift+P > "Developer: Toggle Developer Tools")');
    console.log('   - Output panel (Ctrl+Shift+U > select "RayDaemon")');
    
    // Wait to see if VS Code sends anything back
    console.log('\n⏳ Waiting 5 seconds...');
    await sleep(5000);
    
    console.log('🏁 Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function sendToWebhook(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/ray-response',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: responseData
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
testWithNotification().catch(console.error);