# Server Migration Example

## Overview

This document provides practical examples for migrating your Ray server to handle the new RayDaemon message format.

## Before and After Comparison

### Old Message Handler (Before)
```python
# OLD FORMAT - Don't use this anymore
def handle_vscode_message_old(request_data):
    message = request_data.get('message', '')
    model = request_data.get('model')
    thinking_budget = request_data.get('thinking_budget', 0)
    include_system = request_data.get('include_system', True)
    use_memory = request_data.get('use_memory', True)
    max_memory_messages = request_data.get('max_memory_messages', 10)
    command_results = request_data.get('command_results', [])
    
    # Process with old fields
    context = build_context(include_system, use_memory, max_memory_messages)
    response = process_message(message, context, thinking_budget)
    
    return response
```

### New Message Handler (After)
```python
# NEW FORMAT - Use this
def handle_vscode_message_new(request_data):
    message = request_data.get('message', '')
    model = request_data.get('model')
    project_id = request_data.get('project_id')  # NEW
    chat_id = request_data.get('chat_id')        # NEW
    user_id = request_data.get('user_id')        # NEW (UUID4 from login)
    command_results = request_data.get('command_results', [])
    
    # Check if user is authenticated (not using default UUID)
    is_authenticated = user_id != "00000000-0000-4000-8000-000000000000"
    
    # Process with session tracking
    session_context = get_session_context(project_id, chat_id, user_id, is_authenticated)
    response = process_message_with_session(message, session_context, command_results)
    
    return response
```

## Example Migration Scripts

### Flask/Python Example
```python
from flask import Flask, request, jsonify
import json
from datetime import datetime

app = Flask(__name__)

# Session storage (use proper database in production)
sessions = {}
projects = {}
users = {}  # Store user authentication data

@app.route('/api/login', methods=['POST'])
def login():
    """
    User authentication endpoint - returns user_id for RayDaemon
    """
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email') 
        password = data.get('password')
        
        # Validate credentials (replace with your auth logic)
        user = authenticate_user(username, email, password)
        
        if user:
            return jsonify({
                'user_id': user['user_id'],  # UUID4 for this user
                'username': user['username'],
                'email': user['email'],
                'token': generate_auth_token(user),
                'expires_at': get_token_expiration().isoformat()
            })
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
            
    except Exception as e:
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

@app.route('/api/vscode_user_message', methods=['POST'])
def handle_vscode_message():
    try:
        data = request.json
        
        # Extract new required fields
        message = data.get('message', '')
        project_id = data.get('project_id')
        chat_id = data.get('chat_id')
        user_id = data.get('user_id')
        model = data.get('model')
        command_results = data.get('command_results', [])
        
        # Validate required fields
        if not project_id or not chat_id or not user_id:
            return jsonify({
                'error': 'Missing required fields: project_id, chat_id, and user_id'
            }), 400
        
        # Check if user is authenticated
        is_authenticated = user_id != "00000000-0000-4000-8000-000000000000"
        if not is_authenticated:
            # User should login first for full functionality
            print(f"[Warning] User not authenticated, using default user_id: {user_id}")
        
        # Get or create session context
        session_key = f"{project_id}:{chat_id}"
        if session_key not in sessions:
            sessions[session_key] = {
                'created': datetime.now(),
                'messages': [],
                'context': {}
            }
        
        # Store message in session history
        sessions[session_key]['messages'].append({
            'timestamp': datetime.now(),
            'message': message,
            'command_results': command_results
        })
        
        # Process message with session context
        response_text = process_message_with_context(
            message=message,
            session=sessions[session_key],
            project_id=project_id,
            chat_id=chat_id,
            user_id=user_id,
            command_results=command_results
        )
        
        return jsonify({
            'response': response_text,
            'session_id': session_key,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500

def process_message_with_context(message, session, project_id, chat_id, user_id, command_results):
    """
    Process message with full session context
    """
    # Get project-specific context
    project_context = projects.get(project_id, {})
    
    # Get user-specific context (could be preferences, history, etc.)
    user_context = get_user_context(user_id)
    
    # Build conversation history from session
    conversation_history = []
    for msg in session['messages'][-10:]:  # Last 10 messages
        conversation_history.append({
            'role': 'user',
            'content': msg['message']
        })
    
    # If there are command results, this is a follow-up message
    if command_results:
        # Process the command results
        tools_output = format_command_results(command_results)
        context = f"Previous command results:\n{tools_output}\n\nUser message: {message}"
    else:
        context = message
    
    # Your AI processing logic here
    # This is where you'd call your AI model with the context
    ai_response = call_your_ai_model(
        context=context,
        conversation_history=conversation_history,
        project_context=project_context,
        user_context=user_context
    )
    
    return ai_response

def format_command_results(command_results):
    """
    Format command results for AI context
    """
    formatted = []
    for result in command_results:
        command = result.get('command', 'unknown')
        args = result.get('args', [])
        success = result.get('ok', False)
        output = result.get('output', '')
        error = result.get('error', '')
        
        if success:
            formatted.append(f"✅ {command} {' '.join(args)}\nOutput: {output}")
        else:
            formatted.append(f"❌ {command} {' '.join(args)}\nError: {error}")
    
    return '\n\n'.join(formatted)

def authenticate_user(username, email, password):
    """
    Authenticate user credentials - replace with your auth logic
    """
    # Example authentication (replace with real implementation)
    if (username == "demo" or email == "demo@example.com") and password == "password":
        return {
            'user_id': '550e8400-e29b-41d4-a716-446655440000',  # Fixed UUID4 for demo user
            'username': 'demo',
            'email': 'demo@example.com'
        }
    return None

def generate_auth_token(user):
    """
    Generate JWT or session token
    """
    # Replace with your token generation logic
    return f"token_{user['user_id']}"

def get_token_expiration():
    """
    Get token expiration time
    """
    from datetime import datetime, timedelta
    return datetime.now() + timedelta(hours=24)

def get_user_context(user_id):
    """
    Get user-specific context and preferences
    """
    is_authenticated = user_id != "00000000-0000-4000-8000-000000000000"
    
    if is_authenticated:
        # Get real user data from database
        user_data = users.get(user_id, {})
        return {
            "user_id": user_id, 
            "authenticated": True,
            "preferences": user_data.get('preferences', {}),
            "username": user_data.get('username')
        }
    else:
        # Default context for non-authenticated users
        return {
            "user_id": user_id,
            "authenticated": False,
            "preferences": {},
            "username": "anonymous"
        }

def call_your_ai_model(context, conversation_history, project_context, user_context):
    """
    Replace this with your actual AI model call
    """
    # Example placeholder - replace with your AI integration
    return f"Processed message with context from project, chat session, and user. Context length: {len(context)} chars"

if __name__ == '__main__':
    print("Starting Ray server with authentication support...")
    print("Login endpoint: POST http://localhost:8000/api/login")
    print("Message endpoint: POST http://localhost:8000/api/vscode_user_message")
    app.run(host='localhost', port=8000, debug=True)
```

