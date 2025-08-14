# Custom Tab Panels Implementation

## Overview

The RayDaemon WebUI implements custom tab panels while hiding VS Code's default ones to provide a more focused and customized user experience. This document explains how to implement custom tab panels and manage the visibility of default VS Code panels.

## Hiding Default VS Code Panels

### 1. CSS Approach

```css
/* Hide default VS Code tab bar */
.tabs-and-actions-container {
  display: none !important;
}

/* Hide default VS Code tab buttons */
.tab {
  display: none !important;
}

/* Ensure custom content takes full height */
.custom-webview-content {
  height: 100vh !important;
  max-height: 100vh !important;
}
```

### 2. Contribution Point Configuration

In `package.json`, configure the view container to hide default UI elements:

```json
{
  "contributes": {
    "viewsContainers": {
      "panel": [
        {
          "id": "rayDaemonContainer",
          "title": "RayDaemon",
          "icon": "media/ray-icon.svg"
        }
      ]
    },
    "views": {
      "rayDaemonContainer": [
        {
          "type": "webview",
          "id": "rayDaemonDummyView",
          "name": "RayDaemon",
          "initialSize": 15
        }
      ]
    }
  }
}
```

## Implementing Custom Tab Panels

### 1. Tab Panel Structure

```html
<div class="custom-tabs-container">
  <div class="tabs-header">
    <button class="tab-button active" data-tab="chat">Chat</button>
    <button class="tab-button" data-tab="tools">Tools</button>
    <button class="tab-button" data-tab="settings">Settings</button>
  </div>
  
  <div class="tab-content">
    <div class="tab-panel active" id="chat-panel">
      <!-- Chat Interface -->
    </div>
    <div class="tab-panel" id="tools-panel">
      <!-- Tools Interface -->
    </div>
    <div class="tab-panel" id="settings-panel">
      <!-- Settings Interface -->
    </div>
  </div>
</div>
```

### 2. Tab Panel Styling

```css
.custom-tabs-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--vscode-editor-background);
}

.tabs-header {
  display: flex;
  background: var(--vscode-tab-activeBackground);
  border-bottom: 1px solid var(--vscode-tab-border);
}

.tab-button {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--vscode-tab-inactiveForeground);
  cursor: pointer;
  font-size: 13px;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.tab-button.active {
  color: var(--vscode-tab-activeForeground);
  border-bottom-color: var(--vscode-focusBorder);
  background: var(--vscode-tab-activeBackground);
}

.tab-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.tab-panel {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease;
}

.tab-panel.active {
  opacity: 1;
  visibility: visible;
}
```

### 3. Tab Panel JavaScript

```javascript
class TabManager {
  constructor() {
    this.tabButtons = document.querySelectorAll('.tab-button');
    this.tabPanels = document.querySelectorAll('.tab-panel');
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
    // Update button states
    this.tabButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });

    // Update panel states
    this.tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabName}-panel`);
    });

    // Post tab change event to extension
    vscode.postMessage({
      type: 'tabChange',
      tab: tabName
    });
  }
}
```

### 4. Integration with WebviewProvider

```typescript
export class RayDaemonViewProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(webviewView: vscode.WebviewView) {
    // Configure webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(this._context.extensionPath)
      ]
    };

    // Set custom webview content
    const webviewConfig = {
      title: 'RayDaemon Control Panel',
      showCustomTabs: true,
      initialTab: 'chat',
      tabs: [
        { id: 'chat', label: 'Chat' },
        { id: 'tools', label: 'Tools' },
        { id: 'settings', label: 'Settings' }
      ]
    };

    webviewView.webview.html = this.getWebviewContent(webviewConfig);

    // Handle tab changes
    webviewView.webview.onDidReceiveMessage(message => {
      if (message.type === 'tabChange') {
        // Handle tab change
        this.handleTabChange(message.tab);
      }
    });
  }
}
```

## State Management

### 1. Persisting Tab State

```typescript
class TabStateManager {
  private readonly stateKey = 'activeTab';
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  saveActiveTab(tab: string) {
    this.context.workspaceState.update(this.stateKey, tab);
  }

  getActiveTab(): string {
    return this.context.workspaceState.get(this.stateKey, 'chat');
  }
}
```

### 2. Restoring Tab State

```javascript
class TabManager {
  constructor() {
    // ... existing initialization ...
    this.restoreTabState();
  }

  restoreTabState() {
    // Post message to get saved state
    vscode.postMessage({
      type: 'getTabState'
    });
  }

  // Handle state restore message from extension
  handleStateRestore(savedTab) {
    if (savedTab) {
      this.switchTab(savedTab);
    }
  }
}
```

## Best Practices

1. **Performance**
   - Lazy load tab content
   - Use CSS transitions for smooth tab switching
   - Minimize DOM updates

2. **Accessibility**
   - Use proper ARIA attributes
   - Implement keyboard navigation
   - Provide focus indicators

3. **State Management**
   - Persist tab state
   - Handle tab restoration
   - Manage tab history

4. **Error Handling**
   - Graceful fallbacks
   - Error boundaries
   - State recovery

## Example Usage

```javascript
// Initialize tab manager
document.addEventListener('DOMContentLoaded', () => {
  const tabManager = new TabManager();
  
  // Handle messages from extension
  window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
      case 'restoreState':
        tabManager.handleStateRestore(message.tab);
        break;
      // ... handle other messages
    }
  });
});
```
