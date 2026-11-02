// Partilha e backup: exportar/importar jogadores (aldeias) ou tudo, por ficheiro ou código. Valida tudo no import.
(() => {
    'use strict';
    const { h, state, toast, confirmDialog } = KA;
    const PREFIX = 'KAOPS1:';
    const MAX_BYTES = 8 * 1024 * 1024;

    // ---------- Codificação ----------
    function toB64(text) {
        const bytes = new TextEncoder().encode(text);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(bin);
    }
    function fromB64(b64) {
        const bin = atob(b64.replace(/\s+/g, ''));
        return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    }
    const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dados';

    // ---------- Pacotes ----------
    const playersBundle = (names) => ({
        app: 'kaops', v: 1, type: 'players', exported: Date.now(),
        players: state.players.filter((p) => !names || names.includes(p.name))
    });
    const backupBundle = () => {
        const s = JSON.parse(JSON.stringify(state));
        return { app: 'kaops', v: 1, type: 'backup', exported: Date.now(), state: s };
    };

    function download(file) {
        const url = URL.createObjectURL(file);
        const a = h('a', { href: url, download: file.name });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    async function shareFile(bundle, name) {
        const file = new File([JSON.stringify(bundle)], `kaops-${name}.json`, { type: 'application/json' });
        try {
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: 'KingsAge Ops', text: 'Importa no KingsAge Ops (Aldeias → Importar).' });
                return;
            }
        } catch (err) {
            if (err?.name === 'AbortError') return;
        }
        download(file);
        toast('Ficheiro guardado. Envia-o à aliança!');
    }

    async function copyCode(bundle) {
        const ok = await KA.copyText(PREFIX + toB64(JSON.stringify(bundle)));
        toast(ok ? 'Código copiado. Cola-o numa mensagem!' : 'Não foi possível copiar.');
    }

    const sharePlayer = (name) => shareFile(playersBundle([name]), slug(name));
    const copyPlayerCode = (name) => copyCode(playersBundle([name]));
    const shareAllPlayers = () => shareFile(playersBundle(), 'aldeias');
    const copyAllPlayersCode = () => copyCode(playersBundle());

    // ---------- Importar ----------
    function parse(text) {
        text = String(text || '').trim();
        if (!text) throw new Error('Está vazio.');
        if (text.length > MAX_BYTES) throw new Error('Ficheiro demasiado grande.');
        let json = text;
        if (text.startsWith(PREFIX)) json = fromB64(text.slice(PREFIX.length));
        else if (!/^[\[{]/.test(text)) json = fromB64(text);
        const data = JSON.parse(json);
        if (Array.isArray(data)) return { type: 'overview', villages: data };
        if (data?.app !== 'kaops') throw new Error('Isto não é um ficheiro do KingsAge Ops.');
        if (data.type !== 'players' && data.type !== 'backup') throw new Error('Tipo de dados desconhecido.');
        return data;
    }

    async function apply(data) {
        if (data.type === 'players') {
            const incoming = (data.players || []).map(KA.cleanPlayer).filter(Boolean);
            if (!incoming.length) throw new Error('Sem jogadores válidos.');
            let added = 0, updated = 0;
            incoming.forEach((p) => {
                const i = state.players.findIndex((x) => x.name === p.name);
                if (i >= 0) { state.players[i] = p; updated++; } else { state.players.push(p); added++; }
            });
            KA.save();
            KA.emit('change');
            toast(`Importado: ${added} novo(s), ${updated} atualizado(s).`);
            return true;
        }
        if (data.type === 'backup') {
            const ok = await confirmDialog('Isto substitui TODOS os dados atuais (jogadores, fases, alvos, definições). Continuar?', { title: 'Restaurar backup', okText: 'Restaurar', danger: true });
            if (!ok) return false;
            KA.replaceState(data.state);
            KA.setPlan(null);
            toast('Backup restaurado.');
            return true;
        }
        return false;
    }

    async function importText(text) {
        try {
            const data = parse(text);
            if (data.type === 'overview') throw new Error('Isto é uma overview crua: usa o campo "Overview" em Aldeias → Importar overview.');
            return await apply(data);
        } catch (e) {
            toast(`Importação falhou: ${e.message}`);
            return false;
        }
    }

    function pickFile(onText) {
        const input = h('input', { type: 'file', accept: '.json,application/json,text/plain', class: 'hidden' });
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            input.remove();
            if (!file) return;
            if (file.size > MAX_BYTES) { toast('Ficheiro demasiado grande.'); return; }
            onText(await file.text());
        });
        document.body.append(input);
        input.click();
    }
    const importFile = () => pickFile((t) => importText(t));

    function importCodeDialog() {
        const ta = h('textarea', { rows: 6, placeholder: 'Cola aqui o código (KAOPS1:…) ou o conteúdo do ficheiro' });
        KA.sheet({
            title: 'Importar código',
            body: ta,
            actions: [{ label: 'Importar', onclick: async (close) => { if (await importText(ta.value)) close(); } }]
        });
    }

    // ---------- Vista Backup ----------
    function renderBackup() {
        const root = document.getElementById('view-backup');
        const nPlayers = state.players.length, nVillages = state.players.reduce((s, p) => s + p.villages.length, 0);
        KA.mount(root, 
            h('div', { class: 'panel' },
                h('h2', {}, 'Backup e partilha'),
                h('p', { class: 'muted' }, `Tens ${nPlayers} jogador(es) e ${nVillages} aldeia(s) guardados neste dispositivo.`),
                h('p', { class: 'muted small' }, 'Cada membro pode exportar as suas aldeias e enviá-las ao líder, que as importa e gera o plano — sem servidor.')),
            h('div', { class: 'panel' },
                h('h2', {}, 'Exportar'),
                h('div', { class: 'actions' },
                    h('button', { type: 'button', onclick: shareAllPlayers }, '📤 Aldeias (ficheiro)'),
                    h('button', { type: 'button', class: 'secondary', onclick: copyAllPlayersCode }, '📋 Aldeias (código)')),
                h('div', { class: 'actions' },
                    h('button', { type: 'button', class: 'secondary', onclick: () => shareFile(backupBundle(), 'backup') }, '💾 Backup total (ficheiro)'),
                    h('button', { type: 'button', class: 'secondary', onclick: () => copyCode(backupBundle()) }, '📋 Backup total (código)'))),
            h('div', { class: 'panel' },
                h('h2', {}, 'Importar'),
                h('div', { class: 'actions' },
                    h('button', { type: 'button', onclick: importFile }, '📂 De ficheiro'),
                    h('button', { type: 'button', class: 'secondary', onclick: importCodeDialog }, '📋 Colar código'))),
            h('div', { class: 'panel' },
                h('h2', {}, 'Zona de perigo'),
                h('button', {
                    type: 'button', class: 'secondary danger', onclick: async () => {
                        if (!await confirmDialog('Apagar todos os dados guardados neste dispositivo?', { title: 'Apagar tudo', okText: 'Apagar', danger: true })) return;
                        KA.replaceState(KA.defaults());
                        KA.setPlan(null);
                        toast('Dados apagados.');
                    }
                }, '🗑 Apagar todos os dados')));
    }
    document.addEventListener('viewchange', (e) => { if (e.detail === 'backup') renderBackup(); });
    KA.on('change', () => { if (location.hash === '#backup') renderBackup(); });

    window.Share = { sharePlayer, copyPlayerCode, shareAllPlayers, copyAllPlayersCode, importFile, importCodeDialog, importText };
})();
