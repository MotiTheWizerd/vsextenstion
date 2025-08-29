export function countFilesInResults(results = []) {
  let count = 0;
  try {
    results.forEach((result) => {
      if (result && result.ok && Array.isArray(result.args) && result.args.length > 0) {
        const first = result.args[0];
        if (typeof first === "string") count++;
      }
    });
  } catch (_) {}
  return count;
}

export function shouldHaveFileResults(tools = [], results = []) {
  try {
    const fileCommands = ["open", "read", "write", "append", "replace", "list", "ls", "diff", "find"];
    const hasFileInResults = results?.some((result) => {
      if (!result) return false;
      if (result.ok && typeof result.output === "string") {
        const hasPathLike = /[\/\\]/.test(result.output) || result.output.includes(".");
        if (hasPathLike) return true;
      }
      if (Array.isArray(result.args) && result.args.length > 0) {
        const firstArg = result.args[0];
        if (typeof firstArg === "string" && (firstArg.includes("/") || firstArg.includes("\\") || firstArg.includes("."))) {
          return true;
        }
      }
      if (result.command && fileCommands.some((cmd) => String(result.command).toLowerCase().includes(cmd))) {
        return true;
      }
      return false;
    });
    return !!hasFileInResults;
  } catch (e) {
    return false;
  }
}