### Node.js/Express Example
```javascript
const express = require('express');
const app = express();

app.use(express.json());

// Session storage (use proper database in production)
const sessions = new Map();
const projects = new Map();

// Authentication endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Authenticate user (replace with your auth logic)
        const user = await authenticateUser(username, email, password);
        
        if (user) {
            res.json({
                user_id: user.user_id,  // UUID4 for this user
                username: user.username,
                email: user.email,
                token: generateAuthToken(user),
                expires_at: getTokenExpiration().toISOString()
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: `Login failed: ${error.message}` });
    }
});

app.post('/api/vscode_user_message', async (req, res) => {
    try {
        const { message, project_id, chat_id, user_id, model, command_results = [] } = req.body;
        
        // Validate required fields
        if (!project_id || !chat_id || !user_id) {
            return res.status(400).json({
                error: 'Missing required fields: project_id, chat_id, and user_id'
            });
        }
        
        // Check if user is authenticated
        const isAuthenticated = user_id !== "00000000-0000-4000-8000-000000000000";
        if (!isAuthenticated) {
            console.warn(`[Warning] User not authenticated, using default user_id: ${user_id}`);
        }
        
        // Get or create session
        const sessionKey = `${project_id}:${chat_id}`;
        if (!sessions.has(sessionKey)) {
            sessions.set(sessionKey, {
                created: new Date(),
                messages: [],
                context: {}
            });
        }
        
        const session = sessions.get(sessionKey);
        
        // Store message in session
        session.messages.push({
            timestamp: new Date(),
            message,
            command_results
        });
        
        // Process message
        const response = await processMessageWithContext({
            message,
            session,
            project_id,
            chat_id,
            user_id,
            command_results
        });
        
        res.json({
            response,
            session_id: sessionKey,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({
            error: `Internal server error: ${error.message}`
        });
    }
});

async function processMessageWithContext({ message, session, project_id, chat_id, user_id, command_results }) {
    // Get project context
    const projectContext = projects.get(project_id) || {};
    
    // Get user context
    const userContext = getUserContext(user_id);
    
    // Build conversation history
    const conversationHistory = session.messages.slice(-10).map(msg => ({
        role: 'user',
        content: msg.message
    }));
    
    // Handle command results if present
    let context = message;
    if (command_results.length > 0) {
        const toolsOutput = formatCommandResults(command_results);
        context = `Previous command results:\n${toolsOutput}\n\nUser message: ${message}`;
    }
    
    // Call your AI model
    const aiResponse = await callYourAIModel({
        context,
        conversationHistory,
        projectContext,
        userContext
    });
    
    return aiResponse;
}

function formatCommandResults(commandResults) {
    return commandResults.map(result => {
        const { command, args = [], ok, output = '', error = '' } = result;
        const status = ok ? '✅' : '❌';
        const content = ok ? `Output: ${output}` : `Error: ${error}`;
        return `${status} ${command} ${args.join(' ')}\n${content}`;
    }).join('\n\n');
}

async function authenticateUser(username, email, password) {
    // Example authentication (replace with real implementation)
    if ((username === "demo" || email === "demo@example.com") && password === "password") {
        return {
            user_id: '550e8400-e29b-41d4-a716-446655440000',  // Fixed UUID4 for demo user
            username: 'demo',
            email: 'demo@example.com'
        };
    }
    return null;
}

function generateAuthToken(user) {
    // Replace with your JWT generation logic
    return `token_${user.user_id}`;
}

function getTokenExpiration() {
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24);
    return expiration;
}

function getUserContext(userId) {
    const isAuthenticated = userId !== "00000000-0000-4000-8000-000000000000";
    
    if (isAuthenticated) {
        // Get real user data from database
        const userData = users.get(userId) || {};
        return {
            userId,
            authenticated: true,
            preferences: userData.preferences || {},
            username: userData.username
        };
    } else {
        // Default context for non-authenticated users
        return {
            userId,
            authenticated: false,
            preferences: {},
            username: "anonymous"
        };
    }
}

async function callYourAIModel({ context, conversationHistory, projectContext, userContext }) {
    // Replace with your actual AI model integration
    return `Processed message with context. Length: ${context.length} chars`;
}

app.listen(8000, 'localhost', () => {
    console.log('Ray server listening on http://localhost:8000');
    console.log('Login endpoint: POST http://localhost:8000/api/login');
    console.log('Message endpoint: POST http://localhost:8000/api/vscode_user_message');
});
```

