# Project Structure

## Root Directory

```
raydaemon/
├── .git/                    # Git repository
├── .kiro/                   # Kiro IDE configuration and steering
├── .vscode/                 # VS Code workspace settings
├── dist/                    # Build output (extension.js)
├── media/                   # Extension assets
│   └── ray-icon.svg        # Activity bar icon
├── node_modules/           # Dependencies
├── src/                    # Source code
└── package.json           # Extension manifest
```

## Source Organization

### Main Entry Point
- `src/extension.ts` - Extension lifecycle (activate/deactivate)
  - Command registration and handlers
  - Tree data provider implementation
  - Webview panel creation and HTML generation
  - Daemon interval management

### Test Structure
- `src/test/` - Test files (closed folder, standard VS Code test setup)
- `src/.vscode/` - Test-specific VS Code configuration

## Key Files

### Configuration
- `package.json` - Extension manifest with commands, views, and activation events
- `tsconfig.json` - TypeScript compiler configuration
- `eslint.config.mjs` - Linting rules and TypeScript integration
- `esbuild.js` - Custom build script with watch mode support

### Development
- `.vscodeignore` - Files excluded from extension package
- `.npmrc` - npm configuration
- `pnpm-lock.yaml` - Dependency lock file
- `vsc-extension-quickstart.md` - VS Code extension development guide

## Architecture Patterns

### Extension Structure
- Single-file entry point pattern
- Command-based architecture with VS Code API integration
- Tree data provider for sidebar views
- Webview panels for rich UI components

### Code Organization
- Class-based components (RayDaemonTreeProvider, RayDaemonItem)
- Functional command handlers
- Embedded HTML/CSS/JS for webview content
- Interval-based background processing

### Naming Conventions
- Commands: `raydaemon.commandName`
- Views: `rayDaemonContainer`, `rayDaemonDummyView`
- Classes: PascalCase (RayDaemonTreeProvider)
- Functions: camelCase (startRayDaemon, getWebviewContent)