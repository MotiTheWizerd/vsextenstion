#!/usr/bin/env node

/**
 * Debug Ray API endpoint to see what VS Code is sending
 */

const http = require("http");

// Create a debug server that mimics Ray's /api/messages endpoint
const debugServer = http.createServer((req, res) => {
  console.log(`\n📥 Received ${req.method} request to ${req.url}`);
  console.log(`Headers:`, req.headers);

  if (req.method === "POST" && req.url === "/api/messages") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        console.log("\n🔍 VS Code sent to Ray API:");
        console.log("Timestamp:", new Date().toISOString());
        console.log("Full payload:", JSON.stringify(data, null, 2));

        // Check specifically for command_results
        if (data.command_results && data.command_results.length > 0) {
          console.log("\n✅ COMMAND RESULTS FOUND:");
          console.log("Count:", data.command_results.length);
          data.command_results.forEach((result, index) => {
            console.log(
              `Result ${index + 1}:`,
              JSON.stringify(result, null, 2)
            );
          });
        } else {
          console.log("\n❌ NO COMMAND RESULTS (empty or missing)");
          console.log("command_results field:", data.command_results);
        }

        // Respond like Ray would - with command_calls to trigger execution
        const response = {
          action: "test_response",
          message: "Debug response from fake Ray server",
          command_calls: [
            {
              command: "ping",
              args: [],
            },
          ],
          is_final: false,
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error("❌ Error parsing JSON:", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
  } else {
    console.log(`❌ Unhandled request: ${req.method} ${req.url}`);
    res.writeHead(404);
    res.end("Not found");
  }
});

debugServer.listen(8002, () => {
  console.log("🐛 Debug Ray API server listening on port 8002");
  console.log("This will intercept what VS Code sends to Ray API");
  console.log("\nTo test:");
  console.log("1. Temporarily change VS Code config to use port 8002");
  console.log("2. Send a command via VS Code chat");
  console.log("3. Watch the output here\n");
});

// Keep the server running
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down debug server...");
  debugServer.close();
  process.exit(0);
});
