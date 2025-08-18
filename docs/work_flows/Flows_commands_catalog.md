# RayDaemon — Additional Critical Flows (Catalog for Agents)

This catalog summarizes important operational flows inferred from handler and command-method bundles. Use these flows when planning multi-step tasks.

---
## Handlers
- **commands/handlers/diagnosticHandlers.js** → diagnosticHandlers
- **commands/handlers/fileSystemHandlers.js** → fileSystemHandlers
- **commands/handlers/generalHandlers.js** → generalHandlers
- **commands/handlers/indexHandlers.js** → indexHandlers
- **commands/handlers/navigationHandlers.js** → navigationHandlers
- **commands/handlers/searchHandlers.js** → searchHandlers
- **commands/handlers/symbolHandlers.js** → symbolHandlers
- **commands/handlers/utils.js** → expandExtensions, getSymbolIcon

---
## Command Methods
- **commands/commandMethods/diagnostics/diagnosticWatcher.js** → DiagnosticWatcher, disposeGlobalDiagnosticWatcher, getGlobalDiagnosticWatcher
- **commands/commandMethods/diagnostics/formatDiagnostics.js** → formatDiagnostic, formatDiagnosticSummary, formatDiagnosticsCompact, formatFileDiagnostics, getFileCounts, getSeverityIcon, getSeverityName, getSeverityOrder, groupFiles, sortFiles, truncateMessage
- **commands/commandMethods/diagnostics/getDiagnostics.js** → getAllDiagnostics, getFileDiagnostics, parseSeverityString
- **commands/commandMethods/diagnostics/index.js** → Diagnostic, DiagnosticSeverity, Position, Range, Uri
- **commands/commandMethods/diagnostics/types.js** → (no explicit exports detected)
- **commands/commandMethods/fs/append.js** → appendToFile
- **commands/commandMethods/fs/createIndex.js** → countSymbolsByKind, createIndex, createIndexSummary, formatIndexSummary, normalizeExtension, saveIndex
- **commands/commandMethods/fs/errors.js** → FileOperationError
- **commands/commandMethods/fs/exportIndex.js** → escapeCsvContent, escapeHtml, exportIndex, exportJsonByExtension, exportToCsv, exportToHtml, exportToMarkdown, filterIndex, formatExportResult, replaceOrAddExtension
- **commands/commandMethods/fs/findAllSymbols.js** → findAllSymbols, formatAllSymbols, getSymbolIcon, searchSymbolsByName
- **commands/commandMethods/fs/findByExtension.js** → EXTENSION_GROUPS, findByExtension, searchDirectory
- **commands/commandMethods/fs/findSymbol.js** → findSymbol, formatSymbolLocations, getSymbolIcon
- **commands/commandMethods/fs/findSymbolFromIndex.js** → findSymbolFromIndex, formatSymbolIndexResults, getSymbolKindIcon
- **commands/commandMethods/fs/findSymbolsInFile.js** → SYMBOL_KINDS, findSymbolsInFile, formatSymbols, getSymbolIcon
- **commands/commandMethods/fs/format.js** → formatFileList, formatFileSize
- **commands/commandMethods/fs/getSymbolReferences.js** → formatSymbolReferences, getSymbolReferences, getSymbolReferencesByName
- **commands/commandMethods/fs/glob.js** → globSearch, globToRegex, walk
- **commands/commandMethods/fs/gotoSymbol.js** → getSymbolIcon, gotoDefinition, gotoSymbol, gotoSymbolByName
- **commands/commandMethods/fs/gotoSymbolFromIndex.js** → gotoSymbolByNameFromIndex, gotoSymbolFromIndex, showSymbolIndexMenu
- **commands/commandMethods/fs/index.js** → (no explicit exports detected)
- **commands/commandMethods/fs/list.js** → listFiles
- **commands/commandMethods/fs/loadIndex.js** → clearIndex, getIndexMetadata, getSymbolIndex, loadIndex
- **commands/commandMethods/fs/mkdir.js** → ensureDir
- **commands/commandMethods/fs/move.js** → movePath
- **commands/commandMethods/fs/openInEditor.js** → escapeFencesInContext, openAndHighlight, openInEditor, openInEditorEnhanced, openMultipleInEditor
- **commands/commandMethods/fs/pathResolver.js** → ensureWorkspace, resolveWorkspacePath
- **commands/commandMethods/fs/read.js** → readFile
- **commands/commandMethods/fs/remove.js** → removePath
- **commands/commandMethods/fs/replace.js** → escapeRegex, replaceInFile
- **commands/commandMethods/fs/searchRegex.js** → formatRegexSearchResults, searchRegex
- **commands/commandMethods/fs/searchText.js** → formatTextSearchResults, searchText
- **commands/commandMethods/fs/searchText_fixed.js** → (no explicit exports detected)
- **commands/commandMethods/fs/stat.js** → getFileInfo
- **commands/commandMethods/fs/types.js** → DEFAULT_READ_OPTIONS
- **commands/commandMethods/fs/updateIndex.js** → countSymbolsByKind, createIndexSummary, formatUpdateResult, hasFileChanged, normalizeExtension, setupFileWatcher, updateIndex
- **commands/commandMethods/fs/write.js** → writeFileSafe
- **commands/commandMethods/git/status.js** → (no explicit exports detected)