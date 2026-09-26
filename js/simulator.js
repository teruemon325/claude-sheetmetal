/* ===== 曲げシミュレーター(金型干渉判定つき) =====
   断面プロファイル・展開図に加え、機械座標(ダイ固定・パンチ下降)に部品を配置して
   パンチ/ダイとの干渉を幾何的に検出する。数値は代表値に基づく目安。 */
(function(){
  const NS='http://www.w3.org/2000/svg';

  /* 材料物性(代表値) */
  const MAT={
    spcc  :{n:'SPCC(冷延鋼板)',        sb:400, rho:7.85, sbk:1.2, rmin:0.5, vr:6.0},
    secc  :{n:'SECC(電気亜鉛メッキ鋼板)',sb:400, rho:7.85, sbk:1.3, rmin:0.5, vr:6.0},
    sphc  :{n:'SPHC / SS400(熱延鋼板)', sb:420, rho:7.85, sbk:1.4, rmin:1.0, vr:6.0},
    sus304:{n:'SUS304',                 sb:600, rho:7.93, sbk:2.8, rmin:1.0, vr:5.3},
    sus430:{n:'SUS430',                 sb:480, rho:7.75, sbk:2.0, rmin:1.0, vr:5.5},
    a5052 :{n:'A5052-H34(アルミ)',      sb:230, rho:2.68, sbk:2.2, rmin:1.5, vr:5.6},
    a1050 :{n:'A1050-H24(純アルミ)',    sb:110, rho:2.71, sbk:1.0, rmin:1.0, vr:5.8},
    a6061 :{n:'A6061-T6(アルミ)',       sb:310, rho:2.70, sbk:4.0, rmin:3.0, vr:5.5},
    c1100 :{n:'C1100(銅)',              sb:250, rho:8.90, sbk:0.8, rmin:0.5, vr:6.3},
    c2801 :{n:'C2801(真鍮)',            sb:380, rho:8.50, sbk:1.5, rmin:0.5, vr:6.3},
  };
  const PRESETS={
    L  :{n:'L字曲げ(1曲げ)',     sd:0, segs:[50,30],          bends:[{a:90,d:1}]},
    U  :{n:'コの字曲げ(2曲げ)',   sd:0, segs:[30,60,30],       bends:[{a:90,d:1},{a:90,d:1}]},
    Z  :{n:'Z曲げ・段曲げ(2曲げ)',sd:0, segs:[40,10,40],       bends:[{a:90,d:1},{a:90,d:-1}]},
    HAT:{n:'ハット曲げ(4曲げ)',   sd:0, segs:[20,25,50,25,20], bends:[{a:90,d:1},{a:90,d:-1},{a:90,d:-1},{a:90,d:1}]},
    BOX:{n:'背の高いコの字(干渉の例)',sd:0, segs:[40,50,40],    bends:[{a:90,d:1},{a:90,d:1}]},
    OBT:{n:'鈍角曲げ(135°)',     sd:0, segs:[50,40],          bends:[{a:45,d:1}]},
  };
  const PUNCH={
    std  :{n:'標準(ストレート)', ang:88, goose:false},
    goose:{n:'グースネック(逃げ付き)', ang:88, goose:true},
    acute:{n:'鋭角(30°)',      ang:30, goose:false},
  };

  const rad=d=>d*Math.PI/180;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const f=(v,d=2)=>{ if(!isFinite(v)) return '—'; const m=Math.pow(10,d); return (Math.round(v*m)/m).toFixed(d); };
  const stdV=T=> T<=1.0?6: T<=1.2?8: T<=1.6?10: T<=2.0?12: T<=2.3?16: T<=3.2?20: T<=4.5?32: 40;
  function autoK(rt){
    const t=[[0.25,0.32],[0.5,0.35],[1,0.42],[1.5,0.44],[2,0.45],[3,0.47],[4,0.50]];
    if(rt<=t[0][0]) return t[0][1];
    for(let i=1;i<t.length;i++){ if(rt<=t[i][0]){ const a=t[i-1],b=t[i]; return a[1]+(b[1]-a[1])*(rt-a[0])/(b[0]-a[0]); } }
    return 0.50;
  }
  const springback=(m,rt,vt,ang)=>m.sbk*Math.pow(Math.max(rt,0.2),0.6)*Math.pow(Math.max(vt,2)/8,0.25)*(ang/90);

  /* ---------- 加工条件の計算 ---------- */
  function compute(S){
    const m=MAT[S.mat], T=S.T;
    const V=S.Vauto?stdV(T):S.V;
    const R=S.Rauto?V/m.vr:S.R;
    const K=S.Kauto?autoK(R/T):S.K;
    const bends=S.bends.map(b=>{
      const th=rad(b.a), ba=th*(R+K*T), ossb=(R+T)*Math.tan(th/2);
      return {a:b.a,d:b.d,ba,ossb,bd:2*ossb-ba,sb:springback(m,R/T,V/T,b.a),inner:180-b.a};
    });
    const flat=S.segs.reduce((a,b)=>a+b,0)-bends.reduce((a,b)=>a+b.bd,0);
    const ton=1.33*m.sb*S.W*T*T/(V*1000);
    return {m,T,V,R,K,bends,flat,ton,tf:ton/9.80665,mass:flat*S.W*T*m.rho/1e6,minFlange:0.7*V};
  }

  /* 外寸(型線間の寸法)から中心線の頂点間距離を求める */
  function centerDists(S,res){
    const T=res.T, dirs=[rad(S.sd)];
    res.bends.forEach(b=>dirs.push(dirs[dirs.length-1]+rad(b.a)*b.d));
    const ein=[],eout=[];
    res.bends.forEach((b,j)=>{
      const din=dirs[j],dout=dirs[j+1],phi=rad(b.a);
      let bx=Math.cos(din)-Math.cos(dout), by=Math.sin(din)-Math.sin(dout);
      const bl=Math.hypot(bx,by)||1; bx/=bl; by/=bl;
      const s=(T/2)/Math.cos(phi/2);
      ein.push(s*(bx*Math.cos(din)+by*Math.sin(din)));
      eout.push(-s*(bx*Math.cos(dout)+by*Math.sin(dout)));
    });
    return S.segs.map((L,i)=>Math.max(0.05, L-(i<res.bends.length?ein[i]:0)-(i>0?eout[i-1]:0)));
  }

  /* ---------- 形状生成(angles[] は各曲げの現在角度) ---------- */
  function geomA(S,res,angles){
    const T=res.T, Rm=res.R+T/2, cd=res.cd;
    const turns=angles.map((a,i)=>rad(a)*res.bends[i].d);
    let d=rad(S.sd), p={x:0,y:0};
    const C=[p], dirs=[d];
    for(let i=0;i<cd.length;i++){
      p={x:p.x+Math.cos(d)*cd[i], y:p.y+Math.sin(d)*cd[i]};
      C.push(p);
      if(i<turns.length){ d+=turns[i]; dirs.push(d); }
    }
    const n=turns.length, mid=[], tang=[];
    mid.push({x:C[0].x,y:C[0].y,dir:dirs[0]});
    for(let j=1;j<=n;j++){
      const phi=turns[j-1], din=dirs[j-1], dout=dirs[j];
      const tl=Math.abs(phi)<1e-6?0:Rm*Math.tan(Math.abs(phi)/2);
      tang.push(tl);
      const Pin={x:C[j].x-Math.cos(din)*tl,y:C[j].y-Math.sin(din)*tl};
      const Po ={x:C[j].x+Math.cos(dout)*tl,y:C[j].y+Math.sin(dout)*tl};
      mid.push({x:Pin.x,y:Pin.y,dir:din});
      if(tl>0){
        const s=Math.sign(phi);
        const Ct={x:Pin.x+Math.cos(din+s*Math.PI/2)*Rm, y:Pin.y+Math.sin(din+s*Math.PI/2)*Rm};
        const a0=Math.atan2(Pin.y-Ct.y,Pin.x-Ct.x), st=Math.max(3,Math.ceil(Math.abs(phi)/0.12));
        for(let k=1;k<=st;k++){ const u=k/st,aa=a0+phi*u;
          mid.push({x:Ct.x+Math.cos(aa)*Rm,y:Ct.y+Math.sin(aa)*Rm,dir:din+phi*u}); }
      }
      mid.push({x:Po.x,y:Po.y,dir:dout});
    }
    mid.push({x:C[C.length-1].x,y:C[C.length-1].y,dir:dirs[dirs.length-1]});
    const h=T/2;
    const left =mid.map(q=>({x:q.x-Math.sin(q.dir)*h,y:q.y+Math.cos(q.dir)*h}));
    const right=mid.map(q=>({x:q.x+Math.sin(q.dir)*h,y:q.y-Math.cos(q.dir)*h}));
    return {C,dirs,mid,left,right,outline:left.concat(right.slice().reverse()),tang,turns};
  }
  const anglesFor=(res,mask,i,phi)=>res.bends.map((b,j)=> j===i?phi : ((mask>>j)&1)?b.a:0);

  /* ---------- 幾何ユーティリティ ---------- */
  function bbox(l){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;l.forEach(p=>{x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);});return{x0,y0,x1,y1,w:x1-x0,h:y1-y0};}
  function segInt(a,b,c,d){const s=(p,q,r)=>Math.sign((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x));
    return s(a,b,c)!==s(a,b,d)&&s(c,d,a)!==s(c,d,b);}
  function ptIn(po,p){let c=false;for(let i=0,j=po.length-1;i<po.length;j=i++){const a=po[i],b=po[j];
    if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))c=!c;}return c;}
  function dSeg(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
    let t=l2?((p.x-a.x)*dx+(p.y-a.y)*dy)/l2:0; t=clamp(t,0,1);
    return Math.hypot(p.x-(a.x+dx*t),p.y-(a.y+dy*t));}
  function dPoly(po,p){let m=1e9;for(let i=0,j=po.length-1;i<po.length;j=i++)m=Math.min(m,dSeg(p,po[i],po[j]));return m;}
  const insideBy=(po,p,tol)=>ptIn(po,p)&&dPoly(po,p)>tol;
  function densify(pts,step){const o=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];
    o.push(a);const L=Math.hypot(b.x-a.x,b.y-a.y),k=Math.floor(L/step);
    for(let s=1;s<k;s++)o.push({x:a.x+(b.x-a.x)*s/k,y:a.y+(b.y-a.y)*s/k});}return o;}

  /* ---------- 金型形状(機械座標: ダイ上面 y=0、V溝中心 x=0) ---------- */
  function diePoly(res,tool){
    const hv=res.V/2, ha=rad(tool.dieAng/2), dep=hv/Math.tan(ha);
    const rs=Math.min(tool.rs,hv*0.4), Dw=Math.max(tool.dieW,res.V*2.2)/1, Dh=tool.dieH;
    const ux=Math.cos(ha+Math.PI/2), uy=Math.sin(ha+Math.PI/2);
    const sh=(sg)=>{ // 肩の面取り(材料を削る側なので接触位置は鋭角のまま)
      const p=[];
      p.push({x:sg*(hv+rs),y:0});
      p.push({x:sg*(hv-rs*Math.sin(ha)),y:-rs*Math.cos(ha)});
      return p;
    };
    const rt=sh(1), lt=sh(-1);
    return [{x:-Dw/2,y:0},lt[0],lt[1],{x:0,y:-dep},rt[1],rt[0],{x:Dw/2,y:0},{x:Dw/2,y:-Dh},{x:-Dw/2,y:-Dh}];
  }
  function punchPoly(res,tool,phi){
    const ha=rad(tool.punchAng/2), Wp=tool.punchW, Hp=tool.punchH;
    const apexY=-(res.V/2)*Math.tan(rad(phi/2))+res.T/Math.cos(rad(phi/2));
    const side=sg=>{
      const o=[];
      if(tool.goose){
        const t=Math.max(0.6,tool.gd), ht=t/Math.tan(ha);
        o.push({x:sg*t,y:ht});
        o.push({x:sg*t,y:ht+tool.gh});
        o.push({x:sg*Wp/2,y:ht+tool.gh+(Wp/2-t)});
        o.push({x:sg*Wp/2,y:Hp});
      }else{
        const h1=(Wp/2)/Math.tan(ha);
        o.push({x:sg*Wp/2,y:h1});
        o.push({x:sg*Wp/2,y:Math.max(h1+1,Hp)});
      }
      return o;
    };
    const poly=[{x:0,y:0}].concat(side(1)).concat(side(-1).reverse());
    return poly.map(p=>({x:p.x,y:p.y+apexY}));
  }

  /* ---------- 機械座標へ配置 ---------- */
  function placeInMachine(S,res,mask,i,phi){
    const g=geomA(S,res,anglesFor(res,mask,i,phi));
    const din=g.dirs[i], dout=g.dirs[i+1];
    let bx=Math.cos(din)-Math.cos(dout), by=Math.sin(din)-Math.sin(dout);
    const bl=Math.hypot(bx,by);
    if(bl<1e-9){ bx=Math.sin(din)*(res.bends[i].d>0?1:-1); by=-Math.cos(din)*(res.bends[i].d>0?1:-1); }
    else { bx/=bl; by/=bl; }
    const s=(res.T/2)/Math.cos(rad(phi/2));
    const mold={x:g.C[i+1].x+bx*s, y:g.C[i+1].y+by*s};       // 外側型線の頂点
    const rot=-Math.PI/2-Math.atan2(by,bx);
    const ca=Math.cos(rot), sa=Math.sin(rot);
    const dy=-(res.V/2)*Math.tan(rad(phi/2));
    const tr=p=>{const x=p.x-mold.x,y=p.y-mold.y;return{x:x*ca-y*sa,y:x*sa+y*ca+dy};};
    return {outline:g.outline.map(tr), mid:g.mid.map(tr), C:g.C.map(tr), g};
  }

  /* ---------- 干渉判定 ---------- */
  const TOL=0.12;
  function checkAt(S,res,tool,mask,i,phi){
    const pl=placeInMachine(S,res,mask,i,phi);
    const die=diePoly(res,tool), pun=punchPoly(res,tool,phi);
    const apex=pun[0], hv=res.V/2;
    const exP=(res.R+res.T)*1.3+0.8, exD=Math.min(tool.rs,hv*0.4)+res.T*0.6+1.2;
    const pts=densify(pl.outline,1.5);
    for(const p of pts){
      if(Math.hypot(p.x-apex.x,p.y-apex.y)>exP && insideBy(pun,p,TOL)) return {hit:'punch',p,phi};
      if(Math.min(Math.hypot(p.x-hv,p.y),Math.hypot(p.x+hv,p.y))>exD && insideBy(die,p,TOL)) return {hit:'die',p,phi};
    }
    for(const q of pun) if(Math.hypot(q.x-apex.x,q.y-apex.y)>exP && insideBy(pl.outline,q,TOL)) return {hit:'punch',p:q,phi};
    return null;
  }
  function scanBend(S,res,tool,mask,i){
    const th=res.bends[i].a, N=9;
    for(let k=1;k<=N;k++){ const r=checkAt(S,res,tool,mask,i,th*k/N); if(r) return r; }
    return null;
  }
  /* 曲げ順の探索(状態=成形済みの集合。ビットマスクDPで到達可能な順序を求める) */
  function searchOrder(S,res,tool){
    const n=res.bends.length, full=(1<<n)-1;
    const memo=new Map(), from=new Array(full+1).fill(-1), ok=new Array(full+1).fill(false);
    ok[0]=true;
    const feasible=(mask,i)=>{ const key=mask*16+i; if(memo.has(key))return memo.get(key);
      const v=!scanBend(S,res,tool,mask,i); memo.set(key,v); return v; };
    for(let mask=0;mask<=full;mask++){
      if(!ok[mask]) continue;
      for(let i=0;i<n;i++){ if((mask>>i)&1) continue;
        if(feasible(mask,i)){ const nm=mask|(1<<i); if(!ok[nm]){ ok[nm]=true; from[nm]=i; } } }
    }
    if(!ok[full]) return null;
    const order=[]; let m=full;
    while(m){ const i=from[m]; order.unshift(i); m&=~(1<<i); }
    return order;
  }

  /* ---------- 描画: 断面(部品座標) ---------- */
  function drawProfile(svg,S,res,prog,opt){
    const W=680,H=380,PAD=36;
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    while(svg.firstChild)svg.removeChild(svg.firstChild);
    const n=res.bends.length;
    const gF=geomA(S,res,res.bends.map(()=>0)), gA=geomA(S,res,res.bends.map(b=>b.a));
    const bb=bbox(gF.outline.concat(gA.outline));
    const k=Math.min((W-PAD*2)/Math.max(bb.w,1),(H-PAD*2)/Math.max(bb.h,1));
    const ox=(W-bb.w*k)/2-bb.x0*k, oy=(H+bb.h*k)/2+bb.y0*k;
    const X=p=>ox+p.x*k, Y=p=>oy-p.y*k;
    const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const q in a)e.setAttribute(q,a[q]);svg.appendChild(e);return e;};
    const txt=(x,y,s,o={})=>{const e=el('text',{x,y,'font-size':o.size||12,fill:o.fill||'var(--text)','text-anchor':o.anchor||'start','font-weight':o.bold?700:400});e.textContent=s;return e;};
    const poly=(p,a)=>el('path',Object.assign({d:p.map((q,i)=>(i?'L':'M')+X(q)+' '+Y(q)).join(' ')+'Z'},a));
    const cur=geomA(S,res,res.bends.map((b,i)=>b.a*clamp(prog-i,0,1)));
    if(opt.sb&&prog>=n-0.02) poly(geomA(S,res,res.bends.map(b=>b.a+b.sb)).outline,
      {fill:'none',stroke:'var(--ng)','stroke-width':1.4,'stroke-dasharray':'6 4'});
    poly(cur.outline,{fill:'var(--sheet)',stroke:'var(--sheet-dark)','stroke-width':1});
    if(opt.mid) el('path',{d:cur.mid.map((q,i)=>(i?'L':'M')+X(q)+' '+Y(q)).join(' '),fill:'none',stroke:'var(--ng)','stroke-width':1,'stroke-dasharray':'5 3',opacity:.85});
    if(opt.dim&&prog>=n-0.02){
      const P=gA.C, cen=P.reduce((a,q)=>({x:a.x+q.x/P.length,y:a.y+q.y/P.length}),{x:0,y:0});
      for(let i=0;i<S.segs.length;i++){
        const a=P[i],b=P[i+1],mp={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        let nx=-(b.y-a.y),ny=(b.x-a.x); const ln=Math.hypot(nx,ny)||1; nx/=ln;ny/=ln;
        if((mp.x+nx-cen.x)*nx+(mp.y+ny-cen.y)*ny<0){nx=-nx;ny=-ny;}
        const off=res.T/2+14/k, q={x:mp.x+nx*off,y:mp.y+ny*off};
        txt(clamp(X(q),22,W-22),Y(q)+4,`${S.segs[i]}`,{size:11.5,anchor:'middle',bold:1,fill:'var(--primary)'});
      }
    }
    cur.C.slice(1,-1).forEach((q,i)=>{
      el('circle',{cx:X(q),cy:Y(q),r:9,fill:'var(--primary)',opacity:prog>i?1:.3});
      const t=txt(X(q),Y(q)+4,String(i+1),{size:11,anchor:'middle',bold:1,fill:'#fff'});t.style.opacity=prog>i?1:.5;
    });
    txt(12,20,`成形 ${Math.round(prog/n*100)}%  /  曲げ ${Math.min(Math.ceil(prog),n)} / ${n}`,{size:12,bold:1,fill:'var(--primary)'});
    txt(12,H-12,`板厚 ${res.T}  内R ${f(res.R,2)}  V幅 ${res.V}  K値 ${f(res.K,2)}`,{size:11,fill:'var(--muted)'});
  }

  /* ---------- 描画: 機械座標(金型と干渉) ---------- */
  function drawMachine(svg,S,res,tool,mask,i,phi){
    const W=680,H=420,PAD=26;
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    while(svg.firstChild)svg.removeChild(svg.firstChild);
    const pl=placeInMachine(S,res,mask,i,phi);
    const die=diePoly(res,tool), pun=punchPoly(res,tool,phi);
    const bb=bbox(pl.outline.concat(die).concat([{x:0,y:pun[0].y+res.V*2.4}]));
    const k=Math.min((W-PAD*2)/Math.max(bb.w,1),(H-PAD*2-24)/Math.max(bb.h,1));
    const ox=(W-bb.w*k)/2-bb.x0*k, oy=(H-14+bb.h*k)/2+bb.y0*k;
    const X=p=>ox+p.x*k, Y=p=>oy-p.y*k;
    const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const q in a)e.setAttribute(q,a[q]);svg.appendChild(e);return e;};
    const txt=(x,y,s,o={})=>{const e=el('text',{x,y,'font-size':o.size||11.5,fill:o.fill||'var(--text)','text-anchor':o.anchor||'start','font-weight':o.bold?700:400});e.textContent=s;return e;};
    const poly=(p,a)=>el('path',Object.assign({d:p.map((q,j)=>(j?'L':'M')+X(q)+' '+Y(q)).join(' ')+'Z'},a));
    poly(die,{fill:'var(--tool)',opacity:.85});
    poly(pun,{fill:'var(--tool-2)',opacity:.85});
    const hit=checkAt(S,res,tool,mask,i,phi);
    poly(pl.outline,{fill:hit?'var(--ng-soft)':'var(--sheet)',stroke:hit?'var(--ng)':'var(--sheet-dark)','stroke-width':hit?2:1});
    el('line',{x1:X({x:bb.x0}),y1:Y({y:0}),x2:X({x:bb.x1}),y2:Y({y:0}),stroke:'var(--muted)','stroke-dasharray':'4 4',opacity:.5});
    if(hit){
      el('circle',{cx:X(hit.p),cy:Y(hit.p),r:11,fill:'none',stroke:'var(--ng)','stroke-width':2.5});
      el('circle',{cx:X(hit.p),cy:Y(hit.p),r:4,fill:'var(--ng)'});
      txt(W/2,H-8,`✕ ${hit.hit==='punch'?'パンチ':'ダイ'}と干渉(曲げ角度 ${f(phi,0)}° 時点)`,{size:13,anchor:'middle',bold:1,fill:'var(--ng)'});
    } else {
      txt(W/2,H-8,`○ 干渉なし(曲げ角度 ${f(phi,0)}°)`,{size:13,anchor:'middle',bold:1,fill:'var(--ok)'});
    }
    txt(12,18,`曲げ ${i+1} を加工中`,{size:12,bold:1,fill:'var(--primary)'});
    const done=[];for(let j=0;j<res.bends.length;j++) if((mask>>j)&1) done.push(j+1);
    txt(12,34,done.length?`成形済み: 曲げ ${done.join(', ')}`:'成形済み: なし(1本目)',{size:11,fill:'var(--muted)'});
    txt(W-12,18,`${PUNCH[tool.punch].n} / V${res.V}`,{size:11,anchor:'end',fill:'var(--muted)'});
  }

  /* ---------- 描画: 展開図 ---------- */
  function drawFlat(svg,S,res){
    const W=680,H=232,PAD=42;
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    while(svg.firstChild)svg.removeChild(svg.firstChild);
    const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const q in a)e.setAttribute(q,a[q]);svg.appendChild(e);return e;};
    const txt=(x,y,s,o={})=>{const e=el('text',{x,y,'font-size':o.size||11,fill:o.fill||'var(--text)','text-anchor':o.anchor||'start','font-weight':o.bold?700:400});e.textContent=s;return e;};
    const k=(W-PAD*2)/Math.max(res.flat,1), bh=Math.min(88,Math.max(40,S.W*k)), y0=78, X=v=>PAD+v*k;
    el('rect',{x:X(0),y:y0,width:res.flat*k,height:bh,fill:'var(--sheet)',opacity:.55,stroke:'var(--sheet-dark)'});
    let x=0;
    res.bends.forEach((b,i)=>{
      x+=S.segs[i]-(i>0?res.bends[i-1].ossb:0)-b.ossb;
      el('rect',{x:X(x),y:y0,width:b.ba*k,height:bh,fill:'var(--accent)',opacity:.22});
      const cx=X(x+b.ba/2);
      el('line',{x1:cx,y1:y0-9,x2:cx,y2:y0+bh+9,stroke:'var(--ng)','stroke-width':1.6,'stroke-dasharray':'8 3 2 3'});
      txt(clamp(cx,44,W-44),y0-15,`${i+1}: ${b.d>0?'UP':'DOWN'} ${b.a}°`,{size:10.5,anchor:'middle',bold:1,fill:'var(--ng)'});
      txt(clamp(cx,34,W-34),y0+bh+22,`BA ${f(b.ba,2)}`,{size:10,anchor:'middle',fill:'var(--muted)'});
      x+=b.ba;
    });
    const dy=y0+bh+48;
    el('line',{x1:X(0),y1:dy,x2:X(res.flat),y2:dy,stroke:'var(--primary)','stroke-width':1.5});
    el('line',{x1:X(0),y1:dy-6,x2:X(0),y2:dy+6,stroke:'var(--primary)'});
    el('line',{x1:X(res.flat),y1:dy-6,x2:X(res.flat),y2:dy+6,stroke:'var(--primary)'});
    txt((X(0)+X(res.flat))/2,dy-9,`展開長 ${f(res.flat,2)} mm`,{size:12.5,anchor:'middle',bold:1,fill:'var(--primary)'});
    txt(12,20,'展開図(ブランク)',{size:12.5,bold:1});
    txt(12,38,`ブランク寸法 ${f(res.flat,1)} × ${S.W} mm ・ 橙の帯 = 曲げ伸び(BA)の領域、破線 = 曲げ線`,{size:11,fill:'var(--muted)'});
  }

  /* ---------- 形状の成立判定 ---------- */
  function judge(S,res){
    const out=[],T=res.T,m=res.m;
    if(res.R<m.rmin*T-1e-6) out.push({lv:'ng',t:`曲げ内R ${f(res.R,2)}mm が ${m.n} の最小内R目安 ${f(m.rmin*T,2)}mm(${m.rmin}T)を下回ります。曲げ割れの恐れがあります。`});
    else if(res.R<(m.rmin+0.3)*T) out.push({lv:'warn',t:'曲げ内Rが最小値に近い状態です。圧延方向を曲げ線と直交させ、バリ面を内側にしてください。'});
    S.segs.forEach((L,i)=>{ if((i===0||i===S.segs.length-1)&&L<res.minFlange-1e-6)
      out.push({lv:'ng',t:`${i+1}番目の辺 ${L}mm が最小フランジ ${f(res.minFlange,1)}mm(0.7×V${res.V})を下回ります。ダイの肩に乗らず曲がりません。`}); });
    const g=geomA(S,res,res.bends.map(b=>b.a));
    res.cd.forEach((L,i)=>{ const a=(i>0?g.tang[i-1]:0),b=(i<g.tang.length?g.tang[i]:0);
      if(L<a+b-1e-6) out.push({lv:'ng',t:`${i+1}番目の辺に対して曲げR部が ${f(a+b,2)}mm 必要です。形状が成立しません(辺を長くするかRを小さく)。`}); });
    const P=g.C;
    outer: for(let i=0;i<P.length-1;i++) for(let j=i+2;j<P.length-1;j++){
      if(i===0&&j===P.length-2) continue;
      if(segInt(P[i],P[i+1],P[j],P[j+1])){ out.push({lv:'ng',t:'成形後の形状が自分自身と交差します。曲げ角度・辺の長さを見直してください。'}); break outer; } }
    if(res.tf>S.cap) out.push({lv:'ng',t:`必要荷重 ${f(res.tf,1)}tf が機械能力 ${S.cap}tf を超えます。V幅を大きくするか曲げ長さを分割してください。`});
    else if(res.tf>S.cap*0.8) out.push({lv:'warn',t:`必要荷重 ${f(res.tf,1)}tf は機械能力の80%を超えています。金型の許容荷重(tf/m)も確認してください。`});
    res.bends.forEach((b,i)=>{ if(b.a>150) out.push({lv:'warn',t:`曲げ${i+1}は ${b.a}°(内角${f(b.inner,0)}°)の鋭角曲げです。鋭角金型またはヘミング工程が必要です。`}); });
    return out;
  }

  /* ---------- 画面 ---------- */
  let anim=null,S=null,tool=null,curBend=0,phi=0,order=null;
  function stop(){ if(anim){cancelAnimationFrame(anim);anim=null;} }

  function render(main){
    stop();
    S={mat:'spcc',T:1.6,W:500,cap:80,Vauto:true,V:10,Rauto:true,R:1.6,Kauto:true,K:0.42,
       preset:'BOX',sd:PRESETS.BOX.sd,segs:PRESETS.BOX.segs.slice(),bends:PRESETS.BOX.bends.map(b=>({a:b.a,d:b.d})),
       prog:2,sb:true,mid:true,dim:true};
    tool={punch:'std',punchAng:88,punchW:26,punchH:120,goose:false,gd:4,gh:60,dieAng:88,rs:0.8,dieH:60,dieW:34};
    curBend=1; phi=S.bends[1]?S.bends[1].a:S.bends[0].a; order=null;
    main.innerHTML=`
<div class="crumb"><a href="#/home">ホーム</a> › 曲げシミュレーター</div>
<h1>🛠️ 曲げシミュレーター</h1>
<p>断面形状と加工条件を入力すると、<b>成形過程・展開図・加工条件・成形可否</b>を試算します。さらに、部品を機械座標(ダイ固定・パンチ下降)に配置して<b>パンチ・ダイとの干渉</b>を幾何的に検出します。</p>
<div class="sim-wrap">
  <div class="sim-ctrl card" id="simCtrl"></div>
  <div class="sim-view">
    <div class="anim" style="margin-top:0"><div class="anim-title">断面(成形シミュレーション)</div>
      <svg id="simProfile" role="img" aria-label="曲げ成形の断面"></svg>
      <div class="anim-ctrl">
        <button class="btn small" id="simPlay">▶ 再生</button>
        <label>成形進捗 <input type="range" id="simProg" min="0" max="100" value="100"></label>
        <label><input type="checkbox" id="simSb" checked> 戻り(赤破線)</label>
        <label><input type="checkbox" id="simMid" checked> 中立軸</label>
        <label><input type="checkbox" id="simDim" checked> 寸法</label>
      </div>
    </div>
    <div class="anim"><div class="anim-title">金型との干渉(機械座標: ダイ固定・パンチ下降)</div>
      <svg id="simMach" role="img" aria-label="金型と部品の干渉シミュレーション"></svg>
      <div class="anim-ctrl">
        <button class="btn small" id="machPlay">▶ 下降</button>
        <label>加工する曲げ <select id="machBend"></select></label>
        <label>曲げ角度 <input type="range" id="machPhi" min="0" max="100" value="100"></label>
      </div>
      <div class="anim-note">選んだ曲げより前の曲げは成形済み、後の曲げは未成形として配置します。曲げ順は左の「曲げ順」で変わります。</div>
    </div>
    <div class="anim"><div class="anim-title">展開図</div><svg id="simFlat" role="img" aria-label="展開図"></svg></div>
  </div>
</div>
<div id="simJudge"></div>
<h2>計算結果</h2>
<div id="simRes"></div>
<div class="callout tip"><b>干渉が出たときの対処</b>①曲げ順を変える(左の「曲げ順」または自動探索)、②グースネックパンチなど逃げのある金型にする、③V幅を小さくしてダイ幅を狭める、④フランジを短くする、⑤形状を分割して溶接にする、の順で検討するのが定石です。</div>`;
    buildCtrl(); update();
  }

  function orderList(){ const n=S.bends.length; return order||(S.rev?Array.from({length:n},(_,i)=>n-1-i):Array.from({length:n},(_,i)=>i)); }
  function maskBefore(i){ const o=orderList(); let m=0; for(const b of o){ if(b===i) break; m|=1<<b; } return m; }

  function buildCtrl(){
    const c=document.getElementById('simCtrl'), m=MAT[S.mat];
    c.innerHTML=`
<h3 style="margin-top:0">加工条件</h3>
<div class="calc-form">
<label>材質<select id="sMat">${Object.keys(MAT).map(k=>`<option value="${k}" ${k===S.mat?'selected':''}>${MAT[k].n}</option>`).join('')}</select></label>
<label>板厚 T (mm)<input id="sT" type="number" step="0.1" min="0.3" value="${S.T}"></label>
<label>曲げ長さ W (mm)<input id="sW" type="number" step="10" min="10" value="${S.W}"></label>
<label>機械能力 (tf)<input id="sCap" type="number" step="10" min="5" value="${S.cap}"></label>
<label>V幅 (mm)<span class="sim-inline"><input id="sV" type="number" step="1" min="3" value="${S.Vauto?stdV(S.T):S.V}" ${S.Vauto?'disabled':''}><label class="sim-auto"><input type="checkbox" id="sVa" ${S.Vauto?'checked':''}>自動</label></span></label>
<label>曲げ内R (mm)<span class="sim-inline"><input id="sR" type="number" step="0.1" min="0.1" value="${f(S.Rauto?(S.Vauto?stdV(S.T):S.V)/m.vr:S.R,2)}" ${S.Rauto?'disabled':''}><label class="sim-auto"><input type="checkbox" id="sRa" ${S.Rauto?'checked':''}>自動</label></span></label>
<label>K値<span class="sim-inline"><input id="sK" type="number" step="0.01" min="0.2" max="0.5" value="${f(S.K,2)}" ${S.Kauto?'disabled':''}><label class="sim-auto"><input type="checkbox" id="sKa" ${S.Kauto?'checked':''}>自動</label></span></label>
</div>
<h3>金型</h3>
<div class="calc-form">
<label>パンチ形状<select id="tPun">${Object.keys(PUNCH).map(k=>`<option value="${k}" ${k===tool.punch?'selected':''}>${PUNCH[k].n}</option>`).join('')}</select></label>
<label>曲げ順<select id="tOrd"><option value="0" ${!S.rev?'selected':''}>1 → ${S.bends.length}(順)</option><option value="1" ${S.rev?'selected':''}>${S.bends.length} → 1(逆)</option></select></label>
</div>
<details class="kh" style="margin:8px 0"><summary style="padding:8px 10px;font-size:.9rem">金型の詳細寸法</summary><div class="kh-body"><div class="calc-form">
<label>パンチ先端角 (°)<input id="tPa" type="number" step="1" min="20" max="95" value="${tool.punchAng}"></label>
<label>パンチ肩幅 (mm)<input id="tPw" type="number" step="1" min="6" value="${tool.punchW}"></label>
<label>パンチ高さ (mm)<input id="tPh" type="number" step="5" min="20" value="${tool.punchH}"></label>
<label>逃げ深さ (mm)<input id="tGd" type="number" step="0.5" min="0.6" value="${tool.gd}" ${tool.goose?'':'disabled'}></label>
<label>逃げ高さ (mm)<input id="tGh" type="number" step="5" min="5" value="${tool.gh}" ${tool.goose?'':'disabled'}></label>
<label>ダイ V角度 (°)<input id="tDa" type="number" step="1" min="28" max="90" value="${tool.dieAng}"></label>
<label>ダイ肩R (mm)<input id="tRs" type="number" step="0.1" min="0" value="${tool.rs}"></label>
<label>ダイ幅 (mm)<input id="tDw" type="number" step="2" min="10" value="${tool.dieW}"></label>
<label>ダイ高さ (mm)<input id="tDh" type="number" step="5" min="10" value="${tool.dieH}"></label>
</div></div></details>
<h3>断面形状</h3>
<div class="calc-form"><label>形状<select id="sPre">${Object.keys(PRESETS).map(k=>`<option value="${k}" ${k===S.preset?'selected':''}>${PRESETS[k].n}</option>`).join('')}</select></label>
<label>曲げ数<span class="sim-inline"><button class="btn small secondary" id="sMinus">−</button><span id="sNb" style="min-width:2em;text-align:center;font-weight:700">${S.bends.length}</span><button class="btn small secondary" id="sPlus">＋</button></span></label></div>
<div class="table-wrap"><table class="sim-tbl"><tr><th>辺</th><th>外寸 (mm)</th><th>曲げ</th><th>角度 (°)</th><th>方向</th></tr>
${S.segs.map((L,i)=>`<tr><td>${i+1}</td><td><input class="sim-seg" data-i="${i}" type="number" step="1" min="1" value="${L}"></td>
${i<S.bends.length?`<td>${i+1}</td><td><input class="sim-ang" data-i="${i}" type="number" step="5" min="5" max="170" value="${S.bends[i].a}"></td>
<td><select class="sim-dir" data-i="${i}"><option value="1" ${S.bends[i].d>0?'selected':''}>UP</option><option value="-1" ${S.bends[i].d<0?'selected':''}>DOWN</option></select></td>`:'<td></td><td></td><td></td>'}</tr>`).join('')}</table></div>
<p style="font-size:.8rem;color:var(--muted);margin:.4em 0 0">外寸は型線(外面を延長した交点)までの寸法です。</p>
<button class="btn" id="simSearch" style="margin-top:10px;width:100%">干渉しない曲げ順を探す</button>
<div id="simOrder" style="font-size:.85rem;margin-top:6px"></div>`;

    const on=(id,ev,fn)=>{const e=document.getElementById(id);if(e)e.addEventListener(ev,fn);};
    const reb=()=>{order=null;buildCtrl();update();};
    on('sMat','change',e=>{S.mat=e.target.value;reb();});
    on('sT','input',e=>{S.T=Math.max(0.3,+e.target.value||1);reb();});
    on('sW','input',e=>{S.W=Math.max(10,+e.target.value||10);update();});
    on('sCap','input',e=>{S.cap=Math.max(1,+e.target.value||1);update();});
    on('sVa','change',e=>{S.Vauto=e.target.checked;if(!S.Vauto)S.V=stdV(S.T);reb();});
    on('sRa','change',e=>{S.Rauto=e.target.checked;if(!S.Rauto)S.R=(S.Vauto?stdV(S.T):S.V)/MAT[S.mat].vr;reb();});
    on('sKa','change',e=>{S.Kauto=e.target.checked;reb();});
    on('sV','input',e=>{S.V=Math.max(3,+e.target.value||3);order=null;update();});
    on('sR','input',e=>{S.R=Math.max(0.1,+e.target.value||0.1);order=null;update();});
    on('sK','input',e=>{S.K=clamp(+e.target.value||0.42,0.2,0.5);update();});
    on('tPun','change',e=>{tool.punch=e.target.value;tool.punchAng=PUNCH[e.target.value].ang;tool.goose=PUNCH[e.target.value].goose;reb();});
    on('tOrd','change',e=>{S.rev=e.target.value==='1';order=null;update();});
    [['tPa','punchAng'],['tPw','punchW'],['tPh','punchH'],['tGd','gd'],['tGh','gh'],['tDa','dieAng'],['tRs','rs'],['tDw','dieW'],['tDh','dieH']]
      .forEach(([id,key])=>on(id,'input',e=>{tool[key]=Math.max(0,+e.target.value||0);order=null;update();}));
    on('sPre','change',e=>{const p=PRESETS[e.target.value];S.preset=e.target.value;S.sd=p.sd;S.segs=p.segs.slice();
      S.bends=p.bends.map(b=>({a:b.a,d:b.d}));S.prog=S.bends.length;curBend=Math.min(curBend,S.bends.length-1);reb();});
    on('sPlus','click',()=>{if(S.bends.length>=6)return;S.bends.push({a:90,d:1});S.segs.push(30);S.prog=S.bends.length;reb();});
    on('sMinus','click',()=>{if(S.bends.length<=1)return;S.bends.pop();S.segs.pop();S.prog=S.bends.length;curBend=Math.min(curBend,S.bends.length-1);reb();});
    c.querySelectorAll('.sim-seg').forEach(x=>x.addEventListener('input',e=>{S.segs[+e.target.dataset.i]=Math.max(1,+e.target.value||1);order=null;update();}));
    c.querySelectorAll('.sim-ang').forEach(x=>x.addEventListener('input',e=>{S.bends[+e.target.dataset.i].a=clamp(+e.target.value||90,5,170);order=null;update();}));
    c.querySelectorAll('.sim-dir').forEach(x=>x.addEventListener('change',e=>{S.bends[+e.target.dataset.i].d=+e.target.value;order=null;update();}));
    on('simSearch','click',()=>{
      const res=compute(S); res.cd=centerDists(S,res);
      const btn=document.getElementById('simSearch'); btn.disabled=true; btn.textContent='探索中…';
      setTimeout(()=>{
        const o=searchOrder(S,res,tool);
        btn.disabled=false; btn.textContent='干渉しない曲げ順を探す';
        const d=document.getElementById('simOrder');
        if(o){ order=o; d.innerHTML=`<span style="color:var(--ok);font-weight:700">○ 干渉しない曲げ順: ${o.map(i=>i+1).join(' → ')}</span>`; }
        else { order=null; d.innerHTML='<span style="color:var(--ng);font-weight:700">✕ どの曲げ順でも干渉します。金型か形状の見直しが必要です。</span>'; }
        update();
      },30);
    });

    const pr=document.getElementById('simProg');
    if(pr&&!pr._w){ pr._w=1;
      pr.addEventListener('input',e=>{stopPlay();S.prog=S.bends.length*(+e.target.value)/100;drawA();});
      document.getElementById('simPlay').addEventListener('click',togglePlay);
      ['simSb:sb','simMid:mid','simDim:dim'].forEach(x=>{const[id,key]=x.split(':');
        document.getElementById(id).addEventListener('change',e=>{S[key]=e.target.checked;drawA();});});
      document.getElementById('machBend').addEventListener('change',e=>{curBend=+e.target.value;phi=S.bends[curBend].a;
        document.getElementById('machPhi').value=100;drawM();});
      document.getElementById('machPhi').addEventListener('input',e=>{stopPlay();phi=S.bends[curBend].a*(+e.target.value)/100;drawM();});
      document.getElementById('machPlay').addEventListener('click',togglePlayM);
    }
  }

  function togglePlay(){ anim?stopPlay():startPlay('A'); }
  function togglePlayM(){ anim?stopPlay():startPlay('M'); }
  function stopPlay(){ stop(); const a=document.getElementById('simPlay'),b=document.getElementById('machPlay');
    if(a)a.textContent='▶ 再生'; if(b)b.textContent='▶ 下降'; }
  function startPlay(kind){
    stop();
    const btn=document.getElementById(kind==='A'?'simPlay':'machPlay'); if(btn)btn.textContent='⏸ 停止';
    const n=S.bends.length, t0=performance.now();
    const step=now=>{
      const t=(now-t0)/1000;
      if(kind==='A'){ const cyc=n*1.4+1.6, tt=t%cyc; S.prog=tt<n*1.4?tt/1.4:n;
        const pr=document.getElementById('simProg'); if(pr)pr.value=Math.round(S.prog/n*100); drawA(); }
      else { const cyc=3.4, tt=t%cyc, u=tt<2.2?tt/2.2:1; phi=S.bends[curBend].a*u;
        const pr=document.getElementById('machPhi'); if(pr)pr.value=Math.round(u*100); drawM(); }
      anim=requestAnimationFrame(step);
    };
    anim=requestAnimationFrame(step);
  }

  function res_(){ const r=compute(S); r.cd=centerDists(S,r); return r; }
  function drawA(){ const r=res_(); drawProfile(document.getElementById('simProfile'),S,r,clamp(S.prog,0,r.bends.length),{sb:S.sb,mid:S.mid,dim:S.dim}); }
  function drawM(){ const r=res_(); drawMachine(document.getElementById('simMach'),S,r,tool,maskBefore(curBend),curBend,clamp(phi,0.5,r.bends[curBend].a)); }

  function update(){
    const r=res_(), n=r.bends.length;
    S.prog=clamp(S.prog,0,n); curBend=clamp(curBend,0,n-1); if(phi>r.bends[curBend].a)phi=r.bends[curBend].a;
    if(S.Vauto)S.V=r.V; if(S.Rauto)S.R=r.R; if(S.Kauto)S.K=r.K;
    const sel=document.getElementById('machBend');
    if(sel) sel.innerHTML=orderList().map((i,k)=>`<option value="${i}" ${i===curBend?'selected':''}>${k+1}番目に曲げる: 曲げ${i+1}</option>`).join('');
    drawA(); drawM(); drawFlat(document.getElementById('simFlat'),S,r);

    const js=judge(S,r);
    const inter=orderList().map(i=>({i,hit:scanBend(S,r,tool,maskBefore(i),i)}));
    const bad=inter.filter(x=>x.hit);
    let ih='';
    if(bad.length){
      bad.forEach(x=>{ ih+=`<div class="callout ng"><b>✕ 干渉: 曲げ${x.i+1}</b>曲げ角度が約 ${f(x.hit.phi,0)}° に達した時点で、部品が<b>${x.hit.hit==='punch'?PUNCH[tool.punch].n:'ダイ'}</b>に当たります。曲げ順の変更、逃げ付き金型への変更、V幅やフランジ長さの見直しを検討してください。</div>`; });
    } else {
      ih=`<div class="callout ok"><b>○ 干渉なし</b>曲げ順 ${orderList().map(i=>i+1).join(' → ')} で、${PUNCH[tool.punch].n}・V${r.V}・ダイ幅${tool.dieW}mm との干渉は検出されませんでした。</div>`;
    }
    document.getElementById('simJudge').innerHTML='<h2>金型との干渉</h2>'+ih+'<h2>形状の成立判定</h2>'+
      (js.length?js:[{lv:'ok',t:'入力した形状は、一般的な標準金型で加工できる範囲です。実際の可否は加工先の設備・金型でご確認ください。'}])
      .map(j=>`<div class="callout ${j.lv==='ng'?'ng':j.lv==='warn'?'warn':'ok'}"><b>${j.lv==='ng'?'✕ 要修正':j.lv==='warn'?'△ 注意':'○ 問題なし'}</b>${j.t}</div>`).join('');

    const tot=S.segs.reduce((a,b)=>a+b,0);
    document.getElementById('simRes').innerHTML=`
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
<div class="stat"><div class="l">展開長(ブランク長さ)</div><div class="v">${f(r.flat,2)} <small style="font-size:.6em">mm</small></div></div>
<div class="stat"><div class="l">外寸合計 − 曲げ縮み</div><div class="v" style="font-size:1.05rem">${f(tot,1)} − ${f(tot-r.flat,2)}</div></div>
<div class="stat"><div class="l">必要荷重(1曲げ)</div><div class="v">${f(r.tf,1)} <small style="font-size:.6em">tf</small></div></div>
<div class="stat"><div class="l">ブランク質量</div><div class="v">${f(r.mass,3)} <small style="font-size:.6em">kg</small></div></div>
</div>
<div class="table-wrap"><table>
<tr><th>曲げ</th><th>角度</th><th>製品内角</th><th>方向</th><th>曲げ伸び BA</th><th>外側セットバック</th><th>曲げ縮み BD</th><th>戻り角の目安</th><th>狙う曲げ角度</th><th>金型干渉</th></tr>
${r.bends.map((b,i)=>{const x=inter.find(y=>y.i===i);
  return `<tr><td>${i+1}</td><td>${b.a}°</td><td>${f(b.inner,0)}°</td><td>${b.d>0?'UP':'DOWN'}</td><td>${f(b.ba,3)}</td><td>${f(b.ossb,3)}</td><td><b>${f(b.bd,3)}</b></td><td>${f(b.sb,1)}°</td><td>${f(b.a+b.sb,1)}°</td><td>${x&&x.hit?`<span style="color:var(--ng);font-weight:700">✕ ${x.hit.hit==='punch'?'パンチ':'ダイ'}</span>`:'<span style="color:var(--ok)">○</span>'}</td></tr>`;}).join('')}
</table></div>
<div class="table-wrap"><table>
<tr><th>項目</th><th>値</th><th>根拠・備考</th></tr>
<tr><td>使用V幅</td><td>V${r.V}(${f(r.V/r.T,1)}T)</td><td>板厚の6〜8倍が標準${S.Vauto?'(自動選定)':'(手入力)'}</td></tr>
<tr><td>曲げ内R</td><td>${f(r.R,2)} mm(${f(r.R/r.T,2)}T)</td><td>エアベンドの目安 R ≒ V ÷ ${MAT[S.mat].vr}${S.Rauto?'(自動)':'(手入力)'}</td></tr>
<tr><td>K値</td><td>${f(r.K,3)}</td><td>R/T = ${f(r.R/r.T,2)} から内挿${S.Kauto?'(自動)':'(手入力)'}</td></tr>
<tr><td>最小フランジ</td><td>${f(r.minFlange,1)} mm</td><td>0.7 × V幅</td></tr>
<tr><td>干渉判定の方法</td><td colspan="2">部品をダイ上面 y=0・V溝中心 x=0 の機械座標に配置し、外形を1.5mm間隔で点列化してパンチ/ダイ多角形との内外判定を行います。パンチ先端とダイ肩の接触部は判定から除外し、めり込み量 ${TOL}mm 超を干渉としています。</td></tr>
<tr><td>展開長の式</td><td colspan="2">L = Σ外寸 − ΣBD、BA = (π×θ/180)×(R+K×T)、OSSB = (R+T)×tan(θ/2)、BD = 2×OSSB − BA</td></tr>
<tr><td>荷重の式</td><td colspan="2">P[kN] = 1.33 × σb × W × T² ÷ (V × 1000)、σb = ${MAT[S.mat].sb} N/mm²</td></tr>
</table></div>
<div class="callout warn"><b>この試算の位置づけ</b>金型形状はパラメータで近似した断面です。実際の金型は面取り・逃げ・ホルダ形状が異なるため、最終判断は加工先の金型図面と曲げシミュレーションソフトで確認してください。戻り角も経験的な目安です。</div>`;
  }

  window.SM_SIM={render,stop};
})();
