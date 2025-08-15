import * as vscode from 'vscode';

/**
 * Map of valid VS Code URI schemes
 */
const VALID_VSCODE_SCHEMES = new Set([
    'file',
    'vscode',
    'vscode-resource',
    'vscode-userdata',
    'untitled',
    'webview-panel',
    'vscode-webview',
    'vscode-webview-resource',
    'vscode-remote',
    'chat-editing-snapshot-text-model',
    'vscode-notebook-cell',
    'vscode-notebook',
    'vscode-test',
    'vscode-file',
    'vscode-terminal',
    'vscode-scm'
]);

/**
 * Special URI schemes that should be preserved
 */
const SPECIAL_SCHEMES = new Set([
    'http',
    'https',
    'ws',
    'wss',
    'mailto',
    'data'
]);

/**
 * Safely convert a string into a vscode.Uri.
 * If the string looks like a URI (has a scheme), use Uri.parse.
 * Otherwise fall back to Uri.file so Windows paths like C:\... work.
 * 
 * @param s The string to convert to a URI
 * @returns A vscode.Uri instance
 * @throws Error if the string cannot be converted to a valid URI
 */
export function safeUriFromString(s: string): vscode.Uri {
    if (!s) {
        throw new Error('Cannot create URI from empty string');
    }

    // Clean the string first
    const cleanPath = s.trim();

    try {
        // Extract scheme if present - capture scheme and path separately
        const schemeMatch = cleanPath.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(?:\/\/)?(.+)/);
        
        if (schemeMatch) {
            const [, scheme, path] = schemeMatch;
            const normalizedScheme = scheme.toLowerCase();

            // Handle VS Code specific schemes
            if (VALID_VSCODE_SCHEMES.has(normalizedScheme)) {
                // Special handling for chat-editing-snapshot-text-model scheme
                if (normalizedScheme === 'chat-editing-snapshot-text-model') {
                    // Parse the path as a URL to handle query parameters properly
                    try {
                        const pathParts = path.split('?');
                        const basePath = pathParts[0];
                        const query = pathParts[1] || '';
                        
                        // Encode path segments individually
                        const encodedPath = basePath
                            .split('/')
                            .map(segment => encodeURIComponent(decodeURIComponent(segment)))
                            .join('/');
                            
                        // Keep query parameters as is if they're already encoded
                        const finalUri = query 
                            ? `${normalizedScheme}:${encodedPath}?${query}`
                            : `${normalizedScheme}:${encodedPath}`;
                            
                        return vscode.Uri.parse(finalUri);
                    } catch {
                        // If URL parsing fails, fall back to basic encoding
                        const encodedPath = encodeURIComponent(path)
                            .replace(/%2F/g, '/');
                        return vscode.Uri.parse(`${normalizedScheme}:${encodedPath}`);
                    }
                }

                // For other VS Code schemes
                const encodedPath = path
                    .split('/')
                    .map(segment => encodeURIComponent(decodeURIComponent(segment)))
                    .join('/');
                return vscode.Uri.parse(`${normalizedScheme}:${encodedPath}`);
            }

            // Handle file URIs specially
            if (normalizedScheme === 'file') {
                const filePath = decodeURIComponent(path);
                return vscode.Uri.file(filePath);
            }

            // Handle special schemes that should be preserved as-is
            if (SPECIAL_SCHEMES.has(normalizedScheme)) {
                return vscode.Uri.parse(cleanPath);
            }

            // For other schemes, try to preserve the structure while ensuring valid encoding
            // For other schemes, try to preserve the structure while ensuring valid encoding
            const decodedPath = decodeURIComponent(path); // Decode first
            const encodedPath = encodeURIComponent(decodedPath)
                .replace(/%2F/g, '/')
                .replace(/%5C/g, '')
                .replace(/%3A/g, ':');
            return vscode.Uri.parse(`${normalizedScheme}:${encodedPath}`);
        }

        // No scheme - treat as file path
        
        // Check for Windows drive letter
        const hasWindowsDrive = /^[a-zA-Z]:[/\\]/i.test(cleanPath);
        
        // Normalize path separators based on platform
        const normalizedPath = process.platform === 'win32' || hasWindowsDrive
            ? cleanPath.replace(/\//g, '\\')
            : cleanPath.replace(/\\/g, '/');

        // Handle Windows network paths
        if (normalizedPath.startsWith('\\\\')) {
            return vscode.Uri.file(normalizedPath);
        }

        // Regular file path
        return vscode.Uri.file(normalizedPath);

    } catch (err) {
        // Last resort - try to sanitize and create file URI
        try {
            // Remove any invalid characters and create file URI
            const sanitizedPath = cleanPath
                .replace(/[\u0000-\u001F\u007F-\u009F<>:"|?*]/g, '_');
            return vscode.Uri.file(sanitizedPath);
        } catch (finalErr) {
            throw new Error(
                `Invalid URI or file path: ${s}. Original error: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }
}
