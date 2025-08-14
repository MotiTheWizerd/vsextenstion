import * as vscode from "vscode";
import { CommandRegistry, CommandError } from "../commandHandler";
import {
  getAllDiagnostics,
  getFileDiagnostics,
  formatDiagnosticSummary,
  formatFileDiagnostics,
  formatDiagnosticsCompact,
  getGlobalDiagnosticWatcher,
  parseSeverityString,
} from "../commandMethods/diagnostics";
import { safeUriFromString } from "../../utils/uri";

export const diagnosticHandlers: CommandRegistry = {
  getDiagnostics: {
    handler: async (args: string[]): Promise<string> => {
      let severity: vscode.DiagnosticSeverity[] = [
        vscode.DiagnosticSeverity.Error,
        vscode.DiagnosticSeverity.Warning,
        vscode.DiagnosticSeverity.Information,
        vscode.DiagnosticSeverity.Hint,
      ];
      let maxFiles = 1000;
      let maxPerFile = 100;
      let filePattern: string | undefined;
      let isGlob = true;
      let showSummaryOnly = false;
      let compact = false;
      let maxFilesToShow = 20;
      let json = false;
      let noEmoji = false;
      let groupBy: "severity" | "folder" | "none" = "none";
      let sortBy: "severity" | "path" | "count" = "severity";
      let openFirst = false;
      let openN = 0;

      // Parse arguments
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--errors-only" || arg === "-e") {
          severity = [vscode.DiagnosticSeverity.Error];
        } else if (arg === "--warnings-only" || arg === "-w") {
          severity = [vscode.DiagnosticSeverity.Warning];
        } else if (arg === "--info-only" || arg === "-i") {
          severity = [vscode.DiagnosticSeverity.Information];
        } else if (arg === "--hints-only" || arg === "-H") {
          severity = [vscode.DiagnosticSeverity.Hint];
        } else if (arg === "--severity") {
          const severityStr = args[++i];
          if (!severityStr) {
            throw new CommandError("No severity value provided", "EINVAL");
          }
          severity = parseSeverityString(severityStr);
          if (severity.length === 0) {
            throw new CommandError("Invalid severity values", "EINVAL");
          }
        } else if (arg === "--summary" || arg === "-s") {
          showSummaryOnly = true;
        } else if (arg === "--compact" || arg === "-c") {
          compact = true;
        } else if (arg === "--json") {
          json = true;
        } else if (arg === "--no-emoji") {
          noEmoji = true;
        } else if (arg === "--max-files") {
          const maxValue = args[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-files value", "EINVAL");
          }
          maxFiles = Number(maxValue);
        } else if (arg === "--max-per-file") {
          const maxValue = args[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-per-file value", "EINVAL");
          }
          maxPerFile = Number(maxValue);
        } else if (arg === "--file-pattern" || arg === "-f") {
          filePattern = args[++i];
          if (!filePattern) {
            throw new CommandError("No file pattern provided", "EINVAL");
          }
        } else if (arg === "--substring") {
          isGlob = false;
        } else if (arg === "--group-by") {
          const groupValue = args[++i];
          if (
            !groupValue ||
            !["severity", "folder", "none"].includes(groupValue)
          ) {
            throw new CommandError(
              "Invalid group-by value. Use: severity, folder, none",
              "EINVAL"
            );
          }
          groupBy = groupValue as "severity" | "folder" | "none";
        } else if (arg === "--sort") {
          const sortValue = args[++i];
          if (
            !sortValue ||
            !["severity", "path", "count"].includes(sortValue)
          ) {
            throw new CommandError(
              "Invalid sort value. Use: severity, path, count",
              "EINVAL"
            );
          }
          sortBy = sortValue as "severity" | "path" | "count";
        } else if (arg === "--open-first") {
          openFirst = true;
          openN = 1;
        } else if (arg === "--open") {
          const openValue = args[++i];
          if (!openValue || isNaN(Number(openValue))) {
            throw new CommandError("Invalid open value", "EINVAL");
          }
          openN = Number(openValue);
          openFirst = openN > 0;
        }
      }

      try {
        const summary = await getAllDiagnostics({
          severity,
          maxFiles,
          maxPerFile,
          filePattern,
          isGlob,
        });

        // Handle opening first/nth diagnostic
        if (openFirst && summary.files.length > 0) {
          let diagnosticCount = 0;
          let found = false;

          for (const fileInfo of summary.files) {
            for (const diagnostic of fileInfo.diagnostics) {
              diagnosticCount++;
              if (diagnosticCount === openN) {
                // Open the file and go to the diagnostic location
                const uri = safeUriFromString(fileInfo.uri);
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, {
                  selection: diagnostic.range,
                  viewColumn: vscode.ViewColumn.One,
                });
                found = true;
                break;
              }
            }
            if (found) {
              break;
            }
          }
        }

        if (compact) {
          return formatDiagnosticsCompact(summary, { noEmoji, json });
        }

        return formatDiagnosticSummary(summary, {
          showSummaryOnly,
          maxFilesToShow,
          maxPerFile,
          noEmoji,
          json,
          groupBy,
          sortBy,
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Failed to get diagnostics: ${errorMessage}`,
          "EDIAGNOSTIC",
          true
        );
      }
    },
    description:
      "Get all current diagnostics (errors, warnings, etc.) across the workspace with advanced filtering and formatting",
    usage:
      "getDiagnostics [--errors-only|-e] [--warnings-only|-w] [--info-only|-i] [--hints-only|-H] [--severity <error,warning,info,hint>] [--summary|-s] [--compact|-c] [--json] [--no-emoji] [--max-files <n>] [--max-per-file <n>] [--file-pattern|-f <pattern>] [--substring] [--group-by <severity|folder|none>] [--sort <severity|path|count>] [--open-first] [--open <n>]",
  },

  getFileDiagnostics: {
    handler: async (args: string[]): Promise<string> => {
      if (args.length === 0) {
        throw new CommandError("No file path provided", "EINVAL");
      }

      const filePath = args[0];
      let severity: vscode.DiagnosticSeverity[] = [
        vscode.DiagnosticSeverity.Error,
        vscode.DiagnosticSeverity.Warning,
        vscode.DiagnosticSeverity.Information,
        vscode.DiagnosticSeverity.Hint,
      ];
      let includeSource = true;
      let maxPerFile = 100;
      let json = false;
      let noEmoji = false;
      let openFirst = false;
      let openN = 0;

      // Parse arguments
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--errors-only" || arg === "-e") {
          severity = [vscode.DiagnosticSeverity.Error];
        } else if (arg === "--warnings-only" || arg === "-w") {
          severity = [vscode.DiagnosticSeverity.Warning];
        } else if (arg === "--info-only" || arg === "-i") {
          severity = [vscode.DiagnosticSeverity.Information];
        } else if (arg === "--hints-only" || arg === "-H") {
          severity = [vscode.DiagnosticSeverity.Hint];
        } else if (arg === "--severity") {
          const severityStr = args[++i];
          if (!severityStr) {
            throw new CommandError("No severity value provided", "EINVAL");
          }
          severity = parseSeverityString(severityStr);
          if (severity.length === 0) {
            throw new CommandError("Invalid severity values", "EINVAL");
          }
        } else if (arg === "--no-source") {
          includeSource = false;
        } else if (arg === "--max-per-file") {
          const maxValue = args[++i];
          if (!maxValue || isNaN(Number(maxValue))) {
            throw new CommandError("Invalid max-per-file value", "EINVAL");
          }
          maxPerFile = Number(maxValue);
        } else if (arg === "--json") {
          json = true;
        } else if (arg === "--no-emoji") {
          noEmoji = true;
        } else if (arg === "--open-first") {
          openFirst = true;
          openN = 1;
        } else if (arg === "--open") {
          const openValue = args[++i];
          if (!openValue || isNaN(Number(openValue))) {
            throw new CommandError("Invalid open value", "EINVAL");
          }
          openN = Number(openValue);
          openFirst = openN > 0;
        }
      }

      try {
        const fileInfo = await getFileDiagnostics(filePath, {
          severity,
          maxPerFile,
        });

        if (!fileInfo) {
          const checkIcon = noEmoji ? "[✓]" : "✅";
          return `${checkIcon} No issues found in ${filePath}`;
        }

        // Handle opening first/nth diagnostic
        if (openFirst && fileInfo.diagnostics.length > 0) {
          const diagnosticIndex = Math.min(
            openN - 1,
            fileInfo.diagnostics.length - 1
          );
          const diagnostic = fileInfo.diagnostics[diagnosticIndex];

          const uri = safeUriFromString(fileInfo.uri);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, {
            selection: diagnostic.range,
            viewColumn: vscode.ViewColumn.One,
          });
        }

        return formatFileDiagnostics(fileInfo, {
          includeSource,
          maxPerFile,
          json,
          noEmoji,
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Failed to get file diagnostics: ${errorMessage}`,
          "EDIAGNOSTIC",
          true
        );
      }
    },
    description: "Get diagnostics for a specific file with advanced options",
    usage:
      "getFileDiagnostics <filePath> [--errors-only|-e] [--warnings-only|-w] [--info-only|-i] [--hints-only|-H] [--severity <error,warning,info,hint>] [--no-source] [--max-per-file <n>] [--json] [--no-emoji] [--open-first] [--open <n>]",
  },

  watchDiagnostics: {
    handler: async (args: string[]): Promise<string> => {
      let action = "start";
      let severity: vscode.DiagnosticSeverity[] | undefined;
      let filePattern: string | undefined;
      let debounceMs = 100;

      // Parse arguments
      let i = 0;
      if (args.length > 0 && !args[0].startsWith("--")) {
        action = args[0].toLowerCase();
        i = 1;
      }

      for (; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--severity") {
          const severityStr = args[++i];
          if (!severityStr) {
            throw new CommandError("No severity value provided", "EINVAL");
          }
          severity = parseSeverityString(severityStr);
          if (severity.length === 0) {
            throw new CommandError("Invalid severity values", "EINVAL");
          }
        } else if (arg === "--file-pattern") {
          filePattern = args[++i];
          if (!filePattern) {
            throw new CommandError("No file pattern provided", "EINVAL");
          }
        } else if (arg === "--debounce") {
          const debounceValue = args[++i];
          if (!debounceValue || isNaN(Number(debounceValue))) {
            throw new CommandError("Invalid debounce value", "EINVAL");
          }
          debounceMs = Number(debounceValue);
        }
      }

      const watcher = getGlobalDiagnosticWatcher();

      try {
        switch (action) {
          case "start":
            watcher.start({ severity, filePattern, debounceMs });
            return "🔍 **Diagnostic watcher started** - Now monitoring for diagnostic changes";

          case "stop":
            watcher.stop();
            return "⏹️ **Diagnostic watcher stopped** - No longer monitoring diagnostic changes";

          case "status":
            const stats = watcher.getChangeStats();
            const severityList =
              stats.activeFilters.severity?.join(", ") || "all";
            const patternInfo = stats.activeFilters.filePattern || "all files";

            return `📊 **Diagnostic Watcher Status**
**Active:** ${stats.isActive ? "✅ Yes" : "❌ No"}
**Watched Files:** ${stats.watchedFiles}
**Active Handlers:** ${stats.totalHandlers}
**Debounce:** ${stats.debounceMs}ms
**Severity Filter:** ${severityList}
**File Pattern:** ${patternInfo}`;

          case "once":
            const changes = await watcher.takeSnapshot();
            if (changes.length === 0) {
              return "📸 **Snapshot taken** - No diagnostic changes detected";
            }

            const changeLines = changes.map((change) => {
              const addedCount = change.added.length;
              const removedCount = change.removed.length;
              return `📄 \`${change.relativePath}\` - +${addedCount} -${removedCount}`;
            });

            return `📸 **Diagnostic Changes Snapshot**\n\n${changeLines.join(
              "\n"
            )}`;

          default:
            throw new CommandError(
              `Unknown action: ${action}. Use 'start', 'stop', 'status', or 'once'`,
              "EINVAL"
            );
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Failed to manage diagnostic watcher: ${errorMessage}`,
          "EDIAGNOSTIC",
          true
        );
      }
    },
    description:
      "Start, stop, check status, or take snapshot of diagnostic change monitoring",
    usage:
      "watchDiagnostics [start|stop|status|once] [--severity <error,warning,info,hint>] [--file-pattern <pattern>] [--debounce <ms>]",
  },

  diagnosticStats: {
    handler: async (): Promise<string> => {
      try {
        const summary = await getAllDiagnostics();

        const lines: string[] = [];
        lines.push("📊 **Workspace Diagnostic Statistics**");
        lines.push("");
        lines.push(`**Total Issues:** ${summary.totalDiagnostics}`);
        lines.push(`**Files with Issues:** ${summary.totalFiles}`);
        lines.push("");
        lines.push("**By Severity:**");
        lines.push(`❌ **Errors:** ${summary.errorCount}`);
        lines.push(`⚠️ **Warnings:** ${summary.warningCount}`);
        lines.push(`ℹ️ **Information:** ${summary.infoCount}`);
        lines.push(`💡 **Hints:** ${summary.hintCount}`);

        if (summary.totalDiagnostics === 0) {
          lines.push("");
          lines.push("✅ **Great job! No issues found in your workspace.**");
        }

        return lines.join("\n");
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new CommandError(
          `Failed to get diagnostic statistics: ${errorMessage}`,
          "EDIAGNOSTIC",
          true
        );
      }
    },
    description: "Show diagnostic statistics summary for the workspace",
    usage: "diagnosticStats",
  },
};
