/**
 * Simple markdown to HTML converter
 */
class MarkdownParser {
  static parse(text) {
    if (!text) {
      return "";
    }

    // Convert headers
    text = text.replace(/^### (.*$)/gm, "<h3>$1</h3>");
    text = text.replace(/^## (.*$)/gm, "<h2>$1</h2>");
    text = text.replace(/^# (.*$)/gm, "<h1>$1</h1>");

    // Convert code blocks
    text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
      return `<pre><code>${this.escapeHtml(code.trim())}</code></pre>`;
    });

    // Convert inline code
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Convert links
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Convert bold and italic
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    // text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    // text = text.replace(/_([^_]+)_/g, "<em>$1</em>");

    // Convert lists
    text = text.replace(/^\s*[-*]\s+(.*$)/gm, "<li>$1</li>");
    text = text.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");

    // Convert line breaks
    text = text.replace(/\n/g, "<br>");

    return text;
  }

  static escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// MarkdownParser is now globally available