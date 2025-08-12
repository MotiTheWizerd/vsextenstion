#!/usr/bin/env node

/**
 * Test script to verify that Ray's messages are displayed correctly
 * when she sends both a message and command_calls
 */

const http = require('http');

// Create a test server that simulates Ray's response
const testServer = http.createServer((req, res) => {
  console.log(`\n📥 Received ${req.method} request to ${req.url}`);
  
  if (req.method === 'POST' && req.url === '/api/messages') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('\n🔍 VS Code sent:', JSON.stringify(data, null, 2));
        
        // Simulate Ray's response with both message and command_calls
        const response = {
          message: "I'll help you read that file. Let me check its contents for you.",
          command_calls: [
            {
              command: 'read',
              args: ['src/extension.ts']
            }
          ],
          is_final: false
        };
        
        console.log('\n📤 Sending Ray response:', JSON.stringify(response, null, 2));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        
      } catch (error) {
        console.error('❌ Error parsing JSON:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

testServer.listen(8003, () => {
  console.log('🧪 Test Ray server listening on port 8003');
  console.log('This simulates Ray sending both a message and command_calls');
  console.log('\nTo test:');
  console.log('1. Change VS Code config to use port 8003');
  console.log('2. Send any message via VS Code chat');
  console.log('3. Check that Ray\'s message appears first, then tool execution status\n');
});

// Keep the server running
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down test server...');
  testServer.close();
  process.exit(0);
});