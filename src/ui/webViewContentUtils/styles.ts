import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Get the CSS content for the webview
 * @param extensionContext - The extension context
 * @param customCSS - Custom CSS to inject
 * @returns The CSS content
 */
export function getStyles(extensionContext: vscode.ExtensionContext, customCSS: string = ""): string {
  // Get file system paths for reading content
  const stylesPath = path.join(
    extensionContext.extensionPath,
    "src/ui/assets/css/webview.css"
  );
  const customPanelStylesPath = path.join(
    extensionContext.extensionPath,
    "src/ui/assets/css/custom-panel.css"
  );
  const fileIconsStylesPath = path.join(
    extensionContext.extensionPath,
    "src/ui/assets/css/file-icons.css"
  );

  // Read CSS files
  let cssContent = "";

  try {
    cssContent = fs.readFileSync(stylesPath, "utf8");
    cssContent += "\n" + fs.readFileSync(customPanelStylesPath, "utf8");
    cssContent += "\n" + fs.readFileSync(fileIconsStylesPath, "utf8");
  } catch (error) {
    console.error("Failed to load webview CSS:", error);
    cssContent = "/* Error loading styles */";
  }

  // Ensure Codicons are available inside the webview.
  try {
    const codiconCssPath = path.join(
      extensionContext.extensionPath,
      "node_modules",
      "@vscode",
      "codicons",
      "dist",
      "codicon.css"
    );
    const codiconFontPath = path.join(
      extensionContext.extensionPath,
      "node_modules",
      "@vscode",
      "codicons",
      "dist",
      "codicon.ttf"
    );
    let codiconCss = fs.readFileSync(codiconCssPath, "utf8");
    // Read the font file and encode as base64 so the webview can load it without CORS issues
    try {
      const fontBuffer = fs.readFileSync(codiconFontPath);
      const fontBase64 = fontBuffer.toString("base64");
      const dataUri = `url('data:font/truetype;base64,${fontBase64}')`;
      codiconCss = codiconCss.replace(
        /url\((?:['\"])?\.\/codicon\.ttf[^)]*\)/g,
        dataUri
      );
    } catch (fontErr) {
      console.error("Failed to inline codicon.ttf as base64:", fontErr);
    }
    // Prepend codicon CSS so font-face and icon classes are available to other styles
    cssContent = codiconCss + "\n" + cssContent;
  } catch (err) {
    console.error("Failed to load codicon assets for webview:", err);
  }

  // Add custom CSS if provided
  if (customCSS) {
    cssContent += "\n" + customCSS;
  }

  return cssContent;
}
