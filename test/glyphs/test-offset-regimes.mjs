// Ground the "which offsets is the substitution table exact at?" question.
// For each (lat=v, long=h) offset: seed = order-5 offset map, expand via the
// seniority's SUB_TABLE, compare to the order-6 offset map (truth). Report
// divergence + which codes appear ("reachables") grouped into D4 orbits
// (member-only). Do it for V and H.

import { Seniority } from "coylean/core";
import {
    getSectionData, computeMapModel, setOffset,
    computePattern, transformedPatternKey, classifyVisualD4, d4Compose,
} from "coylean/glyphs";

const SEC = 4;
const V = Seniority.vertical();
const H = Seniority.horizontal();

// ── D4 machinery (verbatim from substitution.mjs) ──
const D4_POS = [[0,1,2,3],[1,3,0,2],[3,2,1,0],[2,0,3,1],[2,3,0,1],[1,0,3,2],[0,2,1,3],[3,1,2,0]];
const D4_BND = [[0,1,2,3],[3,2,0,1],[1,0,3,2],[2,3,1,0],[1,0,2,3],[0,1,3,2],[2,3,0,1],[3,2,1,0]];
const D4_INV = (() => { const inv = new Array(8);
    for (let g=0;g<8;g++) for (let k=0;k<8;k++) if (d4Compose(g,k)===0){inv[g]=k;break;} return inv; })();
function buildCodeUnderD4(sen){const m=new Map();
    for(let d=0;d<8;d++)for(let r=0;r<8;r++){const{v,h}=computePattern(d,r,sen);m.set(transformedPatternKey(v,h,0),[d,r]);}
    const t={};for(let d=0;d<8;d++)for(let r=0;r<8;r++){const{v,h}=computePattern(d,r,sen);const l=new Array(8);
    for(let ti=0;ti<8;ti++)l[ti]=m.get(transformedPatternKey(v,h,ti));t[d+","+r]=l;}return t;}
const CU_V = buildCodeUnderD4(V), CU_H = buildCodeUnderD4(H);
function applyD4ToRule(rule,ti,ct){const nc=new Array(4);
    for(let i=0;i<4;i++){const[d,r]=rule.children[i];nc[D4_POS[ti][i]]=[...ct[d+","+r][ti]];}
    const ob=[rule.vBoundTop,rule.vBoundBot,rule.hBoundLeft,rule.hBoundRight];const nb=[0,0,0,0];
    for(let i=0;i<4;i++)nb[D4_BND[ti][i]]=ob[i];
    return{children:nc,vBoundTop:nb[0],vBoundBot:nb[1],hBoundLeft:nb[2],hBoundRight:nb[3]};}
function extrapolate(base,sen){const out={...base};const cs=classifyVisualD4(sen);
    const ct=sen.isVertical?CU_V:CU_H;
    for(const cl of cs){let ci=-1;for(let i=0;i<cl.orbit.length;i++){const[d,r]=cl.orbit[i];if(base[d+","+r]){ci=i;break;}}
    if(ci<0)continue;const[cd,cr]=cl.orbit[ci];const br=base[cd+","+cr];const tinv=D4_INV[cl.transforms[ci]];
    for(let i=0;i<cl.orbit.length;i++){const[d,r]=cl.orbit[i];if(out[d+","+r])continue;
    const ti=d4Compose(cl.transforms[i],tinv);out[d+","+r]=applyD4ToRule(br,ti,ct);}}return out;}
function buildSubTable(sen){const o=[32,64,128].map(N=>getSectionData(N,N,sen));const t={};
    function ing(p,c){for(let sr=0;sr<p.NSr;sr++)for(let sc=0;sc<p.NSc;sc++){const[dc,rc]=p.codes[sr][sc];const k=dc+","+rc;
    if(t[k])continue;const a=sr*2,b=sc*2;t[k]={children:[[...c.codes[a][b]],[...c.codes[a][b+1]],[...c.codes[a+1][b]],[...c.codes[a+1][b+1]]],
    vBoundTop:c.vBound[a][b],vBoundBot:c.vBound[a+1][b],hBoundLeft:c.hBound[a][b],hBoundRight:c.hBound[a][b+1]};}}
    ing(o[0],o[1]);ing(o[1],o[2]);return t;}
