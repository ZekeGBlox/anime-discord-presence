const NATIVE_HOST = 'com.animepresence.discord';

let nativePort = null;
let reconnectTimeout = null;
let keepaliveInterval = null;

let state = {
    connected: false,
    enabled: true,
    anime: null,
    episode: null,
    episodeTitle: null,
    progress: null,
    pageState: 'idle',
    thumbnail: null,
    playing: false,
    nativeHostError: null
};
 
let settings = {
    showProgressBar: true,
    showPlayState: true,
    idleStatus: 'Browsing Anime',
    clientId: ''
};

function connectNative() {
    if (nativePort || !state.enabled) return;

    try {
        nativePort = chrome.runtime.connectNative(NATIVE_HOST);

        nativePort.onMessage.addListener((msg) => {
            if (msg.type === 'status') {
                state.connected = msg.connected;
                state.nativeHostError = null;
                notifyPopup();
            }
        });

        nativePort.onDisconnect.addListener(() => {
            let err = chrome.runtime.lastError;
            nativePort = null;
            state.connected = false;
            clearInterval(keepaliveInterval);
            keepaliveInterval = null;

            if (err && err.message && err.message.includes('not found')) {
                state.nativeHostError = 'not_installed';
                notifyPopup();
                return;
            }

            state.nativeHostError = null;
            notifyPopup();
            scheduleReconnect();
        });

        // keepalive so the service worker doesnt die
        clearInterval(keepaliveInterval);
        keepaliveInterval = setInterval(() => {
            sendNative({ type: 'ping' });
        }, 25000);

        sendNative({ type: 'settings_update', settings });
    } catch (e) {
        nativePort = null;
        state.nativeHostError = 'not_installed';
        notifyPopup();
    }
}

function sendNative(msg) {
    if (!nativePort) return;
    try { nativePort.postMessage(msg); } catch (e) {}
}

function scheduleReconnect() {
    if (reconnectTimeout || !state.enabled) return;
    reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        connectNative();
    }, 5000);
}

function notifyPopup() {
    chrome.runtime.sendMessage({ type: 'POPUP_UPDATE', data: state }).catch(() => {});
}

function broadcastToTabs(msg) {
    chrome.tabs.query({ url: '*://*.crunchyroll.com/*' }, (tabs) => {
        tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, msg).catch(() => {}));
    });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'ANIME_STATE') {
        sendNative({ type: 'anime_state', ...msg.data, settings });
        if (msg.stateForPopup) {
            state = { ...state, ...msg.stateForPopup };
            notifyPopup();
        }
    }

    if (msg.type === 'GET_STATE') {
        sendResponse(state);
    }

    if (msg.type === 'TOGGLE_ENABLED') {
        state.enabled = msg.enabled;
        chrome.storage.local.set({ enabled: msg.enabled });
        broadcastToTabs({ type: 'ENABLED_CHANGED', enabled: msg.enabled });

        if (msg.enabled) {
            connectNative();
        } else {
            if (nativePort) {
                sendNative({ type: 'disconnect' });
                nativePort.disconnect();
                nativePort = null;
            }
            state.connected = false;
            state.nativeHostError = null;
            clearInterval(keepaliveInterval);
            keepaliveInterval = null;
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            notifyPopup();
        }
    }

    if (msg.type === 'RETRY_CONNECTION') {
        state.nativeHostError = null;
        if (nativePort) {
            nativePort.disconnect();
            nativePort = null;
        }
        connectNative();
    }

    if (msg.type === 'SETTINGS_UPDATE') {
        let oldClientId = settings.clientId;
        settings = { ...settings, ...msg.settings };
        broadcastToTabs({ type: 'SETTINGS_CHANGED', settings: msg.settings });
        sendNative({ type: 'settings_update', settings });
        if (settings.clientId && settings.clientId !== oldClientId) {
            sendNative({ type: 'set_client_id', clientId: settings.clientId });
        }
    }

    if (msg.type === 'GET_SETTINGS') {
        sendResponse(settings);
    }

    return true;
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        enabled: true,
        showProgressBar: true,
        showPlayState: true,
        idleStatus: 'Browsing Anime',
        compactMode: false,
        showThumbnails: true,
        accentColor: 'orange',
        clientId: ''
    });
});

chrome.storage.local.get(['enabled', 'clientId', 'showProgressBar', 'showPlayState', 'idleStatus'], (result) => {
    state.enabled = result.enabled !== false;
    if (result.clientId) settings.clientId = result.clientId;
    if (result.showProgressBar !== undefined) settings.showProgressBar = result.showProgressBar;
    if (result.showPlayState !== undefined) settings.showPlayState = result.showPlayState;
    if (result.idleStatus) settings.idleStatus = result.idleStatus;
    if (state.enabled) connectNative();
});
