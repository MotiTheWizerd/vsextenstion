
import { ResultParser } from './fileUtils/resultParser.js';
import { DropdownRenderer } from './fileUtils/dropdownRenderer.js';
import { UIController } from './fileUtils/uiController.js';

class FileUtils {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.resultParser = new ResultParser();
    this.uiController = new UIController(chatUI, this.resultParser);
  }

  hasFileResults(results) {
    if (!results || results.length === 0) {
      return false;
    }

    const fileObjects = this.resultParser.extractFileList(results);
    return fileObjects && fileObjects.length > 0;
  }

  createFileDropdown(results, totalCount) {
    const fileObjects = this.resultParser.extractFileList(results);
    if (!fileObjects || fileObjects.length === 0) {
      return "";
    }

    return DropdownRenderer.render(results, fileObjects);
  }

  toggleToolDropdown(messageDiv) {
    this.uiController.toggleToolDropdown(messageDiv);
  }

  openFile(filePath) {
    this.uiController.openFile(filePath);
  }

  showFileDiff(filePath) {
    this.uiController.showFileDiff(filePath);
  }
}

window.FileUtils = FileUtils;
