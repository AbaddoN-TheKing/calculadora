// Separador Aldeias: importar overview (JSON da consola), jogadores e aldeias, partilha entre membros.
(() => {
    'use strict';
    const { h, esc, state, toast, fmtNum, totalsOf, calcOffPower, confirmDialog, ask } = KA;
    const root = document.getElementById('view-villages');
    const ui = { status: null, open: new Set() };

    // ---------- Overview ----------
    function sanitizeText(text) {
        text = text.replace(/^﻿/, '').trim();
        if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
        return text.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, ' ').replace(/\\t/g, ' ').trim();
    }

    // Tenta o JSON tal como veio; só se falhar aplica a limpeza (cópias da consola vêm com escapes).
    function parseOverview(text) {
        text = text.trim();
        try { return JSON.parse(text.replace(/^﻿/, '')); } catch { /* tenta com limpeza */ }
        return JSON.parse(sanitizeText(text));
    }

    function processOverview(text, owner) {
        if (!text.trim()) return { ok: false, msg: 'Cola o JSON primeiro.' };
        let data;
        try { data = parseOverview(text); } catch (e) {
            return { ok: false, msg: `JSON inválido (${e.message}). Dica: usa o botão "Copiar" da janela do jogo, não copies do console.log.` };
        }
        if (!Array.isArray(data)) return { ok: false, msg: `Esperava uma lista de aldeias, recebi: ${typeof data}.` };
        if (!data.length) return { ok: false, msg: 'Lista vazia. Verifica se colaste o JSON completo.' };
        const player = KA.cleanPlayer({ name: owner || `Jogador ${state.players.length + 1}`, villages: data });
        if (!player || !player.villages.length) return { ok: false, msg: 'Nenhuma aldeia válida (precisa de x, y e tropas).' };
        const i = state.players.findIndex((p) => p.name === player.name);
        if (i >= 0) state.players[i] = player; else state.players.push(player);
        KA.save();
        KA.emit('change');
        return { ok: true, msg: `${player.villages.length} aldeias processadas para ${player.name}.`, name: player.name };
    }

    const SAMPLE = '[{"x":509,"y":471,"name":"001 - Exemplo","troops":{"farmer":51,"warrior":0,"spy":2630,"blackknight":5935,"ram":4}},{"x":525,"y":491,"name":"002 - Exemplo2","troops":{"warrior":29078,"ram":715,"catapult":73}}]';

    // ---------- Vistas ----------
    function villageType(v) {
        const off = calcOffPower(v.troops);
        if (off >= state.settings.minOff) return ['OFF', 'off'];
        if (v.troops.ram > 0 || v.troops.spy > 0) return ['FAKE', 'fake'];
        if (v.troops.snob > 0) return ['CONDE', 'snob'];
        return ['DEF', 'def'];
    }

    function troopStats(totals) {
        return h('div', { class: 'troop-summary' }, TROOP_ORDER.filter((u) => totals[u] > 0).map((u) =>
            h('div', { class: 'troop-stat', title: `${TROOP_LABELS[u]}: ${fmtNum(totals[u])}` },
                h('div', { class: 'icon', html: troopIcon(u) }),
                h('div', { class: 'v' }, fmtNum(totals[u])),
                h('div', { class: 'l' }, TROOP_LABELS[u]))));
    }

    function villageTable(p, totals) {
        const rows = p.villages.map((v) => {
            const [label, cls] = villageType(v);
            return `<tr><td class="sticky"><b>${esc(v.key)}</b></td><td class="small nm">${esc(v.name)}</td>` +
                TROOP_ORDER.map((u) => `<td class="num${v.troops[u] ? '' : ' zero'}">${v.troops[u] ? fmtNum(v.troops[u]) : '—'}</td>`).join('') +
                `<td class="num"><b>${fmtNum(calcOffPower(v.troops))}</b></td><td><span class="pill ${cls}">${label}</span></td></tr>`;
        }).join('');
        return h('div', {
            class: 'tbl-wrap', html: `<table class="borderlist"><thead><tr><th class="sticky">Coord.</th><th>Nome</th>` +
                TROOP_ORDER.map((u) => `<th class="num">${troopIcon(u)}</th>`).join('') + `<th class="num">Poder</th><th>Tipo</th></tr></thead><tbody>${rows}</tbody>` +
                `<tfoot><tr><td class="sticky">TOTAL</td><td></td>${TROOP_ORDER.map((u) => `<td class="num">${totals[u] ? fmtNum(totals[u]) : '—'}</td>`).join('')}<td></td><td></td></tr></tfoot></table>`
        });
    }

    function playerCard(p) {
        const totals = totalsOf(p.villages);
        const nOff = p.villages.filter((v) => calcOffPower(v.troops) >= state.settings.minOff).length;
        const nSnob = p.villages.filter((v) => v.troops.snob > 0).length;
        const open = ui.open.has(p.name);
        const details = h('details', { class: 'fold', open: open || null, ontoggle: (e) => { if (e.target.open) ui.open.add(p.name); else ui.open.delete(p.name); } },
            h('summary', {}, `Ver ${p.villages.length} aldeias`),
            villageTable(p, totals));
        return h('div', { class: 'panel player' },
            h('div', { class: 'ph-header' },
                h('div', { class: 'grow' },
                    h('div', { class: 'pc-name' }, p.name),
                    h('small', { class: 'muted' }, `${p.villages.length} aldeias · ${nOff} OFF · ${nSnob} c/ conde`))),
            troopStats(totals),
            details,
            h('div', { class: 'actions' },
                h('button', { type: 'button', onclick: () => Share.sharePlayer(p.name) }, '📤 Partilhar'),
                h('button', { type: 'button', class: 'secondary', onclick: () => Share.copyPlayerCode(p.name) }, '📋 Código'),
                h('button', {
                    type: 'button', class: 'secondary', onclick: async () => {
                        const name = await ask('Novo nome do jogador:', p.name);
                        if (name == null) return;
                        const n = name.trim().slice(0, 40);
                        if (!n || n === p.name) return;
                        if (state.players.some((x) => x.name === n)) { toast('Já existe um jogador com esse nome.'); return; }
                        p.name = n; KA.save(); KA.emit('change');
                    }
                }, '✏ Renomear'),
                h('button', {
                    type: 'button', class: 'secondary danger', onclick: async () => {
                        if (!await confirmDialog(`Remover o jogador ${p.name}?`, { okText: 'Remover', danger: true })) return;
                        state.players = state.players.filter((x) => x !== p);
                        KA.save(); KA.emit('change');
                    }
                }, '🗑')));
    }

    function render() {
        const names = state.players.map((p) => p.name);
        const ta = h('textarea', { rows: 5, placeholder: 'Cola aqui o JSON da consola…', id: 'ovJson' });
        const nameIn = h('input', { type: 'text', id: 'ovName', placeholder: 'Nome do jogador', list: 'ovNames', maxlength: 40, autocomplete: 'off' });
        ui.status = h('div', { class: 'status', role: 'status' });
        const go = () => {
            const r = processOverview(ta.value, nameIn.value.trim());
            ui.status.className = `status ${r.ok ? 'ok' : 'bad'}`;
            ui.status.textContent = (r.ok ? '✓ ' : '✗ ') + r.msg;
            if (r.ok) toast(r.msg);
        };

        const nVill = state.players.reduce((s, p) => s + p.villages.length, 0);
        const nOff = KA.allies().filter((v) => v.offPower >= state.settings.minOff).length;

        KA.mount(root, 
            h('div', { class: 'hero' },
                h('div', { class: 'hero-top' },
                    h('div', { class: 'grow' },
                        h('span', { class: 'kicker small' }, 'A tua aliança'),
                        h('div', { class: 'hero-name' }, 'Aldeias'))),
                h('div', { class: 'hero-stats' },
                    h('div', {}, h('b', {}, String(state.players.length)), h('small', {}, 'jogadores')),
                    h('div', {}, h('b', {}, String(nVill)), h('small', {}, 'aldeias')),
                    h('div', {}, h('b', {}, String(nOff)), h('small', {}, 'aldeias OFF')))),
            h('div', { class: 'panel' },
                h('h2', {}, 'Importar overview'),
                h('p', { class: 'muted small' }, 'Corre o script no KingsAge (computador, F12), copia o resultado e cola aqui. Em alternativa, importa o código/ficheiro que um aliado te enviou.'),
                h('div', { class: 'actions' },
                    h('button', { type: 'button', class: 'secondary', onclick: async () => { toast((await KA.copyText(SNIPPET)) ? 'Script copiado.' : 'Não foi possível copiar.'); } }, '📋 Copiar script'),
                    h('a', { class: 'btn secondary', href: '#extrair' }, 'ℹ Como funciona')),
                h('label', { class: 'fld' }, h('span', {}, 'Overview (JSON)'), ta),
                h('label', { class: 'fld' }, h('span', {}, 'Jogador'), nameIn, h('datalist', { id: 'ovNames' }, names.map((n) => h('option', { value: n })))),
                h('div', { class: 'actions' },
                    h('button', { type: 'button', onclick: go }, '🔍 Processar'),
                    h('button', { type: 'button', class: 'secondary', onclick: () => { ta.value = SAMPLE; nameIn.value = 'Exemplo'; } }, 'Exemplo')),
                ui.status),
            h('div', { class: 'panel' },
                h('h2', {}, 'Receber de aliados'),
                h('div', { class: 'actions' },
                    h('button', { type: 'button', onclick: () => Share.importFile() }, '📂 Importar ficheiro'),
                    h('button', { type: 'button', class: 'secondary', onclick: () => Share.importCodeDialog() }, '📋 Colar código'))),
            state.players.length
                ? state.players.map(playerCard)
                : h('div', { class: 'panel' }, h('div', { class: 'empty' }, 'Ainda não há jogadores. Importa uma overview para começar.')),
            state.players.length
                ? h('button', {
                    type: 'button', class: 'secondary danger', onclick: async () => {
                        if (!await confirmDialog('Remover TODOS os jogadores?', { okText: 'Remover tudo', danger: true })) return;
                        state.players = []; KA.save(); KA.emit('change');
                    }
                }, '🗑 Limpar todos os jogadores')
                : null);
    }

    document.addEventListener('viewchange', (e) => { if (e.detail === 'aldeias') render(); });
    KA.on('change', () => { if (location.hash === '#aldeias') render(); });
    window.Villages = { render, processOverview };
})();
