#!/usr/bin/env node

/**
 * Test webhook directly with the exact format Ray is sending
 */

const http = require('http');

async function testWebhookDirect() {
  console.log('🧪 Testing webhook with Ray format...\n');

  // Use the exact format from your Ray logs
  const rayFormat = {
    action: 'answer',
    message: 'Creating and opening basic index in workspace root.',
    command_calls: [
      {
        command: 'createIndex',
        args: ['.', '--output', './basicindex1.json']
      },
      {
        command: 'openInEditorCmd',
        args: ['./basicindex1.json']
      }
    ]
  };

  try {
    console.log('📤 Sending Ray format to VS Code webhook...');
    console.log('Data:', JSON.stringify(rayFormat, null, 2));
    
    const response = await sendToWebhook(rayFormat);
    console.log('✅ Response:', response.status, response.data);
    
    // Wait to see if VS Code sends anything back
    console.log('⏳ Waiting 10 seconds to see if VS Code sends command results...');
    await sleep(10000);
    
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

    console.log('🔗 Sending to:', `http://${options.hostname}:${options.port}${options.path}`);

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
testWebhookDirect().catch(console.error);