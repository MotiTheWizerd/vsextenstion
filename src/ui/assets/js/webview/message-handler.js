class MessageHandler {
  constructor(chatUI) {
    this.chatUI = chatUI;
  }

  handleToolStatus(data) {
    console.log("[RayDaemon] handleToolStatus called with:", data);
    
    const {
      status,
      tools,
      successCount,
      failedCount,
      totalCount,
      error,
      results,
      currentIndex,
      batchMode,
    } = data;

    console.log("[RayDaemon] Tool status:", status, "batchMode:", batchMode, "tools:", tools);

    let content = "";
    let className = "tool-status";

    if (status === "starting") {
      console.log("[RayDaemon] Processing starting status, batchMode:", batchMode);
      if (batchMode) {
        // Show batch starting indicator
        const taskDescription = this.getBatchDescription(tools, totalCount);
        console.log("[RayDaemon] Creating batch starting message with taskDescription:", taskDescription);
        // Get appropriate icon for starting state based on tools
        const startingCategories = this.categorizeCommands(tools, []);
        const primaryStartingCategory = Object.entries(startingCategories)
          .filter(([key, value]) => value.count > 0)
          .sort(([, a], [, b]) => b.count - a.count)[0];
        
        const startingIcon = primaryStartingCategory 
          ? this.getStartingIcon(primaryStartingCategory[0])
          : "🚀";

        content = `<div class="${className} starting" data-tool-id="batch-starting">
          <div class="tool-status-main">
            <div class="tool-icon">${startingIcon}</div>
            <div class="tool-content">
              <div class="tool-text">Initializing: ${taskDescription}</div>
            </div>
            <div class="tool-meta">
              <div class="tool-badge">Starting</div>
            </div>
          </div>
        </div>`;

        // Remove any existing batch starting indicator
        const existingStarting = this.chatUI.chatMessages.querySelector(
          '[data-tool-id="batch-starting"]'
        );
        if (existingStarting) {
          existingStarting.remove();
        }
      } else {
        // Individual command starting (legacy support)
        const toolList =
          tools && tools.length > 0 ? tools.join(", ") : "Processing";
        const progressText =
          currentIndex && totalCount ? ` (${currentIndex}/${totalCount})` : "";

        // Get appropriate icon for starting state based on tools
        const individualStartingCategories = this.categorizeCommands(tools, []);
        const primaryIndividualStartingCategory = Object.entries(individualStartingCategories)
          .filter(([key, value]) => value.count > 0)
          .sort(([, a], [, b]) => b.count - a.count)[0];
        
        const individualStartingIcon = primaryIndividualStartingCategory 
          ? this.getStartingIcon(primaryIndividualStartingCategory[0])
          : "🚀";

        content = `<div class="${className} starting" data-tool-id="current-starting-${
          currentIndex || "batch"
        }">
          <div class="tool-status-main">
            <div class="tool-icon">${individualStartingIcon}</div>
            <div class="tool-content">
              <div class="tool-text">Initializing: ${toolList}${progressText}</div>
            </div>
            <div class="tool-meta">
              <div class="tool-badge">Starting</div>
            </div>
          </div>
        </div>`;

        const existingStarting = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="current-starting-${currentIndex || "batch"}"]`
        );
        if (existingStarting) {
          existingStarting.remove();
        }
      }
    } else if (status === "working") {
      if (batchMode) {
        // Show batch working indicator with current progress
        const taskDescription = this.getBatchDescription(tools, totalCount);
        const progressText =
          currentIndex && totalCount ? ` (${currentIndex}/${totalCount})` : "";

        content = `<div class="${className} working" data-tool-id="batch-working">
          <div class="tool-status-main">
            <div class="tool-icon">⚡</div>
            <div class="tool-content">
              <div class="tool-text">${taskDescription}${progressText}</div>
            </div>
            <div class="tool-meta">
              <div class="tool-badge">Processing</div>
              <div class="tool-spinner"></div>
            </div>
          </div>
          <div class="tool-progress"></div>
        </div>`;

        // Remove the batch starting indicator
        const existingStarting = this.chatUI.chatMessages.querySelector(
          '[data-tool-id="batch-starting"]'
        );
        if (existingStarting) {
          existingStarting.remove();
        }

        // Update existing working indicator or create new one
        const existingWorking = this.chatUI.chatMessages.querySelector(
          '[data-tool-id="batch-working"]'
        );
        if (existingWorking) {
          // Update the text content of the existing working indicator
          const textElement = existingWorking.querySelector(".tool-text");
          if (textElement) {
            textElement.textContent = `${taskDescription}${progressText}`;
          }
          return; // Don't create a new message, just update existing
        }
      } else {
        // Individual command working (legacy support)
        const toolList =
          tools && tools.length > 0 ? tools.join(", ") : "Processing";
        const progressText =
          currentIndex && totalCount ? ` (${currentIndex}/${totalCount})` : "";

        content = `<div class="${className} working" data-tool-id="current-working-${
          currentIndex || "batch"
        }">
          <div class="tool-status-main">
            <div class="tool-icon">⚡</div>
            <div class="tool-content">
              <div class="tool-text">${toolList}${progressText}</div>
            </div>
            <div class="tool-meta">
              <div class="tool-badge">Processing</div>
              <div class="tool-spinner"></div>
            </div>
          </div>
          <div class="tool-progress"></div>
        </div>`;

        const existingStarting = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="current-starting-${currentIndex || "batch"}"]`
        );
        if (existingStarting) {
          existingStarting.remove();
        }

        const existingWorking = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="current-working-${currentIndex || "batch"}"]`
        );
        if (existingWorking) {
          existingWorking.remove();
        }
      }
    } else if (status === "completed") {
      if (batchMode) {
        // Remove batch indicators
        const startingIndicator = this.chatUI.chatMessages.querySelector(
          '[data-tool-id="batch-starting"]'
        );
        if (startingIndicator) {
          startingIndicator.remove();
        }

        const workingIndicator = this.chatUI.chatMessages.querySelector(
          '[data-tool-id="batch-working"]'
        );
        if (workingIndicator) {
          workingIndicator.remove();
        }

        // Check if results contain file paths
        console.log("[RayDaemon] Checking results for files:", results);
        const hasFileResults = this.chatUI.fileUtils.hasFileResults(results);
        console.log("[RayDaemon] hasFileResults result:", hasFileResults);

        const extractedFiles = this.chatUI.fileUtils.extractFileList(results);
        console.log("[RayDaemon] extractedFiles:", extractedFiles);

        // Check if we should force file results based on command types
        const shouldHaveFiles = this.shouldHaveFileResults(tools, results);
        console.log(
          "[RayDaemon] shouldHaveFiles based on commands:",
          shouldHaveFiles
        );

        const finalHasFileResults = hasFileResults || shouldHaveFiles;
        console.log("[RayDaemon] finalHasFileResults:", finalHasFileResults);

        const dropdownHtml = finalHasFileResults
          ? this.chatUI.fileUtils.createFileDropdown(results, totalCount)
          : "";
        console.log("[RayDaemon] dropdownHtml length:", dropdownHtml.length);

        // Get the actual count of files for display
        const fileCount = finalHasFileResults
          ? Math.max(extractedFiles.length, 1)
          : 0;
        
        // Only show file count if we actually have files, otherwise show operation count
        const shouldShowFileCount = finalHasFileResults && extractedFiles.length > 0;
        const displayCount = shouldShowFileCount ? fileCount : totalCount;
        const displayLabel = shouldShowFileCount
          ? fileCount === 1
            ? "file"
            : "files"
          : totalCount === 1
          ? "result"
          : "results";
        
        // Only make expandable if we have actual files to show
        const shouldBeExpandable = finalHasFileResults && dropdownHtml && extractedFiles.length > 0;

        console.log(
          "[RayDaemon] Batch completion - finalHasFileResults:",
          finalHasFileResults,
          "fileCount:",
          fileCount,
          "displayCount:",
          displayCount
        );

        // Create batch completion message with detailed results
        const taskDescription = this.getDetailedCompletionMessage(
          tools,
          results,
          totalCount
        );

        // Get appropriate icon for this command type
        const primaryCategory = Object.entries(
          this.categorizeCommands(tools, results)
        )
          .filter(([key, value]) => value.count > 0)
          .sort(([, a], [, b]) => b.count - a.count)[0];

        const commandIcon = primaryCategory
          ? this.getCommandIcon(primaryCategory[0], primaryCategory[1])
          : "⚙️";

        if (failedCount > 0) {
          content = `<div class="${className} partial" data-tool-id="batch-completed">
            <div class="tool-status-main">
              <div class="tool-icon">⚠️</div>
              <div class="tool-content">
                <div class="tool-text">${taskDescription} (${failedCount} error${
            failedCount > 1 ? "s" : ""
          })</div>
              </div>
              <div class="tool-meta">
                <div class="tool-badge">Partial</div>
                <div class="tool-count ${
                  shouldBeExpandable ? "expandable" : ""
                }" data-expandable="${shouldBeExpandable}">${successCount}/${totalCount}</div>
              </div>
            </div>
            ${dropdownHtml}
          </div>`;
        } else {
          content = `<div class="${className} success" data-tool-id="batch-completed">
            <div class="tool-status-main">
              <div class="tool-icon">${commandIcon}</div>
              <div class="tool-content">
                <div class="tool-text">${taskDescription}</div>
              </div>
              <div class="tool-meta">
                <div class="tool-badge">Completed</div>
                <div class="tool-count ${
                  shouldBeExpandable ? "expandable" : ""
                }" data-expandable="${shouldBeExpandable}">${displayCount} ${displayLabel}</div>
              </div>
            </div>
            ${dropdownHtml}
          </div>`;
        }
      } else {
        // Individual command completion (legacy support)
        const startingIndicator = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="current-starting-${currentIndex || "batch"}"]`
        );
        if (startingIndicator) {
          startingIndicator.remove();
        }

        const workingIndicator = this.chatUI.chatMessages.querySelector(
          `[data-tool-id="current-working-${currentIndex || "batch"}"]`
        );
        if (workingIndicator) {
          workingIndicator.remove();
        }

        const hasFileResults = this.chatUI.fileUtils.hasFileResults(results);
        const dropdownHtml = hasFileResults
          ? this.chatUI.fileUtils.createFileDropdown(results, totalCount || 1)
          : "";

        // Get the actual count of files for display
        const extractedFiles = hasFileResults ? this.chatUI.fileUtils.extractFileList(results) : [];
        const fileCount = extractedFiles.length;
        
        // Only show file count if we actually have files, otherwise show operation count
        const shouldShowFileCount = hasFileResults && fileCount > 0;
        const displayCount = shouldShowFileCount ? fileCount : 1;
        const displayLabel = shouldShowFileCount
          ? fileCount === 1
            ? "file"
            : "files"
          : "result";
        
        // Only make expandable if we have actual files to show
        const shouldBeExpandable = hasFileResults && dropdownHtml && fileCount > 0;

        console.log(
          "[RayDaemon] Individual completion - hasFileResults:",
          hasFileResults,
          "fileCount:",
          fileCount,
          "displayCount:",
          displayCount
        );

        let completionText = this.getCompletionText(tools, 1);
        const progressText =
          currentIndex && totalCount ? ` (${currentIndex}/${totalCount})` : "";

        // Get appropriate icon for this individual command
        const individualCategory = Object.entries(
          this.categorizeCommands(tools, results)
        )
          .filter(([key, value]) => value.count > 0)
          .sort(([, a], [, b]) => b.count - a.count)[0];

        const individualIcon = individualCategory
          ? this.getCommandIcon(individualCategory[0], individualCategory[1])
          : "⚙️";

        if (failedCount > 0) {
          content = `<div class="${className} partial" data-tool-id="completed-${
            currentIndex || "batch"
          }">
            <div class="tool-status-main">
              <div class="tool-icon">⚠️</div>
              <div class="tool-content">
                <div class="tool-text">${completionText}${progressText} (error)</div>
              </div>
              <div class="tool-meta">
                <div class="tool-badge">Error</div>
                <div class="tool-count ${
                  hasFileResults && dropdownHtml ? "expandable" : ""
                }" data-expandable="${!!(
            hasFileResults && dropdownHtml
          )}">Error</div>
              </div>
            </div>
            ${dropdownHtml}
          </div>`;
        } else {
          content = `<div class="tool-status success" data-tool-id="completed-${
            currentIndex || "batch"
          }">
            <div class="tool-status-main">
              <div class="tool-icon">${individualIcon}</div>
              <div class="tool-content">
                <div class="tool-text">${completionText}${progressText}</div>
              </div>
              <div class="tool-meta">
                <div class="tool-badge">Completed</div>
                <div class="tool-count ${
                  hasFileResults && dropdownHtml ? "expandable" : ""
                }" data-expandable="${!!(
            hasFileResults && dropdownHtml
          )}">${displayCount} ${displayLabel}</div>
              </div>
            </div>
            ${dropdownHtml}
          </div>`;
        }
      }
    } else if (status === "failed") {
      // Remove both starting and working indicators for this command
      const startingIndicator = this.chatUI.chatMessages.querySelector(
        `[data-tool-id="current-starting-${currentIndex || "batch"}"]`
      );
      if (startingIndicator) {
        startingIndicator.remove();
      }

      const workingIndicator = this.chatUI.chatMessages.querySelector(
        `[data-tool-id="current-working-${currentIndex || "batch"}"]`
      );
      if (workingIndicator) {
        workingIndicator.remove();
      }

      const toolList = tools && tools.length > 0 ? tools.join(", ") : "Tool";
      const progressText =
        currentIndex && totalCount ? ` (${currentIndex}/${totalCount})` : "";

      content = `<div class="${className} failed" data-tool-id="failed-${
        currentIndex || "batch"
      }">
        <div class="tool-status-main">
          <div class="tool-icon">❌</div>
          <div class="tool-content">
            <div class="tool-text">Failed: ${toolList}${progressText}</div>
          </div>
          <div class="tool-meta">
            <div class="tool-badge">Failed</div>
          </div>
        </div>
      </div>`;
    }

    if (content) {
      const messageDiv = document.createElement("div");
      messageDiv.className = "message system tool-message";
      messageDiv.innerHTML = content;

      this.chatUI.chatMessages.appendChild(messageDiv);

      // Only add click handler for completed status with valid dropdowns
      if (status === "completed") {
        const expandableCount = messageDiv.querySelector(
          ".tool-count.expandable"
        );
        const dropdown = messageDiv.querySelector(".tool-dropdown");

        console.log(
          "[RayDaemon] Looking for expandable count:",
          expandableCount
        );
        console.log("[RayDaemon] Found dropdown:", !!dropdown);

        // Only make it clickable if we have both an expandable count and a dropdown with content
        if (expandableCount && dropdown) {
          console.log("[RayDaemon] Adding click handler to expandable count");

          expandableCount.addEventListener("click", (e) => {
            console.log(
              "[RayDaemon] Tool count clicked!",
              expandableCount.textContent
            );
            e.preventDefault();
            e.stopPropagation();
            this.chatUI.fileUtils.toggleToolDropdown(messageDiv);
          });

          // Add visual cursor pointer and clear title for clickable elements
          expandableCount.style.cursor = "pointer";
          expandableCount.title = "Click to view details";
          expandableCount.setAttribute('role', 'button');
          expandableCount.setAttribute('aria-expanded', 'false');
          console.log(
            "[RayDaemon] Made tool count clickable with pointer cursor"
          );
        } else {
          console.log(
            "[RayDaemon] No valid expandable count or dropdown found"
          );

          // Remove expandable class and interactive properties if no dropdown content
          const anyToolCount = messageDiv.querySelector(".tool-count");
          if (anyToolCount && !dropdown) {
            anyToolCount.classList.remove("expandable");
            anyToolCount.removeAttribute("data-expandable");
            anyToolCount.style.cursor = "default";
            anyToolCount.removeAttribute('role');
            anyToolCount.removeAttribute('aria-expanded');
            anyToolCount.removeAttribute('title');
          }
        }

        // Add click handlers for file items
        const fileItems = messageDiv.querySelectorAll(".tool-file-item");
        fileItems.forEach(fileItem => {
          fileItem.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const filePath = fileItem.getAttribute("data-file-path");
            if (filePath) {
              console.log("[RayDaemon] Opening file:", filePath);
              // Send message to extension to open the file
              this.chatUI.postMessage({
                command: "openFile",
                filePath: filePath
              });
            }
          });
          
          // Add hover effect
          fileItem.style.cursor = "pointer";
        });

        // Add click handlers for diff icons
        const diffIcons = messageDiv.querySelectorAll(".tool-file-diff");
        diffIcons.forEach(diffIcon => {
          diffIcon.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const filePath = diffIcon.getAttribute("data-file-path");
            if (filePath) {
              console.log("[RayDaemon] Showing diff for file:", filePath);
              // Send message to extension to show the diff
              this.chatUI.postMessage({
                command: "showDiff",
                filePath: filePath
              });
            }
          });
          
          // Add hover effect
          diffIcon.style.cursor = "pointer";
          diffIcon.title = "Click to view changes";
        });
      }

      this.chatUI.scrollToBottom();
    }
  }

  getDetailedCompletionMessage(tools, results, totalCount) {
    if (!tools || tools.length === 0 || !results || results.length === 0) {
      return `Analyzed ${totalCount} task${totalCount > 1 ? "s" : ""}`;
    }

    // Analyze the actual results to create specific completion messages
    const successfulResults = results.filter((r) => r.ok);

    // Categorize commands by type for better grouping
    const commandCategories = this.categorizeCommands(tools, results);

    // Generate messages based on command categories
    return this.generateCategoryMessage(
      commandCategories,
      successfulResults,
      totalCount
    );
  }

  categorizeCommands(tools, results) {
    const categories = {
      diagnostic: { count: 0, tools: [], results: [] },
      fileModification: { count: 0, tools: [], results: [] },
      fileReading: { count: 0, tools: [], results: [] },
      search: { count: 0, tools: [], results: [] },
      listing: { count: 0, tools: [], results: [] },
      indexing: { count: 0, tools: [], results: [] },
      other: { count: 0, tools: [], results: [] },
    };

    console.log("[RayDaemon] Categorizing tools:", tools);

    tools.forEach((tool, index) => {
      const toolLower = tool.toLowerCase();
      const result = results[index];

      console.log(`[RayDaemon] Categorizing tool: "${tool}" (${toolLower})`);

      // More specific categorization with exact matches first
      if (
        toolLower === "getalldiagnostics" ||
        toolLower === "getfilediagnostics" ||
        toolLower.includes("diagnostic")
      ) {
        categories.diagnostic.count++;
        categories.diagnostic.tools.push(tool);
        categories.diagnostic.results.push(result);
        console.log(`[RayDaemon] → Categorized as diagnostic`);
      } else if (
        toolLower === "write" ||
        toolLower === "append" ||
        toolLower === "replace" ||
        toolLower.startsWith("writing ") ||
        toolLower.startsWith("modifying ")
      ) {
        categories.fileModification.count++;
        categories.fileModification.tools.push(tool);
        categories.fileModification.results.push(result);
        console.log(`[RayDaemon] → Categorized as fileModification`);
      } else if (
        toolLower === "read" ||
        toolLower === "open" ||
        toolLower.startsWith("reading ")
      ) {
        categories.fileReading.count++;
        categories.fileReading.tools.push(tool);
        categories.fileReading.results.push(result);
        console.log(`[RayDaemon] → Categorized as fileReading`);
      } else if (
        toolLower.includes("search") ||
        toolLower.includes("find") ||
        toolLower.includes("grep")
      ) {
        categories.search.count++;
        categories.search.tools.push(tool);
        categories.search.results.push(result);
        console.log(`[RayDaemon] → Categorized as search`);
      } else if (
        toolLower === "ls" ||
        toolLower === "list" ||
        toolLower.startsWith("listing ")
      ) {
        categories.listing.count++;
        categories.listing.tools.push(tool);
        categories.listing.results.push(result);
        console.log(`[RayDaemon] → Categorized as listing`);
      } else if (
        toolLower === "loadindex" ||
        toolLower === "createindex" ||
        toolLower === "updateindex" ||
        (toolLower.includes("index") &&
          (toolLower.includes("load") ||
            toolLower.includes("create") ||
            toolLower.includes("update")))
      ) {
        categories.indexing.count++;
        categories.indexing.tools.push(tool);
        categories.indexing.results.push(result);
        console.log(`[RayDaemon] → Categorized as indexing`);
      } else {
        categories.other.count++;
        categories.other.tools.push(tool);
        categories.other.results.push(result);
        console.log(`[RayDaemon] → Categorized as other`);
      }
    });

    console.log("[RayDaemon] Final categories:", categories);
    return categories;
  }

  generateCategoryMessage(categories, successfulResults, totalCount) {
    // Find the primary category (most commands)
    const primaryCategory = Object.entries(categories)
      .filter(([key, value]) => value.count > 0)
      .sort(([, a], [, b]) => b.count - a.count)[0];

    if (!primaryCategory) {
      // Try to be more specific based on tools even without categories
      if (tools && tools.length > 0) {
        const toolNames = tools.slice(0, 2).join(", ");
        if (tools.length > 2) {
          return `Executed ${toolNames} and ${tools.length - 2} other command${tools.length - 2 > 1 ? "s" : ""}`;
        } else {
          return `Executed ${toolNames}`;
        }
      }
      return `Completed ${totalCount} operation${totalCount > 1 ? "s" : ""}`;
    }

    const [categoryName, categoryData] = primaryCategory;
    const hasMultipleCategories =
      Object.values(categories).filter((cat) => cat.count > 0).length > 1;

    console.log(
      `[RayDaemon] Generating message for category: ${categoryName}`,
      categoryData
    );

    // Try to generate a specific message based on actual tool names first
    const specificMessage = this.generateSpecificMessage(
      categoryData,
      hasMultipleCategories,
      totalCount
    );
    if (specificMessage) {
      return specificMessage;
    }

    // Fall back to category-based messages
    switch (categoryName) {
      case "diagnostic":
        return this.generateDiagnosticMessage(
          categoryData,
          hasMultipleCategories,
          totalCount
        );
      case "fileModification":
        return this.generateFileModificationMessage(
          categoryData,
          hasMultipleCategories,
          totalCount
        );
      case "fileReading":
        return this.generateFileReadingMessage(
          categoryData,
          hasMultipleCategories,
          totalCount
        );
      case "search":
        return this.generateSearchMessage(
          categoryData,
          hasMultipleCategories,
          totalCount
        );
      case "listing":
        return this.generateListingMessage(
          categoryData,
          hasMultipleCategories,
          totalCount
        );
      case "indexing":
        return this.generateIndexingMessage(
          categoryData,
          hasMultipleCategories,
          totalCount
        );
      default:
        return this.generateMixedMessage(categories, totalCount);
    }
  }

  /**
   * Generate specific messages based on actual tool names and results
   */
  generateSpecificMessage(categoryData, hasMultiple, totalCount) {
    if (!categoryData.tools || categoryData.tools.length === 0) {
      return null;
    }

    const tools = categoryData.tools;
    const results = categoryData.results;

    // Look for specific patterns in tool names
    const toolsLower = tools.map((t) => t.toLowerCase());

    // Check for specific operations
    if (toolsLower.some((t) => t.includes("codebase") && t.includes("index"))) {
      return hasMultiple
        ? `Updated codebase index + ${
            totalCount - categoryData.count
          } other operation${totalCount - categoryData.count > 1 ? "s" : ""}`
        : `Updated codebase index`;
    }

    if (
      toolsLower.some((t) => t.includes("analyzing") || t.includes("analyzed"))
    ) {
      const fileCount = this.countFilesInResults(results);
      return hasMultiple
        ? `Analyzed ${fileCount} file${fileCount > 1 ? "s" : ""} + ${
            totalCount - categoryData.count
          } other operation${totalCount - categoryData.count > 1 ? "s" : ""}`
        : `Analyzed ${fileCount} file${fileCount > 1 ? "s" : ""}`;
    }

    if (toolsLower.some((t) => t.includes("reading") || t.includes("read"))) {
      const fileCount = this.countFilesInResults(results);
      return hasMultiple
        ? `Read ${fileCount} file${fileCount > 1 ? "s" : ""} + ${
            totalCount - categoryData.count
          } other operation${totalCount - categoryData.count > 1 ? "s" : ""}`
        : `Read ${fileCount} file${fileCount > 1 ? "s" : ""}`;
    }

    if (
      toolsLower.some((t) => t.includes("writing") || t.includes("modifying"))
    ) {
      const fileCount = categoryData.count;
      return hasMultiple
        ? `Modified ${fileCount} file${fileCount > 1 ? "s" : ""} + ${
            totalCount - fileCount
          } other operation${totalCount - fileCount > 1 ? "s" : ""}`
        : `Modified ${fileCount} file${fileCount > 1 ? "s" : ""}`;
    }

    // If no specific pattern found, return null to use category-based message
    return null;
  }

  /**
   * Get appropriate icon for starting state based on command category
   */
  getStartingIcon(categoryName) {
    switch (categoryName) {
      case "diagnostic":
        return "🔍"; // Magnifying glass for analysis
      case "fileModification":
        return "✏️"; // Pencil for editing
      case "fileReading":
        return "📖"; // Book for reading
      case "search":
        return "🔎"; // Search icon
      case "listing":
        return "📋"; // Clipboard for listing
      case "indexing":
        return "🗂️"; // Index cards for indexing
      default:
        return "🚀"; // Rocket for generic starting
    }
  }

  /**
   * Get appropriate icon for command category
   */
  getCommandIcon(categoryName, categoryData) {
    const tools = categoryData.tools || [];
    const toolsLower = tools.map((t) => t.toLowerCase());

    // Specific operation icons
    if (toolsLower.some((t) => t.includes("codebase") && t.includes("index"))) {
      return "🗂️"; // Index/database icon
    }

    if (
      toolsLower.some((t) => t.includes("analyzing") || t.includes("analyzed"))
    ) {
      return "🔍"; // Analysis icon
    }

    if (
      toolsLower.some((t) => t.includes("creating") || t.includes("created"))
    ) {
      return "✨"; // Creation icon
    }

    if (
      toolsLower.some((t) => t.includes("writing") || t.includes("modifying"))
    ) {
      return "✏️"; // Writing/editing icon
    }

    // Category-based icons
    switch (categoryName) {
      case "diagnostic":
        return "🩺"; // Medical diagnostic icon
      case "fileModification":
        return "📝"; // File editing icon
      case "fileReading":
        return "📖"; // Reading icon
      case "search":
        return "🔎"; // Search icon
      case "listing":
        return "📋"; // List icon
      case "indexing":
        return "🗃️"; // Filing cabinet icon
      default:
        return "⚙️"; // Generic operation icon
    }
  }

  /**
   * Count files mentioned in results
   */
  countFilesInResults(results) {
    const files = new Set();

    results.forEach((result) => {
      if (result && result.ok) {
        // Check command arguments for file paths
        if (result.args && result.args.length > 0) {
          const firstArg = result.args[0];
          if (
            typeof firstArg === "string" &&
            (firstArg.includes("/") || firstArg.includes("\\"))
          ) {
            files.add(firstArg);
          }
        }

        // Check output for file paths
        if (result.output && typeof result.output === "string") {
          const lines = result.output.split("\n");
          lines.forEach((line) => {
            if (line.includes("/") || line.includes("\\")) {
              // Extract potential file path
              const cleaned = line.trim().replace(/^["']|["']$/g, "");
              if (cleaned.length > 0) {
                files.add(cleaned);
              }
            }
          });
        }
      }
    });

    return files.size || 1; // At least 1 if we have results
  }

  /**
   * Check if commands should have file results based on their types
   */
  shouldHaveFileResults(tools, results) {
    if (!tools || tools.length === 0) {
      return false;
    }

    const toolsLower = tools.map((t) => t.toLowerCase());

    // Commands that typically work with files
    const fileCommands = [
      "write",
      "append",
      "replace",
      "read",
      "open",
      "create",
      "modify",
      "update",
      "edit",
      "writing",
      "reading",
      "creating",
      "modifying",
    ];

    // Check if any tool suggests file operations
    const hasFileCommand = toolsLower.some((tool) =>
      fileCommands.some((cmd) => tool.includes(cmd))
    );

    if (hasFileCommand) {
      console.log("[RayDaemon] Found file command in tools:", toolsLower);
      return true;
    }

    // Check if results have file-like arguments or output
    const hasFileInResults =
      results &&
      results.some((result) => {
        if (!result || !result.ok) {return false;}

        // Check command arguments
        if (result.args && result.args.length > 0) {
          const firstArg = result.args[0];
          if (
            typeof firstArg === "string" &&
            (firstArg.includes("/") ||
              firstArg.includes("\\") ||
              firstArg.includes("."))
          ) {
            console.log("[RayDaemon] Found file-like argument:", firstArg);
            return true;
          }
        }

        // Check if command name suggests file operations
        if (
          result.command &&
          fileCommands.some((cmd) => result.command.toLowerCase().includes(cmd))
        ) {
          console.log("[RayDaemon] Found file command:", result.command);
          return true;
        }

        return false;
      });

    return hasFileInResults;
  }

  generateDiagnosticMessage(categoryData, hasMultiple, totalCount) {
    let diagnosticCount = 0;
    let fileCount = 0;

    categoryData.results.forEach((result) => {
      if (result && result.ok && result.output) {
        if (typeof result.output === "string") {
          const lines = result.output.split("\n").filter((line) => line.trim());
          diagnosticCount += lines.length;
          // Count unique files mentioned in diagnostics
          const files = new Set();
          lines.forEach((line) => {
            if (line.includes("/") || line.includes("\\")) {
              const parts = line.split(":");
              if (parts.length > 0) {
                files.add(parts[0]);
              }
            }
          });
          fileCount += files.size;
        }
      }
    });

    if (hasMultiple) {
      if (diagnosticCount > 0) {
        return `Analyzed ${diagnosticCount} diagnostic${
          diagnosticCount > 1 ? "s" : ""
        } + ${totalCount - categoryData.count} other operation${
          totalCount - categoryData.count > 1 ? "s" : ""
        }`;
      } else {
        return `Analyzed diagnostics + ${
          totalCount - categoryData.count
        } other operation${totalCount - categoryData.count > 1 ? "s" : ""}`;
      }
    } else {
      if (diagnosticCount > 0) {
        return `Analyzed ${diagnosticCount} diagnostic${
          diagnosticCount > 1 ? "s" : ""
        } across ${fileCount} file${fileCount > 1 ? "s" : ""}`;
      } else {
        return `Analyzed diagnostics (no issues found)`;
      }
    }
  }

  generateFileModificationMessage(categoryData, hasMultiple, totalCount) {
    const fileCount = categoryData.count;
    
    // Extract file names from the results
    const modifiedFiles = [];
    categoryData.results.forEach((result) => {
      if (result && result.ok && result.args && result.args.length > 0) {
        const filePath = result.args[0];
        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        modifiedFiles.push(fileName);
      }
    });

    if (modifiedFiles.length === 0) {
      // Fallback to generic message
      if (hasMultiple) {
        return `Modified ${fileCount} file${fileCount > 1 ? "s" : ""} + ${
          totalCount - fileCount
        } other operation${totalCount - fileCount > 1 ? "s" : ""}`;
      } else {
        return `Modified ${fileCount} file${fileCount > 1 ? "s" : ""}`;
      }
    }

    // Create specific message with file names
    if (modifiedFiles.length === 1) {
      const message = `${modifiedFiles[0]} was modified`;
      if (hasMultiple) {
        return `${message} + ${totalCount - fileCount} other operation${totalCount - fileCount > 1 ? "s" : ""}`;
      }
      return message;
    } else {
      const firstFile = modifiedFiles[0];
      const remainingCount = modifiedFiles.length - 1;
      const message = `${firstFile} was modified and ${remainingCount}+ other${remainingCount > 1 ? "s" : ""}`;
      if (hasMultiple) {
        return `${message} + ${totalCount - fileCount} other operation${totalCount - fileCount > 1 ? "s" : ""}`;
      }
      return message;
    }
  }

  generateFileReadingMessage(categoryData, hasMultiple, totalCount) {
    let totalLines = 0;
    const fileCount = categoryData.count;

    categoryData.results.forEach((result) => {
      if (
        result &&
        result.ok &&
        result.output &&
        typeof result.output === "string"
      ) {
        const lines = result.output.split("\n").filter((line) => line.trim());
        totalLines += lines.length;
      }
    });

    if (hasMultiple) {
      return `Read ${fileCount} file${fileCount > 1 ? "s" : ""} + ${
        totalCount - fileCount
      } other operation${totalCount - fileCount > 1 ? "s" : ""}`;
    } else {
      if (totalLines > 0) {
        return `Read ${fileCount} file${
          fileCount > 1 ? "s" : ""
        } (${totalLines} lines total)`;
      } else {
        return `Read ${fileCount} file${fileCount > 1 ? "s" : ""}`;
      }
    }
  }

  generateSearchMessage(categoryData, hasMultiple, totalCount) {
    let totalMatches = 0;
    let totalFiles = 0;

    categoryData.results.forEach((result) => {
      if (
        result &&
        result.ok &&
        result.output &&
        typeof result.output === "string"
      ) {
        const lines = result.output.split("\n").filter((line) => line.trim());
        const matches = lines.filter(
          (line) =>
            line.includes(":") && (line.includes("/") || line.includes("\\"))
        );
        totalMatches += matches.length;

        const files = new Set();
        matches.forEach((match) => {
          const parts = match.split(":");
          if (parts.length > 0) {
            files.add(parts[0]);
          }
        });
        totalFiles += files.size;
      }
    });

    if (hasMultiple) {
      if (totalMatches > 0) {
        return `Found ${totalMatches} match${totalMatches > 1 ? "es" : ""} + ${
          totalCount - categoryData.count
        } other operation${totalCount - categoryData.count > 1 ? "s" : ""}`;
      } else {
        return `Searched codebase + ${
          totalCount - categoryData.count
        } other operation${totalCount - categoryData.count > 1 ? "s" : ""}`;
      }
    } else {
      if (totalMatches > 0) {
        return `Found ${totalMatches} match${
          totalMatches > 1 ? "es" : ""
        } across ${totalFiles} file${totalFiles > 1 ? "s" : ""}`;
      } else {
        return `Searched codebase (no matches)`;
      }
    }
  }

  generateListingMessage(categoryData, hasMultiple, totalCount) {
    const dirCount = categoryData.count;
    
    // Try to get the directory name from the first result
    let dirName = "";
    if (categoryData.results && categoryData.results.length > 0) {
      const firstResult = categoryData.results[0];
      if (firstResult && firstResult.args && firstResult.args.length > 0) {
        const dirPath = firstResult.args[0] || ".";
        dirName = dirPath === "." ? "current directory" : dirPath.split(/[/\\]/).pop() || dirPath;
      }
    }

    const baseMessage = dirName ? `Listed ${dirName}` : `Listed ${dirCount} director${dirCount > 1 ? "ies" : "y"}`;
    
    if (hasMultiple) {
      return `${baseMessage} + ${totalCount - dirCount} other operation${totalCount - dirCount > 1 ? "s" : ""}`;
    } else {
      return baseMessage;
    }
  }

  generateIndexingMessage(categoryData, hasMultiple, totalCount) {
    if (hasMultiple) {
      return `Updated codebase index + ${
        totalCount - categoryData.count
      } other operation${totalCount - categoryData.count > 1 ? "s" : ""}`;
    } else {
      return `Updated codebase index`;
    }
  }

  generateMixedMessage(categories, totalCount) {
    const activeCategories = Object.entries(categories)
      .filter(([key, value]) => value.count > 0)
      .sort(([, a], [, b]) => b.count - a.count);

    if (activeCategories.length <= 1) {
      return `Completed ${totalCount} operation${totalCount > 1 ? "s" : ""}`;
    }

    // Create a summary of the top 2-3 categories
    const topCategories = activeCategories.slice(0, 3);
    const categoryNames = topCategories.map(([name, data]) => {
      switch (name) {
        case "diagnostic":
          return `${data.count} diagnostic${data.count > 1 ? "s" : ""}`;
        case "fileModification":
          return `${data.count} file modification${data.count > 1 ? "s" : ""}`;
        case "fileReading":
          return `${data.count} file read${data.count > 1 ? "s" : ""}`;
        case "search":
          return `${data.count} search${data.count > 1 ? "es" : ""}`;
        case "listing":
          return `${data.count} listing${data.count > 1 ? "s" : ""}`;
        case "indexing":
          return `${data.count} index operation${data.count > 1 ? "s" : ""}`;
        default:
          return `${data.count} operation${data.count > 1 ? "s" : ""}`;
      }
    });

    if (categoryNames.length === 2) {
      return `Completed ${categoryNames[0]} + ${categoryNames[1]}`;
    } else if (categoryNames.length === 3) {
      return `Completed ${categoryNames[0]} + ${categoryNames[1]} + ${categoryNames[2]}`;
    } else {
      return `Completed ${totalCount} mixed operations`;
    }
  }

  getBatchDescription(tools, totalCount) {
    if (!tools || tools.length === 0) {
      return `${totalCount} task${totalCount > 1 ? "s" : ""}`;
    }

    // Use the same categorization logic for consistency
    const categories = this.categorizeCommands(tools, []);

    // Find the primary category
    const primaryCategory = Object.entries(categories)
      .filter(([key, value]) => value.count > 0)
      .sort(([, a], [, b]) => b.count - a.count)[0];

    if (!primaryCategory) {
      return `${totalCount} operation${totalCount > 1 ? "s" : ""}`;
    }

    const [categoryName, categoryData] = primaryCategory;
    const hasMultipleCategories =
      Object.values(categories).filter((cat) => cat.count > 0).length > 1;

    // Generate batch descriptions based on primary category
    switch (categoryName) {
      case "diagnostic":
        return hasMultipleCategories
          ? `${categoryData.count} diagnostic${
              categoryData.count > 1 ? "s" : ""
            } + ${totalCount - categoryData.count} other${
              totalCount - categoryData.count > 1 ? "s" : ""
            }`
          : `${categoryData.count} diagnostic${
              categoryData.count > 1 ? "s" : ""
            }`;
      case "fileModification":
        return hasMultipleCategories
          ? `${categoryData.count} file modification${
              categoryData.count > 1 ? "s" : ""
            } + ${totalCount - categoryData.count} other${
              totalCount - categoryData.count > 1 ? "s" : ""
            }`
          : `${categoryData.count} file${categoryData.count > 1 ? "s" : ""}`;
      case "fileReading":
        return hasMultipleCategories
          ? `${categoryData.count} file read${
              categoryData.count > 1 ? "s" : ""
            } + ${totalCount - categoryData.count} other${
              totalCount - categoryData.count > 1 ? "s" : ""
            }`
          : `${categoryData.count} file${categoryData.count > 1 ? "s" : ""}`;
      case "search":
        return hasMultipleCategories
          ? `${categoryData.count} search${
              categoryData.count > 1 ? "es" : ""
            } + ${totalCount - categoryData.count} other${
              totalCount - categoryData.count > 1 ? "s" : ""
            }`
          : `${categoryData.count} search${categoryData.count > 1 ? "es" : ""}`;
      case "listing":
        return hasMultipleCategories
          ? `${categoryData.count} listing${
              categoryData.count > 1 ? "s" : ""
            } + ${totalCount - categoryData.count} other${
              totalCount - categoryData.count > 1 ? "s" : ""
            }`
          : `${categoryData.count} director${
              categoryData.count > 1 ? "ies" : "y"
            }`;
      case "indexing":
        return hasMultipleCategories
          ? `index update + ${totalCount - categoryData.count} other${
              totalCount - categoryData.count > 1 ? "s" : ""
            }`
          : `index update`;
      default:
        return `${totalCount} operation${totalCount > 1 ? "s" : ""}`;
    }
  }

  getCompletionText(tools, resultCount) {
    if (!tools || tools.length === 0) {
      return "Task completed";
    }

    // Determine the primary action based on tools used
    const toolTypes = tools.map((tool) => tool.toLowerCase());

    if (toolTypes.some((t) => t.includes("search"))) {
      return "Searched codebase";
    } else if (toolTypes.some((t) => t.includes("read"))) {
      return "Read file(s)";
    } else if (
      toolTypes.some((t) => t.includes("find") || t.includes("symbol"))
    ) {
      return "Found symbols";
    } else if (
      toolTypes.some((t) => t.includes("load") || t.includes("index"))
    ) {
      return "Updated index";
    } else if (toolTypes.some((t) => t.includes("list"))) {
      return "Listed directory";
    } else if (toolTypes.some((t) => t.includes("open"))) {
      return "Opened file(s)";
    } else if (toolTypes.some((t) => t.includes("write"))) {
      return "Modified file(s)";
    } else {
      return "Analyzed codebase";
    }
  }

  handleIncomingMessage(message) {
    console.log("Received message:", message);
    console.log("Message type:", message.type);
    console.log("Message data:", message.data);

    // Clear typing indicator and timeout for any incoming response
    if (this.chatUI.typingTimeout) {
      clearTimeout(this.chatUI.typingTimeout);
      this.chatUI.typingTimeout = null;
    }
    this.chatUI.showTypingIndicator(false);

    // Handle tool status messages
    if (message.type === "toolStatus" && message.data) {
      this.handleToolStatus(message.data);
      return;
    }

    // Handle different message types
    if (message.type === "chat_response") {
      this.chatUI.addMessage("assistant", message.content, {
        isMarkdown: true,
        showAvatar: true,
      });
      return;
    }

    if (message.type === "rayResponse" && message.data) {
      const { content, isWorking, isFinal, isCommandResult } = message.data;
      console.log("rayResponse - content:", content);
      console.log("rayResponse - isWorking:", isWorking);
      console.log("rayResponse - isFinal:", isFinal);
      console.log("rayResponse - isCommandResult:", isCommandResult);
      
      if (content) {
        // Skip old command result messages only if they're not final responses
        if (isCommandResult && !isFinal) {
          console.log("Skipping command result message (not final)");
          return;
        }
        
        console.log("Adding rayResponse message to chat");
        
        // If this is a final response and we have a working message, replace it
        if (isFinal !== false && !isWorking) {
          const workingMessage = this.chatUI.chatMessages.querySelector(
            '[data-working="true"]'
          );
          if (workingMessage) {
            workingMessage.remove();
          }
        }

        this.chatUI.addMessage("assistant", content, {
          isMarkdown: true,
          showAvatar: true,
          isWorking: isWorking || false,
        });
      } else {
        console.log("rayResponse has no content, skipping");
      }
      return;
    }

    // Handle command-based messages
    if (message.command) {
      switch (message.command) {
        case "addMessage":
          this.chatUI.addMessage(message.sender, message.content, {
            ...message.options,
            showAvatar: true,
          });
          break;
        case "showTyping":
          this.chatUI.showTypingIndicator(message.typing);
          break;
        case "clearChat":
          this.chatUI.clearChat();
          break;
        case "setStatus":
          this.chatUI.setStatus(message.status);
          break;
        case "chatError":
          this.chatUI.addMessage("assistant", `Error: ${message.error}`, {
            isMarkdown: false,
            showAvatar: true,
          });
          break;
      }
    }
  }
}

// MessageHandler is now globally available
