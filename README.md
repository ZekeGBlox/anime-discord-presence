# Anime Discord Presence

Show what anime you're watching as your Discord Rich Presence. Currently supports Crunchyroll.

![Chrome](https://img.shields.io/badge/Chrome-supported-green) ![Brave](https://img.shields.io/badge/Brave-supported-green) ![Edge](https://img.shields.io/badge/Edge-supported-green)

## Features

- Displays anime title, episode, and progress bar on Discord
- Uses cover art directly from the streaming site
- Play/pause state tracking
- "Watch Now" button on your Discord profile
- Customizable idle status, accent colors, and more
- Shows different states for browsing, searching, watching

## Setup

### 1. Install Python

Download from [python.org/downloads](https://www.python.org/downloads/). **Check "Add to PATH"** during install.

### 2. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, name it whatever you want
3. Copy the **Application ID** from the General Information page
4. *(Optional)* Go to **Rich Presence > Art Assets** and upload an image named `logo`

### 3. Load the Extension

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this folder

### 4. Run the Setup

1. Click the extension icon to open the popup
2. Follow the setup guide — paste your Application ID and download the installer
3. Run the installer script
4. Click **Save & Connect**

That's it! Open an anime site and start watching.

## How it Works

The extension uses Chrome's Native Messaging API to communicate with a small Python script that talks to Discord's IPC pipe. The content script scrapes anime info from the page and sends it through the extension's background service worker to the native host, which updates your Discord Rich Presence.

```
Anime site → content.js → background.js → native host (Python) → Discord IPC
```

## Supported Sites

- Crunchyroll

More sites can be added in the future.

## Requirements

- Discord desktop app (running)
- Chrome, Brave, or Edge
- Python 3.8+
- Windows, macOS, or Linux

## Files

```
├── manifest.json          # Chrome extension manifest
├── background.js          # Service worker, manages native messaging
├── content.js             # Scrapes anime info from the page
├── iframe-inject.js       # Extracts video state from player iframe
├── popup.html / popup.js  # Extension popup UI
├── native_host/           # Native messaging host
│   ├── anime_discord_presence.py    # Discord IPC bridge
│   └── anime_discord_presence.bat   # Windows launcher
├── install.bat            # Manual setup (Windows)
├── install.sh             # Manual setup (Mac/Linux)
└── icons/                 # Extension icons
```

## Troubleshooting

- **Setup screen keeps showing**: Make sure you ran the installer and Python is in your PATH
- **Not connecting to Discord**: Discord desktop app must be open (not the browser version)
- **No anime info showing**: Make sure you're on a supported site and actually watching something
- **Installer can't find extension**: If you loaded unpacked, paste the extension folder path when prompted
