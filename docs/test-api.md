# RayDaemon API Testing Guide

Your RayDaemon extension now has web API call functionality! Here's how to use it:

## Features Added

1. **API Client Class** - Built-in HTTP/HTTPS client for making web requests
2. **API Testing Tab** - Full UI for testing APIs with method, URL, headers, and body
3. **Chat Integration** - Use `/api` commands in chat for quick API calls
4. **Test Buttons** - Quick access to popular test APIs

## How to Use

### Method 1: API Tab

1. Open the RayDaemon control panel
2. Click the "🌐 API" tab
3. Select HTTP method (GET, POST, PUT, DELETE)
4. Enter URL
5. Add headers and body as needed (JSON format)
6. Click "Send"

### Method 2: Chat Commands

In either the chat tab or global chat input, use:

```
/api GET https://jsonplaceholder.typicode.com/posts/1
/api POST https://httpbin.org/post {"Content-Type": "application/json"} {"test": "data"}
```

### Method 3: Test Buttons

Use the quick test buttons for:

- **JSONPlaceholder** - Simple REST API for testing
- **HTTPBin** - HTTP request & response service
- **GitHub API** - Public GitHub API endpoints

## Example API Calls

### GET Request

```
URL: https://jsonplaceholder.typicode.com/posts/1
Method: GET
Headers: {}
```

### POST Request

```
URL: https://httpbin.org/post
Method: POST
Headers: {"Content-Type": "application/json"}
Body: {"message": "Hello from RayDaemon!", "timestamp": "2025-01-08"}
```

### GitHub API

```
URL: https://api.github.com/users/octocat
Method: GET
Headers: {"User-Agent": "RayDaemon-Test"}
```

## Features

- ✅ Full HTTP method support (GET, POST, PUT, DELETE)
- ✅ Custom headers support
- ✅ Request body support (JSON)
- ✅ Response display with status, headers, and body
- ✅ Error handling and display
- ✅ Chat integration with `/api` commands
- ✅ Logging of API calls
- ✅ Test API presets

## Next Steps

You can now:

1. Test any REST API from within VS Code
2. Build automated API testing workflows
3. Integrate API calls into your development process
4. Use the chat interface for quick API experiments

Try opening the control panel and testing an API call!
