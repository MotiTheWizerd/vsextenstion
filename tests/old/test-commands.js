#!/usr/bin/env node

/**
 * Test script to verify command execution works
 */

const http = require('http');

async function testCommands() {
  console.log('🧪 Testing command execution...\n');

  // Test with simple commands first
  console.log('📤 Testing simple commands...');
  const simpleTest = {
    message: "Testing simple commands",
    is_final: false,
    command_calls: [
      {
        command: "ping",
        args: []
      },
      {
        command: "status",
        args: []
      }
    ]
  };

  try {
    const response1 = await sendToWebhook(simpleTest);
    console.log('✅ Simple commands test:', response1.status);
    
    await sleep(2000);
    
    // Test with createIndex command
    console.log('📤 Testing createIndex command...');
    const indexTest = {
      message: "Testing index creation",
      is_final: false,
      command_calls: [
        {
          command: "createIndex",
          args: ["."]
        }
      ]
    };
    
    const response2 = await sendToWebhook(indexTest);
    console.log('✅ CreateIndex test:', response2.status);
    
    await sleep(5000); // Wait longer for index creation
    
    console.log('\n🎉 Command tests completed!');
    
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
testCommands().catch(console.error);