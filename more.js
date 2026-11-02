// Secções do separador "Mais": condes por pontuação, tutoriais e script de extração da overview.
(() => {
    'use strict';
    const { h, esc, toast, fmtNum } = KA;

    // ---------- Condes necessários ----------
    // Tabela principal (referência da comunidade) e a mais conservadora, ambas do texto da página original.
    const MAIN = [[4500, '2'], [6750, '3'], [9000, '4'], [9990, '5'], [Infinity, '6']];
    const SAFE = [[4500, '2'], [5500, '2 ou 3'], [6750, '3'], [8250, '3 ou 4'], [9000, '4'], [10000, '5 ou 6']];
    const pick = (table, pts) => (table.find(([max]) => pts <= max) || table[table.length - 1])[1];

    function renderSnobs() {
        const root = document.getElementById('view-snobs');
        const out = h('div', { class: 'out' });
        const inp = h('input', { type: 'number', inputmode: 'numeric', min: 50, max: 20000, placeholder: 'ex. 7200' });
        const calc = () => {
            const pts = Math.trunc(+inp.value);
            if (!(pts >= 50)) { out.innerHTML = '<div class="alert warn">Indica a pontuação da colónia (mínimo 50).</div>'; return; }
            out.innerHTML = `<div class="summary">
                <div class="stat ok"><div class="v">${pick(MAIN, pts)}</div><div class="l">Referência principal</div></div>
                <div class="stat warn"><div class="v">${pick(SAFE, pts)}</div><div class="l">Conservadora</div></div></div>
                <div class="alert info">Para <b>${fmtNum(pts)}</b> pontos. Se estiveres perto de um limite, envia sempre o valor mais alto e não arrisques.</div>`;
        };
        inp.addEventListener('input', calc);
        const table = (rows, head) => `<div class="tbl-wrap"><table class="borderlist"><thead><tr><th>${head}</th><th class="num">Condes</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        KA.mount(root, 
            h('div', { class: 'panel' },
                h('h2', {}, '👑 Condes necessários'),
                h('p', { class: 'muted' }, 'Quantos condes precisas para conquistar uma colónia? As fontes da comunidade não são unânimes nos limiares exatos (variam por versão/servidor): usa estas duas referências como intervalo de segurança, não como valor absoluto.'),
                h('label', { class: 'fld' }, h('span', {}, 'Pontuação da colónia (poderio/aprovação)'), inp),
                out),
            h('div', { class: 'panel' },
                h('h2', {}, 'Referência principal'),
                h('div', {
                    html: table(`<tr><td>50 – 4.500</td><td class="num"><b>2</b></td></tr><tr><td>4.500 – 6.750</td><td class="num"><b>3</b></td></tr><tr><td>6.750 – 9.000</td><td class="num"><b>4</b></td></tr><tr><td>9.000 – 9.990</td><td class="num"><b>5</b></td></tr><tr><td>10.000 (Memorial)</td><td class="num"><b>6</b></td></tr>`, 'Pontos')
                }),
                h('h3', {}, 'Referência conservadora'),
                h('div', {
                    html: table(`<tr><td>0 – 4.500</td><td class="num">2</td></tr><tr><td>4.500 – 5.500</td><td class="num">2 ou 3</td></tr><tr><td>5.500 – 6.750</td><td class="num">3</td></tr><tr><td>6.750 – 8.250</td><td class="num">3 ou 4</td></tr><tr><td>8.250 – 9.000</td><td class="num">4</td></tr><tr><td>9.000 – 10.000</td><td class="num">5 ou 6</td></tr>`, 'Pontos')
                })),
            h('div', {
                class: 'panel', html: `<h2>Importante</h2><p>Cada ataque vitorioso com conde reduz o poderio/aprovação entre ~2.000 e 2.750 pontos (menos se houver monumento), mas o <b>primeiro</b> ataque nunca reduz mais de metade do valor total — e só conta se o conde sobreviver. A moral/aprovação recupera com o tempo, por isso os ataques devem ser sucessivos e pouco espaçados.</p>
                <p><b>Enviar vários condes no mesmo ataque não ajuda</b> — só 1 conde por onda reduz o poderio, os restantes são desperdiçados; o mais eficiente é 1 conde por ataque, em ataques seguidos.</p>
                <p>Atenção ao <b>ataque suicida</b>: se um dos teus ataques já conquista a aldeia, os seguintes que tinhas programado acabam por atingir a tua própria aldeia — cancela-os a tempo.</p>`
            }));
        inp.focus({ preventScroll: true });
    }

    // ---------- Tutoriais ----------
    function renderTutorials() {
        const root = document.getElementById('view-tutorials');
        const list = h('div', { class: 'tuto-list' });
        const draw = (q) => {
            const term = q.trim().toLowerCase();
            const items = KA_TUTORIALS.filter((t) => !term || (t.title + ' ' + t.html.replace(/<[^>]+>/g, ' ')).toLowerCase().includes(term));
            list.replaceChildren(...(items.length
                ? items.map((t) => h('details', { class: 'tuto-acc' },
                    h('summary', {}, h('span', { class: 'ti' }, t.icon), t.title),
                    h('div', { class: 'tuto-body', html: t.html })))
                : [h('div', { class: 'empty' }, 'Nenhum tutorial encontrado.')]));
        };
        const search = h('input', { type: 'search', class: 'search', placeholder: 'Pesquisar tutoriais…', 'aria-label': 'Pesquisar', oninput: (e) => draw(e.target.value) });
        draw('');
        KA.mount(root, h('div', { class: 'panel' }, h('h2', {}, '📚 Tutoriais'),
            h('p', { class: 'muted small' }, 'Resumo em português dos tutoriais de referência da comunidade, para consultares sem sair da app.'), search, list));
    }

    // ---------- Extrair overview ----------
    function renderSnippet() {
        const root = document.getElementById('view-snippet');
        const box = h('pre', { class: 'snippet-box' });
        box.textContent = SNIPPET;
        KA.mount(root, 
            h('div', { class: 'panel' },
                h('h2', {}, '📋 Extrair a overview'),
                h('p', { class: 'muted small' }, 'O script lê a tabela da overview do KingsAge. Só funciona num computador (precisa da consola do navegador); depois podes partilhar o resultado com o líder pelo telemóvel.'),
                h('ol', { class: 'steps' },
                    h('li', { html: 'Abre o KingsAge em <b>Visão geral das aldeias</b>.' }),
                    h('li', { html: 'Prime <b>F12</b> → separador <b>Console</b>.' }),
                    h('li', { html: 'Cola o código abaixo e prime <b>Enter</b>.' }),
                    h('li', { html: 'Na janela que aparece no jogo: clica dentro, <b>Ctrl+A</b>, <b>Ctrl+C</b>.' }),
                    h('li', { html: 'Volta a <a href="#aldeias">Aldeias</a> e cola no campo "Overview".' })),
                box,
                h('div', { class: 'actions' },
                    h('button', { type: 'button', onclick: async () => { toast((await KA.copyText(SNIPPET)) ? 'Script copiado.' : 'Seleciona e copia manualmente.'); } }, '📋 Copiar script'),
                    h('button', {
                        type: 'button', class: 'secondary', onclick: () => KA.dialog({
                            title: 'Como funciona',
                            message: '1. O script lê a tabela da overview do KingsAge.\n2. Extrai coordenadas (do title) e tropas (das células).\n3. Mostra uma janela no jogo com o JSON.\n4. Copias e colas aqui.\n\nNão guarda nada, não envia nada.'
                        })
                    }, 'ℹ Como funciona'))));
    }

    document.addEventListener('viewchange', (e) => {
        if (e.detail === 'condes') renderSnobs();
        else if (e.detail === 'tutoriais') renderTutorials();
        else if (e.detail === 'extrair') renderSnippet();
    });
})();
