class FileIconUtils {
  static getFileIcon(filename) {
    const extension = filename.split(".").pop().toLowerCase();
    const fileName = filename.toLowerCase();

    // Map file extensions to emoji icons for reliability
    const iconMap = {
      // Programming Languages
      js: "📦",
      ts: "📦", 
      jsx: "⚛️",
      tsx: "⚛️",
      py: "🐍",
      java: "☕",
      cpp: "⚙️",
      c: "⚙️",
      cs: "🔷",
      go: "🐹",
      rs: "🦀",
      rb: "💎",
      php: "🐘",

      // Web Technologies
      html: "🌐",
      css: "🎨",
      scss: "🎨",
      sass: "🎨",
      less: "🎨",
      json: "📋",
      xml: "📄",
      md: "📝",

      // Config Files
      env: "⚙️",
      yml: "⚙️",
      yaml: "⚙️",
      toml: "⚙️",
      ini: "⚙️",
      conf: "⚙️",
      config: "⚙️",

      // Documentation
      pdf: "📕",
      doc: "📄",
      docx: "📄",
      txt: "📄",

      // Images
      png: "🖼️",
      jpg: "🖼️",
      jpeg: "🖼️",
      gif: "🖼️",
      svg: "🖼️",

      // Archives
      zip: "📦",
      rar: "📦",
      tar: "📦",
      gz: "📦",

      // Others
      sh: "💻",
      bat: "💻",
      ps1: "💻",
      sql: "🗃️",
      db: "🗃️",
    };

    return iconMap[extension] || "📄"; // Return emoji directly
  }
}
