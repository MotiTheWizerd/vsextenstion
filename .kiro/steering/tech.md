# Technology Stack

## Core Technologies

- **TypeScript** - Primary language with strict type checking enabled
- **VS Code Extension API** - Built on vscode ^1.102.0 engine
- **Node.js** - Runtime environment (Node16 module system, ES2022 target)
- **esbuild** - Fast bundler for production builds

## Build System

### Package Manager
- **pnpm** - Primary package manager (lock file: pnpm-lock.yaml)

### Build Tools
- **esbuild** - Bundling and minification
- **TypeScript Compiler** - Type checking (tsc --noEmit)
- **ESLint** - Code linting with TypeScript rules
- **npm-run-all** - Parallel script execution

### Common Commands

```bash
# Development
pnpm run compile          # Build with type checking and linting
pnpm run watch           # Watch mode for development
pnpm run watch:esbuild   # Watch esbuild only
pnpm run watch:tsc       # Watch TypeScript type checking

# Production
pnpm run package         # Production build (minified)
pnpm run vscode:prepublish # Pre-publish build

# Quality
pnpm run check-types     # Type checking only
pnpm run lint           # ESLint checking
pnpm run test           # Run tests with vscode-test

# Testing
pnpm run compile-tests   # Compile test files
pnpm run pretest        # Full pre-test pipeline
```

## Configuration Files

- `tsconfig.json` - TypeScript configuration (Node16, ES2022, strict mode)
- `eslint.config.mjs` - ESLint rules with TypeScript plugin
- `esbuild.js` - Custom build configuration with problem matcher
- `.vscodeignore` - Extension packaging exclusions

## Development Patterns

- Entry point: `src/extension.ts` with activate/deactivate lifecycle
- Bundle output: `dist/extension.js` (single file)
- External dependencies: VS Code API excluded from bundle
- Source maps enabled in development, disabled in production