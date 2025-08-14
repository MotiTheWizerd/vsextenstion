// Panel button interactions
document.addEventListener('DOMContentLoaded', () => {
    const settingsBtn = document.querySelector('.codicon-gear');
    const moreBtn = document.querySelector('.codicon-ellipsis');
    const maximizeBtn = document.querySelector('.codicon-chrome-maximize');
    const closeBtn = document.querySelector('.codicon-chrome-close');

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'openSettings' });
        });
    }

    if (moreBtn) {
        moreBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'showMoreActions' });
        });
    }

    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'maximizePanel' });
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'closePanel' });
        });
    }
});
