function initSettings() {
    let $ = (id) => document.getElementById(id);

    let enableToggle = $('enableToggle');
    let showPlayState = $('showPlayState');
    let showProgressBar = $('showProgressBar');
    let idleStatusInput = $('idleStatus');
    let saveSettings = $('saveSettings');
    let compactMode = $('compactMode');
    let showThumbnails = $('showThumbnails');
    let accentColor = $('accentColor');
    let saveDisplaySettings = $('saveDisplaySettings');
    let clientIdInput = $('clientId');
    let setupClientId = $('setupClientId');
    let autoSkipToggle = $('autoSkip');

    chrome.storage.local.get([
        'enabled', 'showPlayState', 'showProgressBar', 'idleStatus',
        'compactMode', 'showThumbnails', 'accentColor', 'clientId', 'autoSkip'
    ], (r) => {
        enableToggle.checked = r.enabled !== false;
        showPlayState.checked = r.showPlayState !== false;
        showProgressBar.checked = r.showProgressBar !== false;
        autoSkipToggle.checked = r.autoSkip || false;
        idleStatusInput.value = r.idleStatus || '';
        compactMode.checked = r.compactMode || false;
        showThumbnails.checked = r.showThumbnails !== false;
        accentColor.value = r.accentColor || 'orange';
        applyTheme(r.accentColor || 'orange');
        document.body.style.minHeight = (r.compactMode ? '350px' : '450px');
        if (r.clientId) {
            clientIdInput.value = r.clientId;
            setupClientId.value = r.clientId;
        }
    });

    enableToggle.addEventListener('change', () => {
        chrome.storage.local.set({ enabled: enableToggle.checked });
        chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED', enabled: enableToggle.checked });
    });

    autoSkipToggle.addEventListener('change', () => {
        let val = autoSkipToggle.checked;
        chrome.storage.local.set({ autoSkip: val });
        chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATE', settings: { autoSkip: val } });
    });

    saveSettings.addEventListener('click', () => {
        let s = {
            clientId: clientIdInput.value.trim(),
            showPlayState: showPlayState.checked,
            showProgressBar: showProgressBar.checked,
            idleStatus: idleStatusInput.value || 'Browsing Anime'
        };
        chrome.storage.local.set(s, () => {
            chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATE', settings: s });
            setupClientId.value = s.clientId;
            flashButton(saveSettings, 'Saved!', 'Save Settings');
        });
    });

    saveDisplaySettings.addEventListener('click', () => {
        let d = {
            compactMode: compactMode.checked,
            showThumbnails: showThumbnails.checked,
            accentColor: accentColor.value
        };
        chrome.storage.local.set(d, () => {
            applyTheme(accentColor.value);
            document.body.style.minHeight = (compactMode.checked ? '350px' : '450px');
            flashButton(saveDisplaySettings, 'Applied!', 'Apply Theme');
        });
    });
}

function flashButton(btn, text, original) {
    btn.textContent = text;
    btn.classList.add('saved');
    setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('saved');
    }, 2000);
}
