# Test Ray Webhook

## Test the webhook server with curl:

```bash
curl -X POST http://localhost:3001/ray-response \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello from Ray! This is my analysis result.",
    "ray_prompt": "Let me check something else",
    "is_final": false
  }'
```

## Expected behavior:

1. **Console logs**:
   - `[RayDaemon] Received Ray POST: {message: "Hello from Ray!...", ...}`
   - `[RayDaemon] Message field: Hello from Ray! This is my analysis result.`
   - `[RayDaemon] Displaying Ray message in chat: Hello from Ray! This is my analysis result.`

2. **Chat display**:
   - Shows message with "✅ Ray (Work Complete)" header
   - Content: "Hello from Ray! This is my analysis result."
   - Green border styling

3. **Loop continuation** (if is_final: false):
   - Continues with ray_prompt after 1.5 seconds

## PowerShell test:

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/ray-response" -Method POST -ContentType "application/json" -Body '{"message":"Test message from Ray","is_final":true}'
```

The "message" field from Ray's POST will be displayed in the chat! 🎯