// Dados e constantes do KingsAge (portado da página original).
(() => {
'use strict';
const UNIT_SPEEDS={farmer:20,templar:22,squire:18,warrior:18,archer:18,spy:9,crusader:10,blackknight:11,ram:30,catapult:30,snob:35};
const FAKE_TYPES={
  fake:{name:'Fake',troops:'89 milícias + 1 aríete',unit:'ram'},
  fakeSnob:{name:'Conde falso',troops:'1 conde falso',unit:'snob'},
  fakeSpy:{name:'Fake espião',troops:'5 espiões',unit:'spy'},
  fakeSpyRam:{name:'Fake espião+aríete',troops:'89 espiões + 1 aríete',unit:'ram'},
  fakeAxeRam:{name:'Fake guerreiro+aríete',troops:'89 guerreiros + 1 aríete',unit:'ram'},
  realOff:{name:'OFF',troops:'OFF completa',unit:'warrior'},
  realSnob:{name:'Conde real',troops:'1 conde + escolta',unit:'snob'}
};
const TROOP_LABELS={farmer:'Milícias',templar:'Templários',squire:'Escudeiros',warrior:'Guerreiros',archer:'Arqueiros',spy:'Espiões',crusader:'Cruzados',blackknight:'Cav. Negros',ram:'Aríetes',catapult:'Catapultas',snob:'Condes'};
const TROOP_ICONS={farmer:'🛡',templar:'⚔',squire:'🗡',warrior:'⚔',archer:'🏹',spy:'👁',crusader:'🐎',blackknight:'🐴',ram:'🔨',catapult:'⚙',snob:'👑'};
const TROOP_ORDER=['farmer','templar','squire','warrior','archer','spy','crusader','blackknight','ram','catapult','snob'];

/* ===== Custos oficiais de treino e colonos (help.php?m=units) ===== */
const TROOP_COST={
  farmer     :{wood:3     ,stone:10    ,iron:7    ,pop:1  },
  templar    :{wood:30    ,stone:10    ,iron:80   ,pop:1  },
  squire     :{wood:10    ,stone:20    ,iron:30   ,pop:1  },
  warrior    :{wood:40    ,stone:50    ,iron:50   ,pop:1  },
  archer     :{wood:80    ,stone:160   ,iron:80   ,pop:1  },
  spy        :{wood:40    ,stone:60    ,iron:60   ,pop:2  },
  crusader   :{wood:100   ,stone:100   ,iron:300  ,pop:4  },
  blackknight:{wood:100   ,stone:300   ,iron:500  ,pop:6  },
  ram        :{wood:100   ,stone:500   ,iron:200  ,pop:5  },
  catapult   :{wood:200   ,stone:600   ,iron:200  ,pop:8  },
  snob       :{wood:100000,stone:120000,iron:80000,pop:100}
};
/* Imagens oficiais do KingsAge (fallback para emoji se a imagem não carregar) */
const KA_IMG='https://s55-br.kingsage.gameforge.com/img/';
const TROOP_IMG={farmer:'unit_farmer.png',templar:'unit_sword.png',squire:'unit_spear.png',warrior:'unit_axe.png',
  archer:'unit_bow.png',spy:'unit_spy.png',crusader:'unit_light.png',blackknight:'unit_heavy.png',
  ram:'unit_ram.png',catapult:'unit_kata.png',snob:'unit_snob.png'};
const RES_META={wood:{img:'res2.png',label:'Madeira'},stone:{img:'res1.png',label:'Pedra'},iron:{img:'res3.png',label:'Ferro'}};
function troopIcon(u){return `<img class="ka-unit" src="${KA_IMG}units/${TROOP_IMG[u]}" alt="" title="${TROOP_LABELS[u]}" onerror="this.outerHTML='${TROOP_ICONS[u]}'">`}
function resIcon(k){return `<img class="ka-res" src="${KA_IMG}${RES_META[k].img}" alt="" title="${RES_META[k].label}">`}
function popIcon(){return `<img class="ka-res" src="${KA_IMG}worker.png" alt="" title="Colonos">`}
Object.assign(window,{UNIT_SPEEDS,FAKE_TYPES,TROOP_LABELS,TROOP_ICONS,TROOP_ORDER,TROOP_COST,KA_IMG,TROOP_IMG,RES_META,troopIcon,resIcon,popIcon});
})();