## Database Schema Updates

### SQL Example
```sql
-- Add new columns to existing conversations table
ALTER TABLE conversations 
ADD COLUMN project_id VARCHAR(255),
ADD COLUMN chat_id VARCHAR(255),
ADD COLUMN user_id VARCHAR(255);

-- Create indexes for efficient querying
CREATE INDEX idx_conversations_project_id ON conversations(project_id);
CREATE INDEX idx_conversations_chat_id ON conversations(chat_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_project_chat ON conversations(project_id, chat_id);
CREATE INDEX idx_conversations_user_project ON conversations(user_id, project_id);

-- Create sessions table for session management
CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    context_data JSON,
    UNIQUE(project_id, chat_id)
);

-- Create projects table for project-specific data
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table for user-specific data
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    preferences JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### MongoDB Example
```javascript
// MongoDB schema updates
const mongoose = require('mongoose');

// Updated conversation schema
const conversationSchema = new mongoose.Schema({
    message: String,
    project_id: { type: String, required: true, index: true },
    chat_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    command_results: [Object],
    timestamp: { type: Date, default: Date.now },
    response: String
});

// Compound indexes for efficient queries
conversationSchema.index({ project_id: 1, chat_id: 1 });
conversationSchema.index({ user_id: 1, project_id: 1 });

// Session schema
const sessionSchema = new mongoose.Schema({
    project_id: { type: String, required: true },
    chat_id: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    last_active: { type: Date, default: Date.now },
    context: Object,
    message_count: { type: Number, default: 0 }
});

sessionSchema.index({ project_id: 1, chat_id: 1 }, { unique: true });

// Project schema
const projectSchema = new mongoose.Schema({
    project_id: { type: String, required: true, unique: true },
    name: String,
    settings: Object,
    created_at: { type: Date, default: Date.now },
    last_active: { type: Date, default: Date.now }
});

// User schema
const userSchema = new mongoose.Schema({
    user_id: { type: String, required: true, unique: true },
    preferences: Object,
    created_at: { type: Date, default: Date.now },
    last_active: { type: Date, default: Date.now }
});

const Conversation = mongoose.model('Conversation', conversationSchema);
const Session = mongoose.model('Session', sessionSchema);
const Project = mongoose.model('Project', projectSchema);
const User = mongoose.model('User', userSchema);
```

## Testing Your Migration

### Example Test Script
```python
import requests
import json