// prettier-ignore
const EXTRA_SUB_V = {
    "0,1":{children:[[7,2],[0,1],[6,7],[0,1]],vBoundTop:0,vBoundBot:0,hBoundLeft:0,hBoundRight:0},
    "0,2":{children:[[5,0],[6,7],[2,1],[7,5]],vBoundTop:1,vBoundBot:1,hBoundLeft:1,hBoundRight:0},
    "0,5":{children:[[5,0],[6,7],[2,6],[7,2]],vBoundTop:1,vBoundBot:1,hBoundLeft:1,hBoundRight:0},
    "0,6":{children:[[7,5],[0,6],[4,3],[2,6]],vBoundTop:0,vBoundBot:0,hBoundLeft:1,hBoundRight:1},
    "1,0":{children:[[3,6],[6,7],[5,6],[7,1]],vBoundTop:1,vBoundBot:1,hBoundLeft:1,hBoundRight:0},
    "4,6":{children:[[7,5],[0,6],[4,3],[2,6]],vBoundTop:0,vBoundBot:0,hBoundLeft:1,hBoundRight:1},
    "6,0":{children:[[4,5],[1,7],[3,0],[4,1]],vBoundTop:1,vBoundBot:1,hBoundLeft:1,hBoundRight:0},
    "6,4":{children:[[5,0],[1,7],[2,6],[4,2]],vBoundTop:1,vBoundBot:1,hBoundLeft:1,hBoundRight:0},
    "7,2":{children:[[0,1],[7,6],[0,2],[1,5]],vBoundTop:1,vBoundBot:1,hBoundLeft:0,hBoundRight:1},
    "7,5":{children:[[0,6],[7,1],[2,6],[3,2]],vBoundTop:1,vBoundBot:1,hBoundLeft:1,hBoundRight:0},
    "5,0":{children:[[3,6],[2,7],[2,6],[4,2]],vBoundTop:1,vBoundBot:1,hBoundLeft:0,hBoundRight:1},
    "5,5":{children:[[1,4],[3,1],[1,7],[7,2]],vBoundTop:0,vBoundBot:0,hBoundLeft:0,hBoundRight:0},
};
const SUB_V_CANON = extrapolate(buildSubTable(V), V);
const SUB_V_FULL  = extrapolate({...buildSubTable(V), ...EXTRA_SUB_V}, V);
const SUB_H_CANON = extrapolate(buildSubTable(H), H);

function sectionize(model, ns){const{downMatrix,rightMatrix}=model;
    const oR=model.firstDarkRow+1,oC=model.firstDarkCol+1;
    const g=Array.from({length:ns},()=>Array.from({length:ns},()=>[0,0]));
    const vB=Array.from({length:ns},()=>Array(ns).fill(false));
    const hB=Array.from({length:ns},()=>Array(ns).fill(false));
    for(let sr=0;sr<ns;sr++)for(let sc=0;sc<ns;sc++){const y0=oR+sr*SEC,x0=oC+sc*SEC;
    for(let i=0;i<3;i++){const dr=downMatrix[y0];if(dr&&dr[x0+i])g[sr][sc][0]|=1<<i;
    const rc=rightMatrix[x0];if(rc&&rc[y0+i])g[sr][sc][1]|=1<<i;}
    const xE=x0+SEC-1;for(let i=0;i<SEC;i++){const row=downMatrix[y0+i];if(row&&row[xE]){vB[sr][sc]=true;break;}}
    const yE=y0+SEC-1;for(let i=0;i<SEC;i++){const col=rightMatrix[x0+i];if(col&&col[yE]){hB[sr][sc]=true;break;}}}
    return{grid:g,vBound:vB,hBound:hB};}

