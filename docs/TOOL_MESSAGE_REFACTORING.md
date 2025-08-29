Message Handler Refactor

Overview
- The monolithic `src/ui/assets/js/webview/message-handler.js` was split into focused modules under `src/ui/assets/js/webview/message-handler/` to reduce file size and clarify responsibilities.

New Structure
- `message-handler.js`: Thin orchestrator class that keeps the public API (`handleIncomingMessage`, `handleToolStatus`) and delegates to submodules.
- `message-handler/tool-status-handler.js`: Handles tool status lifecycle rendering (starting/working/completed/error), DOM updates, and file dropdown interactions.
- `message-handler/message-router.js`: Routes incoming `postMessage` payloads to the appropriate UI actions and the tool status handler.
- `message-handler/dom-utils.js`: DOM logging helpers used during development and debugging.
- `message-handler/text-utils.js`: Categorization, icon selection, and text generation utilities used by the status handler.

Behavior
- No change to external behavior or import paths. Existing imports of `./message-handler.js` continue to work.
- The tool status UI, file dropdowns, and message routing logic are functionally equivalent and easier to maintain.

Notes
- This refactor keeps each file under ~200–300 lines and follows the project’s modular architecture guidance in `AGENTS.md`.
