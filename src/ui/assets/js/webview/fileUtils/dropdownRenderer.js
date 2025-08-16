
import { FileItemRenderer } from './fileItemRenderer.js';

export class DropdownRenderer {
    static render(results, fileObjects) {
        // Process all messages and commands
        let messages = [];
        let statusMessages = new Set();

        // First collect all messages
        results.forEach(result => {
            if (result.message) {
                messages.push(result.message);
            }
            if (result.status && !statusMessages.has(result.status)) {
                messages.push(result.status);
                statusMessages.add(result.status);
            }
            if (result.command) {
                if (result.output && typeof result.output === 'string' && result.output.trim()) {
                    // Try to parse JSON output and create a nice summary
                    try {
                        const parsed = JSON.parse(result.output.trim());
                        if (parsed.type === 'fileList' && Array.isArray(parsed.files)) {
                            // For file lists, show a summary instead of command name and raw JSON
                            const fileCount = parsed.files.length;
                            const summary = `Found ${fileCount} item${fileCount !== 1 ? 's' : ''} in directory`;
                            messages.push(summary);
                        } else {
                            // For other JSON, show command name and output
                            const cmdMsg = result.args 
                                ? `${result.command} ${result.args.join(' ')}`
                                : result.command;
                            messages.push(cmdMsg);
                            messages.push(result.output.trim());
                        }
                    } catch (e) {
                        // Not JSON, check if it's a file modification command
                        if (['write', 'append', 'replace'].includes(result.command)) {
                            // For file modification commands, show a success message instead of the file content
                            const fileName = result.args && result.args[0] ? result.args[0].split(/[\/]/).pop() : 'file';
                            const action = result.command === 'write' ? 'Created' : 
                                       result.command === 'append' ? 'Appended to' : 'Modified';
                            messages.push(`✅ ${action} ${fileName}`);
                        } else {
                            // For other commands, show command name and output
                            const cmdMsg = result.args 
                                ? `${result.command} ${result.args.join(' ')}`
                                : result.command;
                            messages.push(cmdMsg);
                            messages.push(result.output.trim());
                        }
                    }
                } else {
                    // No output, just show command name
                    const cmdMsg = result.args 
                        ? `${result.command} ${result.args.join(' ')}`
                        : result.command;
                    messages.push(cmdMsg);
                }
            }
        });

        // Show all files
        const displayFiles = fileObjects;
        const hasMore = false;

        // Create the command summary with all messages
        const commandSummary = messages.length > 0
            ? `<div class="tool-command-info">
                  ${messages.map(msg => `<div class="tool-message">${msg}</div>`).join('')}
                </div>`
            : "";

        const fileItems = displayFiles
            .map(fileObj => FileItemRenderer.render(fileObj))
            .join("");

        const moreIndicator = hasMore
            ? `<div class="tool-more-indicator">... and ${ 
                  fileObjects.length - 10
                } more files</div>`
            : "";

        const dropdownHtml = `
            <div class="tool-dropdown">
                ${commandSummary}
                <div class="tool-file-list">
                    ${fileItems}
                    ${moreIndicator}
                </div>
            </div>
        `;

        return dropdownHtml;
    }
}
