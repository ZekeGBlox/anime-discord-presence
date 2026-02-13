#!/bin/bash
set -e

echo ""
echo "  Anime Discord Presence - Manual Setup"
echo ""

if ! command -v python3 &> /dev/null; then
    echo "  Python 3 not found. Install from https://python.org"
    exit 1
fi

echo "  Python found."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST="$SCRIPT_DIR/native_host/anime_discord_presence.py"

if [ ! -f "$HOST" ]; then
    echo "  native_host folder not found. Make sure this script"
    echo "  is in the extension root folder."
    exit 1
fi

chmod +x "$HOST"

echo ""
echo "  To find your extension ID:"
echo "    1. Go to chrome://extensions"
echo "    2. Turn on Developer mode"
echo "    3. Copy the ID under Anime Discord Presence"
echo ""
read -rp "  Extension ID: " EXT_ID

if [ -z "$EXT_ID" ]; then
    echo "  ID is required."
    exit 1
fi

MANIFEST='{
  "name": "com.animepresence.discord",
  "description": "Anime Discord Presence Native Host",
  "path": "'"$HOST"'",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://'"$EXT_ID"'/"]
}'

if [[ "$OSTYPE" == "darwin"* ]]; then
    CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
else
    CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
fi

mkdir -p "$CHROME_DIR"
echo "$MANIFEST" > "$CHROME_DIR/com.animepresence.discord.json"
echo "  Registered for Chrome."

echo ""
echo "  Done! Reload the extension and you're good to go."
echo ""
