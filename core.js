// Núcleo: estado persistente (localStorage), utilitários de UI (toast, diálogos, painéis) e helpers de cálculo.
(() => {
    'use strict';

    const KEY = 'kaops.v1';
    const PKEY = 'kaops.plan.v1';
    const TKEY = 'kaops.theme';
    const $ = (id) => document.getElementById(id);

    // ---------- DOM ----------
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function h(tag, attrs, ...kids) {
        const el = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs || {})) {
            if (v == null || v === false || k === 'value') continue;
            if (k === 'class') el.className = v;
            else if (k === 'html') el.innerHTML = v;
            else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
            else el.setAttribute(k, v === true ? '' : v);
        }
        kids.flat(Infinity).forEach((c) => {
            if (c == null || c === false) return;
            el.append(c.nodeType ? c : document.createTextNode(String(c)));
        });
        if (attrs && attrs.value != null) el.value = attrs.value;
        return el;
    }

    // replaceChildren converte null em texto "null"; este filtra vazios.
    const mount = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));

    // ---------- Estado ----------
    const uid = () => 'ph' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    function defaults() {
        return {
            v: 1,
            settings: { world: 1, minOff: 5000, escort: 100, fakesPerVillage: 50, treatyType: 'small', protect: 3, block: 9 },
            players: [],
            phases: [
                { id: uid(), name: 'Operação Fake', time: '09:00:00', type: 'fake', targetsText: '' },
                { id: uid(), name: 'Operação Real', time: '13:10:00', type: 'real', targetsText: '' }
            ],
            targets: '',
            enemies: '',
            sim: { att: {}, def: {}, wall: 20, moral: 100, luck: 0, night: 0, statue: 0 },
            wave: { def: {}, att: {}, wall: 20, night: 0, statue: 0, moral: 100, luck: 0, max: 15 }
        };
    }

    function sanitize(raw) {
        const d = defaults();
        if (!raw || typeof raw !== 'object') return d;
        const out = { ...d };
        for (const k of ['settings', 'sim', 'wave']) out[k] = { ...d[k], ...(raw[k] && typeof raw[k] === 'object' ? raw[k] : {}) };
        out.players = Array.isArray(raw.players) ? raw.players.map(cleanPlayer).filter(Boolean) : [];
        out.phases = Array.isArray(raw.phases)
            ? raw.phases.filter((p) => p && typeof p === 'object').map((p) => ({
                id: String(p.id || uid()), name: String(p.name || 'Fase'), time: /^\d{1,2}:\d{2}(:\d{2})?$/.test(p.time) ? p.time : '12:00:00',
                type: String(p.type || 'fake'), targetsText: String(p.targetsText || '')
            }))
            : d.phases;
        out.targets = String(raw.targets || '');
        out.enemies = String(raw.enemies || '');
        return out;
    }

    function cleanVillage(v) {
        if (!v || typeof v !== 'object') return null;
        const x = Math.trunc(+v.x), y = Math.trunc(+v.y);
        if (!(x > 0 && y > 0)) return null;
        const t = v.troops || {};
        const troops = {};
        TROOP_ORDER.forEach((u) => { troops[u] = Math.max(0, Math.trunc(+t[u]) || 0); });
        return { key: `${x}|${y}`, x, y, name: String(v.name || `${x}|${y}`).slice(0, 60), troops };
    }

    function cleanPlayer(p) {
        if (!p || typeof p !== 'object' || !String(p.name || '').trim()) return null;
        return { name: String(p.name).trim().slice(0, 40), villages: (Array.isArray(p.villages) ? p.villages : []).map(cleanVillage).filter(Boolean) };
    }

    function load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (raw) return sanitize(JSON.parse(raw));
        } catch { /* sem armazenamento ou dados inválidos */ }
        return defaults();
    }

    const state = load();
    let saveTimer = 0;
    function flush() {
        clearTimeout(saveTimer);
        saveTimer = 0;
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota/privado */ }
    }
    function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flush, 250);
    }
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

    function replaceState(next) {
        const clean = sanitize(next);
        Object.keys(state).forEach((k) => delete state[k]);
        Object.assign(state, clean);
        flush();
        emit('change');
    }

    // ---------- Plano gerado (guardado à parte; pode ser grande) ----------
    function loadPlan() {
        try { return JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch { return null; }
    }
    let plan = loadPlan();
    function setPlan(p) {
        plan = p;
        try {
            if (p) localStorage.setItem(PKEY, JSON.stringify(p)); else localStorage.removeItem(PKEY);
        } catch { toast('Plano demasiado grande para guardar; fica só nesta sessão.'); }
    }

    // ---------- Eventos ----------
    function emit(name, detail) { document.dispatchEvent(new CustomEvent(`ka:${name}`, { detail })); }
    const on = (name, fn) => document.addEventListener(`ka:${name}`, fn);

    // ---------- Helpers de cálculo ----------
    const TREATY_NAMES = { small: 'Pequeno', medium: 'Médio', large: 'Grande' };
    function parseCoords(text) {
        const out = [], seen = new Set();
        const re = /(\d+)\s*\|\s*(\d+)/g;
        let m;
        while ((m = re.exec(text || ''))) {
            const x = +m[1], y = +m[2], key = `${x}|${y}`;
            if (!seen.has(key)) { seen.add(key); out.push({ x, y, key }); }
        }
        return out;
    }
    const secs = (t) => { const [hh, mm, ss] = String(t).split(':').map(Number); return (hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0); };
    const fmt = (v) => {
        v = ((v % 86400) + 86400) % 86400;
        return [Math.floor(v / 3600), Math.floor(v % 3600 / 60), Math.floor(v % 60)].map((n) => String(n).padStart(2, '0')).join(':');
    };
    const fmtDur = (v) => `${Math.floor(v / 3600)}h${String(Math.floor(v % 3600 / 60)).padStart(2, '0')}m${String(Math.floor(v % 60)).padStart(2, '0')}s`;
    const fmtNum = (n) => Number(n || 0).toLocaleString('pt-PT');
    const fmtSigned = (n) => (n > 0 ? '+' : '') + fmtNum(n);
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const travelTime = (from, to, unit, world) => dist(from, to) * (UNIT_SPEEDS[unit] / world) * 60;
    const calcOffPower = (t) => (t.warrior || 0) + (t.crusader || 0) + (t.ram || 0) + (t.catapult || 0);

    function treaty() {
        const s = state.settings;
        return { name: TREATY_NAMES[s.treatyType] || 'Pequeno', protect: +s.protect || 3, block: +s.block || 9 };
    }

    // Aldeias de todos os jogadores, já com dono e poder ofensivo.
    function allies() {
        return state.players.flatMap((p) => p.villages.map((v) => ({ ...v, owner: p.name, offPower: calcOffPower(v.troops) })));
    }
    function totalsOf(villages) {
        const t = {};
        TROOP_ORDER.forEach((u) => { t[u] = 0; });
        villages.forEach((v) => TROOP_ORDER.forEach((u) => { t[u] += v.troops[u] || 0; }));
        return t;
    }

    // ---------- UI: toast, diálogos, painéis ----------
    let toastTimer = 0;
    function toast(msg) {
        const el = $('toast');
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
    }

    function dialog({ title = '', message = '', type = 'alert', defaultValue = '', okText = 'OK', cancelText = 'Cancelar', danger = false }) {
        return new Promise((resolve) => {
            const ov = $('dialogOverlay'), input = $('dialogInput'), ok = $('dialogConfirm'), cancel = $('dialogCancel');
            $('dialogTitle').textContent = title;
            $('dialogMessage').textContent = message;
            input.classList.toggle('hidden', type !== 'prompt');
            input.value = defaultValue;
            cancel.classList.toggle('hidden', type === 'alert');
            ok.textContent = okText;
            cancel.textContent = cancelText;
            ok.classList.toggle('danger-solid', danger);
            ov.classList.add('show');
            if (type === 'prompt') setTimeout(() => input.focus(), 50);
            const done = (val) => {
                ov.classList.remove('show');
                ok.onclick = cancel.onclick = ov.onkeydown = null;
                resolve(val);
            };
            ok.onclick = () => done(type === 'prompt' ? input.value : true);
            cancel.onclick = () => done(type === 'prompt' ? null : false);
            ov.onkeydown = (e) => {
                if (e.key === 'Escape') cancel.onclick();
                else if (e.key === 'Enter' && type === 'prompt') ok.onclick();
            };
        });
    }
    const confirmDialog = (message, opts = {}) => dialog({ message, type: 'confirm', ...opts });
    const ask = (message, defaultValue = '') => dialog({ message, type: 'prompt', defaultValue });

    // Painel deslizante (janela) com conteúdo livre.
    function sheet({ title, body, actions = [] }) {
        const close = () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 250); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        const ov = h('div', { class: 'modal-overlay sheet', onclick: (e) => { if (e.target === ov) close(); } },
            h('div', { class: 'modal' },
                h('div', { class: 'modal-header' },
                    h('h2', { class: 'modal-title' }, title),
                    h('button', { type: 'button', class: 'modal-close', 'aria-label': 'Fechar', onclick: close }, '×')),
                h('div', { class: 'modal-content' }, body),
                actions.length ? h('div', { class: 'dialog-actions' }, actions.map((a) =>
                    h('button', { type: 'button', class: a.secondary ? 'secondary' : '', onclick: () => a.onclick(close) }, a.label))) : null));
        document.body.append(ov);
        document.addEventListener('keydown', onKey);
        requestAnimationFrame(() => ov.classList.add('show'));
        return { close, el: ov };
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            const ta = h('textarea', { class: 'hidden-ta' });
            ta.value = text;
            document.body.append(ta);
            ta.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch { /* sem suporte */ }
            ta.remove();
            return ok;
        }
    }

    // ---------- Tema ----------
    function applyTheme(t) {
        document.documentElement.dataset.theme = t;
        const btn = $('themeBtn');
        if (btn) btn.textContent = t === 'light' ? '🌙' : '☀️';
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = t === 'light' ? '#f1ebdd' : '#0d0905';
    }
    function toggleTheme() {
        const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        try { localStorage.setItem(TKEY, next); } catch { /* ignorar */ }
        applyTheme(next);
    }
    let saved = 'dark';
    try { saved = localStorage.getItem(TKEY) || 'dark'; } catch { /* ignorar */ }
    applyTheme(saved);

    // Indicador do servidor no cabeçalho
    function updateWorldChip() { const c = $('worldChip'); if (c) c.textContent = `${state.settings.world}x`; }
    on('change', updateWorldChip);

    window.KA = {
        $, h, mount, esc, uid, state, save, flush, replaceState, defaults, sanitize, cleanPlayer,
        get plan() { return plan; }, setPlan, emit, on,
        parseCoords, secs, fmt, fmtDur, fmtNum, fmtSigned, dist, travelTime, calcOffPower, treaty, allies, totalsOf,
        toast, dialog, confirmDialog, ask, sheet, copyText, toggleTheme, updateWorldChip, TREATY_NAMES
    };
    window.toggleTheme = toggleTheme;
})();
