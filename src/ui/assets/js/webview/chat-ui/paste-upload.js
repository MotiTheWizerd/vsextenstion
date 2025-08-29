// Paste handling and file upload support

export function handlePaste(ui, event) {
  const items = (event.clipboardData || event.originalEvent.clipboardData).items;
  for (const item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) {
        handleFileUpload(ui, file);
        event.preventDefault();
        return;
      }
    }
  }
}

export function handleFileUpload(ui, file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    ui.postMessage({
      command: "fileUpload",
      filename: file.name,
      type: file.type,
      size: file.size,
      content: e.target.result,
    });
  };
  reader.readAsDataURL(file);
}