# Test the new message format
def test_new_format():
    url = "http://localhost:8000/api/vscode_user_message"
    
    # First, login to get user_id
    login_response = requests.post("http://localhost:8000/api/login", json={
        "username": "demo",
        "password": "password"
    })
    
    if login_response.status_code == 200:
        user_data = login_response.json()
        user_id = user_data['user_id']
        print("Login successful, user_id:", user_id)
    else:
        user_id = "00000000-0000-4000-8000-000000000000"  # Default fallback
        print("Login failed, using default user_id")
    
    # Test user message with proper user_id
    user_message = {
        "message": "Hello, can you help me write a Python function?",
        "model": None,
        "project_id": "test-project-12345678",
        "chat_id": "chat-abcdef01",
        "user_id": user_id
    }
    
    response = requests.post(url, json=user_message)
    print("User message response:", response.json())
    
    # Test message with command results
    command_results_message = {
        "message": "Hello, can you help me write a Python function?",
        "command_results": [
            {
                "command": "write",
                "args": ["test.py", "def hello(): return 'world'"],
                "ok": True,
                "output": "File 'test.py' written successfully"
            }
        ],
        "model": None,
        "project_id": "test-project-12345678",
        "chat_id": "chat-abcdef01",
        "user_id": user_id  # Use the user_id from login
    }
    
    response = requests.post(url, json=command_results_message)
    print("Command results response:", response.json())

if __name__ == "__main__":
    test_new_format()
```

## Migration Checklist

### Server Code Updates
- [ ] Remove handling of old fields (`thinking_budget`, `include_system`, `use_memory`, `max_memory_messages`)
- [ ] Add handling for new fields (`project_id`, `chat_id`, `user_id`)
- [ ] Implement user authentication endpoint (`/api/login`)
- [ ] Add user_id validation and authentication checking
- [ ] Update message validation to require new fields
- [ ] Implement session management logic
- [ ] Add project context handling
- [ ] Add user context handling with authentication status

### Database Updates
- [ ] Add `project_id`, `chat_id`, and `user_id` columns/fields
- [ ] Create appropriate indexes for performance
- [ ] Migrate existing data if needed
- [ ] Create session, project, and user tables/collections

### Testing
- [ ] Test user authentication endpoint
- [ ] Test with authenticated vs non-authenticated users
- [ ] Test with new message format
- [ ] Verify session tracking works across devices with same user_id
- [ ] Test project context isolation
- [ ] Validate command results handling
- [ ] Performance test with multiple sessions
- [ ] Test token expiration and refresh

### Monitoring
- [ ] Add logging for session creation/management
- [ ] Monitor API response times
- [ ] Track session and project metrics
- [ ] Set up alerts for migration issues

## Common Migration Issues

### Issue 1: Missing Required Fields
```python
# Problem: Old validation logic
if not message:
    return error("Message required")

# Solution: Add new field validation
if not message or not project_id or not chat_id or not user_id:
    return error("Missing required fields: message, project_id, chat_id, user_id")
```

### Issue 2: Session Storage Memory Leaks
```python
# Problem: Unlimited session storage
sessions[session_key] = session_data

# Solution: Add session cleanup
MAX_SESSIONS = 10000
if len(sessions) > MAX_SESSIONS:
    # Remove oldest sessions
    oldest_sessions = sorted(sessions.items(), key=lambda x: x[1]['created'])[:1000]
    for session_key, _ in oldest_sessions:
        del sessions[session_key]
```

### Issue 3: Project Context Conflicts
```python
# Problem: Global context shared across projects
global_context = load_context()

# Solution: Project-specific context
def get_project_context(project_id):
    return project_contexts.get(project_id, create_default_context())
```

## Best Practices

1. **Authentication First**: Implement secure user authentication before message handling
2. **Validate Input**: Always validate `project_id`, `chat_id`, and `user_id` are present
3. **Check Authentication**: Distinguish between authenticated and anonymous users
4. **Session Cleanup**: Implement session expiration and cleanup
5. **Project Isolation**: Keep project contexts separate
6. **User Isolation**: Keep user contexts separate with proper authentication
7. **Security**: Use proper JWT tokens and password hashing
8. **Performance**: Use appropriate database indexes
9. **Monitoring**: Log session creation, authentication, and usage patterns
10. **Error Handling**: Provide clear error messages for migration and auth issues

## Support

If you encounter issues during migration:

1. Check the logs for specific error messages
2. Validate your message format matches the examples
3. Test with the provided test scripts
4. Review the API_MESSAGE_STRUCTURE_UPDATE.md for detailed specifications

For additional support, refer to the developer-guide.md documentation.