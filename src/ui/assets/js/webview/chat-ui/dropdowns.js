// Dropdown menu behavior for model/agent selection

export function initializeDropdowns(ui) {
  document.addEventListener("click", (e) => {
    const dropdownToggle = e.target.closest(".dropdown-toggle");
    const dropdown = dropdownToggle?.closest(".dropdown");
    document.querySelectorAll(".dropdown").forEach((d) => {
      if (d !== dropdown) d.classList.remove("show");
    });
    if (dropdownToggle) {
      e.preventDefault();
      dropdown?.classList.toggle("show");
    } else {
      document.querySelectorAll(".dropdown").forEach((d) => d.classList.remove("show"));
    }
  });

  document.addEventListener("click", (e) => {
    const dropdownItem = e.target.closest(".dropdown-item");
    if (!dropdownItem) return;
    const value = dropdownItem.dataset.value;
    const dropdown = dropdownItem.closest(".dropdown");
    const dropdownToggle = dropdown?.querySelector(".dropdown-toggle");
    if (dropdownToggle) {
      const icon = dropdownToggle.querySelector("span");
      if (icon) {
        const selectedText = dropdownItem.textContent.trim();
        icon.textContent = value === "agent" ? "∞ Agent" : selectedText;
      }
      dropdown.classList.remove("show");
      ui.postMessage({ command: "agentModeSelected", mode: value });
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".dropdown").forEach((d) => d.classList.remove("show"));
    }
  });
}

