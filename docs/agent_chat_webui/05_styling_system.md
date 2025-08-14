# Styling System Documentation

## Overview

The Agent Chat WebUI implements a modern, responsive styling system that integrates with VS Code's theming while maintaining its own distinct visual identity. The styling system is built to be maintainable, performant, and accessible.

## Core Styling Components

### 1. Layout Structure

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  padding: 32px 24px 24px;
  overflow-y: auto;
  scroll-behavior: smooth;
  background-color: var(--darker-bg);
  position: relative;
}
```

### 2. Message Styling

```css
.message {
  display: flex;
  margin: 16px 0;
  position: relative;
}

.message-content {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--message-bg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--avatar-bg);
  color: var(--avatar-text);
}
```

### 3. Input Area Styling

```css
.input-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 16px 24px;
  background: var(--input-bg);
  border-top: 1px solid var(--border-color);
}

#chatInput {
  min-width: 0;
  max-height: 120px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--input-text);
  resize: none;
  line-height: 1.5;
}
```

## Theme Integration

### 1. VS Code Theme Variables

```css
:root {
  --vscode-editor-background: var(--chat-bg);
  --vscode-editor-foreground: var(--text-color);
  --vscode-button-background: var(--accent-color);
  --vscode-button-foreground: var(--button-text);
  --vscode-button-hover-background: var(--accent-hover);
}
```

### 2. Custom Theme Variables

```css
:root {
  --chat-bg: var(--vscode-editor-background);
  --darker-bg: color-mix(in srgb, var(--chat-bg) 95%, black);
  --lighter-bg: color-mix(in srgb, var(--chat-bg) 95%, white);
  --text-color: var(--vscode-editor-foreground);
  --accent-color: var(--vscode-button-background);
  --accent-hover: var(--vscode-button-hover-background);
  --border-color: color-mix(in srgb, var(--text-color) 15%, transparent);
}
```

## Component-Specific Styling

### 1. Code Blocks

```css
pre {
  position: relative;
  background: var(--code-bg);
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
}

code {
  font-family: var(--vscode-editor-font-family);
  font-size: 0.9em;
  line-height: 1.4;
}

.copy-button {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

pre:hover .copy-button {
  opacity: 1;
}
```

### 2. Tool Messages

```css
.tool-message {
  justify-content: flex-start;
  margin: 16px 0 20px 0;
  padding-left: 60px;
  pointer-events: none;
}

.tool-message .message-content {
  max-width: none;
  padding: 0;
  background: none;
  border: none;
  box-shadow: none;
}

.tool-status {
  color: var(--text-secondary);
  font-size: 0.9em;
  margin-top: 4px;
}
```

## Animations and Transitions

### 1. Typing Indicator

```css
.typing-dots span {
  width: 4px;
  height: 4px;
  margin: 0 1px;
  background: currentColor;
  border-radius: 50%;
  display: inline-block;
  animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}
```

### 2. Smooth Transitions

```css
.message {
  transition: opacity 0.2s ease;
}

.status-indicator {
  transition: background-color 0.3s ease;
}

.chat-messages {
  scroll-behavior: smooth;
}
```

## Responsive Design

```css
@media (max-width: 600px) {
  .message-content {
    max-width: 95%;
  }

  .input-wrapper {
    padding: 12px 16px;
  }

  .chat-messages {
    padding: 24px 16px 16px;
  }
}

@media (min-width: 1200px) {
  .message-content {
    max-width: 75%;
  }
}
```

## Accessibility Features

```css
/* Focus states */
#chatInput:focus {
  outline: 2px solid var(--accent-color);
  outline-offset: -1px;
}

/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
