/* ===== 計算ツール ===== */
(function(){
  const MAT = {
    spcc:{name:'SPCC / SECC(軟鋼)', sb:400, rho:7.85, kf:1.0, sbk:1.5, rmin:0.5, holeMin:1.0, clr:'5〜8%'},
    sphc:{name:'SPHC / SS400(熱延鋼)', sb:420, rho:7.85, kf:1.0, sbk:1.5, rmin:1.0, holeMin:1.0, clr:'6〜10%'},
    sus304:{name:'SUS304', sb:600, rho:7.93, kf:1.5, sbk:3.0, rmin:1.0, holeMin:1.5, clr:'7〜12%'},
    sus430:{name:'SUS430', sb:480, rho:7.75, kf:1.2, sbk:2.0, rmin:1.0, holeMin:1.5, clr:'7〜10%'},
    a5052:{name:'A5052-H34(アルミ)', sb:230, rho:2.68, kf:0.6, sbk:2.5, rmin:1.5, holeMin:1.0, clr:'5〜8%'},
    a1050:{name:'A1050(純アルミ)', sb:100, rho:2.71, kf:0.3, sbk:1.5, rmin:1.0, holeMin:1.0, clr:'4〜6%'},
    c2801:{name:'C2801(真鍮)', sb:380, rho:8.5, kf:0.9, sbk:1.5, rmin:0.5, holeMin:1.0, clr:'4〜6%'},
    c1100:{name:'C1100(銅)', sb:250, rho:8.9, kf:0.6, sbk:1.0, rmin:0.5, holeMin:1.0, clr:'4〜6%'},
  };
  const matOptions = sel => Object.keys(MAT).map(k=>`<option value="${k}" ${k===sel?'selected':''}>${MAT[k].name}</option>`).join('');
  const f = (v,d=2)=> (Math.round(v*Math.pow(10,d))/Math.pow(10,d)).toFixed(d);
  const num = (id,dflt)=>{ const v=parseFloat(document.getElementById(id).value); return isNaN(v)?dflt:v; };
  const stdV = T => T<=1.0?6: T<=1.2?8: T<=1.6?10: T<=2.0?12: T<=2.3?16: T<=3.2?20: T<=4.5?32: 40;

  const TABS = [
    {id:'flat', name:'展開長(伸び値/K値)'},
    {id:'tonnage', name:'曲げトン数'},
    {id:'rules', name:'曲げ設計ルール早見'},
    {id:'mass', name:'質量・板取り'},
    {id:'tol', name:'一般公差(JIS B 0405)'},
    {id:'angle', name:'角度誤差→寸法誤差'},
  ];

  const R = {};

  /* --- 展開長 --- */
  R.flat = function(box){
    box.innerHTML = `
<p>曲げ部の伸びをK値で計算し、外寸(または内寸)から展開長を求めます。曲げ角度は「曲げの角度(90°=直角)」で入力。</p>
<div class="calc-form">
<label>板厚 T (mm)<input id="c_T" type="number" step="0.1" value="1.6"></label>
<label>曲げ内R (mm)<input id="c_R" type="number" step="0.1" value="1.6"></label>
<label>曲げ角度 θ (°)<input id="c_ang" type="number" step="1" value="90"></label>
<label>K値<input id="c_K" type="number" step="0.01" value="0.42"></label>
<label>寸法基準<select id="c_mode"><option value="out">外寸(一般的)</option><option value="in">内寸</option></select></label>
<label>形状<select id="c_shape"><option value="2">L字(曲げ1箇所)</option><option value="3">コの字(曲げ2箇所)</option><option value="4">曲げ3箇所</option></select></label>
<label>寸法A (mm)<input id="c_A" type="number" step="0.1" value="50"></label>
<label>寸法B (mm)<input id="c_B" type="number" step="0.1" value="30"></label>
<label>寸法C (mm)<input id="c_C" type="number" step="0.1" value="30"></label>
<label>寸法D (mm)<input id="c_D" type="number" step="0.1" value="20"></label>
</div>
<div class="calc-result" id="c_out"></div>
<div class="callout tip"><b>使い方のヒント</b>Kの目安: R&lt;T → 0.33、R≒T〜2T → 0.40〜0.45、R&gt;2T → 0.5。実務では自社の伸び値表を優先し、このツールは「当たり」を付けるために使ってください。</div>`;
    const svg = document.createElement('div'); svg.className='figure'; box.insertBefore(svg, box.querySelector('.calc-result'));
    const upd = ()=>{
      const T=num('c_T',1), Rr=num('c_R',1), ang=num('c_ang',90), K=num('c_K',0.42), mode=document.getElementById('c_mode').value, n=+document.getElementById('c_shape').value;
      const dims=['c_A','c_B','c_C','c_D'].slice(0,n).map(id=>num(id,0));
      ['c_C','c_D'].forEach((id,i)=>{ document.getElementById(id).parentElement.style.display = (i+2<n)?'':'none'; });
      const th=ang*Math.PI/180; const BA=th*(Rr+K*T); const OSSB=(Rr+T)*Math.tan(th/2); const BD=2*OSSB-BA;
      const bends=n-1; const sum=dims.reduce((a,b)=>a+b,0);
      let L; if(mode==='out') L = sum - BD*bends; else L = sum + (BA - 2*Rr*Math.tan(th/2))*bends;
      const inBA = BA - 2*Rr*Math.tan(th/2);
      document.getElementById('c_out').innerHTML = `<div class="big">展開長 L = ${f(L)} mm</div>
<table><tr><td>曲げ伸び BA (中立軸弧長)</td><td><b>${f(BA,3)}</b> mm</td></tr>
<tr><td>外側セットバック OSSB</td><td>${f(OSSB,3)} mm</td></tr>
<tr><td>曲げ縮み BD (外寸から引く値)</td><td><b>${f(BD,3)}</b> mm / 曲げ1箇所</td></tr>
<tr><td>内寸に足す伸び値</td><td>${f(inBA,3)} mm / 曲げ1箇所</td></tr>
<tr><td>曲げ数</td><td>${bends}</td></tr>
<tr><td>計算式</td><td>${mode==='out'?`L = (${dims.join(' + ')}) − ${f(BD,3)} × ${bends}`:`L = (${dims.join(' + ')}) + ${f(inBA,3)} × ${bends}`}</td></tr></table>`;
      // 図
      const sc = 240/Math.max(1,Math.max(...dims)); const t=Math.max(3,T*sc*0.8);
      let d='', x=40, y=150; const pts=[];
      svg.innerHTML = `<svg viewBox="0 0 640 200"><g fill="none" stroke="var(--primary)" stroke-width="${t}" stroke-linejoin="round">${(()=>{ let s=`M${x} ${y}`; let dir=0; let cx=x, cy=y; dims.forEach((L,i)=>{ const len=L*sc; if(i===0){cx+=len; s+=` L${cx} ${cy}`;} else if(i===1){cy-=len; s+=` L${cx} ${cy}`;} else if(i===2){cx-=len; s+=` L${cx} ${cy}`;} else {cy+=len; s+=` L${cx} ${cy}`;} }); return `<path d="${s}"/>`; })()}</g>
<text x="330" y="40" font-size="12" fill="var(--muted)">${mode==='out'?'外寸':'内寸'}: ${dims.map((v,i)=>'ABCD'[i]+'='+v).join(', ')}  /  θ=${ang}° R=${Rr} T=${T} K=${K}</text>
<text x="330" y="60" font-size="12" fill="var(--muted)">※図は概略(縮尺・Rは正確ではありません)</text></svg>`;
    };
    box.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',upd)); upd();
  };

  /* --- トン数 --- */
  R.tonnage = function(box){
    box.innerHTML = `
<p>エアベンド(V曲げ)の必要荷重の概算。P = 1.33 × σb × L × T² / V。ボトミングは約3〜5倍、コイニングは8倍以上必要です。</p>
<div class="calc-form">
<label>材質<select id="t_mat">${matOptions('spcc')}</select></label>
<label>引張強さ σb (N/mm²)<input id="t_sb" type="number" step="10" value="400"></label>
<label>板厚 T (mm)<input id="t_T" type="number" step="0.1" value="1.6"></label>
<label>曲げ長さ L (mm)<input id="t_L" type="number" step="1" value="1000"></label>
<label>V幅 (mm) <small>空欄で標準(≒6〜8T)</small><input id="t_V" type="number" step="1" placeholder="自動"></label>
<label>機械能力 (tf)<input id="t_cap" type="number" step="1" value="80"></label>
</div>
<div class="calc-result" id="t_out"></div>`;
    const matSel=document.getElementById('t_mat');
    matSel.addEventListener('change',()=>{ document.getElementById('t_sb').value=MAT[matSel.value].sb; upd(); });
    const upd=()=>{
      const m=MAT[matSel.value]; const sb=num('t_sb',400), T=num('t_T',1), L=num('t_L',1000); let V=num('t_V',0); if(!V) V=stdV(T);
      const P=1.33*sb*L*T*T/V/1000; const tf=P/9.80665; const cap=num('t_cap',80);
      const perM = P/L*1000/9.80665;
      const ok = tf<=cap;
      document.getElementById('t_out').innerHTML=`<div class="big">必要荷重 ≒ ${f(P,1)} kN ≒ ${f(tf,1)} tf <span class="badge ${ok?'lv-1':'lv-3'}">${ok?'機械能力内':'機械能力オーバー'}</span></div>
<table><tr><td>使用V幅</td><td>V${V} (${f(V/T,1)}T)</td></tr>
<tr><td>1mあたり荷重</td><td>${f(perM,1)} tf/m</td></tr>
<tr><td>エアベンド時の内R目安</td><td>約 ${f(V/6,1)}〜${f(V/5,1)} mm</td></tr>
<tr><td>最小フランジ目安(外寸)</td><td>約 ${f(V*0.7,1)} mm</td></tr>
<tr><td>ボトミングの目安</td><td>約 ${f(tf*3,0)}〜${f(tf*5,0)} tf</td></tr>
<tr><td>スプリングバック目安(${m.name})</td><td>約 ${m.sbk}°(オーバーベンドで補正)</td></tr></table>
<p style="font-size:.85rem;color:var(--muted);margin:.5em 0 0">※ 材料ロット・金型・潤滑で±20%程度変動します。金型の許容荷重(tf/m)も必ず確認。</p>`;
    };
    box.querySelectorAll('input').forEach(e=>e.addEventListener('input',upd)); upd();
  };

  /* --- ルール早見 --- */
  R.rules = function(box){
    box.innerHTML=`
<p>板厚と材質から、曲げ設計の推奨値を一覧します。設計レビュー・DFMチェックに。</p>
<div class="calc-form">
<label>材質<select id="r_mat">${matOptions('spcc')}</select></label>
<label>板厚 T (mm)<input id="r_T" type="number" step="0.1" value="1.6"></label>
<label>曲げ内R (mm) <small>空欄=板厚</small><input id="r_R" type="number" step="0.1" placeholder="=T"></label>
</div>
<div class="calc-result" id="r_out"></div>`;
    const upd=()=>{
      const m=MAT[document.getElementById('r_mat').value]; const T=num('r_T',1); let Rr=num('r_R',0); if(!Rr) Rr=T;
      const V=stdV(T); const rminT=Math.max(m.rmin*T, 0.3);
      const rows=[
        ['標準V幅', `V${V} (${f(V/T,1)}T) — 6〜8Tが標準`],
        ['エアベンドの自然な内R', `約 ${f(V/6,1)}〜${f(V/5,1)} mm`],
        ['最小曲げ内R(割れ限界の目安)', `${f(rminT,1)} mm (${m.rmin}T)${m.name.includes('アルミ')?' ※圧延方向直交・質別に注意':''}`],
        ['最小フランジ長さ(外寸)', `約 ${f(V*0.7,1)} mm (≒0.7V)`],
        ['穴〜曲げ内面の最小距離', `${f(2*T+Rr,1)} mm (2T+R) / 推奨 ${f(3*T+Rr,1)} mm (3T+R)`],
        ['長穴・角穴〜曲げ内面', `${f(2.5*T+Rr,1)} mm 以上 (2.5T+R)`],
        ['曲げ逃げ 幅 / 深さ', `幅 ≥ ${f(Math.max(T,1),1)} mm / 深さ ≥ ${f(Rr+T,1)} mm (R+T)`],
        ['最小穴径(タレパン / レーザー)', `φ${f(m.holeMin*T,1)} / φ${f(Math.max(0.5*T,1.0),1)} 以上`],
        ['穴〜外形端 / 穴〜穴 の最小距離', `${f(1.5*T,1)}〜${f(2*T,1)} mm / ${f(2*T,1)} mm`],
        ['打抜きクリアランス(片側)', `板厚の ${m.clr} → 約 ${f(T*0.05,2)}〜${f(T*0.1,2)} mm`],
        ['ねじの目安', T>=2.0?'M4以上は直タップ可(M3はt1.6〜)。M5以上はt2.3〜3.2推奨':T>=1.6?'M3直タップ可、M4はバーリング/プレスナット推奨':T>=1.0?'M3〜M4はバーリングタップ、またはプレスナット':'プレスナット推奨(バーリングも要検討)'],
        ['スプリングバック目安', `約 ${m.sbk}°`],
        ['深い箱(4方曲げ)の目安', `箱の高さ ≤ 約100mm(標準パンチ)。それ以上は要相談`],
      ];
      document.getElementById('r_out').innerHTML=`<table>${rows.map(r=>`<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('')}</table><p style="font-size:.85rem;color:var(--muted);margin:.5em 0 0">※ 一般的な目安です。工場の金型・設備により異なります。</p>`;
    };
    box.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',upd)); upd();
  };

  /* --- 質量・板取り --- */
  R.mass = function(box){
    box.innerHTML=`
<p>展開サイズから質量と定尺からの取り数(概算)を計算します。</p>
<div class="calc-form">
<label>材質<select id="m_mat">${matOptions('spcc')}</select></label>
<label>板厚 T (mm)<input id="m_T" type="number" step="0.1" value="1.6"></label>
<label>展開 幅 W (mm)<input id="m_W" type="number" step="1" value="300"></label>
<label>展開 長さ L (mm)<input id="m_L" type="number" step="1" value="460"></label>
<label>穴・切欠きの面積率 (%)<input id="m_hole" type="number" step="1" value="0"></label>
<label>製品数量<input id="m_qty" type="number" step="1" value="100"></label>
<label>定尺<select id="m_sheet"><option value="914,1829">3×6 (914×1829)</option><option value="1219,2438">4×8 (1219×2438)</option><option value="1000,2000">メーター板 (1000×2000)</option><option value="1524,3048">5×10 (1524×3048)</option></select></label>
<label>切りしろ・端材余裕 (mm)<input id="m_kerf" type="number" step="1" value="5"></label>
</div>
<div class="calc-result" id="m_out"></div>`;
    const upd=()=>{
      const m=MAT[document.getElementById('m_mat').value]; const T=num('m_T',1),W=num('m_W',1),L=num('m_L',1),h=num('m_hole',0),qty=num('m_qty',1),k=num('m_kerf',5);
      const [sw,sl]=document.getElementById('m_sheet').value.split(',').map(Number);
      const mass = W*L*T*m.rho/1e6*(1-h/100);
      const n1=Math.floor((sw+k)/(W+k))*Math.floor((sl+k)/(L+k)); const n2=Math.floor((sw+k)/(L+k))*Math.floor((sl+k)/(W+k)); const n=Math.max(n1,n2);
      const sheetMass=sw*sl*T*m.rho/1e6; const yieldPct = n? (n*W*L)/(sw*sl)*100:0; const sheets = n? Math.ceil(qty/n):0;
      document.getElementById('m_out').innerHTML=`<div class="big">1個 ≒ ${f(mass,3)} kg (${qty}個で ${f(mass*qty,1)} kg)</div>
<table><tr><td>定尺1枚からの取り数</td><td><b>${n} 個</b> (${n1>=n2?'W×L向き':'L×W向き(90°回転)'})</td></tr>
<tr><td>歩留まり</td><td>${f(yieldPct,1)} %</td></tr>
<tr><td>必要定尺枚数</td><td>${sheets} 枚 (定尺1枚 ${f(sheetMass,1)} kg)</td></tr>
<tr><td>材料総重量(端材込み)</td><td>${f(sheets*sheetMass,1)} kg</td></tr></table>
<p style="font-size:.85rem;color:var(--muted);margin:.5em 0 0">※ 矩形での単純配置。実際のネスティング(共取り・回転・混載)ではさらに歩留まりが向上します。</p>`;
    };
    box.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',upd)); upd();
  };

  /* --- 一般公差 --- */
  R.tol = function(box){
    const len=[[0.5,3,0.05,0.1,0.2,null],[3,6,0.05,0.1,0.3,0.5],[6,30,0.1,0.2,0.5,1],[30,120,0.15,0.3,0.8,1.5],[120,400,0.2,0.5,1.2,2.5],[400,1000,0.3,0.8,2,4],[1000,2000,0.5,1.2,3,6],[2000,4000,null,2,4,8]];
    const ang=[[0,10,'±1°','±1°','±1°30′','±3°'],[10,50,'±30′','±30′','±1°','±2°'],[50,120,'±20′','±20′','±30′','±1°'],[120,400,'±10′','±10′','±15′','±30′'],[400,1e9,'±5′','±5′','±10′','±20′']];
    box.innerHTML=`
<p>JIS B 0405(普通公差)の長さ・角度の許容差を検索します。板金図面の注記「JIS B 0405-m」が中級です。<b>※数値は規格原本で必ず確認してください。</b></p>
<div class="calc-form">
<label>基準寸法 (mm)<input id="o_L" type="number" step="0.1" value="50"></label>
<label>等級<select id="o_g"><option value="1">f 精級</option><option value="2" selected>m 中級</option><option value="3">c 粗級</option><option value="4">v 極粗級</option></select></label>
<label>角度: 短い方の辺の長さ (mm)<input id="o_A" type="number" step="1" value="40"></label>
</div>
<div class="calc-result" id="o_out"></div>`;
    const upd=()=>{
      const Lv=num('o_L',50), g=+document.getElementById('o_g').value, A=num('o_A',40);
      const row=len.find(r=>Lv>r[0]&&Lv<=r[1]) || (Lv<=0.5?len[0]:null); const t=row?row[1+g]:null;
      const ar=ang.find(r=>A>r[0]&&A<=r[1]) || ang[0]; const at=ar[1+g];
      document.getElementById('o_out').innerHTML=`<div class="big">${row&&t!=null?`長さ ${Lv} mm → ±${t} mm`:'範囲外/規定なし'}</div>
<table><tr><td>角度(短辺 ${A} mm)</td><td><b>${at}</b></td></tr>
<tr><td>寸法区分</td><td>${row?`${row[0]}を超え ${row[1]}以下`:'—'}</td></tr>
<tr><td>板金での注意</td><td>曲げをまたぐ寸法は中級でも厳しい場合あり。溶接組立品は粗級相当が現実的なことも。</td></tr></table>
<h3 style="font-size:1rem;margin-top:12px">長さ寸法の表(mm)</h3>
<div class="table-wrap"><table><tr><th>区分</th><th>f</th><th>m</th><th>c</th><th>v</th></tr>${len.map(r=>`<tr ${row===r?'style="background:var(--accent-soft)"':''}><td>${r[0]}〜${r[1]}</td><td>${r[2]==null?'—':'±'+r[2]}</td><td>±${r[3]}</td><td>±${r[4]}</td><td>${r[5]==null?'—':'±'+r[5]}</td></tr>`).join('')}</table></div>`;
    };
    box.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',upd)); upd();
  };

  /* --- 角度誤差→寸法 --- */
  R.angle = function(box){
    box.innerHTML=`
<p>曲げ角度の誤差がフランジ先端の寸法にどれだけ影響するかを計算します。ΔL ≒ H × tan(Δθ)。</p>
<div class="calc-form">
<label>フランジ高さ H (mm)<input id="a_H" type="number" step="1" value="100"></label>
<label>角度誤差 Δθ (°)<input id="a_d" type="number" step="0.1" value="1"></label>
<label>寸法公差 ± (mm)<input id="a_t" type="number" step="0.05" value="0.3"></label>
</div>
<div class="calc-result" id="a_out"></div>`;
    const upd=()=>{
      const H=num('a_H',100), d=num('a_d',1), t=num('a_t',0.3);
      const dL=H*Math.tan(d*Math.PI/180); const allow=Math.atan(t/H)*180/Math.PI;
      document.getElementById('a_out').innerHTML=`<div class="big">先端の寸法誤差 ≒ ${f(dL,2)} mm</div>
<table><tr><td>公差 ±${t} を守るための角度精度</td><td><b>±${f(allow,2)}°</b> 以内</td></tr>
<tr><td>判定</td><td>${dL<=t?'<span class="badge lv-1">公差内</span>':'<span class="badge lv-3">公差オーバー → 角度を補正</span>'}</td></tr>
<tr><td>ヒント</td><td>長いフランジほど角度がシビア。角度センサ付きベンダーやボトミングで安定化。寸法測定位置(先端/根元)を検査基準で決める。</td></tr></table>`;
    };
    box.querySelectorAll('input').forEach(e=>e.addEventListener('input',upd)); upd();
  };

  window.SM_CALC = {
    TABS,
    render(container, tab){
      tab = TABS.find(t=>t.id===tab)?tab:'flat';
      container.innerHTML = `<h1>🧮 計算ツール</h1><p>設計・加工・検査でよく使う計算をその場で。結果は目安であり、実際の加工条件で検証してください。</p>
<div class="calc-tabs">${TABS.map(t=>`<a class="btn ${t.id===tab?'':'secondary'} small" href="#/calc/${t.id}">${t.name}</a>`).join('')}</div><div class="card" id="calcBox"></div>`;
      R[tab](container.querySelector('#calcBox'));
    }
  };
})();
