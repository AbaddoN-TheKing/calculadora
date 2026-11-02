// Separador Operação: configuração, fases, alvos, aldeias inimigas e gerador do plano (lógica da página original).
(() => {
    'use strict';
    const { h, esc, state, toast, fmtNum, parseCoords, secs, dist, travelTime, confirmDialog, uid } = KA;
    const root = document.getElementById('view-operation');
    // state.settings é substituído ao importar/restaurar, por isso lê-se sempre pelo estado atual.
    const S = new Proxy({}, { get: (_, k) => state.settings[k], set: (_, k, v) => { state.settings[k] = v; return true; } });

    const PHASE_TYPES = [['fake', 'Fake'], ['fakeSnob', 'Conde falso'], ['fakeSpy', 'Fake espião'], ['fakeSpyRam', 'Fake espião+aríete'], ['fakeAxeRam', 'Fake guerreiro+aríete'], ['real', 'Real']];

    // ---------- Gerador do plano ----------
    function treatyWindow(attackSec) {
        const t = KA.treaty(), margin = 10, signed = attackSec - margin * 60;
        return { signed, protectEnd: signed + t.protect * 3600, blockEnd: signed + t.protect * 3600 + t.block * 3600, attack: attackSec };
    }

    // Para cada aldeia inimiga: a que horas pode lançar o snipe (conde/CN) e se há OFF tua que o bloqueie 1s antes.
    function calculateAntiSnipe(attackTime, target, enemies, world, myOff) {
        const A = secs(attackTime);
        return enemies.map((enemy) => {
            const dToTarget = dist(enemy, target);
            const travel = dToTarget * (11 / world) * 60;
            const maxLaunchSnipe = A - travel;
            const myAttackArrival = maxLaunchSnipe - 1;
            const cands = myOff.map((v) => {
                const t = travelTime(v, enemy, 'warrior', world);
                return { v, travel: t, launch: myAttackArrival - t };
            }).filter((c) => c.launch > 0).sort((a, b) => a.launch - b.launch);
            return { enemy, dToTarget, travel, maxLaunchSnipe, myAttackArrival, cands, canCounter: cands.length > 0 };
        }).sort((a, b) => a.dToTarget - b.dToTarget);
    }

    function buildPlan() {
        const world = +S.world || 1, minOff = +S.minOff || 5000, escort = +S.escort || 100, fakesPerVillage = +S.fakesPerVillage || 50;
        const allies = KA.allies();
        const enemies = parseCoords(state.enemies);
        const offV = allies.filter((v) => v.offPower >= minOff);
        const fakeV = allies.filter((v) => v.offPower < minOff && (v.troops.ram > 0 || v.troops.spy > 0));
        const snobV = allies.filter((v) => v.troops.snob > 0);
        const missions = [], antiSnipe = [], warnings = [];

        state.phases.forEach((phase) => {
            const attack = secs(phase.time), targets = parseCoords(phase.targetsText);
            if (!targets.length) { warnings.push(`A fase "${phase.name}" não tem alvos e foi ignorada.`); return; }
            if (phase.type === 'real') {
                targets.forEach((tgt) => {
                    const cands = offV.map((v) => ({ v, d: dist(v, tgt), travel: travelTime(v, tgt, 'warrior', world) })).sort((a, b) => a.d - b.d);
                    cands.slice(0, Math.min(3, cands.length)).forEach((c) => {
                        missions.push({ phase: phase.name, type: 'OFF', from: c.v.key, to: tgt.key, fromOwner: c.v.owner, travel: c.travel, launch: attack - c.travel, arrival: attack, troops: `OFF completa (poder ${c.v.offPower})`, isFake: false });
                    });
                    const snobs = snobV.map((v) => ({ v, d: dist(v, tgt), travel: travelTime(v, tgt, 'snob', world) })).sort((a, b) => a.d - b.d);
                    if (!snobs.length) return;
                    const s = snobs[0];
                    missions.push({ phase: phase.name, type: 'Conde real', from: s.v.key, to: tgt.key, fromOwner: s.v.owner, travel: s.travel, launch: attack - s.travel, arrival: attack, troops: `1 conde + ${escort} escolta`, isFake: false });
                    if (!enemies.length) return;
                    const as = calculateAntiSnipe(phase.time, tgt, enemies, world, offV);
                    antiSnipe.push({
                        targetKey: tgt.key, phase: phase.name,
                        results: as.map((r) => ({ enemy: r.enemy, dToTarget: r.dToTarget, travel: r.travel, maxLaunchSnipe: r.maxLaunchSnipe, myAttackArrival: r.myAttackArrival, nCands: r.cands.length, canCounter: r.canCounter }))
                    });
                    as.forEach((r) => {
                        if (!r.canCounter) return;
                        const best = r.cands[0];
                        missions.push({ phase: phase.name, type: 'Anti-snipe', from: best.v.key, to: r.enemy.key, fromOwner: best.v.owner, travel: best.travel, launch: best.launch, arrival: r.myAttackArrival, troops: `OFF anti-snipe (bloqueia ${r.enemy.key})`, isFake: false });
                    });
                });
            } else {
                const ft = FAKE_TYPES[phase.type] || FAKE_TYPES.fake;
                [...offV, ...fakeV].forEach((v) => {
                    const shuffled = [...targets].sort(() => Math.random() - 0.5);
                    const n = Math.min(fakesPerVillage, shuffled.length * 3);
                    for (let i = 0; i < n; i++) {
                        const tgt = shuffled[i % shuffled.length], arrival = attack + i * 2, travel = travelTime(v, tgt, ft.unit, world);
                        missions.push({ phase: phase.name, type: ft.name, from: v.key, to: tgt.key, fromOwner: v.owner, travel, launch: arrival - travel, arrival, troops: ft.troops, isFake: true });
                    }
                });
            }
        });
        missions.sort((a, b) => a.launch - b.launch);

        const real = missions.filter((m) => !m.isFake);
        const asVill = antiSnipe.reduce((s, a) => s + a.results.filter((r) => r.canCounter).length, 0);
        const asTotal = antiSnipe.reduce((s, a) => s + a.results.length, 0);
        return {
            created: Date.now(), world, treaty: KA.treaty(), minOff,
            players: state.players.map((p) => ({
                name: p.name, villages: p.villages.length,
                off: p.villages.filter((v) => KA.calcOffPower(v.troops) >= minOff).length,
                snob: p.villages.filter((v) => v.troops.snob > 0).length, totals: KA.totalsOf(p.villages)
            })),
            global: KA.totalsOf(allies),
            counts: { players: state.players.length, villages: allies.length, off: offV.length, fake: fakeV.length, snob: snobV.length },
            phases: state.phases.map((ph) => {
                const ms = missions.filter((m) => m.phase === ph.name);
                return { name: ph.name, time: ph.time, w: treatyWindow(secs(ph.time)), fakes: ms.filter((m) => m.isFake).length, reals: ms.filter((m) => !m.isFake).length };
            }),
            missions, antiSnipe, warnings,
            metrics: {
                off: real.filter((m) => m.type === 'OFF').length, snob: real.filter((m) => m.type === 'Conde real').length,
                fakes: missions.length - real.length, antiSnipe: real.filter((m) => m.type === 'Anti-snipe').length, asVill, asTotal
            }
        };
    }

    async function generate() {
        if (!KA.allies().length) {
            await KA.dialog({ title: 'Faltam aldeias', message: 'Importa primeiro as overviews dos jogadores no separador Aldeias.' });
            location.hash = '#aldeias';
            return;
        }
        if (!state.phases.length) { toast('Adiciona pelo menos uma fase.'); return; }
        const plan = buildPlan();
        if (!plan.missions.length) {
            await KA.dialog({ title: 'Plano vazio', message: plan.warnings.join('\n') || 'Não foi possível gerar missões. Verifica os alvos das fases.' });
            return;
        }
        KA.setPlan(plan);
        KA.emit('plan');
        location.hash = '#plano';
        if (plan.warnings.length) toast(plan.warnings[0]);
    }

    // ---------- UI ----------
    const num = (label, key, opts = {}) => h('label', { class: 'fld' }, h('span', {}, label),
        h('input', {
            type: 'number', inputmode: 'numeric', min: opts.min ?? 0, value: S[key], oninput: (e) => {
                S[key] = +e.target.value; KA.save();
                if (key === 'world') KA.updateWorldChip();
            }
        }));

    function phaseCard(p, targetsInput) {
        const ta = h('textarea', { rows: 3, placeholder: '537|519\n533|512', oninput: (e) => { p.targetsText = e.target.value; KA.save(); } });
        ta.value = p.targetsText || '';
        return h('div', { class: 'phase-card' },
            h('div', { class: 'ph-header' },
                h('input', { class: 'ph-name', type: 'text', value: p.name, maxlength: 40, 'aria-label': 'Nome da fase', oninput: (e) => { p.name = e.target.value; KA.save(); } }),
                h('button', { type: 'button', class: 'btn-x', 'aria-label': 'Remover fase', onclick: () => { state.phases = state.phases.filter((x) => x !== p); KA.save(); render(); } }, '×')),
            h('div', { class: 'row2' },
                h('label', { class: 'fld' }, h('span', {}, 'Hora de chegada'),
                    h('input', { type: 'time', step: 1, value: p.time, oninput: (e) => { if (e.target.value) { p.time = e.target.value; KA.save(); } } })),
                h('label', { class: 'fld' }, h('span', {}, 'Tipo'),
                    h('select', { value: p.type, onchange: (e) => { p.type = e.target.value; KA.save(); } }, PHASE_TYPES.map(([v, l]) => h('option', { value: v }, l))))),
            h('label', { class: 'fld' }, h('span', {}, 'Alvos desta fase'), ta),
            h('button', { type: 'button', class: 'secondary small', onclick: () => { p.targetsText = state.targets; ta.value = state.targets; KA.save(); toast('Alvos copiados.'); } }, '↧ Usar alvos gerais'));
    }

    function suggest(out) {
        const parsed = parseCoords(state.targets), allies = KA.allies();
        if (!parsed.length) { out.innerHTML = '<div class="alert warn">Escreve primeiro algumas coordenadas.</div>'; return; }
        if (!allies.length) { out.innerHTML = '<div class="alert warn">Importa primeiro as aldeias da aliança.</div>'; return; }
        const rows = parsed.map((tgt) => {
            let minDist = Infinity, reach = 0;
            allies.forEach((a) => { const d = dist(a, tgt); if (d < minDist) minDist = d; if (travelTime(a, tgt, 'warrior', S.world) < 4 * 3600) reach++; });
            return { tgt, minDist, reach, score: minDist - reach * 5 };
        }).sort((a, b) => a.score - b.score).slice(0, 15);
        out.innerHTML = '<div class="phase"><h4>💡 Alvos analisados</h4>' + rows.map((s) =>
            `<div class="village-row"><b>${esc(s.tgt.key)}</b><span class="small">Dist. ${s.minDist.toFixed(1)} · ${s.reach} aldeias a &lt;4h</span></div>`).join('') + '</div>';
    }

    function render() {
        const allies = KA.allies();
        const nOff = allies.filter((v) => v.offPower >= S.minOff).length;
        const sugOut = h('div', {});
        const targetsTa = h('textarea', { rows: 4, placeholder: '537|519\n533|512\n530|512', oninput: (e) => { state.targets = e.target.value; KA.save(); } });
        targetsTa.value = state.targets;
        const enemyStatus = h('div', { class: 'status' });
        const enemiesTa = h('textarea', {
            rows: 3, placeholder: '520|510\n525|515', oninput: (e) => { state.enemies = e.target.value; KA.save(); refreshEnemies(); }
        });
        enemiesTa.value = state.enemies;
        const refreshEnemies = () => { enemyStatus.textContent = `${parseCoords(state.enemies).length} aldeias inimigas`; };
        refreshEnemies();

        KA.mount(root, 
            h('div', { class: 'hero' },
                h('div', { class: 'hero-top' },
                    h('div', { class: 'grow' },
                        h('span', { class: 'kicker small' }, 'Planeador'),
                        h('div', { class: 'hero-name' }, 'Operação'))),
                h('div', { class: 'hero-stats' },
                    h('div', {}, h('b', {}, String(allies.length)), h('small', {}, 'aldeias')),
                    h('div', {}, h('b', {}, String(nOff)), h('small', {}, 'OFF')),
                    h('div', {}, h('b', {}, String(state.phases.length)), h('small', {}, 'fases'))),
                h('button', { type: 'button', class: 'awesome', onclick: generate }, '⚔ Gerar operação completa')),

            h('details', { class: 'panel fold-panel' },
                h('summary', {}, h('h2', {}, '⚙ Configuração')),
                h('div', { class: 'row2' },
                    h('label', { class: 'fld' }, h('span', {}, 'Velocidade do servidor'),
                        h('select', { value: String(S.world), onchange: (e) => { S.world = +e.target.value; KA.save(); KA.updateWorldChip(); } },
                            [1, 2, 3, 4, 5, 10].map((n) => h('option', { value: String(n) }, `${n}x`)))),
                    num('Mín. poder ofensivo', 'minOff')),
                h('div', { class: 'row2' }, num('Escolta do conde', 'escort'), num('Fakes por aldeia', 'fakesPerVillage')),
                h('h3', {}, 'Tratado de paz'),
                h('div', { class: 'row3' },
                    h('label', { class: 'fld' }, h('span', {}, 'Tipo'),
                        h('select', { value: S.treatyType, onchange: (e) => { S.treatyType = e.target.value; KA.save(); } },
                            Object.entries(KA.TREATY_NAMES).map(([v, l]) => h('option', { value: v }, l)))),
                    num('Proteção (h)', 'protect'), num('Bloqueio (h)', 'block'))),

            h('div', { class: 'panel' },
                h('h2', {}, '📅 Fases'),
                state.phases.length ? state.phases.map((p) => phaseCard(p)) : h('div', { class: 'empty' }, 'Sem fases. Adiciona uma.'),
                h('div', { class: 'actions' },
                    h('button', { type: 'button', onclick: () => { state.phases.push({ id: uid(), name: `Fase ${state.phases.length + 1}`, time: '12:00:00', type: 'fake', targetsText: '' }); KA.save(); render(); } }, '+ Fase'),
                    h('button', { type: 'button', class: 'secondary', onclick: () => { state.phases.push({ id: uid(), name: 'Operação Fake', time: '09:00:00', type: 'fake', targetsText: state.targets }); KA.save(); render(); } }, '+ Fake rápida'),
                    h('button', { type: 'button', class: 'secondary', onclick: () => { state.phases.push({ id: uid(), name: 'Operação Real', time: '13:10:00', type: 'real', targetsText: state.targets }); KA.save(); render(); } }, '+ Real rápida')),
                state.phases.length ? h('button', {
                    type: 'button', class: 'secondary danger', onclick: async () => {
                        if (!await confirmDialog('Remover todas as fases?', { okText: 'Remover', danger: true })) return;
                        state.phases = []; KA.save(); render();
                    }
                }, '🗑 Limpar fases') : null),

            h('div', { class: 'panel' },
                h('h2', {}, '🎯 Alvos'),
                h('p', { class: 'muted small' }, 'Coordenadas inimigas a atacar, uma por linha (x|y).'),
                targetsTa,
                h('div', { class: 'actions' },
                    h('button', { type: 'button', class: 'secondary', onclick: () => suggest(sugOut) }, '💡 Sugerir'),
                    h('button', { type: 'button', class: 'secondary', onclick: () => { state.targets = '444|664\n537|519\n533|512\n530|512'; targetsTa.value = state.targets; KA.save(); suggest(sugOut); } }, 'Exemplo')),
                sugOut),

            h('div', { class: 'panel' },
                h('h2', {}, '🔴 Aldeias inimigas'),
                h('p', { class: 'muted small' }, 'Aldeias que podem snipar os teus condes (usadas no anti-snipe).'),
                enemiesTa, enemyStatus,
                h('button', { type: 'button', class: 'secondary', onclick: () => { state.enemies = '520|510\n525|515\n530|505\n510|500\n515|520'; enemiesTa.value = state.enemies; KA.save(); refreshEnemies(); } }, 'Exemplo')));
    }

    document.addEventListener('viewchange', (e) => { if (e.detail === 'operacao') render(); });
    KA.on('change', () => { if (location.hash === '#operacao') render(); });
    window.Ops = { buildPlan, generate, treatyWindow };
})();
