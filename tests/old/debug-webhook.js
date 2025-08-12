#!/usr/bin/env node

/**
 * Debug webhook to see what's actually happening
 */

const http = require('http');

// Create a debug server to see what VS Code is sending back
const debugServer = http.createServer((req, res) => {
  console.log(`\n📥 Received ${req.method} request to ${req.url}`);
  
  if (req.method === 'POST' && req.url === '/api/messages') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('\n🔍 VS Code sent command results back:');
        console.log('URL:', req.url);
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Body:', JSON.stringify(data, null, 2));
        
        // Respond with a simple acknowledgment (like Ray would)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'received', 
          message: 'Command results received successfully',
          action: 'continue_conversation',
          is_final: true
        }));
      } catch (error) {
        console.error('❌ Error parsing JSON:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    // Health check
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    console.log(`❌ Unhandled request: ${req.method} ${req.url}`);
    res.writeHead(404);
    res.end('Not found');
  }
});

debugServer.listen(8001, () => {
  console.log('🐛 Debug server listening on port 8001');
  console.log('This will show what VS Code sends back to Ray API');
  console.log('Now send a test command to VS Code webhook...\n');
});

// Send test command to VS Code
setTimeout(async () => {
  console.log('📤 Sending test command to VS Code...');
  
  const testCommand = {
    message: "Debug test - creating index",
    is_final: false,
    command_calls: [
      {
        command: "ping",
        args: []
      }
    ]
  };
  
  try {
    const response = await sendToVSCode(testCommand);
    console.log('✅ Sent to VS Code:', response.status);
  } catch (error) {
    console.error('❌ Failed to send to VS Code:', error.message);
  }
}, 1000);

function sendToVSCode(data) {
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