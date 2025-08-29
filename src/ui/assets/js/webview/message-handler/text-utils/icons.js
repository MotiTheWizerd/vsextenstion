export function getStartingIcon(categoryName) {
  switch (categoryName) {
    case "diagnostic":
      return "🩺";
    case "fileModification":
      return "🛠️";
    case "fileReading":
      return "📖";
    case "search":
      return "🔎";
    case "listing":
      return "📂";
    case "indexing":
      return "🗂️";
    default:
      return "🚀";
  }
}

export function getCommandIcon(categoryName /*, categoryData */) {
  switch (categoryName) {
    case "diagnostic":
      return "🧪";
    case "fileModification":
      return "✏️";
    case "fileReading":
      return "📄";
    case "search":
      return "🔍";
    case "listing":
      return "🗂";
    case "indexing":
      return "🧭";
    default:
      return "⚙️";
  }
}

