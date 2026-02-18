document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
        });
    });

    initControls();
    initSettings();
    initInstaller();

    function updateUI(s) {
        let setupScreen = document.getElementById('setupScreen');
        let connectionStatus = document.getElementById('connectionStatus');
        let connectionText = document.getElementById('connectionText');
        let nowWatching = document.getElementById('nowWatching');
        let idleState = document.getElementById('idleState');

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
        document.querySelectorAll('.tab-content').forEach(tc => tc.style.removeProperty('display'));
        let activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            document.getElementById(activeTab.dataset.tab + 'Tab').classList.add('active');
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
                document.getElementById('animeTitle').textContent = s.anime;

                let epText = '';
                if (s.episode) epText += 'Episode ' + s.episode;
                if (s.episodeTitle) {
                    if (epText) epText += ' \u2022 ';
                    epText += s.episodeTitle;
                }
                document.getElementById('episodeInfo').textContent = epText || 'Watching';

                let animeThumbnail = document.getElementById('animeThumbnail');
                if (s.thumbnail && showThumb) {
                    animeThumbnail.src = s.thumbnail;
                    animeThumbnail.style.display = 'block';
                } else {
                    animeThumbnail.style.display = 'none';
                }

                let cur = s.currentTime || 0;
                let total = s.duration || 0;
                if (!total && s.progress) {
                    let parts = s.progress.split(' / ');
                    if (parts.length === 2) { cur = parseTime(parts[0]); total = parseTime(parts[1]); }
                }
                updateProgress(cur, total, s.playing);

                let playStatus = document.getElementById('playStatus');
                if (s.playing) {
                    playStatus.className = 'play-status playing';
                    playStatus.innerHTML = '\u25b6 Playing';
                    nowWatching.classList.add('is-playing');
                } else {
                    playStatus.className = 'play-status paused';
                    playStatus.innerHTML = '\u23f8 Paused';
                    nowWatching.classList.remove('is-playing');
                }
                syncPlayPauseIcon(s.playing);
            } else {
                nowWatching.style.display = 'none';
                idleState.style.display = 'block';
                nowWatching.classList.remove('is-playing');
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
