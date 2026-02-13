@echo off
setlocal enabledelayedexpansion

echo.
echo   Anime Discord Presence - Manual Setup
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   Python not found. Install from https://python.org
    pause
    exit /b 1
)

echo   Python found.
echo.

set "SCRIPT_DIR=%~dp0"
set "NATIVE_DIR=%SCRIPT_DIR%native_host"

if not exist "%NATIVE_DIR%" (
    echo   native_host folder not found. Make sure this script
    echo   is in the extension root folder.
    pause
    exit /b 1
)

echo   To find your extension ID:
echo     1. Go to chrome://extensions
echo     2. Turn on Developer mode
echo     3. Copy the ID under Anime Discord Presence
echo.
set /p EXT_ID="   Extension ID: "

if "%EXT_ID%"=="" (
    echo   ID is required.
    pause
    exit /b 1
)

set "BAT_PATH=%NATIVE_DIR%\anime_discord_presence.bat"
set "BAT_PATH_JSON=!BAT_PATH:\=\\!"

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
) > "%NATIVE_DIR%\com.animepresence.discord.json"

set "MANIFEST=%NATIVE_DIR%\com.animepresence.discord.json"

reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.animepresence.discord" /ve /t REG_SZ /d "%MANIFEST%" /f >nul 2>&1
echo   Registered for Chrome.

reg add "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.animepresence.discord" /ve /t REG_SZ /d "%MANIFEST%" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.animepresence.discord" /ve /t REG_SZ /d "%MANIFEST%" /f >nul 2>&1

echo.
echo   Done! Reload the extension and you're good to go.
echo.
pause
