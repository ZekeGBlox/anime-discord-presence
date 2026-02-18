function getPlatform() {
    let ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    return 'linux';
}

function initInstaller() {
    let downloadInstaller = document.getElementById('downloadInstaller');
    let retryConnection = document.getElementById('retryConnection');
    let setupClientId = document.getElementById('setupClientId');
    let clientIdInput = document.getElementById('clientId');
    let connectionText = document.getElementById('connectionText');

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

    let links = {
        'setupDevPortalLink': 'https://discord.com/developers/applications',
        'discordDevLink': 'https://discord.com/developers/applications',
        'pythonDownloadLink': 'https://www.python.org/downloads/',
        'pythonHelpLink': 'https://www.python.org/downloads/'
    };
    Object.entries(links).forEach(([id, url]) => {
        let el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ url });
            });
        }
    });
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
