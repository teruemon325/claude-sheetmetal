/* ===== 曲げシミュレーター =====
   断面プロファイルを指定し、曲げ加工の成形過程・展開図・加工条件・成形可否を試算する。
   数値はすべて一般的な代表値に基づく「目安」であり、実機での初品確認が前提。 */
(function(){
  const NS='http://www.w3.org/2000/svg';

  /* 材料物性(代表値)
     sb: 引張強さ N/mm2, sy: 降伏点 N/mm2, E: 縦弾性係数 N/mm2, rho: 比重,
     sbk: 戻り角の基準値(内R=T・V=8T・90°のときの目安 °),
     rmin: 最小曲げ内R(×T), vr: エアベンド時の内R ≒ V/vr */
  const MAT={
    spcc  :{n:'SPCC(冷延鋼板)',        sb:400, sy:210, E:205000, rho:7.85, sbk:1.2, rmin:0.5, vr:6.0},
    secc  :{n:'SECC(電気亜鉛メッキ鋼板)',sb:400, sy:210, E:205000, rho:7.85, sbk:1.3, rmin:0.5, vr:6.0},
    sphc  :{n:'SPHC / SS400(熱延鋼板)', sb:420, sy:245, E:205000, rho:7.85, sbk:1.4, rmin:1.0, vr:6.0},
    sus304:{n:'SUS304',                 sb:600, sy:250, E:193000, rho:7.93, sbk:2.8, rmin:1.0, vr:5.3},
    sus430:{n:'SUS430',                 sb:480, sy:250, E:200000, rho:7.75, sbk:2.0, rmin:1.0, vr:5.5},
    a5052 :{n:'A5052-H34(アルミ)',      sb:230, sy:180, E:70000,  rho:2.68, sbk:2.2, rmin:1.5, vr:5.6},
    a1050 :{n:'A1050-H24(純アルミ)',    sb:110, sy:85,  E:69000,  rho:2.71, sbk:1.0, rmin:1.0, vr:5.8},
    a6061 :{n:'A6061-T6(アルミ)',       sb:310, sy:275, E:69000,  rho:2.70, sbk:4.0, rmin:3.0, vr:5.5},
    c1100 :{n:'C1100(銅)',              sb:250, sy:200, E:117000, rho:8.90, sbk:0.8, rmin:0.5, vr:6.3},
    c2801 :{n:'C2801(真鍮)',            sb:380, sy:250, E:103000, rho:8.50, sbk:1.5, rmin:0.5, vr:6.3},
  };

  const PRESETS={
    L  :{n:'L字曲げ(1曲げ)',   sd:0,   segs:[50,30],          bends:[{a:90,d:1}]},
    U  :{n:'コの字曲げ(2曲げ)', sd:0,   segs:[30,60,30],       bends:[{a:90,d:1},{a:90,d:1}]},
    Z  :{n:'Z曲げ・段曲げ(2曲げ)',sd:0, segs:[40,10,40],       bends:[{a:90,d:1},{a:90,d:-1}]},
    HAT:{n:'ハット曲げ(4曲げ)', sd:0,   segs:[20,25,50,25,20], bends:[{a:90,d:1},{a:90,d:-1},{a:90,d:-1},{a:90,d:1}]},
    OBT:{n:'鈍角曲げ(135°)',   sd:0,   segs:[50,40],          bends:[{a:45,d:1}]},
  };

  const rad=d=>d*Math.PI/180, degOf=r=>r*180/Math.PI;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const f=(v,d=2)=>{ if(!isFinite(v)) return '—'; const m=Math.pow(10,d); return (Math.round(v*m)/m).toFixed(d); };
  const stdV=T=> T<=1.0?6: T<=1.2?8: T<=1.6?10: T<=2.0?12: T<=2.3?16: T<=3.2?20: T<=4.5?32: 40;

  /* 内R/板厚比からK値を内挿 */
  function autoK(rt){
    const t=[[0.25,0.32],[0.5,0.35],[1,0.42],[1.5,0.44],[2,0.45],[3,0.47],[4,0.50]];
    if(rt<=t[0][0]) return t[0][1];
    for(let i=1;i<t.length;i++){ if(rt<=t[i][0]){ const a=t[i-1],b=t[i]; return a[1]+(b[1]-a[1])*(rt-a[0])/(b[0]-a[0]); } }
    return 0.50;
  }
  /* スプリングバック戻り角の目安(経験式) */
  function springback(m,rt,vt,ang){
    return m.sbk*Math.pow(Math.max(rt,0.2),0.6)*Math.pow(Math.max(vt,2)/8,0.25)*(ang/90);
  }

  /* ---------- 計算 ---------- */
  function compute(S){
    const m=MAT[S.mat], T=S.T;
    const V=S.Vauto?stdV(T):S.V;
    const R=S.Rauto?V/m.vr:S.R;
    const K=S.Kauto?autoK(R/T):S.K;
    const bends=S.bends.map(b=>{
      const th=rad(b.a);
      const ba=th*(R+K*T);
      const ossb=(R+T)*Math.tan(th/2);
      const bd=2*ossb-ba;
      const sb=springback(m,R/T,V/T,b.a);
      return {a:b.a,d:b.d,ba,ossb,bd,sb,inner:180-b.a};
    });
    const flat=S.segs.reduce((a,b)=>a+b,0)-bends.reduce((a,b)=>a+b.bd,0);
    const ton=1.33*m.sb*S.W*T*T/(V*1000);      // kN(1曲げあたり)
    const mass=flat*S.W*T*m.rho/1e6;            // kg
    return {m,T,V,R,K,bends,flat,ton,tf:ton/9.80665,mass,minFlange:0.7*V};
  }

  /* ---------- 形状生成 ---------- */
  /* prog: 0=展開(平ら) … bends.length=全曲げ完了。overAng: 各曲げに上乗せする角度(スプリングバック表示用) */
  function geom(S,res,prog,over){
    const T=res.T, Rm=res.R+T/2;
    const segs=S.segs, bends=res.bends, n=bends.length;
    const turns=bends.map((b,i)=>{
      const t=clamp(prog-i,0,1);
      return rad((b.a+(over?over[i]:0))*t)*b.d;
    });
    // 節点(型線の交点)
    let d=rad(S.sd), p={x:0,y:0};
    const pts=[p], dirs=[d];
    for(let i=0;i<segs.length;i++){
      p={x:p.x+Math.cos(d)*segs[i], y:p.y+Math.sin(d)*segs[i]};
      pts.push(p);
      if(i<turns.length){ d+=turns[i]; dirs.push(d); }
    }
    // 中立面(板厚中央)を折れ点でR付けして折線化
    const mid=[]; // {x,y,dir}
    const tang=[];
    mid.push({x:pts[0].x,y:pts[0].y,dir:dirs[0]});
    for(let j=1;j<=n;j++){
      const phi=turns[j-1], din=dirs[j-1], dout=dirs[j];
      const tl=Math.abs(phi)<1e-6?0:Rm*Math.tan(Math.abs(phi)/2);
      tang.push(tl);
      const Pin ={x:pts[j].x-Math.cos(din)*tl,  y:pts[j].y-Math.sin(din)*tl};
      const Pout={x:pts[j].x+Math.cos(dout)*tl, y:pts[j].y+Math.sin(dout)*tl};
      mid.push({x:Pin.x,y:Pin.y,dir:din});
      if(tl>0){
        const s=Math.sign(phi);
        const C={x:Pin.x+Math.cos(din+s*Math.PI/2)*Rm, y:Pin.y+Math.sin(din+s*Math.PI/2)*Rm};
        const a0=Math.atan2(Pin.y-C.y,Pin.x-C.x);
        const steps=Math.max(3,Math.ceil(Math.abs(phi)/0.12));
        for(let k=1;k<=steps;k++){
          const u=k/steps, aa=a0+phi*u;
          mid.push({x:C.x+Math.cos(aa)*Rm, y:C.y+Math.sin(aa)*Rm, dir:din+phi*u});
        }
      }
      mid.push({x:Pout.x,y:Pout.y,dir:dout});
    }
    mid.push({x:pts[pts.length-1].x,y:pts[pts.length-1].y,dir:dirs[dirs.length-1]});
    // 板厚方向にオフセットして外形を作る
    const h=T/2;
    const left=mid.map(q=>({x:q.x-Math.sin(q.dir)*h, y:q.y+Math.cos(q.dir)*h}));
    const right=mid.map(q=>({x:q.x+Math.sin(q.dir)*h, y:q.y-Math.cos(q.dir)*h}));
    const outline=left.concat(right.slice().reverse());
    return {pts,dirs,mid,left,right,outline,turns,tang};
  }

  function bbox(list){
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    list.forEach(p=>{ x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y); });
    return {x0,y0,x1,y1,w:x1-x0,h:y1-y0};
  }
  function segInt(a,b,c,d){ // 線分交差判定
    const s=(p,q,r)=>Math.sign((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x));
    const d1=s(a,b,c),d2=s(a,b,d),d3=s(c,d,a),d4=s(c,d,b);
    return d1!==d2&&d3!==d4;
  }

  /* ---------- 判定 ---------- */
  function judge(S,res,g){
    const out=[], T=res.T, V=res.V, m=res.m;
    // 最小曲げ内R
    if(res.R < m.rmin*T-1e-6)
      out.push({lv:'ng',t:`曲げ内R ${f(res.R,2)}mm が ${m.n} の最小内R目安 ${f(m.rmin*T,2)}mm(${m.rmin}T)を下回ります。曲げ割れの恐れがあります。`});
    else if(res.R < (m.rmin+0.3)*T)
      out.push({lv:'warn',t:`曲げ内Rが最小値に近い状態です。圧延方向を曲げ線と直交させ、バリ面を内側にしてください。`});
    // 最小フランジ
    S.segs.forEach((L,i)=>{
      const isEnd = (i===0||i===S.segs.length-1);
      if(isEnd && L < res.minFlange-1e-6)
        out.push({lv:'ng',t:`${i+1}番目の辺 ${L}mm が最小フランジ ${f(res.minFlange,1)}mm(0.7×V${V})を下回ります。ダイの肩に乗らず曲がりません。`});
    });
    // R部の重なり
    S.segs.forEach((L,i)=>{
      const a=(i>0?g.tang[i-1]:0), b=(i<g.tang.length?g.tang[i]:0);
      if(L < a+b-1e-6)
        out.push({lv:'ng',t:`${i+1}番目の辺 ${L}mm に対して曲げR部が ${f(a+b,2)}mm 必要です。形状が成立しません(辺を長くするかRを小さく)。`});
    });
    // 自己干渉
    const P=g.pts;
    for(let i=0;i<P.length-1;i++) for(let j=i+2;j<P.length-1;j++){
      if(j===i+1) continue;
      if(i===0&&j===P.length-2) continue;
      if(segInt(P[i],P[i+1],P[j],P[j+1])){
        out.push({lv:'ng',t:'成形後の形状が自分自身と交差します。曲げ角度・辺の長さを見直してください。'}); i=P.length; break;
      }
    }
    // 段曲げ
    res.bends.forEach((b,i)=>{
      if(i<res.bends.length-1 && b.d!==res.bends[i+1].d){
        const mid=S.segs[i+1];
        if(mid < 3*T) out.push({lv:'warn',t:`曲げ${i+1}と${i+2}が逆方向で、間の辺が ${mid}mm(${f(mid/T,1)}T)と短い段曲げです。専用の段曲げ金型が必要になります。`});
      }
    });
    // 能力
    if(res.tf > S.cap) out.push({lv:'ng',t:`必要荷重 ${f(res.tf,1)}tf が機械能力 ${S.cap}tf を超えます。V幅を大きくするか曲げ長さを分割してください。`});
    else if(res.tf > S.cap*0.8) out.push({lv:'warn',t:`必要荷重 ${f(res.tf,1)}tf は機械能力の80%を超えています。金型の許容荷重(tf/m)も確認してください。`});
    // 鋭角・ヘミング
    res.bends.forEach((b,i)=>{ if(b.a>150) out.push({lv:'warn',t:`曲げ${i+1}は ${b.a}°(内角${f(b.inner,0)}°)の鋭角曲げです。鋭角金型またはヘミング工程が必要です。`}); });
    if(!out.length) out.push({lv:'ok',t:'入力した形状は、一般的な標準金型で加工できる範囲です。実際の可否は加工先の設備・金型でご確認ください。'});
    return out;
  }

  /* ---------- 描画: 断面 ---------- */
  function drawProfile(svg,S,res,prog,opt){
    const W=680,H=400,PAD=38;
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    const gFlat=geom(S,res,0), gFull=geom(S,res,res.bends.length);
    const bb=bbox(gFlat.outline.concat(gFull.outline));
    if(opt.die){ const mg=res.V*0.75; bb.x0-=mg; bb.y0-=mg; bb.x1+=mg; bb.y1+=mg; bb.w+=mg*2; bb.h+=mg*2; }
    const k=Math.min((W-PAD*2)/Math.max(bb.w,1),(H-PAD*2)/Math.max(bb.h,1));
    const ox=(W-bb.w*k)/2-bb.x0*k, oy=(H+bb.h*k)/2+bb.y0*k;
    const X=p=>ox+p.x*k, Y=p=>oy-p.y*k;
    const el=(t,a,par)=>{const e=document.createElementNS(NS,t);for(const q in a)e.setAttribute(q,a[q]);(par||svg).appendChild(e);return e;};
    const txt=(x,y,s,o={})=>{const e=el('text',{x,y,'font-size':o.size||12,fill:o.fill||'var(--text)','text-anchor':o.anchor||'start','font-weight':o.bold?700:400});e.textContent=s;return e;};
    const poly=(p,a)=>el('path',Object.assign({d:p.map((q,i)=>(i?'L':'M')+X(q)+' '+Y(q)).join(' ')+'Z'},a));

    const gCur=geom(S,res,prog);
    const labels=[];
    // 金型
    const idx=Math.floor(Math.min(prog,res.bends.length-1e-6));
    if(opt.die && prog>0.02 && prog<res.bends.length-0.02 && idx<res.bends.length){
      const vtx=gCur.pts[idx+1], din=gCur.dirs[idx], sgn=Math.sign(res.bends[idx].d)||1;
      const ux=Math.cos(din),uy=Math.sin(din);
      const nx=Math.sin(din)*sgn, ny=-Math.cos(din)*sgn;   // 外側(ダイ側)
      const L=(q,w)=>({x:vtx.x+ux*q+nx*w, y:vtx.y+uy*q+ny*w});
      const V2=res.V/2, hw=res.T/2, dp=res.V*0.5;
      const die=[L(-res.V*1.5,hw),L(-V2,hw),L(0,hw+dp),L(V2,hw),L(res.V*1.5,hw),L(res.V*1.5,hw+res.V*0.95),L(-res.V*1.5,hw+res.V*0.95)];
      poly(die,{fill:'var(--tool)',opacity:.5,stroke:'var(--muted)','stroke-width':1});
      const pw=res.V*0.32, ph=res.V*1.15;
      const pp=[L(0,-hw-res.R*0.15),L(pw,-hw-ph*0.55),L(pw*0.5,-hw-ph),L(-pw*0.5,-hw-ph),L(-pw,-hw-ph*0.55)];
      poly(pp,{fill:'var(--tool-2)',opacity:.6,stroke:'var(--muted)','stroke-width':1});
      const dl=L(res.V*1.5,hw+res.V*0.6), pl=L(0,-hw-ph);
      labels.push([clamp(X(dl)+6,20,W-46),clamp(Y(dl),18,H-26),'ダイ','start']);
      labels.push([clamp(X(pl),26,W-26),clamp(Y(pl)-7,16,H-26),'パンチ','middle']);
    }
    // スプリングバック(除荷前の姿)
    if(opt.sb && prog>=res.bends.length-0.02){
      const gOver=geom(S,res,res.bends.length,res.bends.map(b=>b.sb));
      poly(gOver.outline,{fill:'none',stroke:'var(--ng)','stroke-width':1.4,'stroke-dasharray':'6 4',opacity:.95});
    }
    // 本体
    poly(gCur.outline,{fill:'var(--sheet)',stroke:'var(--sheet-dark)','stroke-width':1});
    // 中立軸
    if(opt.mid) el('path',{d:gCur.mid.map((q,i)=>(i?'L':'M')+X(q)+' '+Y(q)).join(' '),fill:'none',stroke:'var(--ng)','stroke-width':1,'stroke-dasharray':'5 3',opacity:.85});
    labels.forEach(L=>{const e=txt(L[0],L[1],L[2],{size:10.5,anchor:L[3],fill:'var(--muted)',bold:1});
      e.setAttribute('stroke','var(--surface)'); e.setAttribute('stroke-width','3.5'); e.setAttribute('paint-order','stroke');});
    // 曲げ番号
    gCur.pts.slice(1,-1).forEach((q,i)=>{
      el('circle',{cx:X(q),cy:Y(q),r:9,fill:'var(--primary)',opacity: prog>i?1:.3});
      const t=txt(X(q),Y(q)+4,String(i+1),{size:11,anchor:'middle',bold:1,fill:'#fff'}); t.style.opacity= prog>i?1:.5;
    });
    // 外寸
    if(opt.dim && prog>=res.bends.length-0.02){
      const P=gFull.pts;
      const cen=P.reduce((a,q)=>({x:a.x+q.x/P.length,y:a.y+q.y/P.length}),{x:0,y:0});
      for(let i=0;i<S.segs.length;i++){
        const a=P[i],b=P[i+1];
        const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        let nx=-(b.y-a.y),ny=(b.x-a.x);
        const ln=Math.hypot(nx,ny)||1; nx/=ln; ny/=ln;
        if((mid.x+nx-cen.x)*nx+(mid.y+ny-cen.y)*ny < 0){ nx=-nx; ny=-ny; }
        const off=(res.T/2)+14/k;
        const q={x:mid.x+nx*off, y:mid.y+ny*off};
        txt(clamp(X(q),22,W-22),Y(q)+4,`${S.segs[i]}`,{size:11.5,anchor:'middle',bold:1,fill:'var(--primary)'});
      }
    }
    txt(12,20,`成形 ${Math.round(prog/res.bends.length*100)}%  /  曲げ ${Math.min(Math.ceil(prog),res.bends.length)} / ${res.bends.length}`,{size:12,bold:1,fill:'var(--primary)'});
    txt(12,H-12,`板厚 ${res.T}  内R ${f(res.R,2)}  V幅 ${res.V}  K値 ${f(res.K,2)}`,{size:11,fill:'var(--muted)'});
  }

  /* ---------- 描画: 展開図 ---------- */
  function drawFlat(svg,S,res){
    const W=680,H=232,PAD=42;
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    while(svg.firstChild) svg.removeChild(svg.firstChild);
    const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const q in a)e.setAttribute(q,a[q]);svg.appendChild(e);return e;};
    const txt=(x,y,s,o={})=>{const e=el('text',{x,y,'font-size':o.size||11,fill:o.fill||'var(--text)','text-anchor':o.anchor||'start','font-weight':o.bold?700:400});e.textContent=s;return e;};
    const k=(W-PAD*2)/Math.max(res.flat,1);
    const bh=Math.min(88,Math.max(40,S.W*k)); const y0=78;
    const X=v=>PAD+v*k;
    el('rect',{x:X(0),y:y0,width:res.flat*k,height:bh,fill:'var(--sheet)',opacity:.55,stroke:'var(--sheet-dark)'});
    let x=0;
    res.bends.forEach((b,i)=>{
      const fl=S.segs[i]-(i>0?res.bends[i-1].ossb:0)-b.ossb;
      x+=fl;
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

  /* ---------- 画面 ---------- */
  let anim=null, S=null;
  function stop(){ if(anim){cancelAnimationFrame(anim);anim=null;} }

  function render(main){
    stop();
    S={mat:'spcc',T:1.6,W:500,cap:80,Vauto:true,V:10,Rauto:true,R:1.6,Kauto:true,K:0.42,
       preset:'U',sd:PRESETS.U.sd,segs:PRESETS.U.segs.slice(),bends:PRESETS.U.bends.map(b=>({a:b.a,d:b.d})),
       prog:2,die:true,sb:true,mid:true,dim:true};
    main.innerHTML=`
<div class="crumb"><a href="#/home">ホーム</a> › 曲げシミュレーター</div>
<h1>🛠️ 曲げシミュレーター</h1>
<p>断面形状と加工条件を入力すると、<b>成形過程・展開図・加工条件・成形可否</b>を試算します。パラメータを変えて、寸法や判定がどう動くかを確かめてください。</p>
<div class="sim-wrap">
  <div class="sim-ctrl card" id="simCtrl"></div>
  <div class="sim-view">
    <div class="anim" style="margin-top:0"><div class="anim-title">断面(成形シミュレーション)</div>
      <svg id="simProfile" role="img" aria-label="曲げ成形の断面シミュレーション"></svg>
      <div class="anim-ctrl">
        <button class="btn small" id="simPlay">▶ 再生</button>
        <label>成形進捗 <input type="range" id="simProg" min="0" max="100" value="100"></label>
        <label><input type="checkbox" id="simDie" checked> 金型</label>
        <label><input type="checkbox" id="simSb" checked> 戻り(赤破線)</label>
        <label><input type="checkbox" id="simMid" checked> 中立軸</label>
        <label><input type="checkbox" id="simDim" checked> 寸法</label>
      </div>
    </div>
    <div class="anim"><div class="anim-title">展開図</div><svg id="simFlat" role="img" aria-label="展開図"></svg></div>
  </div>
</div>
<div id="simJudge"></div>
<h2>計算結果</h2>
<div id="simRes"></div>
<div class="callout tip"><b>使い方のヒント</b>「形状」を切り替えると代表的な断面を呼び出せます。V幅・内R・K値は「自動」を外すと手入力できます。自動時のV幅は板厚から、内Rはエアベンドの目安(V幅÷材質係数)から求めています。</div>`;
    buildCtrl();
    update();
  }

  function buildCtrl(){
    const c=document.getElementById('simCtrl');
    const m=MAT[S.mat];
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
<h3>断面形状</h3>
<div class="calc-form"><label>形状<select id="sPre">${Object.keys(PRESETS).map(k=>`<option value="${k}" ${k===S.preset?'selected':''}>${PRESETS[k].n}</option>`).join('')}</select></label>
<label>曲げ数<span class="sim-inline"><button class="btn small secondary" id="sMinus">−</button><span id="sNb" style="min-width:2em;text-align:center;font-weight:700">${S.bends.length}</span><button class="btn small secondary" id="sPlus">＋</button></span></label></div>
<div class="table-wrap"><table class="sim-tbl"><tr><th>辺</th><th>外寸 (mm)</th><th>曲げ</th><th>角度 (°)</th><th>方向</th></tr>
${S.segs.map((L,i)=>`<tr>
<td>${i+1}</td><td><input class="sim-seg" data-i="${i}" type="number" step="1" min="1" value="${L}"></td>
${i<S.bends.length?`<td>${i+1}</td><td><input class="sim-ang" data-i="${i}" type="number" step="5" min="5" max="170" value="${S.bends[i].a}"></td>
<td><select class="sim-dir" data-i="${i}"><option value="1" ${S.bends[i].d>0?'selected':''}>UP</option><option value="-1" ${S.bends[i].d<0?'selected':''}>DOWN</option></select></td>`:'<td></td><td></td><td></td>'}
</tr>`).join('')}</table></div>
<p style="font-size:.8rem;color:var(--muted);margin:.4em 0 0">外寸は型線(角を延長した交点)までの寸法です。角度は板が曲がる角度で、90°なら直角、45°なら内角135°の鈍角曲げになります。</p>`;

    const on=(id,ev,fn)=>{const e=document.getElementById(id); if(e) e.addEventListener(ev,fn);};
    on('sMat','change',e=>{S.mat=e.target.value;buildCtrl();update();});
    on('sT','input',e=>{S.T=Math.max(0.3,+e.target.value||1);buildCtrl();update();});
    on('sW','input',e=>{S.W=Math.max(10,+e.target.value||10);update();});
    on('sCap','input',e=>{S.cap=Math.max(1,+e.target.value||1);update();});
    on('sVa','change',e=>{S.Vauto=e.target.checked; if(!S.Vauto)S.V=stdV(S.T); buildCtrl();update();});
    on('sRa','change',e=>{S.Rauto=e.target.checked; if(!S.Rauto)S.R=(S.Vauto?stdV(S.T):S.V)/MAT[S.mat].vr; buildCtrl();update();});
    on('sKa','change',e=>{S.Kauto=e.target.checked; buildCtrl();update();});
    on('sV','input',e=>{S.V=Math.max(3,+e.target.value||3);update();});
    on('sR','input',e=>{S.R=Math.max(0.1,+e.target.value||0.1);update();});
    on('sK','input',e=>{S.K=clamp(+e.target.value||0.42,0.2,0.5);update();});
    on('sPre','change',e=>{const p=PRESETS[e.target.value];S.preset=e.target.value;S.sd=p.sd;S.segs=p.segs.slice();S.bends=p.bends.map(b=>({a:b.a,d:b.d}));S.prog=S.bends.length;buildCtrl();update();});
    on('sPlus','click',()=>{ if(S.bends.length>=6) return; S.bends.push({a:90,d:1}); S.segs.push(30); S.prog=S.bends.length; buildCtrl(); update(); });
    on('sMinus','click',()=>{ if(S.bends.length<=1) return; S.bends.pop(); S.segs.pop(); S.prog=S.bends.length; buildCtrl(); update(); });
    c.querySelectorAll('.sim-seg').forEach(i=>i.addEventListener('input',e=>{S.segs[+e.target.dataset.i]=Math.max(1,+e.target.value||1);update();}));
    c.querySelectorAll('.sim-ang').forEach(i=>i.addEventListener('input',e=>{S.bends[+e.target.dataset.i].a=clamp(+e.target.value||90,5,170);update();}));
    c.querySelectorAll('.sim-dir').forEach(i=>i.addEventListener('change',e=>{S.bends[+e.target.dataset.i].d=+e.target.value;update();}));

    const pr=document.getElementById('simProg');
    if(pr&&!pr._w){ pr._w=1;
      pr.addEventListener('input',e=>{stopPlay();S.prog=S.bends.length*(+e.target.value)/100;draw();});
      document.getElementById('simPlay').addEventListener('click',togglePlay);
      ['simDie:die','simSb:sb','simMid:mid','simDim:dim'].forEach(x=>{const[id,key]=x.split(':');
        document.getElementById(id).addEventListener('change',e=>{S[key]=e.target.checked;draw();});});
    }
  }

  function togglePlay(){ anim?stopPlay():startPlay(); }
  function stopPlay(){ stop(); const b=document.getElementById('simPlay'); if(b)b.textContent='▶ 再生'; }
  function startPlay(){
    stop(); const b=document.getElementById('simPlay'); if(b)b.textContent='⏸ 停止';
    const n=S.bends.length; let t0=performance.now();
    const step=now=>{
      const t=(now-t0)/1000, cyc=n*1.4+1.6;
      const tt=t%cyc;
      S.prog = tt<n*1.4 ? (tt/1.4) : n;
      const pr=document.getElementById('simProg'); if(pr) pr.value=Math.round(S.prog/n*100);
      draw();
      anim=requestAnimationFrame(step);
    };
    anim=requestAnimationFrame(step);
  }

  function draw(){
    const res=compute(S);
    drawProfile(document.getElementById('simProfile'),S,res,clamp(S.prog,0,res.bends.length),
      {die:S.die,sb:S.sb,mid:S.mid,dim:S.dim});
  }

  function update(){
    const res=compute(S);
    S.prog=clamp(S.prog,0,res.bends.length);
    if(S.Vauto) S.V=res.V; if(S.Rauto) S.R=res.R; if(S.Kauto) S.K=res.K;
    draw();
    drawFlat(document.getElementById('simFlat'),S,res);
    const g=geom(S,res,res.bends.length);
    const js=judge(S,res,g);
    document.getElementById('simJudge').innerHTML=`<h2>成形可否の判定</h2>`+js.map(j=>
      `<div class="callout ${j.lv==='ng'?'ng':j.lv==='warn'?'warn':'ok'}"><b>${j.lv==='ng'?'✕ 要修正':j.lv==='warn'?'△ 注意':'○ 問題なし'}</b>${j.t}</div>`).join('');
    const tot=S.segs.reduce((a,b)=>a+b,0);
    document.getElementById('simRes').innerHTML=`
<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
<div class="stat"><div class="l">展開長(ブランク長さ)</div><div class="v">${f(res.flat,2)} <small style="font-size:.6em">mm</small></div></div>
<div class="stat"><div class="l">外寸合計 − 曲げ縮み</div><div class="v" style="font-size:1.05rem">${f(tot,1)} − ${f(tot-res.flat,2)}</div></div>
<div class="stat"><div class="l">必要荷重(1曲げ)</div><div class="v">${f(res.tf,1)} <small style="font-size:.6em">tf</small></div></div>
<div class="stat"><div class="l">ブランク質量</div><div class="v">${f(res.mass,3)} <small style="font-size:.6em">kg</small></div></div>
</div>
<div class="table-wrap"><table>
<tr><th>曲げ</th><th>角度</th><th>製品内角</th><th>方向</th><th>曲げ伸び BA</th><th>外側セットバック</th><th>曲げ縮み BD</th><th>戻り角の目安</th><th>狙う曲げ角度</th></tr>
${res.bends.map((b,i)=>`<tr><td>${i+1}</td><td>${b.a}°</td><td>${f(b.inner,0)}°</td><td>${b.d>0?'UP':'DOWN'}</td><td>${f(b.ba,3)}</td><td>${f(b.ossb,3)}</td><td><b>${f(b.bd,3)}</b></td><td>${f(b.sb,1)}°</td><td>${f(b.a+b.sb,1)}°</td></tr>`).join('')}
</table></div>
<div class="table-wrap"><table>
<tr><th>項目</th><th>値</th><th>根拠・備考</th></tr>
<tr><td>使用V幅</td><td>V${res.V}(${f(res.V/res.T,1)}T)</td><td>板厚の6〜8倍が標準${S.Vauto?'(自動選定)':'(手入力)'}</td></tr>
<tr><td>曲げ内R</td><td>${f(res.R,2)} mm(${f(res.R/res.T,2)}T)</td><td>エアベンドの目安 R ≒ V ÷ ${MAT[S.mat].vr}${S.Rauto?'(自動)':'(手入力)'}</td></tr>
<tr><td>K値</td><td>${f(res.K,3)}</td><td>R/T = ${f(res.R/res.T,2)} から内挿${S.Kauto?'(自動)':'(手入力)'}</td></tr>
<tr><td>最小フランジ</td><td>${f(res.minFlange,1)} mm</td><td>0.7 × V幅。端の辺がこれを下回ると曲がりません</td></tr>
<tr><td>最小曲げ内R</td><td>${f(MAT[S.mat].rmin*res.T,2)} mm(${MAT[S.mat].rmin}T)</td><td>${MAT[S.mat].n} の割れ限界の目安</td></tr>
<tr><td>展開長の式</td><td colspan="2">L = Σ外寸 − ΣBD、BA = (π×θ/180)×(R+K×T)、OSSB = (R+T)×tan(θ/2)、BD = 2×OSSB − BA</td></tr>
<tr><td>荷重の式</td><td colspan="2">P[kN] = 1.33 × σb × W × T² ÷ (V × 1000)、σb = ${MAT[S.mat].sb} N/mm²、W = ${S.W} mm</td></tr>
</table></div>
<div class="callout warn"><b>この試算の位置づけ</b>戻り角(スプリングバック)は材質・板厚・内R・V幅から求めた<b>経験的な目安</b>で、材料ロットや金型の状態で±0.5°以上変動します。展開長も自社の伸び値表が最優先です。必ず試し曲げと初品検査で確認してください。</div>`;
  }

  window.SM_SIM={render,stop};
})();
