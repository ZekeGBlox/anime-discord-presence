#!/usr/bin/env python3

import json
import struct
import sys
import os
import time
import socket

CLIENT_ID = None

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

    def pipe_path(self, n=0):
        if sys.platform == 'win32':
            return r'\\.\pipe\discord-ipc-' + str(n)
        for env in ['XDG_RUNTIME_DIR', 'TMPDIR', 'TMP', 'TEMP']:
            path = os.environ.get(env)
            if path:
                return os.path.join(path, 'discord-ipc-' + str(n))
        return '/tmp/discord-ipc-' + str(n)

    def connect(self):
        for i in range(10):
            path = self.pipe_path(i)
            try:
                if sys.platform == 'win32':
                    self.sock = open(path, 'r+b', buffering=0)
                else:
                    self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                    self.sock.connect(path)
                self.connected = True
                if self._handshake():
                    log(f"Connected on pipe {i}")
                    return True
                self.close()
            except Exception:
                if sys.platform != 'win32' and self.sock:
                    try:
                        self.sock.close()
                    except Exception:
                        pass
                    self.sock = None
                continue
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
                header = b''
                while len(header) < 8:
                    chunk = self.sock.read(8 - len(header))
                    if not chunk:
                        return None
                    header += chunk
            else:
                header = self.sock.recv(8)
            if len(header) < 8:
                return None
            _, length = struct.unpack('<II', header)
            if sys.platform == 'win32':
                data = b''
                while len(data) < length:
                    chunk = self.sock.read(length - len(data))
                    if not chunk:
                        return None
                    data += chunk
            else:
                data = self.sock.recv(length)
            return json.loads(data.decode('utf-8'))
        except Exception:
            return None

    def _handshake(self):
        resp = self._send(0, {'v': 1, 'client_id': self.client_id})
        if resp and resp.get('cmd') == 'DISPATCH' and resp.get('evt') == 'READY':
            return True
        return False

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
        self.ipc = None
        self.connected = False
        self.current_anime = None
        self.start_time = None
        self.last_update = 0
        self._last_season = None

    def connect(self):
        if not self.client_id:
            log("No client ID set, waiting...", "WARN")
            return False
        if not self.ipc:
            self.ipc = DiscordIPC(self.client_id)
        if self.ipc.connect():
            self.connected = True
            log("Connected to Discord")
            return True
        log("Discord not running or rejected client ID", "WARN")
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
        if self.ipc:
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
            season = data.get('seasonTitle')

            if page == 'watching' and anime:
                if season:
                    video['season'] = season
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

    def _clean_ep_title(self, ep_title, ep_num):
        import re
        if not ep_title:
            return ep_title
        cleaned = re.sub(r'^E(?:pisode)?\s*\d+\s*[-\u2013]\s*', '', ep_title, flags=re.IGNORECASE).strip()
        return cleaned if cleaned else ep_title

    def _watching(self, anime, ep_title, ep_num, video, ep_url, thumbnail):
        if self.current_anime != anime:
            self.current_anime = anime
            self.start_time = int(time.time())
            log(f"Now watching: {anime}")

        playing = video.get('playing', False)
        paused = video.get('paused', True)
        duration = video.get('duration', 0)
        current_time = video.get('currentTime', 0)
        season = video.get('season') or self._last_season

        if season:
            self._last_season = season

        ep_title = self._clean_ep_title(ep_title, ep_num)

        season_num = None
        if season:
            import re
            m = re.search(r'(\d+)', season)
            if m:
                season_num = m.group(1)

        details = anime[:128]

        if ep_num and season_num:
            ep_label = f"S{season_num}:E{ep_num}"
        elif ep_num:
            ep_label = f"Episode {ep_num.zfill(2)}"
        else:
            ep_label = None

        if ep_label and ep_title and ep_title != anime:
            state = f"{ep_label} - {ep_title}"
        elif ep_label:
            state = ep_label
        elif ep_title and ep_title != anime:
            state = ep_title
        else:
            state = 'Watching'
        state = state[:128]

        cover = thumbnail

        if season and ep_num:
            large_text = f"{season}, Episode {ep_num}"
        elif ep_num:
            large_text = f"Episode {ep_num}"
        else:
            large_text = anime
        large_text = large_text[:128]

        timestamps = {}
        if duration > 0:
            now = int(time.time())
            timestamps['start'] = now - int(current_time)
            timestamps['end'] = now - int(current_time) + int(duration)

        activity = {
            'type': 3,
            'details': details,
            'state': state,
            'timestamps': timestamps,
            'assets': {
                'large_image': cover if cover else 'logo',
                'large_text': large_text
            },
            'buttons': [{'label': 'Watch', 'url': ep_url[:512]}]
        }

        if not self.ipc or not self.ipc.set_activity(activity):
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
        if self.connected and self.ipc:
            self.ipc.clear_activity()
        self.current_anime = None
        self.start_time = None

    def disconnect(self):
        self.clear()
        if self.ipc:
            self.ipc.close()
        self.connected = False


def main():
    log("Native host starting")
    rpc = DiscordRPC()

    send_message({'type': 'status', 'connected': False, 'error': 'waiting_for_client_id'})

    try:
        while True:
            msg = read_message()
            if msg is None:
                break

            t = msg.get('type', '')

            if t == 'settings_update':
                s = msg.get('settings', {})
                new_id = s.get('clientId', '')
                if new_id and new_id != rpc.client_id:
                    rpc.set_client_id(new_id)
                settings.update(s)
                send_message({'type': 'status', 'connected': rpc.connected})
            elif t == 'set_client_id':
                new_id = msg.get('clientId', '')
                if new_id and new_id != rpc.client_id:
                    rpc.set_client_id(new_id)
                    send_message({'type': 'status', 'connected': rpc.connected})
            elif t == 'anime_state':
                if not rpc.connected and rpc.client_id:
                    rpc.connect()
                rpc.process_update(msg)
                send_message({'type': 'status', 'connected': rpc.connected})
            elif t == 'ping':
                if not rpc.connected and rpc.client_id:
                    rpc.connect()
                    send_message({'type': 'status', 'connected': rpc.connected})
                else:
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
