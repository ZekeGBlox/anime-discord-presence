#!/usr/bin/env python3

# native messaging host for anime discord presence
# talks to chrome via stdin/stdout and updates discord rich presence

import json
import struct
import sys
import os
import time
import socket

CLIENT_ID = ""

settings = {
    'showProgressBar': True,
    'showPlayState': True,
    'idleStatus': 'Browsing Anime'
}


def log(msg, level="INFO"):
    print(f"[{level}] {msg}", file=sys.stderr, flush=True)


def read_message():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    length = struct.unpack('<I', raw)[0]
    if length == 0:
        return {}
    data = sys.stdin.buffer.read(length)
    if len(data) < length:
        return None
    return json.loads(data.decode('utf-8'))


def send_message(msg):
    data = json.dumps(msg).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def progress_bar(progress, length=12):
    progress = max(0, min(100, progress))
    filled = int((progress / 100) * length)
    if filled >= length:
        return '\u2501' * length
    if filled <= 0:
        return '\u25cf' + '\u2500' * (length - 1)
    return '\u2501' * filled + '\u25cf' + '\u2500' * (length - filled - 1)


class DiscordIPC:
    def __init__(self, client_id):
        self.client_id = client_id
        self.sock = None
        self.connected = False

    def pipe_path(self):
        if sys.platform == 'win32':
            return r'\\.\pipe\discord-ipc-0'
        for env in ['XDG_RUNTIME_DIR', 'TMPDIR', 'TMP', 'TEMP']:
            path = os.environ.get(env)
            if path:
                return os.path.join(path, 'discord-ipc-0')
        return '/tmp/discord-ipc-0'

    def connect(self):
        path = self.pipe_path()
        try:
            if sys.platform == 'win32':
                self.sock = open(path, 'r+b', buffering=0)
            else:
                self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                self.sock.connect(path)
            self.connected = True
            return self._handshake()
        except Exception:
            self.connected = False
            return False

    def _send(self, op, payload):
        if not self.connected or not self.sock:
            return None
        try:
            data = json.dumps(payload).encode('utf-8')
            header = struct.pack('<II', op, len(data))
            if sys.platform == 'win32':
                self.sock.write(header + data)
                self.sock.flush()
            else:
                self.sock.sendall(header + data)
            return self._recv()
        except Exception:
            self.connected = False
            return None

    def _recv(self):
        if not self.connected or not self.sock:
            return None
        try:
            if sys.platform == 'win32':
                header = self.sock.read(8)
            else:
                header = self.sock.recv(8)
            if len(header) < 8:
                return None
            _, length = struct.unpack('<II', header)
            if sys.platform == 'win32':
                data = self.sock.read(length)
            else:
                data = self.sock.recv(length)
            return json.loads(data.decode('utf-8'))
        except Exception:
            return None

    def _handshake(self):
        return self._send(0, {'v': 1, 'client_id': self.client_id}) is not None

    def set_activity(self, activity):
        return self._send(1, {
            'cmd': 'SET_ACTIVITY',
            'args': {'pid': os.getpid(), 'activity': activity},
            'nonce': str(time.time())
        }) is not None

    def clear_activity(self):
        return self._send(1, {
            'cmd': 'SET_ACTIVITY',
            'args': {'pid': os.getpid(), 'activity': None},
            'nonce': str(time.time())
        }) is not None

    def close(self):
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
        self.sock = None
        self.connected = False


