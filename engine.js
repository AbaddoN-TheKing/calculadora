// Motor de combate oficial (copiado sem alterações da página original).
(() => {
'use strict';
const COMBAT_STATS={
  farmer     :{att:20 ,def:40  ,defCav:30  ,defArc:5   ,cls:'inf'},
  templar    :{att:100,def:300 ,defCav:100 ,defArc:200 ,cls:'inf'},
  squire     :{att:50 ,def:100 ,defCav:200 ,defArc:300 ,cls:'inf'},
  warrior    :{att:350,def:70  ,defCav:50  ,defArc:50  ,cls:'inf'},
  archer     :{att:150,def:400 ,defCav:150 ,defArc:100 ,cls:'arc'},
  spy        :{att:1  ,def:10  ,defCav:5   ,defArc:7   ,cls:'spy'},
  crusader   :{att:900,def:200 ,defCav:300 ,defArc:300 ,cls:'cav'},
  blackknight:{att:600,def:1500,defCav:1000,defArc:1000,cls:'cav'},
  ram        :{att:100,def:100 ,defCav:200 ,defArc:20  ,cls:'inf'},
  catapult   :{att:500,def:400 ,defCav:100 ,defArc:200 ,cls:'inf'},
  snob       :{att:100,def:300 ,defCav:100 ,defArc:200 ,cls:'inf'}
};
const COMBAT_WALL_BONUS=[1.00,1.05,1.09,1.14,1.18,1.23,1.28,1.33,1.38,1.43,1.49,1.55,1.61,1.68,1.74,1.81,1.88,1.96,2.04,2.12,2.20];
const COMBAT_EXP=1.5;
/* Destruição de muralha por aríetes (ajustado a 438 combates com aríetes:
   nível final exato em 80%, ±1 nível em 96%). */
const RAM_COST=13.76, RAM_GROWTH=1.0426, RAM_RATIO_K=1.352, RAM_RATIO_EXP=1.302, RAM_PRE_BATTLE=0.5;
const COMBAT_CLASSES=['inf','cav','arc'];
const COMBAT_DEFKEY={inf:'def',cav:'defCav',arc:'defArc'};

function combatWallBonus(lvl){
  lvl=Math.max(0,Math.min(20,lvl));
  const lo=Math.floor(lvl),hi=Math.min(20,lo+1),f=lvl-lo;
  return COMBAT_WALL_BONUS[lo]*(1-f)+COMBAT_WALL_BONUS[hi]*f;
}
function combatAtkPower(att){return TROOP_ORDER.reduce((s,u)=>{const st=COMBAT_STATS[u];return st&&st.cls!=='spy'?s+(att[u]||0)*st.att:s},0)}
function combatAtkByClass(att){
  const o={inf:0,cav:0,arc:0};
  TROOP_ORDER.forEach(u=>{const st=COMBAT_STATS[u];if(st&&st.cls!=='spy')o[st.cls]+=(att[u]||0)*st.att});
  return o;
}
function combatDefByClass(def){
  const o={inf:0,cav:0,arc:0};
  COMBAT_CLASSES.forEach(c=>{const k=COMBAT_DEFKEY[c];
    o[c]=TROOP_ORDER.reduce((s,u)=>{const st=COMBAT_STATS[u];return st&&st.cls!=='spy'?s+(def[u]||0)*st[k]:s},0)});
  return o;
}
function combatCavShare(att){const a=combatAtkByClass(att),t=a.inf+a.cav+a.arc;return t>0?a.cav/t:0}
function combatDefPower(def,cavShare){const d=combatDefByClass(def);return d.inf*(1-cavShare)+d.cav*cavShare}

function combatRamWallDrop(rams,wall,ratio){
  wall=Math.max(0,Math.min(20,wall));
  if(!(rams>0)||wall<=0)return 0;
  let power=rams*Math.min(1,Math.pow(Math.min(1,ratio*RAM_RATIO_K),RAM_RATIO_EXP));
  let lvl=wall;
  while(lvl>0&&power>=RAM_COST*Math.pow(RAM_GROWTH,lvl)){power-=RAM_COST*Math.pow(RAM_GROWTH,lvl);lvl--}
  return wall-lvl;
}

function simulateBattle(att,def,mods){
  mods=mods||{};
  const wall0=Math.max(0,Math.min(20,mods.wall||0));
  const moral=(mods.moral==null?100:mods.moral),luck=mods.luck||0;
  const night=!!mods.night,statue=!!mods.statue;
  const aMul=(moral/100)*(1+luck/100);
  const aCls=combatAtkByClass(att);
  COMBAT_CLASSES.forEach(c=>aCls[c]*=aMul);
  const atkEff=aCls.inf+aCls.cav+aCls.arc;
  const dRaw=combatDefByClass(def);
  const defMul=w=>combatWallBonus(w)*(night?2:1)*(statue?1.5:1);

  const result={att:{},def:{},atkRaw:combatAtkPower(att),defRaw:dRaw.inf,cavShare:combatCavShare(att),
                wallBefore:wall0,wallAfter:wall0,wallUsed:wall0,classes:{}};
  if(atkEff<=0){
    result.winner='defender';result.fraction=0;result.atkEff=0;
    result.defEff=dRaw.inf*defMul(wall0);result.ratio=0;
    TROOP_ORDER.forEach(u=>{result.att[u]={amount:att[u]||0,losses:att[u]||0,survivors:0};
                            result.def[u]={amount:def[u]||0,losses:0,survivors:def[u]||0}});
    return result;
  }
  // 1) aríetes: dano de muralha, metade aplicada antes deste combate
  const defRef=COMBAT_CLASSES.reduce((s,c)=>s+(aCls[c]/atkEff)*dRaw[c],0)*defMul(wall0);
  const drop=combatRamWallDrop(att.ram||0,wall0,defRef>0?atkEff/defRef:Infinity);
  result.wallAfter=wall0-drop;
  result.wallUsed=wall0-RAM_PRE_BATTLE*drop;
  const dMul=defMul(result.wallUsed);

  // 2) sub-combate por classe
  const lossFrac={inf:0,cav:0,arc:0};let defLost=0;
  COMBAT_CLASSES.forEach(c=>{
    if(aCls[c]<=0)return;
    const share=aCls[c]/atkEff, D=dRaw[c]*dMul*share;
    if(aCls[c]>D){lossFrac[c]=D>0?Math.pow(D/aCls[c],COMBAT_EXP):0;defLost+=share}
    else{lossFrac[c]=1;defLost+=share*Math.pow(aCls[c]/D,COMBAT_EXP)}
    result.classes[c]={atk:aCls[c],def:D,attLossFrac:lossFrac[c]};
  });
  defLost=Math.min(1,defLost);

  const defEff=COMBAT_CLASSES.reduce((s,c)=>s+(aCls[c]/atkEff)*dRaw[c],0)*dMul;
  result.atkEff=atkEff;result.defEff=defEff;result.ratio=defEff>0?atkEff/defEff:Infinity;
  result.winner=defLost>=0.999?'attacker':'defender';
  result.defLossFrac=defLost;
  const attLossTotal=TROOP_ORDER.reduce((s,u)=>{const st=COMBAT_STATS[u];
    return st&&st.cls!=='spy'?s+(att[u]||0)*lossFrac[st.cls]:s},0);
  const attQty=TROOP_ORDER.reduce((s,u)=>{const st=COMBAT_STATS[u];return st&&st.cls!=='spy'?s+(att[u]||0):s},0);
  result.attLossFrac=attQty>0?attLossTotal/attQty:0;
  result.fraction=result.winner==='attacker'?result.attLossFrac:defLost;

  // 3) perdas por unidade
  TROOP_ORDER.forEach(u=>{
    const st=COMBAT_STATS[u],ac=att[u]||0,dc=def[u]||0;
    if(!st){result.att[u]={amount:ac,losses:0,survivors:ac};result.def[u]={amount:dc,losses:0,survivors:dc};return}
    if(st.cls==='spy'){ // batalha de espiões (aproximada — poucos dados de calibração)
      let al=0,dl=0;
      if(ac>0&&dc>0){const r=Math.min(ac,dc)/Math.max(ac,dc);
        if(ac>dc){al=Math.round(ac*Math.pow(r,3));dl=Math.round(dc*(1-r*r))}
        else{al=ac;dl=Math.round(dc*Math.pow(ac/dc,2))}}
      else if(dc>0&&ac===0){dl=0}
      result.att[u]={amount:ac,losses:Math.min(ac,al),survivors:ac-Math.min(ac,al)};
      result.def[u]={amount:dc,losses:Math.min(dc,dl),survivors:dc-Math.min(dc,dl)};
      return;
    }
    const al=Math.min(ac,Math.round(ac*lossFrac[st.cls]));
    const dl=Math.min(dc,Math.round(dc*defLost));
    result.att[u]={amount:ac,losses:al,survivors:ac-al};
    result.def[u]={amount:dc,losses:dl,survivors:dc-dl};
  });
  return result;
}
Object.assign(window,{COMBAT_STATS,combatAtkPower,combatDefByClass,simulateBattle});
})();
