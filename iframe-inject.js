(function() {
    'use strict';
    let lastState = null;
    let videoElement = null;
    let initialized = false;

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
            durationFormatted: formatTime(duration)
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

    const observer = new MutationObserver(() => {
        if (!videoElement || !initialized) {
            const v = findVideo();
            if (v) setupVideoListeners();
        }
    });

    function startObserver() {
        if (document.documentElement) {
            observer.observe(document.documentElement, { childList: true, subtree: true });
        } else {
            setTimeout(startObserver, 100);
        }
    }

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