class DiscordRPC:
    def __init__(self):
        self.client_id = CLIENT_ID
        self.ipc = DiscordIPC(self.client_id)
        self.connected = False
        self.current_anime = None
        self.start_time = None
        self.last_update = 0

    def connect(self):
        if self.ipc.connect():
            self.connected = True
            log("Connected to Discord")
            return True
        log("Discord not running", "WARN")
        self.connected = False
        return False

    def set_client_id(self, new_id):
        if not new_id or new_id == self.client_id:
            return
        log(f"Switching client ID to: {new_id}")
        self.disconnect()
        self.client_id = new_id
        self.ipc = DiscordIPC(new_id)
        self.connect()

    def try_reconnect(self):
        if self.connected:
            return True
        self.ipc.close()
        return self.connect()

    def process_update(self, data):
        global settings

        if not self.connected:
            if not self.try_reconnect():
                return False

        now = time.time()
        if now - self.last_update < 2:
            return True
        self.last_update = now

        if 'settings' in data:
            settings.update(data['settings'])

        try:
            page = data.get('pageState', 'browsing')
            anime = data.get('anime')
            ep_title = data.get('episodeTitle')
            ep_num = data.get('episodeNumber')
            video = data.get('video', {})
            ep_url = data.get('episodeUrl', 'https://www.crunchyroll.com')
            thumbnail = data.get('thumbnail')

            if page == 'watching' and anime:
                self._watching(anime, ep_title, ep_num, video, ep_url, thumbnail)
            elif page.startswith('browsing'):
                self._browsing(page)
            elif page == 'searching':
                self._searching()
            elif page == 'disconnected':
                self.clear()

            return True
        except Exception as e:
            log(f"Error: {e}", "ERROR")
            self.connected = False
            return False

    def _watching(self, anime, ep_title, ep_num, video, ep_url, thumbnail):
        if self.current_anime != anime:
            self.current_anime = anime
            self.start_time = int(time.time())
            log(f"Now watching: {anime}")

        playing = video.get('playing', False)
        paused = video.get('paused', True)
        progress = video.get('progress', 0)
        duration = video.get('duration', 0)
        cur_fmt = video.get('currentTimeFormatted', '0:00')
        dur_fmt = video.get('durationFormatted', '0:00')

        details = anime[:128]
        icon = '\u25b6' if (playing and not paused) else '\u23f8'

        if settings.get('showProgressBar', True) and duration > 0:
            bar = progress_bar(progress, 12)
            state = f"{icon} {cur_fmt} {bar} {dur_fmt}"
        else:
            parts = [icon]
            if ep_num:
                parts.append(f"E{ep_num}")
            if ep_title and ep_title != anime:
                parts.append(ep_title[:22] + '...' if len(ep_title) > 22 else ep_title)
            state = ' \u2022 '.join(parts)
        state = state[:128]

        cover = thumbnail

        large_text = anime
        if ep_title and ep_title != anime:
            large_text = f"E{ep_num} - {ep_title}" if ep_num else ep_title
        large_text = large_text[:128]

        activity = {
            'details': details,
            'state': state,
            'timestamps': {'start': self.start_time},
            'assets': {
                'large_image': cover if cover else 'logo',
                'large_text': large_text
            },
            'buttons': [{'label': 'Watch Now', 'url': ep_url[:512]}]
        }

        if not self.ipc.set_activity(activity):
            self.connected = False

    def _browsing(self, page):
        if self.current_anime:
            log("Stopped watching, browsing now")
            self.current_anime = None
            self.start_time = None

        states = {
            'browsing_series': 'Viewing a series',
            'browsing_home': 'On the home page',
            'browsing_history': 'Checking watch history',
            'browsing_watchlist': 'Browsing watchlist',
            'browsing_calendar': 'Checking release calendar',
            'browsing': 'Exploring'
        }

        self.ipc.set_activity({
            'details': settings.get('idleStatus', 'Browsing Anime')[:128],
            'state': states.get(page, 'Looking around'),
            'assets': {'large_image': 'logo', 'large_text': 'Anime Discord Presence'},
            'buttons': [{'label': 'Visit Crunchyroll', 'url': 'https://www.crunchyroll.com'}]
        })

    def _searching(self):
        self.ipc.set_activity({
            'details': 'Searching',
            'state': 'Looking for anime',
            'assets': {'large_image': 'logo', 'large_text': 'Anime Discord Presence'}
        })

    def clear(self):
        if self.connected:
            self.ipc.clear_activity()
        self.current_anime = None
        self.start_time = None

    def disconnect(self):
        self.clear()
        self.ipc.close()
        self.connected = False


def main():
    log("Native host starting")
    rpc = DiscordRPC()

    if rpc.connect():
        send_message({'type': 'status', 'connected': True})
    else:
        send_message({'type': 'status', 'connected': False, 'error': 'Discord not running'})

    try:
        while True:
            msg = read_message()
            if msg is None:
                break

            t = msg.get('type', '')

            if t == 'anime_state':
                rpc.process_update(msg)
                send_message({'type': 'status', 'connected': rpc.connected})
            elif t == 'settings_update':
                s = msg.get('settings', {})
                new_id = s.get('clientId', '')
                if new_id and new_id != rpc.client_id:
                    rpc.set_client_id(new_id)
                    send_message({'type': 'status', 'connected': rpc.connected})
                settings.update(s)
            elif t == 'set_client_id':
                new_id = msg.get('clientId', '')
                if new_id and new_id != rpc.client_id:
                    rpc.set_client_id(new_id)
                    send_message({'type': 'status', 'connected': rpc.connected})
            elif t == 'ping':
                send_message({'type': 'pong'})
            elif t == 'disconnect':
                rpc.clear()
    except Exception as e:
        log(f"Fatal: {e}", "ERROR")
    finally:
        log("Shutting down")
        rpc.disconnect()


if __name__ == "__main__":
    main()