function expandGrid(grid,vBound,hBound,ns,subTable){const ns2=ns*2;
    const ng=Array.from({length:ns2},()=>Array.from({length:ns2},()=>[0,0]));
    const noRule=[];
    for(let sr=0;sr<ns;sr++)for(let sc=0;sc<ns;sc++){const[dc,rc]=grid[sr][sc];
    const rule=subTable[dc+","+rc];if(!rule){noRule.push(dc+","+rc);continue;}
    const a=sr*2,b=sc*2;ng[a][b]=[...rule.children[0]];ng[a][b+1]=[...rule.children[1]];
    ng[a+1][b]=[...rule.children[2]];ng[a+1][b+1]=[...rule.children[3]];}
    return{grid:ng,ns:ns2,noRule};}

// Divergence: predicted order-6 vs truth order-6, codes only.
function regime(sen, table, h, v){
    setOffset(h, v);
    const m5 = computeMapModel(32, 32, {seniority:sen});
    const m6 = computeMapModel(64, 64, {seniority:sen});
    const ns5 = Math.min(m5.NSr, m5.NSc, 8);
    const ns6 = Math.min(m6.NSr, m6.NSc, 16);
    const s5 = sectionize(m5, ns5);
    const truth6 = sectionize(m6, ns6);
    const exp = expandGrid(s5.grid, s5.vBound, s5.hBound, ns5, table);
    const lim = Math.min(exp.ns, ns6);
    let mism = 0, cells = 0;
    for(let r=0;r<lim;r++)for(let c=0;c<lim;c++){cells++;
        const p=exp.grid[r][c], t=truth6.grid[r][c];
        if(p[0]!==t[0]||p[1]!==t[1])mism++;}
    // reachables = distinct seed codes
    const reach=new Set();
    for(let r=0;r<ns5;r++)for(let c=0;c<ns5;c++)reach.add(s5.grid[r][c].join(","));
    return {mism, cells, noRule:new Set(exp.noRule), reach};
}

function orbitMembers(sen, codeSet){
    const cs=classifyVisualD4(sen);const reps=[];
    for(const cl of cs){const present=cl.orbit.filter(([d,r])=>codeSet.has(d+","+r));
    if(present.length)reps.push({rep:present[0],count:present.length,orbit:cl.orbit.length});}
    return reps;
}

console.log("=== V: divergence by offset (lat=v, long=h) using FULL table (35+29) ===");
console.log("  v\\h", [0,1,2,3].map(h=>"  h"+h).join(""));
for(let v=0;v<=3;v++){let row="   "+v+" ";
    for(let h=0;h<=3;h++){const R=regime(V,SUB_V_FULL,h,v);row+=String(R.mism).padStart(5);}
    console.log(row);}

console.log("\n=== V: same, using CANONICAL-ONLY table (35) ===");
console.log("  v\\h", [0,1,2,3].map(h=>"  h"+h).join(""));
for(let v=0;v<=3;v++){let row="   "+v+" ";
    for(let h=0;h<=3;h++){const R=regime(V,SUB_V_CANON,h,v);row+=String(R.mism).padStart(5);}
    console.log(row);}

console.log("\n=== H: divergence by offset, CANONICAL-ONLY table (35) ===");
console.log("  v\\h", [0,1,2,3].map(h=>"  h"+h).join(""));
for(let v=0;v<=3;v++){let row="   "+v+" ";
    for(let h=0;h<=3;h++){const R=regime(H,SUB_H_CANON,h,v);row+=String(R.mism).padStart(5);}
    console.log(row);}

console.log("\n=== reachables (distinct seed codes) per offset, V ===");
for(const [h,v] of [[0,0],[0,1],[1,0],[1,1],[2,1],[1,2],[2,2]]){
    const R=regime(V,SUB_V_FULL,h,v);
    const reps=orbitMembers(V,R.reach);
    console.log(`  long=${h} lat=${v}: ${R.reach.size} codes, ${reps.length} orbit-members, divergence=${R.mism}/${R.cells}, no-rule seeds=${R.noRule.size}`);
}
setOffset(1,1);
