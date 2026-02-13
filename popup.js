document.addEventListener('DOMContentLoaded', () => {
    let $ = (id) => document.getElementById(id);

    let connectionStatus = $('connectionStatus');
    let connectionText = $('connectionText');
    let nowWatching = $('nowWatching');
    let idleState = $('idleState');
    let animeTitle = $('animeTitle');
    let episodeInfo = $('episodeInfo');
    let animeThumbnail = $('animeThumbnail');
    let progressFill = $('progressFill');
    let currentTime = $('currentTime');
    let duration = $('duration');
    let enableToggle = $('enableToggle');
    let playStatus = $('playStatus');
    let showPlayState = $('showPlayState');
    let showProgressBar = $('showProgressBar');
    let idleStatusInput = $('idleStatus');
    let saveSettings = $('saveSettings');
    let compactMode = $('compactMode');
    let showThumbnails = $('showThumbnails');
    let accentColor = $('accentColor');
    let saveDisplaySettings = $('saveDisplaySettings');
    let setupScreen = $('setupScreen');
    let downloadInstaller = $('downloadInstaller');
    let retryConnection = $('retryConnection');
    let clientIdInput = $('clientId');
    let setupClientId = $('setupClientId');

    let themes = {
        orange: { primary: '#f47521', secondary: '#ff6b35' },
        purple: { primary: '#5865f2', secondary: '#7289da' },
        blue: { primary: '#3498db', secondary: '#2980b9' },
        green: { primary: '#2ecc71', secondary: '#27ae60' },
        pink: { primary: '#e91e63', secondary: '#c2185b' },
        red: { primary: '#e74c3c', secondary: '#c0392b' }
    };

    // tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            tab.classList.add('active');
            $(tab.dataset.tab + 'Tab').classList.add('active');
        });
    });

    // load settings
    chrome.storage.local.get([
        'enabled', 'showPlayState', 'showProgressBar', 'idleStatus',
        'compactMode', 'showThumbnails', 'accentColor', 'clientId'
    ], (r) => {
        enableToggle.checked = r.enabled !== false;
        showPlayState.checked = r.showPlayState !== false;
        showProgressBar.checked = r.showProgressBar !== false;
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

    function flashButton(btn, text, original) {
        btn.textContent = text;
        btn.classList.add('saved');
        setTimeout(() => {
            btn.textContent = original;
            btn.classList.remove('saved');
        }, 2000);
    }

    function applyTheme(name) {
        let t = themes[name] || themes.orange;
        let el = document.getElementById('dynamic-theme');
        if (el) el.remove();
        let style = document.createElement('style');
        style.id = 'dynamic-theme';
        style.textContent = `
            .header { background: linear-gradient(90deg, ${t.primary}, ${t.secondary}) !important; }
            .tab.active { color: ${t.primary} !important; border-bottom-color: ${t.primary} !important; }
            .now-watching-header, .settings-title { color: ${t.primary} !important; }
            .progress-fill { background: linear-gradient(90deg, ${t.primary}, ${t.secondary}) !important; }
            .toggle input:checked + .toggle-slider { background: linear-gradient(90deg, ${t.primary}, ${t.secondary}) !important; }
            .save-btn, .setup-btn:not(.secondary) { background: linear-gradient(90deg, ${t.primary}, ${t.secondary}) !important; }
            .text-input:focus, .select-input:focus { border-color: ${t.primary} !important; }
            .setup-num { color: ${t.primary} !important; background: ${t.primary}22 !important; }
        `;
        document.head.appendChild(style);
    }

    // setup screen - auto install flow
    downloadInstaller.addEventListener('click', () => {
        let extId = chrome.runtime.id;
        let platform = getPlatform();
        let content, filename;

        if (platform === 'windows') {
            content = generateWindowsInstaller(extId);
            filename = 'anime-presence-setup.bat';
        } else {
            content = generateUnixInstaller(extId, platform);
            filename = 'anime-presence-setup.sh';
        }

        let blob = new Blob([content], { type: 'application/octet-stream' });
        let a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    });

    retryConnection.addEventListener('click', () => {
        let cid = setupClientId.value.trim();
        if (cid) {
            chrome.storage.local.set({ clientId: cid });
            chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATE', settings: { clientId: cid } });
            clientIdInput.value = cid;
        }
        chrome.runtime.sendMessage({ type: 'RETRY_CONNECTION' });
        connectionText.textContent = 'Connecting to Discord...';
    });

    // external links
    let links = {
        'setupDevPortalLink': 'https://discord.com/developers/applications',
        'discordDevLink': 'https://discord.com/developers/applications',
        'pythonDownloadLink': 'https://www.python.org/downloads/',
        'pythonHelpLink': 'https://www.python.org/downloads/'
    };
    Object.entries(links).forEach(([id, url]) => {
        let el = $(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ url });
            });
        }
    });

    function getPlatform() {
        let ua = navigator.userAgent.toLowerCase();
        if (ua.includes('win')) return 'windows';
        if (ua.includes('mac')) return 'macos';
        return 'linux';
    }

    function generateWindowsInstaller(extId) {
        return `@echo off
setlocal enabledelayedexpansion

echo.
echo   Anime Discord Presence - Setup
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   Python not found!
    echo.
    echo   Download it from: https://www.python.org/downloads/
    echo   IMPORTANT: Check "Add to PATH" at the bottom of the installer!
    echo.
    echo   After installing Python, run this script again.
    pause
    exit /b 1
)

echo   Python found.
echo.

set "EXT_ID=${extId}"
set "FOUND="

echo   Searching for extension...

REM search chrome web store install locations
for %%D in (
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Extensions\\%EXT_ID%"
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Profile 1\\Extensions\\%EXT_ID%"
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Profile 2\\Extensions\\%EXT_ID%"
    "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Profile 3\\Extensions\\%EXT_ID%"
    "%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Extensions\\%EXT_ID%"
    "%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Extensions\\%EXT_ID%"
) do (
    if exist "%%~D" (
        for /d %%V in ("%%~D\\*") do (
            if exist "%%~V\\native_host\\anime_discord_presence.py" (
                set "EXT_DIR=%%~V"
                set "FOUND=1"
            )
        )
    )
)

REM search common folders for unpacked extension
if not defined FOUND (
    for /f "delims=" %%F in ('dir /s /b "%USERPROFILE%\\native_host\\anime_discord_presence.py" 2^>nul') do (
        set "PYPATH=%%F"
        set "EXT_DIR=%%~dpF.."
        for %%A in ("!EXT_DIR!") do set "EXT_DIR=%%~fA"
        if exist "!EXT_DIR!\\native_host\\anime_discord_presence.py" (
            set "FOUND=1"
        )
    )
)

if not defined FOUND (
    echo.
    echo   Couldn't find extension folder automatically.
    echo   This happens when loading the extension unpacked.
    echo.
    echo   To find the path:
    echo     1. Go to chrome://extensions
    echo     2. Find "Anime Discord Presence"
    echo     3. Look for the path shown under the extension
    echo        (or click the ID and check the URL bar)
    echo.
    set /p EXT_DIR="   Paste extension folder path: "
)

REM strip quotes if they pasted with them
set "EXT_DIR=!EXT_DIR:"=!"

if not exist "!EXT_DIR!\\native_host\\anime_discord_presence.py" (
    echo.
    echo   Couldn't find native_host\\anime_discord_presence.py at that path.
    echo   Make sure you're pointing to the folder that contains native_host\\
    pause
    exit /b 1
)

echo   Found extension at: !EXT_DIR!
echo.

set "NATIVE_DIR=!EXT_DIR!\\native_host"
set "BAT_PATH=!NATIVE_DIR!\\anime_discord_presence.bat"
set "BAT_PATH_JSON=!BAT_PATH:\\=\\\\!"

(
    echo {
    echo   "name": "com.animepresence.discord",
    echo   "description": "Anime Discord Presence Native Host",
    echo   "path": "!BAT_PATH_JSON!",
    echo   "type": "stdio",
    echo   "allowed_origins": [
    echo     "chrome-extension://!EXT_ID!/"
    echo   ]
    echo }
) > "!NATIVE_DIR!\\com.animepresence.discord.json"

set "MANIFEST=!NATIVE_DIR!\\com.animepresence.discord.json"

reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.animepresence.discord" /ve /t REG_SZ /d "!MANIFEST!" /f >nul 2>&1
echo   Registered for Chrome.

reg add "HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\com.animepresence.discord" /ve /t REG_SZ /d "!MANIFEST!" /f >nul 2>&1
reg add "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.animepresence.discord" /ve /t REG_SZ /d "!MANIFEST!" /f >nul 2>&1

echo.
echo   Done! Go back to the extension and click "Save ^& Connect".
echo.
pause
`;
    }

    function generateUnixInstaller(extId, platform) {
        let isMac = platform === 'macos';
        let searchDirs = isMac
            ? `"$HOME/Library/Application Support/Google/Chrome/Default/Extensions/$EXT_ID"
    "$HOME/Library/Application Support/Google/Chrome/Profile 1/Extensions/$EXT_ID"
    "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/Default/Extensions/$EXT_ID"`
            : `"$HOME/.config/google-chrome/Default/Extensions/$EXT_ID"
    "$HOME/.config/google-chrome/Profile 1/Extensions/$EXT_ID"
    "$HOME/.config/BraveSoftware/Brave-Browser/Default/Extensions/$EXT_ID"`;

        let chromeDir = isMac
            ? '"$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"'
            : '"$HOME/.config/google-chrome/NativeMessagingHosts"';

        return `#!/bin/bash
set -e

echo ""
echo "  Anime Discord Presence - Setup"
echo ""

if ! command -v python3 &> /dev/null; then
    echo "  Python 3 not found!"
    echo ""
    echo "  Install it:"
    echo "    macOS: brew install python3"
    echo "    Ubuntu/Debian: sudo apt install python3"
    echo "    Or download from: https://www.python.org/downloads/"
    echo ""
    exit 1
fi

echo "  Python found."
echo "  Searching for extension..."

EXT_ID="${extId}"
EXT_DIR=""

for dir in ${searchDirs}; do
    if [ -d "$dir" ]; then
        for ver in "$dir"/*/; do
            if [ -f "\${ver}native_host/anime_discord_presence.py" ]; then
                EXT_DIR="\${ver%/}"
            fi
        done
    fi
done

# search home directory for unpacked extension
if [ -z "$EXT_DIR" ]; then
    FOUND=\$(find "$HOME" -maxdepth 5 -name "anime_discord_presence.py" -path "*/native_host/*" 2>/dev/null | head -1)
    if [ -n "$FOUND" ]; then
        EXT_DIR=\$(dirname "\$(dirname "$FOUND")")
    fi
fi

if [ -z "$EXT_DIR" ]; then
    echo ""
    echo "  Couldn't find extension folder automatically."
    echo "  This happens when loading the extension unpacked."
    echo ""
    echo "  To find the path:"
    echo "    1. Go to chrome://extensions"
    echo "    2. Find Anime Discord Presence"
    echo "    3. Copy the path shown under the extension"
    echo ""
    read -rp "  Paste extension folder path: " EXT_DIR
fi

HOST="$EXT_DIR/native_host/anime_discord_presence.py"
if [ ! -f "$HOST" ]; then
    echo "  Couldn't find native_host/anime_discord_presence.py at that path."
    echo "  Make sure you're pointing to the folder that contains native_host/"
    exit 1
fi

echo "  Found extension at: $EXT_DIR"
chmod +x "$HOST"

MANIFEST='{
  "name": "com.animepresence.discord",
  "description": "Anime Discord Presence Native Host",
  "path": "'"$HOST"'",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://'"$EXT_ID"'/"]
}'

CHROME_DIR=${chromeDir}
mkdir -p "$CHROME_DIR"
echo "$MANIFEST" > "$CHROME_DIR/com.animepresence.discord.json"
echo "  Registered for Chrome."

echo ""
echo "  Done! Go back to the extension and click Save & Connect."
echo ""
`;
    }

    // main ui update
    function updateUI(s) {
        if (s.nativeHostError === 'not_installed') {
            setupScreen.style.display = 'block';
            document.querySelector('.tabs').style.display = 'none';
            document.querySelectorAll('.tab-content').forEach(tc => {
                tc.classList.remove('active');
                tc.style.removeProperty('display');
            });
            return;
        }

        setupScreen.style.display = 'none';
        document.querySelector('.tabs').style.display = 'flex';
        // clear any inline display overrides so css classes work
        document.querySelectorAll('.tab-content').forEach(tc => tc.style.removeProperty('display'));
        let activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            $(activeTab.dataset.tab + 'Tab').classList.add('active');
        }

        if (s.connected) {
            connectionStatus.classList.remove('disconnected');
            connectionStatus.classList.add('connected');
            connectionText.textContent = 'Connected to Discord';
        } else {
            connectionStatus.classList.remove('connected');
            connectionStatus.classList.add('disconnected');
            connectionText.textContent = 'Connecting to Discord...';
        }

        chrome.storage.local.get(['showThumbnails'], (r) => {
            let showThumb = r.showThumbnails !== false;
            if (s.anime && s.pageState === 'watching') {
                nowWatching.style.display = 'block';
                idleState.style.display = 'none';
                animeTitle.textContent = s.anime;

                let epText = '';
                if (s.episode) epText += 'Episode ' + s.episode;
                if (s.episodeTitle) {
                    if (epText) epText += ' \u2022 ';
                    epText += s.episodeTitle;
                }
                episodeInfo.textContent = epText || 'Watching';

                if (s.thumbnail && showThumb) {
                    animeThumbnail.src = s.thumbnail;
                    animeThumbnail.style.display = 'block';
                } else {
                    animeThumbnail.style.display = 'none';
                }

                if (s.progress) {
                    let parts = s.progress.split(' / ');
                    if (parts.length === 2) {
                        currentTime.textContent = parts[0];
                        duration.textContent = parts[1];
                        let cur = parseTime(parts[0]);
                        let total = parseTime(parts[1]);
                        progressFill.style.width = (total > 0 ? (cur / total) * 100 : 0) + '%';
                    }
                }

                if (s.playing) {
                    playStatus.className = 'play-status playing';
                    playStatus.innerHTML = '\u25b6 Playing';
                } else {
                    playStatus.className = 'play-status paused';
                    playStatus.innerHTML = '\u23f8 Paused';
                }
            } else {
                nowWatching.style.display = 'none';
                idleState.style.display = 'block';
            }
        });
    }

    function parseTime(str) {
        if (!str) return 0;
        let p = str.split(':').map(Number);
        if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
        if (p.length === 2) return p[0] * 60 + p[1];
        return 0;
    }

    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (r) => {
        if (r) updateUI(r);
    });

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'POPUP_UPDATE') updateUI(msg.data);
    });
});
