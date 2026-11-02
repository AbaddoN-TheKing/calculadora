// Separador Plano: resultado da operação (métricas, anti-snipe, fases, cronologia) e exportação (BB-Code / formato simples).
(() => {
    'use strict';
    const { h, esc, toast, fmt, fmtDur, fmtNum } = KA;
    const root = document.getElementById('view-plan');
    const ui = { player: '', shown: 150 };
    const PAGE = 150;

    // ---------- Exportação ----------
    const BB_IMG = { farmer: 'farmer', templar: 'spear', squire: 'sword', warrior: 'axe', archer: 'bow', spy: 'spy', crusader: 'light', blackknight: 'heavy', ram: 'ram', catapult: 'kata', snob: 'snob' };

    function generateBBCode(plan, onlyPlayer) {
        const missions = onlyPlayer ? plan.missions.filter((m) => m.fromOwner === onlyPlayer) : plan.missions;
        const players = onlyPlayer ? plan.players.filter((p) => p.name === onlyPlayer) : plan.players;
        let bb = '[b][size=16][color=#840000]⚔ OPERAÇÃO MILITAR[/color][/size][/b]\n\n';
        bb += `[b]Servidor:[/b] ${plan.world}x · [b]Tratado:[/b] ${plan.treaty.name}\n`;
        bb += `[b]Jogadores:[/b] ${players.length} · [b]Aldeias:[/b] ${players.reduce((s, p) => s + p.villages, 0)}\n\n[hr]\n\n`;
        bb += '[b][size=14][color=#840000]📦 Forças por Jogador[/color][/size][/b]\n\n';
        players.forEach((pl) => {
            bb += `[b]${pl.name}[/b] — ${pl.villages} aldeias\n`;
            TROOP_ORDER.filter((k) => pl.totals[k] > 0).forEach((k) => { bb += `[img_${BB_IMG[k]}] ${TROOP_LABELS[k]}: [b]${fmtNum(pl.totals[k])}[/b]\n`; });
            bb += '\n';
        });
        bb += '[hr]\n\n[b][size=14][color=#840000]📈 Métricas[/color][/size][/b]\n';
        bb += `[img_axe] [b]${missions.filter((m) => !m.isFake && m.type === 'OFF').length}[/b] OFFs\n`;
        bb += `[img_snob] [b]${missions.filter((m) => m.type === 'Conde real').length}[/b] Condes\n`;
        bb += `[img_spy] [b]${missions.filter((m) => m.isFake).length}[/b] Fakes\n\n[hr]\n\n`;
        bb += '[b][size=14][color=#840000]🕐 Ordem de Lançamento[/color][/size][/b]\n\n';
        const byMinute = {};
        [...missions].sort((a, b) => a.launch - b.launch).forEach((m) => { (byMinute[Math.floor(m.launch / 60)] ||= []).push(m); });
        Object.entries(byMinute).sort((a, b) => a[0] - b[0]).forEach(([, ms]) => {
            bb += `[b][color=#2a5a7a]${fmt(ms[0].launch)}[/color][/b]\n`;
            ms.forEach((m) => {
                const icon = m.isFake ? '[img_spy]' : m.type === 'Conde real' ? '[img_snob]' : m.type === 'Anti-snipe' ? '[img_ram]' : '[img_axe]';
                bb += `  ${icon} [b]${m.fromOwner || '—'}[/b] [village]${m.from}[/village] → [village]${m.to}[/village] [i](${m.troops})[/i]\n`;
            });
            bb += '\n';
        });
        return bb + '[hr]\n[i][color=#666]Gerado por [b]-AbaddoN-[/b][/color][/i]\n';
    }

    function generateExport(missions) {
        const byPhase = {};
        missions.forEach((m) => { (byPhase[m.phase] ||= []).push(m); });
        const d = new Date(), dateStr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        let out = '';
        Object.entries(byPhase).forEach(([phase, ms]) => {
            out += `Fase : ${phase}\nCoordenadas :\n`;
            [...ms].sort((a, b) => a.launch - b.launch).forEach((m) => { out += `${m.to}/${m.type}/${dateStr}/${fmt(m.arrival)}\n`; });
            out += '\n';
        });
        return out;
    }

    function showBBCode(plan, player) {
        const ta = h('textarea', { rows: 14, readonly: true, class: 'mono' });
        ta.value = generateBBCode(plan, player);
        KA.sheet({
            title: player ? `BB-Code · ${player}` : 'BB-Code',
            body: ta,
            actions: [
                { label: '📋 Copiar', onclick: async () => { toast((await KA.copyText(ta.value)) ? 'BB-Code copiado.' : 'Não foi possível copiar.'); } },
                { label: 'Fechar', secondary: true, onclick: (close) => close() }
            ]
        });
    }

    // ---------- Blocos ----------
    function timeline(w, t) {
        const start = w.attack - 2 * 3600, end = w.blockEnd + 2 * 3600, span = end - start;
        const pct = (v) => ((v - start) / span * 100).toFixed(2) + '%';
        const pW = ((w.protectEnd - w.signed) / span * 100).toFixed(2), bW = ((w.blockEnd - w.protectEnd) / span * 100).toFixed(2);
        const fW = (100 - parseFloat(pW) - parseFloat(bW)).toFixed(2);
        return `<div class="timeline"><div class="tl-bar tl-protect" style="left:${pct(w.signed)};width:${pW}%"></div><div class="tl-bar tl-block" style="left:${pct(w.protectEnd)};width:${bW}%"></div><div class="tl-bar tl-free" style="left:${pct(w.blockEnd)};width:${fW}%"></div><div class="tl-marker" style="left:${pct(w.attack)}"></div>` +
            `<div class="tl-label" style="left:${pct(w.signed)};top:2px">Assina ${fmt(w.signed)}</div><div class="tl-label" style="left:${pct(w.protectEnd)};top:17px">Fim proteção ${fmt(w.protectEnd)}</div><div class="tl-label" style="left:${pct(w.blockEnd)};top:32px">Fim bloqueio ${fmt(w.blockEnd)}</div></div>` +
            `<div class="tl-legend"><span><i class="tl-dot tl-protect"></i> Proteção (${t.protect}h)</span><span><i class="tl-dot tl-block"></i> Bloqueio (${t.block}h)</span><span><i class="tl-dot tl-free"></i> Ataque livre</span></div>`;
    }

    const stat = (cls, v, l) => `<div class="stat ${cls}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
    const tbl = (inner) => `<div class="tbl-wrap">${inner}</div>`;
    const panel = (title, html, open) => h('details', { class: 'panel fold-panel', open: open || null }, h('summary', {}, h('h2', {}, title)), h('div', { html }));
    const troopGrid = (totals) => '<div class="troop-summary">' + TROOP_ORDER.filter((k) => totals[k] > 0).map((k) =>
        `<div class="troop-stat" title="${TROOP_LABELS[k]}: ${fmtNum(totals[k])}"><div class="icon">${troopIcon(k)}</div><div class="v">${fmtNum(totals[k])}</div><div class="l">${TROOP_LABELS[k]}</div></div>`).join('') + '</div>';

    function typePill(m) {
        if (m.isFake) return `<span class="pill fake">${esc(m.type)}</span>`;
        if (m.type === 'Conde real') return '<span class="pill snob">Conde real</span>';
        return `<span class="pill off">${m.type === 'Anti-snipe' ? 'Anti-snipe' : 'OFF'}</span>`;
    }

    function missionRows(list) {
        return list.map((m) => `<tr><td class="sticky"><b>${fmt(m.launch)}</b></td><td class="small">${esc(m.phase)}</td><td>${typePill(m)}</td><td class="small">${esc(m.fromOwner || '')}</td><td>${esc(m.from)}</td><td>${esc(m.to)}</td><td class="small nm">${esc(m.troops)}</td></tr>`).join('');
    }

    // ---------- Vista ----------
    function render() {
        const plan = KA.plan;
        if (!plan) {
            KA.mount(root, h('div', { class: 'panel cta' },
                h('h2', {}, 'Plano operacional'),
                h('p', { class: 'muted' }, 'Ainda não geraste nenhuma operação. Importa as aldeias, define fases e alvos, e carrega em "Gerar operação".'),
                h('div', { class: 'actions' },
                    h('a', { class: 'btn', href: '#operacao' }, '🎯 Ir para Operação'),
                    h('a', { class: 'btn secondary', href: '#aldeias' }, '🏰 Aldeias'))));
            return;
        }
        const { counts: c, metrics: m } = plan;
        const all = plan.missions;
        if (ui.player && !plan.players.some((p) => p.name === ui.player)) ui.player = '';
        const filtered = ui.player ? all.filter((x) => x.fromOwner === ui.player) : all;
        const shown = filtered.slice(0, ui.shown);
        const when = new Date(plan.created).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });

        const playerSel = h('select', { value: ui.player, 'aria-label': 'Filtrar por jogador', onchange: (e) => { ui.player = e.target.value; ui.shown = PAGE; render(); } },
            h('option', { value: '' }, 'Todos os jogadores'), plan.players.map((p) => h('option', { value: p.name }, p.name)));

        const exportBox = h('div', { class: 'export-box' });
        exportBox.textContent = generateExport(filtered);

        KA.mount(root, 
            h('div', { class: 'hero' },
                h('div', { class: 'hero-top' },
                    h('div', { class: 'grow' },
                        h('span', { class: 'kicker small' }, `Gerado ${when} · ${plan.world}x`),
                        h('div', { class: 'hero-name' }, 'Plano'))),
                h('div', { class: 'summary', html: stat('', c.villages, 'Aldeias') + stat('ok', m.off, 'OFFs') + stat('warn', m.snob, 'Condes') + stat('', m.fakes, 'Fakes') + stat('', m.antiSnipe, 'Anti-snipes') }),
                h('div', { class: 'actions' },
                    h('button', { type: 'button', onclick: () => showBBCode(plan, ui.player) }, '📨 BB-Code'),
                    h('button', { type: 'button', class: 'secondary', onclick: async () => { toast((await KA.copyText(generateExport(filtered))) ? 'Copiado.' : 'Não foi possível copiar.'); } }, '📋 Formato simples')),
                h('a', { class: 'btn secondary', href: '#operacao' }, '✎ Editar e regenerar')),
            plan.warnings.length ? h('div', { class: 'alert warn', html: plan.warnings.map(esc).join('<br>') }) : null,
            m.antiSnipe > 0 ? h('div', { class: 'alert ok', html: `🛡 <b>${m.antiSnipe}</b> anti-snipes — <b>${m.asVill}</b> defesas bloqueadas 1s antes.` }) : null,

            h('div', { class: 'panel' },
                h('h2', {}, 'Cronologia'),
                h('label', { class: 'fld' }, h('span', {}, 'Ver ordens de'), playerSel),
                h('div', { class: 'tbl-wrap tall', html: `<table class="borderlist"><thead><tr><th class="sticky">Hora</th><th>Fase</th><th>Tipo</th><th>Jogador</th><th>Origem</th><th>→ Alvo</th><th>Tropas</th></tr></thead><tbody>${missionRows(shown)}</tbody></table>` }),
                h('small', { class: 'muted' }, `${fmtNum(shown.length)} de ${fmtNum(filtered.length)} ordens`),
                filtered.length > shown.length ? h('button', { type: 'button', class: 'secondary', onclick: () => { ui.shown += PAGE; render(); } }, `Mostrar mais ${Math.min(PAGE, filtered.length - shown.length)}`) : null),

            panel('📈 Tropas usadas', tbl(`<table class="borderlist"><thead><tr><th>Recurso</th><th class="num">Usado</th><th class="num">Disponível</th><th class="num">%</th></tr></thead><tbody>` +
                [['OFFs', m.off, c.off], ['Condes', m.snob, c.snob], ['Fakes', m.fakes, null], ['Anti-snipes', m.antiSnipe, m.asTotal]].map(([n, u, a]) =>
                    `<tr><td>${n}</td><td class="num"><b>${u}</b></td><td class="num">${a == null ? '—' : a}</td><td class="num">${a ? (u / a * 100).toFixed(0) + '%' : '—'}</td></tr>`).join('') + '</tbody></table>'), true),

            ...plan.antiSnipe.map((a) => {
                const cov = a.results.filter((r) => r.canCounter).length;
                return panel(`🎯 Anti-snipe — ${esc(a.targetKey)}`,
                    `<div class="alert ${cov === a.results.length ? 'ok' : cov > 0 ? 'warn' : 'bad'}"><b>${cov}/${a.results.length}</b> aldeias bloqueáveis</div>` +
                    tbl(`<table class="borderlist"><thead><tr><th class="sticky">Inimigo</th><th class="num">Dist.</th><th class="num">Viagem CN</th><th>Snipe máx.</th><th>Tua OFF</th><th>Estado</th></tr></thead><tbody>` +
                        a.results.map((r) => `<tr><td class="sticky"><b>${esc(r.enemy.key)}</b></td><td class="num">${r.dToTarget.toFixed(1)}</td><td class="num">${fmtDur(r.travel)}</td><td><span class="snipe-time">${fmt(r.maxLaunchSnipe)}</span></td><td><span class="snipe-time">${fmt(r.myAttackArrival)}</span></td><td>${r.canCounter ? `<span class="ok">✓ ${r.nCands} OFF</span>` : '<span class="bad">✗ sem OFF</span>'}</td></tr>`).join('') + '</tbody></table>'));
            }),

            panel('📅 Fases e tratado de paz', plan.phases.map((ph) =>
                `<div class="phase-card"><div class="ph-header"><b>${esc(ph.name)}</b><span class="pill">${esc(ph.time)}</span><span class="small">${ph.fakes} fakes · ${ph.reals} reais</span></div>${timeline(ph.w, plan.treaty)}</div>`).join('')),

            panel('📦 Tropas por jogador', plan.players.map((p) =>
                `<div class="player-block"><div class="ph-header"><b>${esc(p.name)}</b><span class="small">${p.villages} aldeias · ${p.off} OFF · ${p.snob} c/ conde</span></div>${troopGrid(p.totals)}</div>`).join('') +
                `<div class="phase"><h4>🌍 Resumo global</h4>${troopGrid(plan.global)}</div>`),

            h('div', { class: 'panel' }, h('h2', {}, '📤 Exportar'),
                h('p', { class: 'muted small' }, ui.player ? `Só as ordens de ${ui.player}.` : 'Todas as ordens do plano.'),
                exportBox,
                h('div', { class: 'actions' },
                    h('button', { type: 'button', onclick: () => showBBCode(plan, ui.player) }, '📨 BB-Code para o KingsAge'),
                    h('button', { type: 'button', class: 'secondary', onclick: async () => { toast((await KA.copyText(exportBox.textContent)) ? 'Copiado.' : 'Não foi possível copiar.'); } }, '📋 Copiar'))));
    }

    document.addEventListener('viewchange', (e) => { if (e.detail === 'plano') { ui.shown = PAGE; render(); } });
    window.PlanView = { render, generateBBCode, generateExport };
})();
