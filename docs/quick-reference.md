# RayDaemon Quick Reference Guide

## File Operations

### Opening Files
1. **Execute Ray commands** that involve files (read, write, search, etc.)
2. **Look for green "Completed" status** with file count (e.g., "1 result ▼")
3. **Click the file count** to expand the file dropdown
4. **Click any file name** to open it directly in VS Code

### Viewing Ray Changes
1. **Look for diff icons** (📊) next to files in the dropdown
2. **Click the diff icon** to see exactly what Ray changed
3. **View the side-by-side diff** showing before/after Ray's modifications

## Visual Indicators

### File Icons
- 📄 JavaScript (.js)
- 📘 TypeScript (.ts)
- 🐍 Python (.py)
- 🌐 HTML (.html)
- 🎨 CSS (.css)
- 📋 JSON (.json)
- 📝 Markdown (.md)
- 📁 Directories

### Status Icons
- ✅ **Completed successfully**
- ⚠️ **Completed with errors**
- ❌ **Failed**
- 🚀 **Starting**
- ⚡ **Working**

### Diff Icons
- 📊 **Diff available** - Click to see Ray's changes

## Common Workflows

### 1. File Modification Workflow
```
Ray modifies file → Green completion status → Click file count → Click diff icon → View changes
```

### 2. File Opening Workflow
```
Ray finds files → Green completion status → Click file count → Click file name → File opens
```

### 3. Error Handling Workflow
```
Error occurs → Red error status → Check console logs → Try alternative approach
```

## Keyboard Shortcuts

- **Open Panel**: Use Command Palette → "RayDaemon: Open Panel"
- **Focus Chat**: Click in the chat input area
- **Send Message**: Enter key or click Send button

## Troubleshooting

### File Won't Open
- ✅ Check file path in console logs
- ✅ Verify workspace folder is open
- ✅ Ensure file permissions allow access

### Diff Not Showing
- ✅ Verify file was modified by Ray (look for diff icon)
- ✅ Check if you're in a Git repository
- ✅ Try opening file manually and check SCM view

### UI Not Responding
- ✅ Check browser console for errors
- ✅ Reload VS Code window
- ✅ Check extension is enabled

## Tips & Best Practices

### For Best Results
- **Open workspace folders** for proper path resolution
- **Use Git repositories** for enhanced diff functionality
- **Keep file sizes reasonable** (<10MB) for best performance
- **Check console logs** when troubleshooting issues

### Performance Tips
- **Limit large file operations** to prevent memory issues
- **Use specific search patterns** to reduce result sets
- **Close unused diff views** to free memory
- **Restart extension** if memory usage becomes high

## Console Commands

### Debug Information
```javascript
// Check current backups
console.log(fileBackups.size + " files backed up");

// Clear all backups (for testing)
clearAllBackups();
```

### Message Testing
```javascript
// Test file opening
vscode.postMessage({
  type: "openFile",
  filePath: "path/to/your/file.js"
});

// Test diff display
vscode.postMessage({
  type: "showFileDiff", 
  filePath: "path/to/your/file.js"
});
```

## Configuration

### Extension Settings
- `raydaemon.enable`: Enable/disable extension
- `raydaemon.daemonInterval`: Heartbeat interval (default: 5000ms)
- `raydaemon.maxBackups`: Max file backups (default: 50)

### Workspace Settings
Add to `.vscode/settings.json`:
```json
{
  "raydaemon.enable": true,
  "raydaemon.maxBackups": 100
}
```

## Advanced Usage

### Custom File Patterns
Ray can work with various file patterns:
- `*.js` - All JavaScript files
- `src/**/*.ts` - All TypeScript files in src directory
- `**/*.md` - All Markdown files recursively

### Diff Strategies
The system tries multiple approaches:
1. **Ray-specific diff** (preferred)
2. **Git extension diff**
3. **SCM command diff**
4. **Manual Git diff**
5. **File + SCM view** (fallback)

### Memory Management
- Backups are automatically cleaned after each command batch
- Only the 50 most recent backups are kept
- Manual cleanup available for testing

## Support

### Getting Help
1. Check this quick reference
2. Review the full documentation in `docs/file-operations-and-diff.md`
3. Check console logs for error details
4. Report issues with specific error messages and steps to reproduce

### Reporting Issues
Include:
- VS Code version
- Extension version
- Error messages from console
- Steps to reproduce
- File types and sizes involved