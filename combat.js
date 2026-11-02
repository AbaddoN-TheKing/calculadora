// Separador Combate: simulador de batalha (fórmula oficial) e calculadora de ondas/OFFs necessárias.
(() => {
    'use strict';
    const { h, esc, state, toast, fmtNum, fmtSigned } = KA;
    const root = document.getElementById('view-combat');
    const ui = { tab: 'batalha', battleOut: '', waveOut: '' };

    // ---------- Custos e balanço (recursos e colonos perdidos) ----------
    function troopCost(troops) {
        const o = { wood: 0, stone: 0, iron: 0, pop: 0, units: 0 };
        TROOP_ORDER.forEach((u) => {
            const n = troops[u] || 0, c = TROOP_COST[u];
            if (!n || !c) return;
            o.wood += n * c.wood; o.stone += n * c.stone; o.iron += n * c.iron; o.pop += n * c.pop; o.units += n;
        });
        o.res = o.wood + o.stone + o.iron;
        return o;
    }
    const costCells = (c) => [c.units, c.pop, c.wood, c.stone, c.iron].map((v) => `<td class="num">${fmtNum(v)}</td>`).join('') + `<td class="num"><b>${fmtNum(c.res)}</b></td>`;

    function balanceTable(attLost, defLost, title) {
        const a = troopCost(attLost), d = troopCost(defLost);
        const head = `<tr><th>${title || 'Balanço'}</th><th class="num">Tropas</th><th class="num">${popIcon()} Colonos</th><th class="num">${resIcon('wood')} Madeira</th><th class="num">${resIcon('stone')} Pedra</th><th class="num">${resIcon('iron')} Ferro</th><th class="num">Total</th></tr>`;
        const rows = `<tr><td>⚔ Perdas do atacante</td>${costCells(a)}</tr><tr><td>🛡 Perdas do defensor</td>${costCells(d)}</tr>` +
            `<tr class="ka-balance"><td><b>Saldo (defensor − atacante)</b></td>${[d.units - a.units, d.pop - a.pop, d.wood - a.wood, d.stone - a.stone, d.iron - a.iron].map((v) => `<td class="num">${fmtSigned(v)}</td>`).join('')}<td class="num"><b>${fmtSigned(d.res - a.res)}</b></td></tr>`;
        return `<div class="tbl-wrap"><table class="borderlist"><thead>${head}</thead><tbody>${rows}</tbody></table></div>` +
            `<p class="muted small">Oponentes derrotados — <b>o atacante ganha ${fmtNum(d.pop)}</b> colonos destruídos, <b>o defensor ganha ${fmtNum(a.pop)}</b>. Os pontos da aldeia não mudam: segundo a ajuda oficial, só a destruição de edifícios por catapultas e a queda da muralha retiram pontos ao alvo.</p>`;
    }

    // ---------- Grelha de tropas ----------
    function troopGrid(obj, onChange) {
        const inputs = {};
        const grid = h('div', { class: 'troop-grid' }, TROOP_ORDER.map((u) => {
            const inp = h('input', {
                type: 'number', inputmode: 'numeric', min: 0, value: obj[u] || 0, 'aria-label': TROOP_LABELS[u],
                onfocus: (e) => e.target.select(),
                oninput: (e) => { obj[u] = Math.max(0, Math.trunc(+e.target.value) || 0); KA.save(); onChange && onChange(); }
            });
            inputs[u] = inp;
            return h('label', { class: 'troop-in' }, h('span', { html: `${troopIcon(u)} ${TROOP_LABELS[u]}` }), inp);
        }));
        const set = (o) => { TROOP_ORDER.forEach((u) => { obj[u] = o[u] || 0; inputs[u].value = obj[u]; }); KA.save(); };
        return { el: grid, set };
    }

    // Seletor "carregar tropas de…" a partir dos jogadores/aldeias importados.
    function loadFrom(apply) {
        if (!state.players.length) return null;
        const sel = h('select', {
            'aria-label': 'Carregar tropas', onchange: (e) => {
                const v = e.target.value;
                e.target.value = '';
                if (!v) return;
                const [kind, pi, vi] = v.split(':');
                const p = state.players[+pi];
                if (!p) return;
                if (kind === 'p') apply(KA.totalsOf(p.villages));
                else if (p.villages[+vi]) apply(p.villages[+vi].troops);
            }
        }, h('option', { value: '' }, '↧ Carregar tropas de…'),
            state.players.map((p, pi) => h('optgroup', { label: p.name },
                h('option', { value: `p:${pi}` }, `Todas as aldeias de ${p.name}`),
                p.villages.map((v, vi) => h('option', { value: `v:${pi}:${vi}` }, `${v.key} · ${v.name.slice(0, 22)}`)))));
        return sel;
    }

    const modNum = (obj, key, label, min, max) => h('label', { class: 'fld' }, h('span', {}, label),
        h('input', { type: 'number', inputmode: 'numeric', min, max, value: obj[key], oninput: (e) => { obj[key] = +e.target.value; KA.save(); } }));
    const modYesNo = (obj, key, label) => h('label', { class: 'fld' }, h('span', {}, label),
        h('select', { value: String(obj[key]), onchange: (e) => { obj[key] = +e.target.value; KA.save(); } },
            h('option', { value: '0' }, 'Não'), h('option', { value: '1' }, 'Sim')));

    // ---------- Simulador de batalha ----------
    function battleHtml(att, def, r) {
        const rows = TROOP_ORDER.filter((u) => att[u] > 0 || def[u] > 0).map((u) => {
            const a = r.att[u], d = r.def[u];
            return `<tr><td class="sticky">${troopIcon(u)} ${TROOP_LABELS[u]}</td><td class="num">${fmtNum(a.amount)}</td><td class="num bad">${fmtNum(a.losses)}</td><td class="num ok">${fmtNum(a.survivors)}</td><td class="num">${fmtNum(d.amount)}</td><td class="num bad">${fmtNum(d.losses)}</td><td class="num ok">${fmtNum(d.survivors)}</td></tr>`;
        }).join('');
        const win = r.winner === 'attacker';
        const wall = r.wallBefore !== r.wallAfter ? ` · muralha ${r.wallBefore} → ${r.wallAfter} (aríetes)` : '';
        const attLost = {}, defLost = {};
        TROOP_ORDER.forEach((u) => { attLost[u] = r.att[u].losses; defLost[u] = r.def[u].losses; });
        return `<div class="alert ${win ? 'ok' : 'bad'}">${win ? '⚔ <b>Atacante vence</b>' : '🛡 <b>Defensor resiste</b>'} — poder ${fmtNum(Math.round(r.atkEff))} vs ${fmtNum(Math.round(r.defEff))} (rácio ${r.ratio.toFixed(2)}) · perdas atacante ${(r.attLossFrac * 100).toFixed(1)}% · perdas defensor ${(r.defLossFrac * 100).toFixed(1)}%${wall}</div>` +
            `<div class="tbl-wrap"><table class="borderlist"><thead><tr><th class="sticky" rowspan="2">Unidade</th><th colspan="3">Atacante</th><th colspan="3">Defensor</th></tr><tr><th class="num">Qtd.</th><th class="num">Perdas</th><th class="num">Sobrev.</th><th class="num">Qtd.</th><th class="num">Perdas</th><th class="num">Sobrev.</th></tr></thead><tbody>${rows}</tbody></table></div>` +
            balanceTable(attLost, defLost, 'Balanço desta batalha');
    }

    function runBattle(out) {
        const s = state.sim;
        if (combatAtkPower(s.att) <= 0) { out.innerHTML = '<div class="alert bad">Define pelo menos uma unidade atacante.</div>'; return; }
        const r = simulateBattle(s.att, s.def, { wall: +s.wall || 0, moral: +s.moral || 100, luck: +s.luck || 0, night: !!+s.night, statue: !!+s.statue });
        out.innerHTML = battleHtml(s.att, s.def, r);
        out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function battleTab() {
        const s = state.sim;
        const att = troopGrid(s.att), def = troopGrid(s.def);
        const out = h('div', { class: 'out' });
        return h('div', {},
            h('div', { class: 'alert info small', html: 'Motor com a <b>fórmula oficial do KingsAge</b>, validado contra 1500 combates reais: vencedor correto em <b>98,5%</b> dos casos sem aríetes e erro médio nas perdas de 0,1–0,4 pp. Com aríetes a destruição da muralha é estimada (~94% no vencedor).' }),
            h('div', { class: 'panel' }, h('h2', {}, '⚔ Atacante'), loadFrom(att.set), att.el),
            h('div', { class: 'panel' }, h('h2', {}, '🛡 Defensor'), def.el),
            h('div', { class: 'panel' }, h('h2', {}, 'Modificadores'),
                h('div', { class: 'row3' }, modNum(s, 'wall', 'Muralha', 0, 30), modNum(s, 'moral', 'Moral %', 30, 100), modNum(s, 'luck', 'Sorte %', -25, 25)),
                h('div', { class: 'row2' }, modYesNo(s, 'night', 'Noturno'), modYesNo(s, 'statue', 'Estátua')),
                h('div', { class: 'actions' },
                    h('button', { type: 'button', onclick: () => runBattle(out) }, '⚔ Simular batalha'),
                    h('button', { type: 'button', class: 'secondary', onclick: () => { att.set({ warrior: 28000, crusader: 4000 }); def.set({ templar: 20000, squire: 15000, archer: 11000, blackknight: 5000 }); } }, 'Exemplo'),
                    h('button', { type: 'button', class: 'secondary', onclick: () => { att.set({}); def.set({}); out.innerHTML = ''; } }, 'Limpar'))),
            out);
    }

    // ---------- Ondas necessárias ----------
    function calcWaves(out) {
        const w = state.wave, off = w.att;
        let def = { ...w.def };
        const wall0 = +w.wall || 0, night = !!+w.night, statue = !!+w.statue, moral = +w.moral || 100, luck = +w.luck || 0, maxWaves = Math.max(1, +w.max || 15);
        if (combatAtkPower(off) <= 0) { out.innerHTML = '<div class="alert bad">Define a composição da OFF primeiro.</div>'; return; }
        if (TROOP_ORDER.reduce((s, u) => s + (def[u] || 0), 0) <= 0) { out.innerHTML = '<div class="alert bad">Define a defesa do alvo primeiro.</div>'; return; }
        const rowsData = [];
        let cleared = false, wave = 0, wall = Math.max(0, Math.min(20, wall0));
        const attLostTotal = {}, defLostTotal = {};
        TROOP_ORDER.forEach((u) => { attLostTotal[u] = 0; defLostTotal[u] = 0; });
        while (wave < maxWaves) {
            wave++;
            const defBefore = TROOP_ORDER.reduce((s, u) => s + (def[u] || 0), 0);
            if (defBefore <= 0) { cleared = true; wave--; break; }
            const r = simulateBattle(off, def, { wall, moral, luck, night, statue });
            const wallBefore = wall;
            wall = r.wallAfter; // aríetes: a muralha fica danificada para a onda seguinte
            let attLossesWave = 0;
            TROOP_ORDER.forEach((u) => { attLostTotal[u] += r.att[u].losses; defLostTotal[u] += r.def[u].losses; attLossesWave += r.att[u].losses; });
            const newDef = {};
            TROOP_ORDER.forEach((u) => { newDef[u] = r.def[u].survivors; });
            const defAfter = TROOP_ORDER.reduce((s, u) => s + newDef[u], 0);
            rowsData.push({ wave, winner: r.winner, defBefore, defAfter, attLossesWave, fraction: r.fraction, wallBefore, wallAfter: wall });
            def = newDef;
            if (defAfter <= 0) { cleared = true; break; }
        }
        const rows = rowsData.map((r) => `<tr><td class="sticky"><b>${r.wave}</b></td><td>${r.winner === 'attacker' ? '<span class="pill off">Atacante</span>' : '<span class="pill def">Defensor</span>'}</td><td class="num">${fmtNum(r.defBefore)}</td><td class="num">${fmtNum(r.defAfter)}</td><td class="num">${r.wallBefore}${r.wallAfter !== r.wallBefore ? ` → <b>${r.wallAfter}</b>` : ''}</td><td class="num bad">${fmtNum(r.attLossesWave)}</td><td class="num">${(r.fraction * 100).toFixed(1)}%</td></tr>`).join('');
        const totalLoss = TROOP_ORDER.reduce((s, u) => s + attLostTotal[u], 0);
        const summary = cleared
            ? `<div class="alert ok">🎯 Precisas de <b>${rowsData.length} onda(s)/OFF(s)</b> idênticas e sucessivas para limpar este alvo — perdes cerca de <b>${fmtNum(totalLoss)}</b> tropas no total. Muralha: <b>${wall0} → ${wall}</b>.</div>`
            : `<div class="alert warn">⚠ Após ${maxWaves} ondas ainda sobram <b>${fmtNum(rowsData[rowsData.length - 1].defAfter)}</b> defensores (muralha ${wall0} → ${wall}). Aumenta o máximo de ondas ou reforça a OFF.</div>`;
        out.innerHTML = summary +
            `<div class="tbl-wrap"><table class="borderlist"><thead><tr><th class="sticky">Onda</th><th>Vencedor</th><th class="num">Defesa antes</th><th class="num">Defesa depois</th><th class="num">Muralha</th><th class="num">Baixas OFF</th><th class="num">% perdas</th></tr></thead><tbody>${rows}</tbody></table></div>` +
            balanceTable(attLostTotal, defLostTotal, 'Custo total da operação') +
            '<p class="muted small">Como as ondas são idênticas, a ordem entre elas não altera o resultado — o que importa é enviá-las o mais próximo possível umas das outras, antes que o defensor reforce ou o poder recupere.</p>';
        out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function waveTab() {
        const w = state.wave;
        const def = troopGrid(w.def), att = troopGrid(w.att);
        const out = h('div', { class: 'out' });
        return h('div', {},
            h('div', { class: 'alert warn small', html: 'Assume ondas <b>idênticas e sucessivas</b> contra a defesa restante, com a <b>muralha a acumular os danos dos aríetes</b> e sem reforços do defensor. Serve para estimar a ordem de grandeza.' }),
            h('div', { class: 'panel' }, h('h2', {}, '🛡 Defesa do alvo'), def.el,
                h('div', { class: 'row3' }, modNum(w, 'wall', 'Muralha', 0, 30), modYesNo(w, 'night', 'Noturno'), modYesNo(w, 'statue', 'Estátua'))),
            h('div', { class: 'panel' }, h('h2', {}, '⚔ Composição de 1 OFF'), loadFrom(att.set), att.el,
                h('div', { class: 'row3' }, modNum(w, 'moral', 'Moral %', 30, 100), modNum(w, 'luck', 'Sorte %', -25, 25), modNum(w, 'max', 'Máx. ondas', 1, 99)),
                h('div', { class: 'actions' },
                    h('button', { type: 'button', onclick: () => calcWaves(out) }, '🎯 Calcular ondas'),
                    h('button', { type: 'button', class: 'secondary', onclick: () => { def.set({ templar: 20000, squire: 15000, archer: 11000, blackknight: 5000 }); att.set({ warrior: 28000, crusader: 4000 }); } }, 'Exemplo'),
                    h('button', { type: 'button', class: 'secondary', onclick: () => { def.set({}); att.set({}); out.innerHTML = ''; } }, 'Limpar'))),
            out);
    }

    function render() {
        KA.mount(root, 
            h('div', { class: 'panel' },
                h('h2', {}, 'Combate'),
                h('div', { class: 'seg' },
                    [['batalha', '⚔ Batalha'], ['ondas', '🎯 Quantas OFFs?']].map(([id, label]) =>
                        h('button', { type: 'button', class: ui.tab === id ? 'on' : '', onclick: () => { ui.tab = id; render(); } }, label)))),
            ui.tab === 'batalha' ? battleTab() : waveTab());
    }

    document.addEventListener('viewchange', (e) => { if (e.detail === 'combate') render(); });
    KA.on('change', () => { if (location.hash === '#combate') render(); });
})();
