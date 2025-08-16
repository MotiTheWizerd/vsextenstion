export class IconProvider {
    static getFileIcon(filePath) {
        const extension = filePath.split('.').pop()?.toLowerCase();
        const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase();

        // Map extensions to VS Code Codicon names
        const iconMap = {
            // Programming Languages
            js: 'javascript',
            jsx: 'react',
            ts: 'typescript',
            tsx: 'react',
            py: 'symbol-misc', // Python
            java: 'symbol-misc',
            cpp: 'symbol-misc',
            c: 'symbol-misc',
            cs: 'symbol-misc',
            go: 'symbol-misc',
            rs: 'symbol-misc',
            rb: 'symbol-misc',
            php: 'symbol-misc',
            
            // Web Technologies
            html: 'html',
            css: 'symbol-color',
            scss: 'symbol-color',
            sass: 'symbol-color',
            less: 'symbol-color',
            json: 'json',
            xml: 'code',
            md: 'markdown',
            
            // Config Files
            env: 'settings-gear',
            yml: 'symbol-misc',
            yaml: 'symbol-misc',
            toml: 'settings-gear',
            ini: 'settings-gear',
            conf: 'settings-gear',
            config: 'settings-gear',
            
            // Documentation
            pdf: 'file-pdf',
            doc: 'file-word',
            docx: 'file-word',
            txt: 'file-text',
            
            // Images
            png: 'file-media',
            jpg: 'file-media',
            jpeg: 'file-media',
            gif: 'file-media',
            svg: 'file-media',
            
            // Archives
            zip: 'file-zip',
            rar: 'file-zip',
            tar: 'file-zip',
            gz: 'file-zip'
        };

        // Special cases based on filename
        if (fileName === 'package.json') { return 'codicon-package'; }
        if (fileName === '.gitignore') { return 'codicon-git'; }
        if (fileName === 'readme.md') { return 'codicon-book'; }
        if (fileName === 'license') { return 'codicon-law'; }
        if (fileName === 'dockerfile') { return 'codicon-docker'; }
        
        // Check if it's a directory
        if (!extension || filePath.endsWith('/') || filePath.endsWith('\\')) {
            return 'codicon-folder';
        }
        
        // Default to file icon if no match
        return `codicon-${iconMap[extension] || 'file'}`;
    }
}
