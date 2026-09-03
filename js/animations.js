/* ===== SVG アニメーション定義 =====
   各アニメーションは (container) => stopFn を返す。
   本文中の <div data-anim="名前"></div> に app.js がマウントする。 */
(function(){
  const A = {};
  const NS = 'http://www.w3.org/2000/svg';
  const active = [];

  function el(tag, attrs, parent){
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function frame(container, title, note, w, h){
    container.classList.add('anim');
    container.innerHTML = `<div class="anim-title">${title}</div>`;
    const svg = el('svg', {viewBox:`0 0 ${w} ${h}`, role:'img', 'aria-label':title});
    container.appendChild(svg);
    const ctrl = document.createElement('div'); ctrl.className='anim-ctrl'; container.appendChild(ctrl);
    if (note){ const n=document.createElement('div'); n.className='anim-note'; n.innerHTML=note; container.appendChild(n); }
    return {svg, ctrl};
  }
  function loop(fn){
    let raf, running=true, t0=performance.now();
    function step(now){ if(!running) return; fn((now-t0)/1000); raf=requestAnimationFrame(step); }
    raf=requestAnimationFrame(step);
    return ()=>{running=false; cancelAnimationFrame(raf);};
  }
  const ease = t => t<.5 ? 2*t*t : -1+(4-2*t)*t;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function text(svg,x,y,s,opt={}){ const t=el('text',Object.assign({x,y,'font-size':opt.size||12,fill:opt.fill||'var(--text)','text-anchor':opt.anchor||'start','font-weight':opt.bold?'700':'400'},opt.attrs||{}),svg); t.textContent=s; return t; }
  function dim(svg,x1,y1,x2,y2,label,opt={}){ // 寸法線
    const g=el('g',{stroke:'var(--muted)','stroke-width':1,fill:'none'},svg);
    el('line',{x1,y1,x2,y2},g);
    const ang=Math.atan2(y2-y1,x2-x1), s=5;
    for(const [x,y,d] of [[x1,y1,1],[x2,y2,-1]]){
      el('path',{d:`M${x+d*s*Math.cos(ang-.4)} ${y+d*s*Math.sin(ang-.4)} L${x} ${y} L${x+d*s*Math.cos(ang+.4)} ${y+d*s*Math.sin(ang+.4)}`},g);
    }
    const t=text(svg,(x1+x2)/2+(opt.dx||0),(y1+y2)/2+(opt.dy||-4),label,{size:opt.size||11,fill:opt.fill||'var(--muted)',anchor:'middle'});
    return t;
  }

  /* ---------- 1. プレスブレーキ曲げ ---------- */
  A['press-brake'] = function(c){
    const {svg,ctrl}=frame(c,'プレスブレーキによる曲げ加工(V曲げ)','パンチ(上型)が下降し、Vダイ(下型)との間で板を曲げます。エアベンドは押し込み量で角度を調整、ボトミングは板をダイに密着させます。',640,320);
    const cx=320, dieTop=230, T=10;
    let V=80, mode='air', speed=1;
    // ダイ
    const die=el('path',{fill:'var(--tool)'},svg);
    const punch=el('g',{},svg);
    el('path',{d:`M${cx-22} 0 L${cx+22} 0 L${cx+22} 80 L${cx+14} 120 L${cx+3} 170 L${cx} 176 L${cx-3} 170 L${cx-14} 120 L${cx-22} 80 Z`,fill:'var(--tool-2)'},punch);
    const left=el('rect',{x:cx-230,y:dieTop-T,width:230,height:T,fill:'var(--sheet)',rx:1},svg);
    const right=el('rect',{x:cx,y:dieTop-T,width:230,height:T,fill:'var(--sheet)',rx:1},svg);
    text(svg,cx+40,40,'パンチ(上型)',{size:13,bold:1});
    text(svg,cx+90,290,'Vダイ(下型)',{size:13,bold:1});
    const vLab=dim(svg,cx-40,300,cx+40,300,'V幅',{dy:14,fill:'#e5e7eb'});
    const angLab=text(svg,40,40,'',{size:14,bold:1,fill:'var(--primary)'});
    const rLab=text(svg,40,62,'',{size:12,fill:'var(--muted)'});
    function drawDie(){
      die.setAttribute('d',`M${cx-260} ${dieTop} L${cx-V/2} ${dieTop} L${cx} ${dieTop+V/2*0.85} L${cx+V/2} ${dieTop} L${cx+260} ${dieTop} L${cx+260} 320 L${cx-260} 320 Z`);
      vLab.textContent=`V幅 = ${(V/10).toFixed(0)}T (板厚の${(V/10).toFixed(0)}倍)`;
    }
    drawDie();
    // コントロール
    ctrl.innerHTML=`<label>方式 <select id="pbMode"><option value="air">エアベンド(部分曲げ)</option><option value="bottom">ボトミング(突き当て)</option></select></label>
      <label>V幅 <input type="range" id="pbV" min="50" max="120" value="80"> <span id="pbVv">8T</span></label>
      <label>速度 <input type="range" id="pbS" min="0.3" max="2" step="0.1" value="1"></label>`;
    ctrl.querySelector('#pbMode').onchange=e=>{mode=e.target.value;};
    ctrl.querySelector('#pbV').oninput=e=>{V=+e.target.value;ctrl.querySelector('#pbVv').textContent=(V/10).toFixed(0)+'T';drawDie();};
    ctrl.querySelector('#pbS').oninput=e=>{speed=+e.target.value;};
    return loop(t=>{
      const cyc=(t*speed)%5; // 5秒周期
      let p; // 0..1 押込み量
      if(cyc<2) p=ease(cyc/2); else if(cyc<3) p=1; else if(cyc<4) p=1-ease(cyc-3); else p=0;
      const maxAng = 45;   // 片側回転角(90°曲げ)
      const ang = p*maxAng;
      const depth = Math.tan(ang*Math.PI/180)*(V/2);
      punch.setAttribute('transform',`translate(0,${dieTop-T-176+depth})`);
      left.setAttribute('transform',`rotate(${ang} ${cx} ${dieTop-T/2+depth})`);
      left.setAttribute('y',dieTop-T+depth); right.setAttribute('y',dieTop-T+depth);
      right.setAttribute('transform',`rotate(${-ang} ${cx} ${dieTop-T/2+depth})`);
      const bendAngle=180-2*ang;
      angLab.textContent=`曲げ角度: ${bendAngle.toFixed(0)}° ${p>=1?(mode==='air'?'(角度=押込み量で決まる)':'(ダイに密着・高精度)'):''}`;
      rLab.textContent=`内R目安 ≒ V/6 ≒ ${(V/10/6).toFixed(2)}T (エアベンド時)`;
    });
  };

  /* ---------- 2. スプリングバック ---------- */
  A['springback'] = function(c){
    const {svg,ctrl}=frame(c,'スプリングバック(戻り)とオーバーベンド','荷重を除くと板は弾性回復して角度が開きます。目標角度より深く曲げる「オーバーベンド」で補正します。※図は戻り量を約4倍に誇張して表示しています。',640,300);
    let sb=1.5; const EX=4; // 表示誇張倍率
    const cx=200, cy=230;
    el('rect',{x:20,y:cy,width:600,height:14,fill:'var(--tool)'},svg);
    el('rect',{x:cx-160,y:cy-10,width:160,height:10,fill:'var(--sheet)'},svg);
    const flange=el('rect',{x:cx,y:cy-10,width:160,height:10,fill:'var(--sheet)'},svg);
    el('line',{x1:cx,y1:cy-5,x2:cx,y2:cy-185,stroke:'var(--ok)','stroke-dasharray':'5 4','stroke-width':1.5},svg);
    text(svg,cx+6,cy-175,'目標 90°',{size:12,fill:'var(--ok)'});
    const load=el('g',{},svg); el('path',{d:'M0 -60 L0 -10 M-8 -20 L0 -10 L8 -20',stroke:'var(--ng)','stroke-width':3,fill:'none'},load); text(load,10,-30,'荷重',{size:12,fill:'var(--ng)',bold:1});
    const lab=text(svg,360,60,'',{size:15,bold:1,fill:'var(--primary)'});
    const lab2=text(svg,360,86,'',{size:12,fill:'var(--muted)'});
    const arc=el('path',{fill:'none',stroke:'var(--ng)','stroke-width':2.5},svg);
    const arcT=text(svg,cx-12,cy-195,'',{size:12,fill:'var(--ng)',bold:1,anchor:'end'});
    ctrl.innerHTML=`<label>材質(戻り量) <select id="sbMat"><option value="1.5">SPCC 軟鋼 (約1〜2°)</option><option value="3">SUS304 (約2〜4°)</option><option value="2.5">A5052 アルミ (約2〜3°)</option><option value="0.8">銅・真鍮 (約1°)</option></select></label>`;
    ctrl.querySelector('#sbMat').onchange=e=>{sb=+e.target.value;};
    return loop(t=>{
      const cyc=t%6; let real, phase;
      if(cyc<2.5){ real=ease(cyc/2.5)*(90+sb); phase=0;}
      else if(cyc<3.3){ real=90+sb; phase=1;}
      else if(cyc<4.3){ real=90+sb-ease((cyc-3.3)/1)*sb; phase=2;}
      else { real=90; phase=3;}
      const disp = real<=90 ? real : 90+(real-90)*EX;   // 表示用(誇張)
      flange.setAttribute('transform',`rotate(${-disp} ${cx} ${cy-5})`);
      const a=disp*Math.PI/180; const tipx=cx+Math.cos(a)*150, tipy=cy-5-Math.sin(a)*150;
      load.setAttribute('transform',`translate(${tipx},${tipy})`); load.style.opacity = phase<=1 ? 1 : 0;
      const msgs=['① 目標より深く曲げる(オーバーベンド)','② 保持: 角度 = 90°+'+sb.toFixed(1)+'°','③ 除荷 → 弾性回復で角度が開く(戻り)','④ 完成: 90°に収まる'];
      lab.textContent=msgs[phase];
      lab2.textContent=`現在の曲げ角度(内角): ${(180-real).toFixed(1)}°   材料の戻り量 ${sb}°`;
      if(phase>=1 && phase<=2 && disp>90.5){
        const r=170, a1=Math.PI/2, a2=a;
        arc.setAttribute('d',`M${cx} ${cy-5-r} A${r} ${r} 0 0 0 ${cx+Math.cos(a2)*r} ${cy-5-Math.sin(a2)*r}`);
        arc.style.display='block'; arcT.textContent=`オーバーベンド ${(real-90).toFixed(1)}°`; arcT.style.display='block';
      } else { arc.style.display='none'; arcT.style.display='none'; }
    });
  };

  /* ---------- 3. レーザー切断 ---------- */
  A['laser'] = function(c){
    const {svg,ctrl}=frame(c,'レーザー切断(ブランク加工)','集光したレーザーとアシストガスで板を溶かし飛ばしながら輪郭を切断。ピアス(貫通)→輪郭切断→ミクロジョイント残しの順に進みます。',640,320);
    el('rect',{x:40,y:40,width:560,height:240,fill:'var(--sheet)',opacity:.55},svg);
    for(let i=0;i<8;i++) el('line',{x1:40,y1:40+i*34,x2:600,y2:40+i*34,stroke:'var(--sheet-dark)','stroke-width':.4,opacity:.4},svg);
    const pathD='M200 250 L200 110 L330 110 L360 140 L440 140 L440 250 Z';
    const holeD='M300 200 m-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0';
    const guide=el('path',{d:pathD,fill:'none',stroke:'var(--muted)','stroke-width':1,'stroke-dasharray':'3 3'},svg);
    const guide2=el('path',{d:holeD,fill:'none',stroke:'var(--muted)','stroke-width':1,'stroke-dasharray':'3 3'},svg);
    const cutH=el('path',{d:holeD,fill:'none',stroke:'var(--bg)','stroke-width':3},svg);
    const cut=el('path',{d:pathD,fill:'none',stroke:'var(--bg)','stroke-width':3},svg);
    const LH=cutH.getTotalLength(), L=cut.getTotalLength();
    cutH.setAttribute('stroke-dasharray',LH); cut.setAttribute('stroke-dasharray',L);
    const head=el('g',{},svg);
    el('rect',{x:-14,y:-70,width:28,height:50,fill:'var(--tool)',rx:3},head);
    el('path',{d:'M-10 -20 L10 -20 L3 0 L-3 0 Z',fill:'var(--tool-2)'},head);
    const beam=el('line',{x1:0,y1:0,x2:0,y2:0,stroke:'var(--laser)','stroke-width':2.5},head);
    const glow=el('circle',{cx:0,cy:0,r:6,fill:'var(--laser)',opacity:.8},head);
    const sparks=[]; for(let i=0;i<8;i++){ const s=el('circle',{cx:0,cy:0,r:1.6,fill:'#ffb347'},head); sparks.push(s);} 
    text(svg,60,300,'ステータス:',{size:12,fill:'var(--muted)'});
    const st=text(svg,130,300,'',{size:12,bold:1,fill:'var(--primary)'});
    const mj=el('rect',{x:198,y:248,width:4,height:6,fill:'var(--sheet)'},svg); mj.style.display='none';
    const mjT=text(svg,150,270,'ミクロジョイント',{size:11,fill:'var(--warn)'}); mjT.style.display='none';
    let gas='N2';
    ctrl.innerHTML=`<label>アシストガス <select id="lzGas"><option value="N2">窒素 N2 (無酸化・SUS/アルミ)</option><option value="O2">酸素 O2 (軟鋼・厚板・酸化面)</option></select></label>`;
    ctrl.querySelector('#lzGas').onchange=e=>{gas=e.target.value;};
    return loop(t=>{
      const cyc=t%9; let x,y,msg;
      if(cyc<1.2){ // ピアス
        const p=cutH.getPointAtLength(0); x=p.x;y=p.y; msg='ピアシング(貫通穴あけ)'; cutH.setAttribute('stroke-dashoffset',LH); cut.setAttribute('stroke-dashoffset',L); mj.style.display='none';mjT.style.display='none';
      } else if(cyc<3.2){ const f=(cyc-1.2)/2; const p=cutH.getPointAtLength(LH*f); x=p.x;y=p.y; cutH.setAttribute('stroke-dashoffset',LH*(1-f)); msg='内側の穴を先に切断(内→外の順)';
      } else if(cyc<3.8){ const p=cut.getPointAtLength(0); x=p.x;y=p.y; msg='外形のピアス位置へ移動'; cut.setAttribute('stroke-dashoffset',L);
      } else if(cyc<8){ const f=Math.min(.985,(cyc-3.8)/4.2); const p=cut.getPointAtLength(L*f); x=p.x;y=p.y; cut.setAttribute('stroke-dashoffset',L*(1-f)); msg=`外形切断中 (${gas==='N2'?'N2: 切断面が酸化せず塗装・溶接に有利':'O2: 酸化反応熱で高速・切断面に酸化膜'})`;
      } else { const p=cut.getPointAtLength(L*.985); x=p.x;y=p.y; msg='切り残し=ミクロジョイントで製品の脱落を防止'; mj.style.display='block';mjT.style.display='block'; }
      head.setAttribute('transform',`translate(${x},${y})`);
      const on = !(cyc>=3.2&&cyc<3.8);
      beam.setAttribute('y2',on?0:-18); beam.style.opacity=on?1:.15; glow.style.opacity=on?(.5+.5*Math.sin(t*40)):0;
      sparks.forEach((s,i)=>{ const ph=(t*3+i*.37)%1; s.setAttribute('cx',Math.cos(i*.8+t)*ph*24); s.setAttribute('cy',ph*18); s.style.opacity=on?1-ph:0; });
      st.textContent=msg;
    });
  };

  /* ---------- 4. タレットパンチプレス ---------- */
  A['turret-punch'] = function(c){
    const {svg}=frame(c,'タレットパンチプレス(タレパン)による打抜き','パンチとダイのすき間(クリアランス)でせん断。丸穴や角穴は1打で、大きな輪郭は「追い抜き(ニブリング)」で連続打抜きします。',640,300);
    el('rect',{x:60,y:170,width:520,height:40,fill:'var(--tool)'},svg); // ダイホルダ
    const dieHole=el('rect',{x:300,y:170,width:44,height:40,fill:'var(--bg)'},svg);
    const sheetG=el('g',{},svg);
    const sheet=el('rect',{x:120,y:158,width:420,height:12,fill:'var(--sheet)'},sheetG);
    const holes=[];
    const punch=el('g',{},svg);
    el('rect',{x:302,y:20,width:40,height:110,fill:'var(--tool-2)',rx:3},punch);
    el('rect',{x:294,y:10,width:56,height:14,fill:'var(--tool)',rx:2},punch);
    text(svg,360,50,'パンチ',{size:13,bold:1}); text(svg,360,200,'ダイ',{size:13,bold:1,fill:'#fff'});
    text(svg,60,250,'クリアランス = (ダイ穴幅 − パンチ幅)/2 ≒ 板厚の5〜10%(片側・軟鋼の目安)',{size:12,fill:'var(--muted)'});
    const status=text(svg,60,275,'',{size:12,bold:1,fill:'var(--primary)'});
    const slug=el('rect',{x:302,y:158,width:40,height:12,fill:'var(--sheet)'},svg); slug.style.display='none';
    let lastHit=-1;
    return loop(t=>{
      const cyc=t%1.2, hit=Math.floor(t/1.2);
      const stroke = cyc<.35 ? ease(cyc/.35) : cyc<.5 ? 1 : 1-ease((cyc-.5)/.7);
      punch.setAttribute('transform',`translate(0,${stroke*45})`);
      const shift=(hit%8)*30-120; sheetG.setAttribute('transform',`translate(${-shift},0)`);
      if(hit!==lastHit){ lastHit=hit; if(hit%8===0){holes.forEach(h=>h.remove()); holes.length=0;} }
      if(stroke>=1 && !holes.find(h=>h._hit===hit)){
        const h=el('rect',{x:302+shift,y:158,width:40,height:12,fill:'var(--bg)'},sheetG); h._hit=hit; holes.push(h);
      }
      const drop = cyc>.5 ? (cyc-.5)*140 : 0;
      slug.style.display=(cyc>.4&&cyc<1.1)?'block':'none'; slug.setAttribute('transform',`translate(0,${drop})`);
      status.textContent=(hit%8===0)?'1打目: 単独打抜き':`追い抜き(ニブリング) ${hit%8+1}打目 → 板を送りながら連続打抜き`;
    });
  };

  /* ---------- 5. 展開図から折り曲げ ---------- */
  A['fold'] = function(c){
    const {svg,ctrl}=frame(c,'展開図(ブランク)→曲げ→完成形状','平らな展開板を曲げるとコの字になります。曲げ部は伸びるため、展開長は外寸の合計より短くなります(曲げ縮み)。',640,300);
    const cx=320, cy=200, T=10, base=200, fl=90;
    let k=0.42, R=10;
    el('line',{x1:40,y1:cy+2,x2:600,y2:cy+2,stroke:'var(--border)'},svg);
    const bs=el('rect',{x:cx-base/2,y:cy-T,width:base,height:T,fill:'var(--sheet)'},svg);
    const lf=el('rect',{x:cx-base/2-fl,y:cy-T,width:fl,height:T,fill:'var(--sheet-dark)'},svg);
    const rf=el('rect',{x:cx+base/2,y:cy-T,width:fl,height:T,fill:'var(--sheet-dark)'},svg);
    const lb=el('line',{x1:cx-base/2,y1:cy-T-6,x2:cx-base/2,y2:cy+6,stroke:'var(--ng)','stroke-dasharray':'3 2'},svg);
    const rb=el('line',{x1:cx+base/2,y1:cy-T-6,x2:cx+base/2,y2:cy+6,stroke:'var(--ng)','stroke-dasharray':'3 2'},svg);
    const dFlat=el('g',{},svg), dBox=el('g',{},svg);
    const lab=text(svg,40,40,'',{size:14,bold:1,fill:'var(--primary)'});
    const lab2=text(svg,40,62,'',{size:12,fill:'var(--muted)'});
    const lab3=text(svg,40,84,'',{size:12,fill:'var(--muted)'});
    const Tmm=1.6, Amm=50, Bmm=30; // 実寸(表示用)
    ctrl.innerHTML=`<label>K値 <input type="range" id="fdK" min="0.3" max="0.5" step="0.01" value="0.42"> <span id="fdKv">0.42</span></label>
      <label>内R(×T) <input type="range" id="fdR" min="0.5" max="3" step="0.1" value="1"> <span id="fdRv">1.0T</span></label>`;
    ctrl.querySelector('#fdK').oninput=e=>{k=+e.target.value;ctrl.querySelector('#fdKv').textContent=k.toFixed(2);};
    ctrl.querySelector('#fdR').oninput=e=>{R=+e.target.value*10;ctrl.querySelector('#fdRv').textContent=(+e.target.value).toFixed(1)+'T';};
    return loop(t=>{
      const cyc=t%6; let ang;
      if(cyc<1) ang=0; else if(cyc<3) ang=ease((cyc-1)/2)*90; else if(cyc<4.5) ang=90; else ang=90-ease((cyc-4.5)/1.5)*90;
      lf.setAttribute('transform',`rotate(${ang} ${cx-base/2} ${cy})`);
      rf.setAttribute('transform',`rotate(${-ang} ${cx+base/2} ${cy})`);
      const Rin=R/10*Tmm; const BA=Math.PI/2*(Rin+k*Tmm); const OSSB=Rin+Tmm; const BD=2*OSSB-BA;
      const outerA=Amm, outerB=Bmm; // 外寸
      const flat = outerA + 2*outerB - 2*BD;
      dFlat.innerHTML=''; dBox.innerHTML='';
      if(ang<1){ dim(dFlat,cx-base/2-fl,cy+24,cx+base/2+fl,cy+24,`展開長 L = ${flat.toFixed(2)} mm`,{dy:16,fill:'var(--primary)',size:12});
        lab.textContent='① 展開図(ブランク)  例: T=1.6 外寸 A=50, B=30 (両側)';
      } else { lab.textContent= ang<90?'② 曲げ加工中(曲げ部の外側は伸び、内側は縮む)':'③ 完成: 外寸で寸法を測る';
        if(ang>=89){ dim(dBox,cx-base/2-T,cy+24,cx+base/2+T,cy+24,`A = ${outerA} (外寸)`,{dy:16,size:12}); dim(dBox,cx+base/2+T+16,cy,cx+base/2+T+16,cy-fl,`B = ${outerB}`,{dx:26,dy:4,size:12}); }
      }
      lab2.textContent=`曲げ伸び BA = π/2 × (R + K×T) = ${BA.toFixed(3)} mm   (R=${Rin.toFixed(2)}, K=${k.toFixed(2)})`;
      lab3.textContent=`曲げ縮み BD = 2(R+T) − BA = ${BD.toFixed(3)} mm  →  L = A + 2B − 2BD = ${flat.toFixed(2)} mm`;
    });
  };

  /* ---------- 6. スポット溶接 ---------- */
  A['spot-weld'] = function(c){
    const {svg}=frame(c,'スポット溶接(抵抗溶接)','上下の電極で板を加圧し、大電流を流して接触抵抗の発熱で溶融部(ナゲット)を作ります。加圧→通電→保持→開放のサイクルです。',640,280);
    const cx=320, cy=150;
    const up=el('g',{},svg); el('path',{d:`M${cx-18} 0 L${cx+18} 0 L${cx+18} 80 L${cx+7} 108 L${cx-7} 108 L${cx-7-0} 108 L${cx-18} 80 Z`,fill:'#b87333'},up);
    const dn=el('g',{},svg); el('path',{d:`M${cx-18} 280 L${cx+18} 280 L${cx+18} 200 L${cx+7} 172 L${cx-7} 172 L${cx-18} 200 Z`,fill:'#b87333'},dn);
    const s1=el('rect',{x:120,y:cy-12,width:400,height:12,fill:'var(--sheet)'},svg);
    const s2=el('rect',{x:120,y:cy,width:400,height:12,fill:'var(--sheet-dark)'},svg);
    const nug=el('ellipse',{cx:cx,cy:cy,rx:0,ry:0,fill:'#ff6a00',opacity:.9},svg);
    const cur=el('g',{},svg); for(let i=0;i<3;i++) el('path',{d:`M${cx-30+i*30} 20 l6 12 l-8 6 l6 14`,stroke:'#ffd400','stroke-width':2,fill:'none'},cur);
    const lab=text(svg,20,270,'',{size:14,bold:1,fill:'var(--primary)'});
    text(svg,cx+40,80,'電極(銅合金)',{size:12}); text(svg,cx+40,cy+40,'ナゲット(溶融凝固部)',{size:12,fill:'#ff6a00'});
    return loop(t=>{
      const cyc=t%5; let sq,I,nr,msg;
      if(cyc<1){sq=ease(cyc);I=0;nr=0;msg='① 加圧: 電極で板を密着させる';}
      else if(cyc<2.2){sq=1;I=1;nr=ease((cyc-1)/1.2);msg='② 通電: 接触抵抗で発熱 → 溶融(ナゲット生成)';}
      else if(cyc<3.2){sq=1;I=0;nr=1;msg='③ 保持: 加圧のまま冷却・凝固';}
      else {sq=1-ease(Math.min(1,(cyc-3.2)/.8));I=0;nr=1;msg='④ 開放: 次の打点へ';}
      up.setAttribute('transform',`translate(0,${-40+sq*40+ (cy-12-108)})`); dn.setAttribute('transform',`translate(0,${40-sq*40+(cy+12-172)})`);
      nug.setAttribute('rx',nr*22); nug.setAttribute('ry',nr*9); nug.setAttribute('fill', cyc<2.2?'#ff6a00':'#c98a5a');
      cur.style.opacity=I? (.5+.5*Math.sin(t*30)):0;
      lab.textContent=msg;
    });
  };

  /* ---------- 7. 工程フロー ---------- */
  A['flow'] = function(c){
    const {svg}=frame(c,'精密板金の工程フロー','受注から出荷まで。各工程の品質が次工程に影響するため、前工程での作り込みが重要です。',640,140);
    const steps=['図面/設計','展開/NEST','ブランク','バリ取り','曲げ','溶接','表面処理','検査','出荷'];
    const w=64, gap=6, x0=8; const nodes=[];
    steps.forEach((s,i)=>{ const x=x0+i*(w+gap); const g=el('g',{},svg); const r=el('rect',{x,y:40,width:w,height:50,rx:8,fill:'var(--surface-2)',stroke:'var(--border)'},g); const tx=text(g,x+w/2,70,s,{size:11,anchor:'middle',bold:1}); if(i<steps.length-1) text(svg,x+w+gap/2,70,'›',{size:14,anchor:'middle',fill:'var(--muted)'}); nodes.push({r,tx}); });
    const cap=text(svg,320,120,'',{size:12,anchor:'middle',fill:'var(--muted)'});
    const caps=['お客様図面を読み解きDFM検討','伸び値を加味した展開図・ネスティング','レーザー/タレパンで外形・穴を加工','切断バリを除去し安全・精度確保','プレスブレーキで曲げ(角度・寸法)','TIG/スポット/半自動で接合・仕上げ','メッキ・塗装・アルマイト等','寸法・外観・機能を検査','梱包・出荷'];
    return loop(t=>{ const i=Math.floor(t/1.4)%steps.length; nodes.forEach((n,j)=>{ n.r.setAttribute('fill', j===i?'var(--primary)':'var(--surface-2)'); n.tx.setAttribute('fill', j===i?'#fff':'var(--text)'); }); cap.textContent=caps[i]; });
  };

  /* ---------- 8. 中立軸とK値 ---------- */
  A['neutral-axis'] = function(c){
    const {svg,ctrl}=frame(c,'曲げ部の中立軸とK値(Kファクタ)','曲げると外側は伸び、内側は縮みます。伸びも縮みもしない層が「中立軸」。内側からの位置 t を板厚 T で割った値がK値です。中立軸の長さが曲げ部の展開長になります。',640,300);
    let k=0.42; const T=60, R=50, cx=180, cy=250;
    const g=el('g',{},svg);
    function draw(){
      g.innerHTML='';
      const Ro=R+T;
      el('path',{d:`M${cx} ${cy-R} A${R} ${R} 0 0 1 ${cx+R} ${cy} L${cx+Ro} ${cy} A${Ro} ${Ro} 0 0 0 ${cx} ${cy-Ro} Z`,fill:'var(--sheet)'},g);
      el('rect',{x:cx-140,y:cy-Ro,width:140,height:T,fill:'var(--sheet)'},g);
      el('rect',{x:cx+R,y:cy,width:T,height:40,fill:'var(--sheet)'},g);
      const Rn=R+k*T;
      el('path',{d:`M${cx-140} ${cy-Rn} L${cx} ${cy-Rn} A${Rn} ${Rn} 0 0 1 ${cx+Rn} ${cy} L${cx+Rn} ${cy+40}`,fill:'none',stroke:'var(--ng)','stroke-width':2,'stroke-dasharray':'6 3'},g);
      // 伸び縮み矢印
      text(g,cx-120,cy-Ro-8,'外側: 引張(伸びる) →',{size:11,fill:'var(--primary)'});
      text(g,cx-120,cy-R+16,'内側: 圧縮(縮む)',{size:11,fill:'var(--warn)'});
      text(g,cx-135,cy-Rn-4,'中立軸(長さ不変)',{size:11,fill:'var(--ng)',bold:1});
      dim(g,cx-60,cy-Ro,cx-60,cy-R,'T',{dx:-12,dy:4});
      dim(g,cx-30,cy-Rn,cx-30,cy-R,`t=K×T`,{dx:-28,dy:4,fill:'var(--ng)'});
      dim(g,cx,cy,cx+R,cy,'内R',{dy:16});
      text(svg,340,60,`K = t / T = ${k.toFixed(2)}`,{size:18,bold:1,fill:'var(--primary)'});
      text(svg,340,90,`展開長(曲げ部) = (π/2)×(R + K×T)`,{size:13});
      text(svg,340,116,`・K が小さい → 中立軸が内側 (きつい曲げ、小R)`,{size:11.5,fill:'var(--muted)'});
      text(svg,340,136,`・K が大きい → 中立軸が中央寄り (大R、緩い曲げ)`,{size:11.5,fill:'var(--muted)'});
      text(svg,340,156,`・上限は0.5(板厚中央)。実務では0.3〜0.5`,{size:11.5,fill:'var(--muted)'});
      text(svg,340,184,`目安: R<T → 0.33 / R≈T〜2T → 0.40〜0.45`,{size:11.5,fill:'var(--muted)'});
      text(svg,340,204,`      R>2T → 0.50 (板厚中央)`,{size:11.5,fill:'var(--muted)'});
    }
    draw();
    ctrl.innerHTML=`<label>K値 <input type="range" id="naK" min="0.25" max="0.5" step="0.01" value="0.42"> <span id="naKv">0.42</span></label>`;
    ctrl.querySelector('#naK').oninput=e=>{k=+e.target.value;ctrl.querySelector('#naKv').textContent=k.toFixed(2);svg.querySelectorAll('text').forEach(t=>{if(+t.getAttribute('x')===340)t.remove();});draw();};
    return ()=>{};
  };

  /* ---------- 9. バーリング ---------- */
  A['burring'] = function(c){
    const {svg}=frame(c,'バーリング加工(タップ下穴の立ち上げ)','薄板に直接タップを立てるとねじ山が足りません。下穴の周囲を筒状に立ち上げて有効ねじ長さを確保するのがバーリングです。',640,260);
    const cy=160, cx=320;
    el('rect',{x:120,y:cy+10,width:400,height:50,fill:'var(--tool)'},svg); el('rect',{x:cx-34,y:cy+10,width:68,height:50,fill:'var(--bg)'},svg);
    const L=el('path',{fill:'var(--sheet)'},svg), Rr=el('path',{fill:'var(--sheet)'},svg);
    const punch=el('g',{},svg); el('path',{d:`M${cx-14} 0 L${cx+14} 0 L${cx+14} 60 L${cx+28} 74 L${cx+28} 120 L${cx-28} 120 L${cx-28} 74 L${cx-14} 60 Z`,fill:'var(--tool-2)'},punch);
    const lab=text(svg,40,40,'',{size:14,bold:1,fill:'var(--primary)'});
    text(svg,40,240,'バーリング高さの目安: 板厚の1.5〜2倍程度。下穴径は展開計算(体積一定)で決めます。',{size:11.5,fill:'var(--muted)'});
    return loop(t=>{
      const cyc=t%4; const p= cyc<1.5? ease(cyc/1.5) : cyc<2.5? 1 : 1-ease((cyc-2.5)/1.5);
      const h=p*34, hole=20+p*10; // 立ち上がり高さ
      L.setAttribute('d',`M120 ${cy} L${cx-hole-14} ${cy} Q${cx-hole} ${cy} ${cx-hole} ${cy+8} L${cx-hole} ${cy+8+h} L${cx-hole-10} ${cy+8+h} L${cx-hole-10} ${cy+12} Q${cx-hole-10} ${cy+10} ${cx-hole-14} ${cy+10} L120 ${cy+10} Z`);
      Rr.setAttribute('d',`M520 ${cy} L${cx+hole+14} ${cy} Q${cx+hole} ${cy} ${cx+hole} ${cy+8} L${cx+hole} ${cy+8+h} L${cx+hole+10} ${cy+8+h} L${cx+hole+10} ${cy+12} Q${cx+hole+10} ${cy+10} ${cx+hole+14} ${cy+10} L520 ${cy+10} Z`);
      punch.setAttribute('transform',`translate(0,${cy-120-80+p*80+8})`);
      lab.textContent= p<.05?'① 下穴(小さめ)を開けた板':p<1?'② パンチで穴の周囲を押し広げる':'③ 筒状のフランジが立ち上がり、ねじ山を確保';
    });
  };

  /* ---------- 10. ヘミング(アール潰し) ---------- */
  A['hemming'] = function(c){
    const {svg}=frame(c,'ヘミング曲げ(アール潰し)','①約30°のV曲げで鋭角に曲げ → ②平らな金型で潰して密着させます。エッジの安全性向上・補強・見栄え向上に使います。',640,240);
    const cx=320, cy=180;
    el('rect',{x:60,y:cy,width:520,height:14,fill:'var(--tool)'},svg);
    const base=el('rect',{x:cx-200,y:cy-10,width:200,height:10,fill:'var(--sheet)'},svg);
    const fl=el('rect',{x:cx,y:cy-10,width:120,height:10,fill:'var(--sheet-dark)'},svg);
    const press=el('rect',{x:80,y:20,width:480,height:20,fill:'var(--tool-2)',rx:2},svg);
    const lab=text(svg,40,70,'',{size:14,bold:1,fill:'var(--primary)'});
    return loop(t=>{
      const cyc=t%6; let ang,py,msg;
      if(cyc<2){ang=ease(cyc/2)*150;py=0;msg='① 鋭角曲げ(30°Vダイなどで約150°折り返す)';}
      else if(cyc<3){ang=150;py=0;msg='② 潰し金型の下へ移動';}
      else if(cyc<4.5){const p=ease((cyc-3)/1.5);ang=150+p*30;py=p*(cy-60);msg='③ 上型で潰して密着(ヘミング完成)';}
      else {ang=180;py=cy-60;msg='完成: 端面が二重になり安全・高剛性';}
      fl.setAttribute('transform',`rotate(${-ang} ${cx} ${cy-5})`);
      press.setAttribute('transform',`translate(0,${py- (cyc<3?0:0)})`);
      press.style.opacity=cyc<3?.3:1;
      lab.textContent=msg;
    });
  };

  /* ---------- 11. 圧延方向と曲げ割れ ---------- */
  A['grain'] = function(c){
    const {svg}=frame(c,'圧延方向(目)と曲げ割れ','材料には圧延方向(繊維の向き)があります。曲げ線が圧延方向と平行だと割れやすく、直交(90°)させると割れにくくなります。',640,220);
    const draw=(x0,label,parallel,ok)=>{
      const g=el('g',{},svg);
      el('rect',{x:x0,y:40,width:220,height:120,fill:'var(--sheet)',opacity:.6,rx:4},g);
      for(let i=0;i<12;i++){ if(parallel) el('line',{x1:x0+8,y1:48+i*10,x2:x0+212,y2:48+i*10,stroke:'var(--sheet-dark)','stroke-width':1,opacity:.7},g); else el('line',{x1:x0+10+i*18,y1:44,x2:x0+10+i*18,y2:156,stroke:'var(--sheet-dark)','stroke-width':1,opacity:.7},g); }
      const bl=el('line',{x1:x0+8,y1:100,x2:x0+212,y2:100,stroke:'var(--ng)','stroke-width':3,'stroke-dasharray':'10 5'},g);
      text(g,x0+110,185,label,{size:12,anchor:'middle',bold:1,fill:ok?'var(--ok)':'var(--ng)'});
      text(g,x0+110,205,ok?'○ 割れにくい(推奨)':'× 割れやすい(特にアルミ・高張力鋼・厚板)',{size:11,anchor:'middle',fill:ok?'var(--ok)':'var(--ng)'});
      return g;
    };
    draw(40,'曲げ線 ∥ 圧延方向',true,false); draw(380,'曲げ線 ⊥ 圧延方向',false,true);
    text(svg,320,30,'赤の破線 = 曲げ線、細線 = 圧延方向(目)',{size:11,anchor:'middle',fill:'var(--muted)'});
    const crack=el('path',{d:'M120 100 l8 -6 l6 8 l7 -7 l8 9 l7 -5',stroke:'#000',fill:'none','stroke-width':1.5},svg);
    return loop(t=>{ crack.style.opacity=.4+.6*Math.abs(Math.sin(t*2)); });
  };

  /* ---------- 12. 穴と曲げの距離 ---------- */
  A['hole-bend'] = function(c){
    const {svg,ctrl}=frame(c,'穴と曲げ線の距離(穴の変形)','曲げ部に近い穴は曲げ時に引き伸ばされて変形します。目安は「曲げ内側の面から 2T + R 以上」(できれば3T以上)離すことです。',640,220);
    let d=1.0; const cx=320, cy=160;
    el('rect',{x:60,y:cy,width:520,height:12,fill:'var(--tool)'},svg);
    const base=el('rect',{x:120,y:cy-10,width:200,height:10,fill:'var(--sheet)'},svg);
    const fl=el('g',{},svg);
    const flr=el('rect',{x:cx,y:cy-10,width:150,height:10,fill:'var(--sheet)'},fl);
    const top=el('g',{},svg); // 上面図
    const lab=text(svg,40,28,'',{size:14,bold:1});
    ctrl.innerHTML=`<label>穴〜曲げ距離 (×T) <input type="range" id="hbD" min="0.5" max="4" step="0.1" value="1"> <span id="hbDv">1.0T</span></label>`;
    ctrl.querySelector('#hbD').oninput=e=>{d=+e.target.value;ctrl.querySelector('#hbDv').textContent=d.toFixed(1)+'T';};
    return loop(t=>{
      const cyc=t%4; const ang= cyc<1.5?ease(cyc/1.5)*90: cyc<3?90:90-ease((cyc-3)/1)*90;
      fl.setAttribute('transform',`rotate(${-ang} ${cx} ${cy-5})`);
      top.innerHTML='';
      const px=cx+20+d*22; const ok=d>=2.0; const stretch=ok?0:(2.0-d)/2.0*ang/90;
      el('rect',{x:cx-160,y:60,width:320,height:60,fill:'var(--sheet)',opacity:.5},top);
      el('line',{x1:cx,y1:56,x2:cx,y2:124,stroke:'var(--ng)','stroke-dasharray':'6 3','stroke-width':2},top);
      el('ellipse',{cx:px,cy:90,rx:10+stretch*10,ry:10-stretch*3,fill:ok?'var(--ok-soft)':'var(--ng-soft)',stroke:ok?'var(--ok)':'var(--ng)','stroke-width':2},top);
      text(top,cx-4,52,'曲げ線',{size:10,anchor:'end',fill:'var(--ng)'});
      dim(top,cx,130,px-10,130,`${d.toFixed(1)}T`,{dy:14,size:11});
      lab.textContent= ok?'○ 距離 ≥ 2T+R: 穴は変形しにくい':'× 距離が近い: 穴が楕円に変形・面が引けます';
      lab.setAttribute('fill',ok?'var(--ok)':'var(--ng)');
    });
  };

  /* ---------- 13. 測定(ノギスで外寸を測る) ---------- */
  A['measure'] = function(c){
    const {svg}=frame(c,'曲げ品の寸法測定(外寸基準)','曲げ品は基本的に外寸で測定します。ノギスのジョウを平行に当て、測定力を一定にします。角度は角度計やスコヤで確認します。',640,240);
    const cx=300, cy=190;
    el('path',{d:`M${cx-120} ${cy} L${cx+120} ${cy} L${cx+120} ${cy-100} L${cx+108} ${cy-100} L${cx+108} ${cy-12} L${cx-108} ${cy-12} L${cx-108} ${cy-100} L${cx-120} ${cy-100} Z`,fill:'var(--sheet)'},svg);
    const cal=el('g',{},svg);
    el('rect',{x:-40,y:-160,width:330,height:16,fill:'var(--tool-2)',rx:2},cal); // 本尺
    el('path',{d:'M-40 -160 L-30 -160 L-30 -20 L-40 -20 Z',fill:'var(--tool)'},cal); // 固定ジョウ
    const slider=el('g',{},cal); el('path',{d:'M0 -168 L40 -168 L40 -140 L10 -140 L10 -20 L0 -20 Z',fill:'var(--tool)'},slider);
    for(let i=0;i<28;i++) el('line',{x1:-20+i*10,y1:-160,x2:-20+i*10,y2:i%5?-155:-150,stroke:'#fff','stroke-width':1},cal);
    const readout=text(svg,40,216,'',{size:14,bold:1,fill:'var(--primary)'});
    text(svg,40,234,'ポイント: ジョウの奥(根元側)で測る・板に対して直角に当てる・数回測って再現性を確認',{size:11.5,fill:'var(--muted)'});
    return loop(t=>{
      const cyc=t%4; const p= cyc<1.5?ease(cyc/1.5): cyc<3?1:1-ease((cyc-3)/1);
      const open=240-p*(240-240); const x=cx-120+30 - 30*0; // 固定
      cal.setAttribute('transform',`translate(${cx-120+40},${cy+ (1-p)*(-60)})`);
      slider.setAttribute('transform',`translate(${240-40 + (1-p)*40},0)`);
      readout.textContent = p>=.99? '読み値: 60.02 mm (図面 60 ±0.2 → 合格)' : '測定中...';
    });
  };

  A.mount = function(root){
    A.unmountAll();
    root.querySelectorAll('[data-anim]').forEach(d=>{ const name=d.getAttribute('data-anim'); if(A[name]){ try{ active.push(A[name](d)); }catch(e){ console.error('anim error',name,e); d.innerHTML='<p style="color:var(--ng)">アニメーションの読み込みに失敗しました: '+name+'</p>'; } } });
  };
  A.unmountAll = function(){ while(active.length){ const s=active.pop(); try{ s&&s(); }catch(e){} } };
  window.SM_ANIM = A;
})();
