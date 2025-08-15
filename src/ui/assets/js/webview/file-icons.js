class FileIconUtils {
  static getFileIcon(filename) {
    const extension = filename.split(".").pop().toLowerCase();
    const fileName = filename.toLowerCase();

    // Map file extensions to actual Codicon icons that exist
    const iconMap = {
      // Programming Languages
      js: "symbol-method",
      ts: "symbol-method",
      jsx: "symbol-method",
      tsx: "symbol-method",
      py: "symbol-method",
      java: "symbol-method",
      cpp: "symbol-method",
      c: "symbol-method",
      cs: "symbol-method",
      go: "symbol-method",
      rs: "symbol-method",
      rb: "symbol-method",
      php: "symbol-method",

      // Web Technologies
      html: "code",
      css: "symbol-color",
      scss: "symbol-color",
      sass: "symbol-color",
      less: "symbol-color",
      json: "json",
      xml: "code",
      md: "markdown",

      // Config Files
      env: "settings-gear",
      yml: "settings-gear",
      yaml: "settings-gear",
      toml: "settings-gear",
      ini: "settings-gear",
      conf: "settings-gear",
      config: "settings-gear",

      // Documentation
      pdf: "file-pdf",
      doc: "file-text",
      docx: "file-text",
      txt: "file-text",

      // Images
      png: "file-media",
      jpg: "file-media",
      jpeg: "file-media",
      gif: "file-media",
      svg: "file-media",

      // Archives
      zip: "file-zip",
      rar: "file-zip",
      tar: "file-zip",
      gz: "file-zip",

      // Others
      sh: "terminal",
      bat: "terminal",
      ps1: "terminal",
      sql: "database",
      db: "database",
    };

    return `codicon codicon-${iconMap[extension] || "file"}`; // Use actual Codicon classes
  }
}
