// Navegação por separadores (hash). O separador "Mais" agrupa as restantes secções.
(() => {
    'use strict';
    const MORE = ['mais', 'condes', 'tutoriais', 'extrair', 'backup'];
    const views = [...document.querySelectorAll('[data-view]')];
    const links = [...document.querySelectorAll('#appNav a')];
    const names = views.map((v) => v.dataset.view);

    const back = document.createElement('a');
    back.id = 'backLink';
    back.className = 'back-link';
    back.href = '#mais';
    back.textContent = '← Mais';
    back.hidden = true;
    views[0].parentElement.prepend(back);

    function home() {
        return KA.state.players.length ? 'operacao' : 'aldeias';
    }

    function show() {
        const name = location.hash.slice(1);
        const active = names.includes(name) ? name : home();
        const group = MORE.includes(active) ? 'mais' : active;
        views.forEach((v) => { v.hidden = v.dataset.view !== active; });
        links.forEach((a) => {
            if (a.getAttribute('href') === `#${group}`) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
        back.hidden = !(MORE.includes(active) && active !== 'mais');
        if (active !== show.last) window.scrollTo(0, 0);
        show.last = active;
        document.dispatchEvent(new CustomEvent('viewchange', { detail: active }));
    }

    window.addEventListener('hashchange', show);
    show();
})();
