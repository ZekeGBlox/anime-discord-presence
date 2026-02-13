(function() {
    'use strict';

    let lastVideoState = null;
    let lastSent = null;
    let enabled = true;
    let iframeFound = false;
    let iframeAttempts = 0;

    let rpcSettings = {
        showProgressBar: true,
        showPlayState: true,
        idleStatus: 'Browsing Anime'
    };

    chrome.storage.local.get(['enabled', 'showProgressBar', 'showPlayState', 'idleStatus'], (r) => {
        enabled = r.enabled !== false;
        if (r.showProgressBar !== undefined) rpcSettings.showProgressBar = r.showProgressBar;
        if (r.showPlayState !== undefined) rpcSettings.showPlayState = r.showPlayState;
        if (r.idleStatus) rpcSettings.idleStatus = r.idleStatus;
    });

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'ENABLED_CHANGED') enabled = msg.enabled;
        if (msg.type === 'SETTINGS_CHANGED') rpcSettings = { ...rpcSettings, ...msg.settings };
    });

    window.addEventListener('message', (e) => {
        if (!e.origin.includes('crunchyroll.com')) return;
        if (e.data && e.data.type === 'ANIME_PRESENCE_VIDEO_STATE' && e.data.source === 'anime-presence-iframe') {
            lastVideoState = e.data.data;
            iframeFound = true;
            sendUpdate();
        }
    });

    function tryFindIframe() {
        if (iframeFound || iframeAttempts >= 50) return;
        if (document.querySelectorAll('iframe[src*="static.crunchyroll.com"]').length > 0) {
            iframeFound = true;
            return;
        }
        iframeAttempts++;
        setTimeout(tryFindIframe, 200);
    }

    function getPageState() {
        let path = window.location.pathname;
        if (path.includes('/watch/')) return 'watching';
        if (path.includes('/series/')) return 'browsing_series';
        if (path === '/' || path.includes('/home')) return 'browsing_home';
        if (path.includes('/search')) return 'searching';
        if (path.includes('/history')) return 'browsing_history';
        if (path.includes('/watchlist') || path.includes('/crunchylists')) return 'browsing_watchlist';
        if (path.includes('/simulcastcalendar')) return 'browsing_calendar';
        return 'browsing';
    }

    function getAnimeInfo() {
        let anime = null, epTitle = null, epNum = null, thumb = null, season = null;

        let seriesSelectors = [
            'a[href*="/series/"] h4', '[data-t="show-title-link"]', '.show-title-link',
            'a.show-title-link', '.erc-series-title a', '.current-media-parent-ref',
            'h4.title a', '[class*="erc-current-media-info"] a[href*="/series/"]',
            '.erc-watch-header a[href*="/series/"]'
        ];
        for (let sel of seriesSelectors) {
            try {
                let el = document.querySelector(sel);
                if (el) {
                    let text = (el.textContent || '').trim();
                    if (text) { anime = text; break; }
                }
            } catch(e) {}
        }

        let titleSelectors = [
            '[data-t="episode-title"]', '.episode-title', '.erc-current-media-info h1',
            'h1.title', '[class*="episode-info"] h1', '.erc-watch-header h1'
        ];
        for (let sel of titleSelectors) {
            try {
                let el = document.querySelector(sel);
                if (el) {
                    let text = (el.textContent || '').trim();
                    if (text) { epTitle = text; break; }
                }
            } catch(e) {}
        }

        let numSelectors = [
            '[data-t="episode-info"]', '.episode-number', '[class*="episode-info"]',
            '.erc-playable-collection-item--is-selected .playable-card-endpoint__episode-text'
        ];
        for (let sel of numSelectors) {
            try {
                let el = document.querySelector(sel);
                if (el) {
                    let match = el.textContent.match(/E(?:pisode)?\s*(\d+)/i);
                    if (match) { epNum = match[1]; break; }
                }
            } catch(e) {}
        }

        if (!epNum) {
            let urlMatch = window.location.pathname.match(/\/watch\/[^/]+\/([^/]+)/);
            if (urlMatch) {
                let m = urlMatch[1].match(/episode-(\d+)/i) || urlMatch[1].match(/e(\d+)/i);
                if (m) epNum = m[1];
            }
        }

        // fallback: parse page title
        if (!anime || !epNum) {
            let match = document.title.match(/^Watch\s+(.+?)\s+(?:Episode\s+)?(\d+)(?:\s*[-\u2013]\s*(.+))?/i);
            if (match) {
                if (!anime) anime = match[1].replace(/\s*\((?:English\s+)?(?:Dub|Sub)(?:bed)?\)/gi, '').trim();
                if (!epNum) epNum = match[2];
                if (!epTitle && match[3]) epTitle = match[3].replace(/\s*-\s*Crunchyroll.*$/i, '').trim();
            }
        }

        let ogImg = document.querySelector('meta[property="og:image"]');
        if (ogImg) thumb = ogImg.getAttribute('content');

        let seasonSelectors = ['[data-t="season-dropdown"] button', '.seasons-select button', '[class*="season-selector"]'];
        for (let sel of seasonSelectors) {
            try {
                let el = document.querySelector(sel);
                if (el) { season = (el.textContent || '').trim(); break; }
            } catch(e) {}
        }

        return { anime, epTitle, epNum, thumb, season, url: window.location.href };
    }

    function fmtTime(s) {
        if (!s || isNaN(s) || !isFinite(s)) return '0:00';
        let h = Math.floor(s / 3600);
        let m = Math.floor((s % 3600) / 60);
        let sec = Math.floor(s % 60);
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        return `${m}:${String(sec).padStart(2, '0')}`;
    }

    function findVideo() {
        for (let sel of ['video', '#player0', '.vjs-tech', '[class*="video-player"] video']) {
            try {
                let v = document.querySelector(sel);
                if (v && v.duration > 0) return v;
            } catch(e) {}
        }
        for (let iframe of document.querySelectorAll('iframe')) {
            try {
                let v = iframe.contentDocument?.querySelector('video');
                if (v && v.duration > 0) return v;
            } catch(e) {}
        }
        return null;
    }

    function getVideoState() {
        let v = findVideo();
        if (!v || !v.duration) return null;
        return {
            playing: !v.paused && !v.ended,
            paused: v.paused,
            currentTime: v.currentTime || 0,
            duration: v.duration || 0,
            progress: v.duration > 0 ? Math.floor((v.currentTime / v.duration) * 100) : 0,
            currentTimeFormatted: fmtTime(v.currentTime),
            durationFormatted: fmtTime(v.duration)
        };
    }

    function collectData() {
        let pageState = getPageState();
        let info = getAnimeInfo();
        let video = {
            playing: false, paused: true, currentTime: 0, duration: 0,
            progress: 0, currentTimeFormatted: '0:00', durationFormatted: '0:00', found: false
        };

        if (lastVideoState && lastVideoState.duration > 0) {
            video = {
                playing: lastVideoState.playing || false,
                paused: lastVideoState.paused !== false,
                currentTime: lastVideoState.currentTime || 0,
                duration: lastVideoState.duration || 0,
                progress: lastVideoState.progress || 0,
                currentTimeFormatted: lastVideoState.currentTimeFormatted || fmtTime(lastVideoState.currentTime),
                durationFormatted: lastVideoState.durationFormatted || fmtTime(lastVideoState.duration),
                found: true
            };
        } else {
            let direct = getVideoState();
            if (direct && direct.duration > 0) video = { ...direct, found: true };
        }

        return { pageState, ...info, video, timestamp: Date.now() };
    }

    function sendUpdate() {
        if (!enabled) return;
        let data = collectData();
        let str = JSON.stringify(data);
        if (str === lastSent) return;
        lastSent = str;

        chrome.runtime.sendMessage({
            type: 'ANIME_STATE',
            data: {
                type: 'anime_state',
                pageState: data.pageState,
                anime: data.anime,
                episodeTitle: data.epTitle,
                episodeNumber: data.epNum,
                seasonTitle: data.season,
                thumbnail: data.thumb,
                episodeUrl: data.url,
                video: data.video,
                url: data.url,
                timestamp: data.timestamp
            },
            stateForPopup: {
                anime: data.anime,
                episode: data.epNum,
                episodeTitle: data.epTitle,
                progress: data.video.currentTimeFormatted + ' / ' + data.video.durationFormatted,
                pageState: data.pageState,
                thumbnail: data.thumb,
                playing: data.video.playing
            }
        }).catch(() => {});
    }

    function init() {
        tryFindIframe();
        setInterval(sendUpdate, 3000);

        let lastUrl = window.location.href;
        new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                lastVideoState = null;
                iframeFound = false;
                iframeAttempts = 0;
                tryFindIframe();
                setTimeout(sendUpdate, 1000);
            }
        }).observe(document.body || document.documentElement, { childList: true, subtree: true });

        window.addEventListener('popstate', () => {
            lastVideoState = null;
            setTimeout(sendUpdate, 1000);
        });

        setTimeout(sendUpdate, 1000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
