const THEMES = {
    orange: { primary: '#f47521', secondary: '#ff6b35' },
    purple: { primary: '#5865f2', secondary: '#7289da' },
    blue: { primary: '#3498db', secondary: '#2980b9' },
    green: { primary: '#2ecc71', secondary: '#27ae60' },
    pink: { primary: '#e91e63', secondary: '#c2185b' },
    red: { primary: '#e74c3c', secondary: '#c0392b' }
};

function applyTheme(name) {
    let t = THEMES[name] || THEMES.orange;
    let el = document.getElementById('dynamic-theme');
    if (el) el.remove();
    let style = document.createElement('style');
    style.id = 'dynamic-theme';
    style.textContent = `
        .header { background: linear-gradient(90deg, ${t.primary}, ${t.secondary}) !important; }
        .tab.active { color: ${t.primary} !important; border-bottom-color: ${t.primary} !important; }
        .now-watching-header, .settings-title { color: ${t.primary} !important; }
        .progress-fill { background: linear-gradient(90deg, ${t.primary}, ${t.secondary}) !important; box-shadow: 0 0 8px ${t.primary}44 !important; }
        .toggle input:checked + .toggle-slider { background: linear-gradient(90deg, ${t.primary}, ${t.secondary}) !important; }
        .save-btn, .setup-btn:not(.secondary) { background: linear-gradient(90deg, ${t.primary}, ${t.secondary}) !important; }
        .text-input:focus, .select-input:focus { border-color: ${t.primary} !important; }
        .setup-num { color: ${t.primary} !important; background: ${t.primary}22 !important; }
        .control-btn-main { background: ${t.primary}33 !important; }
        .control-btn-main:hover { background: ${t.primary}55 !important; }
        .progress-thumb { background: ${t.primary} !important; }
    `;
    document.head.appendChild(style);
}
