// Botão "App": instala a PWA (Android/desktop) ou mostra como adicionar ao ecrã principal (iPhone).
(() => {
    'use strict';
    const btn = document.getElementById('installBtn');
    if (!btn) return;
    let deferred = null;
    const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

    const refresh = () => { btn.hidden = standalone(); };

    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; refresh(); });
    window.addEventListener('appinstalled', () => { deferred = null; refresh(); });

    btn.addEventListener('click', async () => {
        if (deferred) {
            deferred.prompt();
            await deferred.userChoice;
            deferred = null;
            refresh();
            return;
        }
        const message = ios
            ? 'No Safari, toca em Partilhar (⬆) e escolhe "Adicionar ao ecrã principal".'
            : 'No menu do navegador (⋮) escolhe "Instalar app" ou "Adicionar ao ecrã principal".';
        KA.dialog({ title: 'Instalar app', message, type: 'alert' });
    });

    refresh();
})();
