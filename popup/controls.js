let animState = { currentTime: 0, duration: 0, playing: false, lastUpdateAt: 0, frameId: null };

function fmtTime(s) {
    if (!s || isNaN(s) || !isFinite(s)) return '0:00';
    let h = Math.floor(s / 3600);
    let m = Math.floor((s % 3600) / 60);
    let sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

function sendControl(action, value) {
    chrome.runtime.sendMessage({ type: 'VIDEO_CONTROL', action, value });
}

function initControls() {
    let playPauseBtn = document.getElementById('playPauseBtn');
    let seekBackBtn = document.getElementById('seekBackBtn');
    let seekForwardBtn = document.getElementById('seekForwardBtn');
    let speedSelect = document.getElementById('speedSelect');
    let progressBar = document.getElementById('progressBar');

    playPauseBtn.addEventListener('click', () => sendControl('togglePlay'));
    seekBackBtn.addEventListener('click', () => sendControl('seekBack', 10));
    seekForwardBtn.addEventListener('click', () => sendControl('seekForward', 10));
    speedSelect.addEventListener('change', (e) => sendControl('setSpeed', parseFloat(e.target.value)));

    progressBar.addEventListener('click', (e) => {
        if (animState.duration <= 0) return;
        let rect = progressBar.getBoundingClientRect();
        let pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        let seekTo = pct * animState.duration;
        let diff = seekTo - animState.currentTime;
        if (diff > 0) {
            sendControl('seekForward', diff);
        } else {
            sendControl('seekBack', -diff);
        }
        animState.currentTime = seekTo;
        animState.lastUpdateAt = Date.now();
        let fill = document.getElementById('progressFill');
        fill.style.width = (pct * 100) + '%';
        document.getElementById('currentTime').textContent = fmtTime(seekTo);
    });
}

function startProgressAnim() {
    if (animState.frameId) return;
    let progressFill = document.getElementById('progressFill');
    let currentTimeEl = document.getElementById('currentTime');
    function tick() {
        if (!animState.playing || animState.duration <= 0) { animState.frameId = null; return; }
        let elapsed = (Date.now() - animState.lastUpdateAt) / 1000;
        let interp = Math.min(animState.currentTime + elapsed, animState.duration);
        let pct = (interp / animState.duration) * 100;
        progressFill.style.width = pct + '%';
        currentTimeEl.textContent = fmtTime(interp);
        animState.frameId = requestAnimationFrame(tick);
    }
    animState.frameId = requestAnimationFrame(tick);
}

function stopProgressAnim() {
    if (animState.frameId) { cancelAnimationFrame(animState.frameId); animState.frameId = null; }
}

function updateProgress(cur, total, playing) {
    let progressFill = document.getElementById('progressFill');
    let currentTimeEl = document.getElementById('currentTime');
    let durationEl = document.getElementById('duration');

    if (total > 0) {
        durationEl.textContent = fmtTime(total);
        animState.currentTime = cur;
        animState.duration = total;
        animState.playing = playing;
        animState.lastUpdateAt = Date.now();
        if (playing) {
            startProgressAnim();
        } else {
            stopProgressAnim();
            progressFill.style.width = (cur / total) * 100 + '%';
            currentTimeEl.textContent = fmtTime(cur);
        }
    }
}

function syncPlayPauseIcon(playing) {
    let playIcon = document.getElementById('playIcon');
    let pauseIcon = document.getElementById('pauseIcon');
    if (playing) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    }
}
