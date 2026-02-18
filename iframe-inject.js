(function() {
    'use strict';
    let lastState = null;
    let videoElement = null;
    let initialized = false;
    let autoSkip = false;

    function findVideo() {
        const selectors = ['#player0', 'video', '#velocity-player-package video', '.video-player video', '.vjs-tech'];
        for (const sel of selectors) {
            const v = document.querySelector(sel);
            if (v) return v;
        }
        return null;
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function getVideoState() {
        if (!videoElement) videoElement = findVideo();
        if (!videoElement) return null;
        const current = videoElement.currentTime || 0;
        const duration = videoElement.duration || 0;
        const paused = videoElement.paused;
        const ended = videoElement.ended;
        return {
            playing: !paused && !ended && duration > 0,
            paused: paused,
            currentTime: current,
            duration: duration,
            progress: duration > 0 ? Math.floor((current / duration) * 100) : 0,
            currentTimeFormatted: formatTime(current),
            durationFormatted: formatTime(duration),
            playbackRate: videoElement.playbackRate || 1
        };
    }

    function sendToParent() {
        const state = getVideoState();
        if (!state) return;
        const stateStr = JSON.stringify(state);
        if (stateStr === lastState) return;
        lastState = stateStr;
        const message = {
            type: 'ANIME_PRESENCE_VIDEO_STATE',
            source: 'anime-presence-iframe',
            data: state,
            timestamp: Date.now()
        };
        window.parent.postMessage(message, '*');
        if (window.top !== window.parent) {
            window.top.postMessage(message, '*');
        }
    }

    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'ANIME_PRESENCE_AUTOSKIP') {
            autoSkip = e.data.enabled;
            return;
        }
        if (!e.data || e.data.type !== 'ANIME_PRESENCE_VIDEO_CONTROL') return;
        if (e.data.source !== 'anime-presence-content') return;
        if (!videoElement) videoElement = findVideo();
        if (!videoElement) return;

        switch (e.data.action) {
            case 'play': videoElement.play(); break;
            case 'pause': videoElement.pause(); break;
            case 'togglePlay':
                if (videoElement.paused) videoElement.play();
                else videoElement.pause();
                break;
            case 'seekForward':
                videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + (e.data.value || 10));
                break;
            case 'seekBack':
                videoElement.currentTime = Math.max(0, videoElement.currentTime - (e.data.value || 10));
                break;
            case 'setSpeed':
                videoElement.playbackRate = e.data.value || 1;
                break;
        }
        lastState = null;
        setTimeout(sendToParent, 100);
    });

    function setupVideoListeners() {
        videoElement = findVideo();
        if (!videoElement) {
            setTimeout(setupVideoListeners, 300);
            return;
        }
        if (initialized) return;
        initialized = true;
        const events = ['play', 'pause', 'playing', 'timeupdate', 'seeked', 'ended', 'loadedmetadata', 'durationchange'];
        events.forEach(evt => videoElement.addEventListener(evt, sendToParent));
        setInterval(sendToParent, 1500);
        sendToParent();
    }

    function isSkipVisible(el) {
        if (!el || !el.isConnected) return false;
        let r = el.getBoundingClientRect();
        let s = window.getComputedStyle(el);
        if (!r || !s) return false;
        if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false;
        return r.width > 0 && r.height > 0;
    }

    function tryClickSkip(el) {
        if (!el || !isSkipVisible(el)) return false;
        let btn = el.closest('button, [role="button"], a, [tabindex]') || el;
        let label = (btn.textContent || '').toLowerCase();
        if (label.includes('skip')) {
            try { btn.click(); return true; } catch(e) { return false; }
        }
        return false;
    }

    function tryAutoSkip() {
        if (!autoSkip) return;
        let roots = [document];
        document.querySelectorAll('*').forEach(n => { if (n.shadowRoot) roots.push(n.shadowRoot); });
        for (let root of roots) {
            let buttons = root.querySelectorAll('button, [role="button"], a, [tabindex]');
            for (let el of buttons) {
                if (tryClickSkip(el)) return;
            }
        }
    }

    const observer = new MutationObserver(() => {
        if (!videoElement || !initialized) {
            const v = findVideo();
            if (v) setupVideoListeners();
        }
        tryAutoSkip();
    });

    function startObserver() {
        if (document.documentElement) {
            observer.observe(document.documentElement, { childList: true, subtree: true });
        } else {
            setTimeout(startObserver, 100);
        }
    }

    setInterval(tryAutoSkip, 1000);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(setupVideoListeners, 500);
            startObserver();
        });
    } else {
        setTimeout(setupVideoListeners, 500);
        startObserver();
    }
})();
