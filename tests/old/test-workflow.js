#!/usr/bin/env node

/**
 * Test script to verify the RayDaemon workflow
 * This simulates what Ray server should be doing
 */

const http = require('http');

async function testWorkflow() {
  console.log('🧪 Testing RayDaemon workflow...\n');

  // Test 1: Send initial response with command calls
  console.log('📤 Step 1: Sending initial response with command calls...');
  const initialResponse = {
    message: "I'll help you index your workspace. Let me create an index for you.",
    is_final: false,
    command_calls: [
      {
        command: "createIndex",
        args: ["."]
      }
    ]
  };

  try {
    const response1 = await sendToWebhook(initialResponse);
    console.log('✅ Step 1 completed:', response1.status);
    
    // Wait a bit for command execution
    console.log('⏳ Waiting for command execution...');
    await sleep(3000);
    
    // Test 2: Send final response (this should happen automatically when Ray receives command results)
    console.log('📤 Step 2: Sending final response...');
    const finalResponse = {
      message: "Great! I've successfully created an index of your workspace. The index contains all the files and symbols, making it easier to search and navigate your codebase.",
      is_final: true
    };
    
    const response2 = await sendToWebhook(finalResponse);
    console.log('✅ Step 2 completed:', response2.status);
    
    console.log('\n🎉 Workflow test completed successfully!');
    
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
testWorkflow().catch(console.error);