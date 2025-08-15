import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Get the CSS content for the webview
 * @param extensionContext - The extension context
 * @param customCSS - Custom CSS to inject
 * @returns The CSS content
 */
export function getStyles(extensionContext: vscode.ExtensionContext, customCSS: string = "") {
  const cssFiles = [
    "src/ui/assets/css/webview.css",
    "src/ui/assets/css/custom-panel.css",
    "src/ui/assets/css/file-icons.css",
    "src/ui/assets/css/webviewCssStyles/animations.css",
    "src/ui/assets/css/webviewCssStyles/base.css",
    "src/ui/assets/css/webviewCssStyles/chat.css",
    "src/ui/assets/css/webviewCssStyles/code-block.css",
    "src/ui/assets/css/webviewCssStyles/input.css",
    "src/ui/assets/css/webviewCssStyles/responsive.css",
    "src/ui/assets/css/webviewCssStyles/inputUtils/action-button.css",
    "src/ui/assets/css/webviewCssStyles/inputUtils/chat-input.css",
    "src/ui/assets/css/webviewCssStyles/inputUtils/input-context.css",
    "src/ui/assets/css/webviewCssStyles/inputUtils/input-controls.css",
    "src/ui/assets/css/webviewCssStyles/inputUtils/input-main.css",
    "src/ui/assets/css/webviewCssStyles/inputUtils/input-wrapper.css",
    "src/ui/assets/css/webviewCssStyles/inputUtils/send-button.css",
    "src/ui/assets/css/webviewCssStyles/tool-status.css",
    "src/ui/assets/css/webviewCssStyles/tool-dropdown.css",
  ];

  let cssContent = "";

  for (const cssFile of cssFiles) {
    try {
      const cssPath = path.join(extensionContext.extensionPath, cssFile);
      cssContent += fs.readFileSync(cssPath, "utf8") + "\n";
    } catch (error) {
      console.error(`Failed to load CSS file: ${cssFile}`, error);
    }
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
