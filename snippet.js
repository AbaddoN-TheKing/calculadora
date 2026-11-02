// Snippet para extrair a overview no KingsAge.
const SNIPPET = `(function(){
  const villages = [];
  const troopMap = {
    'Milícia do fazendeiro':'farmer','Templário':'templar','Escudeiro':'squire',
    'Guerreiro':'warrior','Arqueiro':'archer','Espião':'spy','Cruzado':'crusader',
    'Cavaleiro negro':'blackknight','Aríete':'ram','Catapulta':'catapult','Conde':'snob'
  };
  document.querySelectorAll('tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    if(cells.length < 12) return;
    const titleSpan = cells[0].querySelector('span[title]');
    if(!titleSpan) return;
    const title = titleSpan.getAttribute('title');
    const coordMatch = title.match(/\\((\\d{1,3})\\|(\\d{1,3})\\)/);
    if(!coordMatch) return;
    const x = parseInt(coordMatch[1], 10);
    const y = parseInt(coordMatch[2], 10);
    const name = title.replace(/\\s*\\(\\d+\\|\\d+\\).*$/, '').trim();
    const troops = {farmer:0,templar:0,squire:0,warrior:0,archer:0,spy:0,crusader:0,blackknight:0,ram:0,catapult:0,snob:0};
    cells.forEach(cell => {
      const t = cell.getAttribute('title') || '';
      const m = t.match(/^([\\d\\.]+)\\s+(.+)$/);
      if(m){
        const count = parseInt(m[1].replace(/\\./g,''), 10);
        const unit = m[2].trim();
        if(troopMap[unit]) troops[troopMap[unit]] = count;
      }
    });
    const snobLink = cells[cells.length-1].querySelector('a');
    if(snobLink){
      const st = snobLink.textContent.trim();
      if(/^\\d+$/.test(st)) troops.snob = parseInt(st, 10);
    }
    villages.push({x, y, name, troops});
  });
  const json = JSON.stringify(villages);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Verdana,sans-serif';
  overlay.innerHTML = '<div style="background:#F1EBDD;border:2px solid #CFAB65;padding:20px;max-width:900px;width:100%;max-height:90vh;overflow-y:auto">'
    + '<div style="font-size:16px;color:#840000;font-weight:bold;margin-bottom:10px">✅ ' + villages.length + ' aldeias extraídas!</div>'
    + '<div style="font-size:12px;color:#5a3d1a;margin-bottom:10px"><b>1.</b> Clica dentro da caixa abaixo<br><b>2.</b> <b>Ctrl+A</b> (selecionar tudo)<br><b>3.</b> <b>Ctrl+C</b> (copiar)<br><b>4.</b> Volta à dashboard e cola (Ctrl+V)</div>'
    + '<textarea id="kes-output" style="width:100%;height:300px;font-family:Courier New,monospace;font-size:11px;border:1px solid #CFAB65;background:#fff;padding:10px" readonly>' + json + '</textarea>'
    + '<div style="margin-top:10px;text-align:right">'
    + '<button id="kes-copy" style="background:#7aa87a;color:#fff;border:1px solid #5a8a5a;padding:8px 16px;cursor:pointer;font-weight:bold">📋 Copiar</button> '
    + '<button id="kes-close" style="background:#e8d8b0;border:1px solid #c4a76e;padding:8px 16px;cursor:pointer">Fechar</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  const ta = document.getElementById('kes-output');
  ta.focus(); ta.select();
  document.getElementById('kes-copy').onclick = function(){
    ta.select();
    try { document.execCommand('copy'); alert('✅ Copiado! Cola na dashboard.'); }
    catch(e){ alert('⚠ Usa Ctrl+A e Ctrl+C manualmente.'); }
  };
  document.getElementById('kes-close').onclick = function(){ overlay.remove(); };
  console.log('✅ ' + villages.length + ' aldeias. Janela aberta.');
})();`;
window.SNIPPET=SNIPPET;
