# RayDaemon Agent Setup

Your extension is now configured to send chat messages to your API! Here's how to set it up:

## 1. Configure Your API Endpoint

Edit `src/config.ts` and update:

```typescript
export const config = {
  // Replace with your actual API endpoint
  apiEndpoint: 'https://your-api-endpoint.com/chat',
  
  // Add any headers your API needs
  apiHeaders: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE' // Uncomment if needed
  },
  
  // The message format sent to your API
  formatMessage: (message: string) => ({
    message: message,
    timestamp: new Date().toISOString(),
    source: 'raydaemon-vscode'
  })
};
```

## 2. Expected API Response Format

Your API should return a response in one of these formats:

```json
{
  "response": "Your agent's response text here"
}
```

Or:

```json
{
  "message": "Your agent's response text here"
}
```

Or just a plain string response.

## 3. How It Works

1. User types a message in the chat or global chat input
2. Extension sends POST request to your API with the message
3. Your API processes the message and returns a response
4. Extension displays the response in the chat

## 4. Test It

1. Update your API endpoint in `src/config.ts`
2. Run `pnpm run compile` to rebuild
3. Press F5 to launch the extension development host
4. Open the RayDaemon control panel
5. Go to the Chat tab or use the global chat input
6. Type a message and see your agent respond!

## 5. Request Format Sent to Your API

```json
{
  "message": "User's message text",
  "timestamp": "2025-01-08T10:30:00.000Z",
  "source": "raydaemon-vscode"
}
```

That's it! Your chat messages will now be sent to your agent API and responses will appear in the chat.