// Tropas: tabela de tropas, mapa global e classificação de jogadores (tudo local, usa state.players).
(() => {
    'use strict';
    const { h, mount, fmtNum, state } = KA;

    // ---------- Classificação das aldeias ----------
    const OFF_U = ['warrior', 'crusader', 'ram', 'catapult'];
    const DEF_U = ['farmer', 'templar', 'squire', 'archer', 'blackknight'];
    const popOf = (t, list) => list.reduce((s, u) => s + (t[u] || 0) * TROOP_COST[u].pop, 0);

    const TYPES = {
        off: { label: 'OFF', color: '#43a047' },
        def: { label: 'DEFF', color: '#e53935' },
        mixt: { label: 'MIXT', color: '#8e5bd6' },
        none: { label: 'Sem intel', color: '#d4a63a' }
    };

    function classify(v) {
        const t = v.troops;
        const off = popOf(t, OFF_U), def = popOf(t, DEF_U);
        const any = TROOP_ORDER.some((u) => (t[u] || 0) > 0);
        let type = 'none';
        if (any) {
            const share = off + def ? off / (off + def) : 0.5;
            type = share >= 0.7 ? 'off' : share <= 0.3 ? 'def' : 'mixt';
        }
        return { type, off, def, snob: t.snob || 0 };
    }

    const rowsNow = () => KA.allies().map((v) => ({ ...v, ...classify(v) }));
    const typeChip = (type) => h('span', { class: 'chip', style: `border-color:${TYPES[type].color};color:${TYPES[type].color}` }, TYPES[type].label);

    function emptyPanel(title) {
        return h('div', { class: 'panel' }, h('h2', {}, title),
            h('div', { class: 'empty' }, 'Ainda não há aldeias. ', h('a', { href: '#aldeias' }, 'Importa a overview em Aldeias.')));
    }

    // Aldeia a focar no mapa (definida ao tocar numa linha da tabela).
    let focusKey = null;

    // ---------- Tabela de tropas ----------
    const tbl = { filter: 'all', q: '' };
    const FILTERS = [['all', 'Todas'], ['off', 'OFF'], ['def', 'DEFF'], ['mixt', 'MIXT'], ['snob', 'Condes'], ['none', 'Sem intel']];

    function renderTable() {
        const root = document.getElementById('view-troops');
        const all = rowsNow();
        if (!all.length) { mount(root, emptyPanel('📋 Tabela de tropas')); return; }

        const q = tbl.q.trim().toLowerCase();
        const rows = all.filter((r) => {
            if (tbl.filter === 'snob' ? !r.snob : tbl.filter !== 'all' && r.type !== tbl.filter) return false;
            return !q || `${r.owner} ${r.name} ${r.key}`.toLowerCase().includes(q);
        }).sort((a, b) => b.off - a.off || b.def - a.def);

        const LIMIT = 300;
        const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
        const search = h('input', { type: 'search', placeholder: 'Procurar jogador, aldeia ou coordenadas', value: tbl.q });
        search.addEventListener('input', () => { tbl.q = search.value; renderTable(); const n = document.querySelector('#view-troops input[type=search]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } });

        mount(root,
            h('div', { class: 'panel' },
                h('h2', {}, '📋 Tabela de tropas'),
                h('div', { class: 'seg' }, FILTERS.map(([k, label]) =>
                    h('button', { type: 'button', class: tbl.filter === k ? 'on' : '', onclick: () => { tbl.filter = k; renderTable(); } }, label))),
                h('label', { class: 'fld' }, search),
                h('div', { class: 'summary' },
                    h('div', { class: 'stat' }, h('div', { class: 'v' }, fmtNum(rows.length)), h('div', { class: 'l' }, 'Aldeias')),
                    h('div', { class: 'stat ok' }, h('div', { class: 'v' }, fmtNum(sum('off'))), h('div', { class: 'l' }, 'Pop. OFF')),
                    h('div', { class: 'stat warn' }, h('div', { class: 'v' }, fmtNum(sum('snob'))), h('div', { class: 'l' }, 'Condes')))),
            h('div', { class: 'panel' },
                rows.length
                    ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'borderlist' },
                        h('thead', {}, h('tr', {}, ['Jogador', 'Aldeia', 'Tipo', 'OFF', 'DEF', '👑'].map((t, i) => h('th', { class: i > 2 ? 'num' : '' }, t)))),
                        h('tbody', {}, rows.slice(0, LIMIT).map((r) =>
                            h('tr', { class: 'row-link', onclick: () => { focusKey = r.key; location.hash = '#mapa'; } },
                                h('td', {}, r.owner),
                                h('td', {}, r.name, h('br'), h('small', { class: 'muted' }, r.key.replace('|', ' | '))),
                                h('td', {}, typeChip(r.type)),
                                h('td', { class: 'num' }, fmtNum(r.off)),
                                h('td', { class: 'num' }, fmtNum(r.def)),
                                h('td', { class: 'num' }, r.snob ? fmtNum(r.snob) : '–'))))))
                    : h('div', { class: 'empty' }, 'Nenhuma aldeia com este filtro.'),
                rows.length > LIMIT ? h('p', { class: 'muted small' }, `A mostrar as ${LIMIT} primeiras de ${fmtNum(rows.length)}. Usa a pesquisa ou os filtros.`) : null,
                h('p', { class: 'muted small' }, 'OFF = guerreiros, cruzados, aríetes e catapultas; DEF = milícias, templários, escudeiros, arqueiros e cav. negros (em população). Toca numa linha para ver no mapa.')));
    }

    // ---------- Mapa global ----------
    const map = { rows: [], cx: 500, cy: 500, s: 1, w: 0, h: 0, sel: null, ready: false, fitted: false };
    let canvas, ctx, detail;

    const toScr = (x, y) => [(x - map.cx) * map.s + map.w / 2, (y - map.cy) * map.s + map.h / 2];
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    function sizeCanvas() {
        const r = canvas.getBoundingClientRect();
        const d = window.devicePixelRatio || 1;
        if (!r.width || !r.height) return false;
        canvas.width = Math.round(r.width * d);
        canvas.height = Math.round(r.height * d);
        ctx.setTransform(d, 0, 0, d, 0, 0);
        map.w = r.width; map.h = r.height;
        return true;
    }

    function fit(world) {
        let x0 = 0, y0 = 0, x1 = 999, y1 = 999;
        if (!world && map.rows.length) {
            x0 = y0 = Infinity; x1 = y1 = -Infinity;
            map.rows.forEach((r) => { x0 = Math.min(x0, r.x); x1 = Math.max(x1, r.x); y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y); });
        }
        map.s = clamp(Math.min(map.w / (x1 - x0 + 24), map.h / (y1 - y0 + 24)), 0.3, 40);
        map.cx = (x0 + x1) / 2; map.cy = (y0 + y1) / 2;
    }

    function zoom(f, px = map.w / 2, py = map.h / 2) {
        const wx = (px - map.w / 2) / map.s + map.cx, wy = (py - map.h / 2) / map.s + map.cy;
        map.s = clamp(map.s * f, 0.3, 60);
        map.cx = wx - (px - map.w / 2) / map.s;
        map.cy = wy - (py - map.h / 2) / map.s;
    }

    function draw() {
        if (!ctx || !map.w) return;
        const css = getComputedStyle(document.documentElement);
        const bg = css.getPropertyValue('--surface2').trim() || '#201a12';
        const line = css.getPropertyValue('--line').trim() || '#4a3b28';
        const sub = css.getPropertyValue('--text-sub').trim() || '#aaa';
        const txt = css.getPropertyValue('--text').trim() || '#fff';
        ctx.fillStyle = bg; ctx.fillRect(0, 0, map.w, map.h);

        // Limites do mundo 0–999
        const [bx0, by0] = toScr(0, 0), [bx1, by1] = toScr(999, 999);
        ctx.strokeStyle = sub; ctx.lineWidth = 1; ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);

        // Grelha
        const step = [10, 50, 100].find((s) => s * map.s >= 48) || 100;
        ctx.strokeStyle = line; ctx.fillStyle = sub; ctx.font = '10px sans-serif'; ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let g = Math.max(0, Math.ceil((map.cx - map.w / 2 / map.s) / step) * step); g <= Math.min(999, map.cx + map.w / 2 / map.s); g += step) {
            const [sx] = toScr(g, 0); ctx.moveTo(sx, 0); ctx.lineTo(sx, map.h); ctx.fillText(g, sx + 2, 10);
        }
        for (let g = Math.max(0, Math.ceil((map.cy - map.h / 2 / map.s) / step) * step); g <= Math.min(999, map.cy + map.h / 2 / map.s); g += step) {
            const [, sy] = toScr(0, g); ctx.moveTo(0, sy); ctx.lineTo(map.w, sy); ctx.fillText(g, 2, sy - 2);
        }
        ctx.stroke();

        // Aldeias
        const r = clamp(map.s * 0.45, 2.5, 9);
        map.rows.forEach((v) => {
            const [sx, sy] = toScr(v.x, v.y);
            if (sx < -12 || sy < -12 || sx > map.w + 12 || sy > map.h + 12) return;
            ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.2832); ctx.fillStyle = TYPES[v.type].color; ctx.fill();
            if (v.snob) { ctx.beginPath(); ctx.arc(sx, sy, r + 2.5, 0, 6.2832); ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 2; ctx.stroke(); }
            if (v.key === map.sel) { ctx.beginPath(); ctx.arc(sx, sy, r + 5, 0, 6.2832); ctx.strokeStyle = txt; ctx.lineWidth = 2; ctx.stroke(); }
        });
    }

    function select(key) {
        map.sel = key;
        const v = map.rows.find((r) => r.key === key);
        if (!v) { mount(detail, h('p', { class: 'muted' }, 'Toca numa aldeia no mapa.')); draw(); return; }
        mount(detail,
            h('h3', {}, v.name, ' ', typeChip(v.type)),
            h('p', { class: 'muted' }, `${v.owner} · ${v.x}|${v.y}${v.snob ? ` · 👑 ${v.snob}` : ''}`),
            h('div', { class: 'troop-chips' }, TROOP_ORDER.filter((u) => v.troops[u] > 0).map((u) =>
                h('span', { class: 'chip', html: `${troopIcon(u)} ${fmtNum(v.troops[u])}` }))),
            h('button', { type: 'button', class: 'secondary small', onclick: async () => { KA.toast(await KA.copyText(`${v.x}|${v.y}`) ? 'Coordenadas copiadas' : 'Não foi possível copiar'); } }, '📋 Copiar coordenadas'));
        draw();
    }

    function buildMap(root) {
        canvas = h('canvas', { style: 'width:100%;height:60vh;min-height:320px;touch-action:none;border-radius:12px;display:block;cursor:grab' });
        ctx = canvas.getContext('2d');
        detail = h('div', {}, h('p', { class: 'muted' }, 'Toca numa aldeia no mapa.'));

        const ptrs = new Map();
        let moved = 0, pinch = 0;
        canvas.addEventListener('pointerdown', (e) => {
            canvas.setPointerCapture(e.pointerId);
            ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
            moved = 0;
            if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y) || 1; }
        });
        canvas.addEventListener('pointermove', (e) => {
            const p = ptrs.get(e.pointerId);
            if (!p) return;
            const nx = e.offsetX, ny = e.offsetY;
            if (ptrs.size === 1) {
                map.cx -= (nx - p.x) / map.s; map.cy -= (ny - p.y) / map.s;
                moved += Math.abs(nx - p.x) + Math.abs(ny - p.y);
                ptrs.set(e.pointerId, { x: nx, y: ny });
            } else if (ptrs.size === 2) {
                ptrs.set(e.pointerId, { x: nx, y: ny });
                const [a, b] = [...ptrs.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
                zoom(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
                pinch = d; moved = 99;
            }
            draw();
        });
        const up = (e) => {
            if (ptrs.size === 1 && moved < 6 && e.type === 'pointerup') {
                let best = null, bd = 18;
                map.rows.forEach((v) => { const [sx, sy] = toScr(v.x, v.y); const d = Math.hypot(sx - e.offsetX, sy - e.offsetY); if (d < bd) { bd = d; best = v; } });
                select(best ? best.key : null);
            }
            ptrs.delete(e.pointerId);
        };
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
        canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.25 : 0.8, e.offsetX, e.offsetY); draw(); }, { passive: false });

        const legend = h('div', { class: 'troop-chips' }, Object.values(TYPES).map((t) =>
            h('span', { class: 'chip', style: `border-color:${t.color}`, html: `<span style="color:${t.color}">●</span> ${t.label}` })),
            h('span', { class: 'chip', style: 'border-color:#ffd400', html: '<span style="color:#ffd400">◎</span> Condes' }));

        mount(root,
            h('div', { class: 'panel' },
                h('h2', {}, '🗺 Mapa global'),
                h('div', { class: 'seg' },
                    h('button', { type: 'button', onclick: () => { zoom(1.5); draw(); } }, '＋'),
                    h('button', { type: 'button', onclick: () => { zoom(1 / 1.5); draw(); } }, '−'),
                    h('button', { type: 'button', onclick: () => { fit(false); draw(); } }, '⌖ Aldeias'),
                    h('button', { type: 'button', onclick: () => { fit(true); draw(); } }, '🌍 0–999')),
                canvas, legend,
                h('p', { class: 'muted small' }, 'Arrasta para mover, pinça ou roda do rato para zoom.')),
            h('div', { class: 'panel' }, h('h2', {}, 'Aldeia selecionada'), detail));
        window.addEventListener('resize', () => { if (!root.hidden && sizeCanvas()) draw(); });
        map.ready = true;
    }

    function renderMap() {
        const root = document.getElementById('view-map');
        map.rows = rowsNow();
        if (!map.rows.length) { map.ready = false; map.fitted = false; mount(root, emptyPanel('🗺 Mapa global')); return; }
        if (!map.ready) buildMap(root);
        if (!sizeCanvas()) return;
        if (!map.fitted) { fit(false); map.fitted = true; }
        if (focusKey) {
            const v = map.rows.find((r) => r.key === focusKey);
            focusKey = null;
            if (v) { map.cx = v.x; map.cy = v.y; map.s = Math.max(map.s, 10); select(v.key); return; }
        }
        select(map.rows.some((r) => r.key === map.sel) ? map.sel : null);
    }

    // ---------- Classificação de jogadores ----------
    const METRICS = [
        ['off', 'OFF', 'Pop. OFF', (t) => popOf(t, OFF_U)],
        ['snob', 'Condes', 'Condes', (t) => t.snob || 0],
        ['def', 'DEFF', 'Pop. DEF', (t) => popOf(t, DEF_U)],
        ['villages', 'Aldeias', 'Aldeias', null]
    ];
    let rankBy = 'off';

    function renderRanking() {
        const root = document.getElementById('view-ranking');
        if (!state.players.length) { mount(root, emptyPanel('🏆 Classificação')); return; }
        const m = METRICS.find((x) => x[0] === rankBy);
        const list = state.players.map((p) => {
            const t = KA.totalsOf(p.villages);
            return { name: p.name, villages: p.villages.length, value: m[3] ? m[3](t) : p.villages.length, snob: t.snob || 0, off: popOf(t, OFF_U) };
        }).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
        const medal = ['🥇', '🥈', '🥉'];

        mount(root, h('div', { class: 'panel' },
            h('h2', {}, '🏆 Classificação de jogadores'),
            h('div', { class: 'seg' }, METRICS.map(([k, label]) =>
                h('button', { type: 'button', class: rankBy === k ? 'on' : '', onclick: () => { rankBy = k; renderRanking(); } }, label))),
            h('div', { class: 'tbl-wrap' }, h('table', { class: 'borderlist' },
                h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Jogador'), h('th', { class: 'num' }, m[2]), h('th', { class: 'num' }, 'Aldeias'))),
                h('tbody', {}, list.map((p, i) => h('tr', {},
                    h('td', {}, medal[i] || String(i + 1)),
                    h('td', {}, p.name),
                    h('td', { class: 'num' }, h('b', {}, fmtNum(p.value))),
                    h('td', { class: 'num' }, fmtNum(p.villages))))))),
            h('p', { class: 'muted small' }, 'Calculado a partir das tropas importadas (não há pontos de jogador nos dados).')));
    }

    // ---------- Ligação à navegação ----------
    const RENDER = { tropas: renderTable, mapa: renderMap, ranking: renderRanking };
    let current = '';
    document.addEventListener('viewchange', (e) => { current = e.detail; if (RENDER[current]) RENDER[current](); });
    KA.on('change', () => { map.fitted = false; if (RENDER[current]) RENDER[current](); });
})();
