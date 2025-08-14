class FileIconUtils {
  static getFileIcon(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const fileName = filename.toLowerCase();

    // Special cases based on full filename
    if (fileName === 'package.json') { return 'package'; }
    if (fileName === '.gitignore') { return 'git'; }
    if (fileName === 'readme.md') { return 'markdown'; }
    if (fileName === 'license') { return 'law'; }
    if (fileName === 'dockerfile') { return 'docker'; }

    // Map file extensions to Codicon names
    const iconMap = {
      // Programming Languages
      js: 'javascript',
      ts: 'typescript',
      jsx: 'react',
      tsx: 'react',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c-lang',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      
      // Web Technologies
      html: 'html5',
      css: 'css',
      scss: 'sass',
      sass: 'sass',
      less: 'less',
      json: 'json',
      xml: 'code',
      md: 'markdown',
      
      // Config Files
      env: 'settings-gear',
      yml: 'yaml',
      yaml: 'yaml',
      toml: 'settings',
      ini: 'settings',
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
      gz: 'file-zip',
      
      // Others
      sh: 'terminal',
      bat: 'terminal',
      ps1: 'terminal',
      sql: 'database',
      db: 'database'
    };
    
    return `codicon-${iconMap[extension] || 'file'}`; // Default icon for unknown file types
  }
}
