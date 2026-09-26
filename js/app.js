/* ===== アプリ本体: ルーティング・描画・進捗 ===== */
(function(){
  const C = window.SM_CONTENT;
  const LV = {1:'初級',2:'中級',3:'実務'};
  const $ = s=>document.querySelector(s);
  const main = $('#main');
  const KEY='sm_progress';
  const store = {
    load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } },
    save(p){ try{ localStorage.setItem(KEY, JSON.stringify(p)); }catch(e){} }
  };
  let P = store.load(); P.done=P.done||{}; P.quiz=P.quiz||{}; P.lq=P.lq||{};
  const lessons = []; C.chapters.forEach(ch=>ch.lessons.forEach(l=>lessons.push({ch,l,key:ch.id+'/'+l.id})));
  const esc = s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const strip = h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  const badge = lv=>`<span class="badge lv-${lv}">${LV[lv]}</span>`;
  const doneCount = ()=>lessons.filter(x=>P.done[x.key]).length;
  const pct = ()=>Math.round(doneCount()/lessons.length*100);
  const DIS = `<aside class="disclaimer"><b class="dt">免責事項</b>
<p>本サイトは<b>仮公開中</b>の学習用教材です。掲載する数値(伸び値・K値・V幅・公差・トン数・板厚など)は一般的な代表値・目安であり、設備・金型・材料ロット・図面指示によって異なります。実際の設計・加工・検査では、<b>自社の基準書・伸び値表・作業手順書および JIS 等の規格原本</b>を必ずご確認ください。作業安全は労働安全衛生法および自社の安全基準に従ってください。内容の正確性・完全性を保証するものではなく、本サイトの利用により生じた損害について作成者は責任を負いません。</p>
<p><a href="#/disclaimer">免責事項・ご利用上の注意(全文)を読む</a></p></aside>`;
  const dis = ()=>{ if(!main.querySelector('.disclaimer')) main.insertAdjacentHTML('beforeend', DIS); };

  const shuffle = a=>{ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  const allQuiz = ()=>{ const q=[]; lessons.forEach(x=>(x.l.quiz||[]).forEach(qq=>q.push(Object.assign({ch:x.ch.id,level:x.l.level,src:x.l.title},qq)))); (C.extraQuiz||[]).forEach(qq=>q.push(Object.assign({src:'総合'},qq))); return q; };

  /* ---------- テーマ ---------- */
  function applyTheme(){ let t=null; try{ t=localStorage.getItem('sm_theme'); }catch(e){} if(!t) t = matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'; document.documentElement.setAttribute('data-theme',t); }
  $('#themeBtn').onclick=()=>{ const t=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'; try{ localStorage.setItem('sm_theme',t);}catch(e){} document.documentElement.setAttribute('data-theme',t); };
  applyTheme();

  /* ---------- サイドバー ---------- */
  const sidebar=$('#sidebar'), backdrop=$('#backdrop');
  $('#menuBtn').onclick=()=>{ sidebar.classList.toggle('open'); backdrop.classList.toggle('show'); };
  backdrop.onclick=()=>{ sidebar.classList.remove('open'); backdrop.classList.remove('show'); };
  function renderSidebar(active){
    const nav = [
      `<div class="nav-section"><a class="nav-title" href="#/home"><span class="ico">🏠</span>ホーム</a></div>`,
      ...C.chapters.map(ch=>{ const d=ch.lessons.filter(l=>P.done[ch.id+'/'+l.id]).length; return `<div class="nav-section"><a class="nav-title" href="#/chapter/${ch.id}"><span class="ico">${ch.icon}</span>${ch.title}<span class="cnt">${d}/${ch.lessons.length}</span></a><ul class="nav-lessons">${ch.lessons.map(l=>{ const k=ch.id+'/'+l.id; return `<li><a href="#/lesson/${k}" class="${active===k?'active':''}"><span class="chk ${P.done[k]?'done':''}">${P.done[k]?'✓':''}</span><span>${l.title}</span></a></li>`; }).join('')}</ul></div>`; }),
      `<div class="nav-divider"></div>`,
      `<div class="nav-section"><a class="nav-title ${active==='knowhow'?'active':''}" href="#/knowhow"><span class="ico">💡</span>ノウハウ集<span class="cnt">${C.knowhow.length}</span></a></div>`,
      `<div class="nav-section"><a class="nav-title" href="#/tips"><span class="ico">⭐</span>ワンポイントアドバイス<span class="cnt">${C.tips.length}</span></a></div>`,
      `<div class="nav-section"><a class="nav-title" href="#/sim"><span class="ico">🛠️</span>曲げシミュレーター</a></div>`,
      `<div class="nav-section"><a class="nav-title" href="#/calc"><span class="ico">🧮</span>計算ツール</a></div>`,
      `<div class="nav-section"><a class="nav-title" href="#/quiz"><span class="ico">📝</span>理解度クイズ</a></div>`,
      `<div class="nav-section"><a class="nav-title" href="#/glossary"><span class="ico">📖</span>用語集<span class="cnt">${C.glossary.length}</span></a></div>`,
      `<div class="nav-section"><a class="nav-title" href="#/progress"><span class="ico">📊</span>学習進捗</a></div>`,
      `<div class="nav-divider"></div>`,
      `<div class="nav-section"><a class="nav-title" href="#/disclaimer"><span class="ico">⚠️</span><span style="font-size:.9rem;font-weight:600">免責事項・ご利用上の注意</span></a></div>`,
    ];
    $('#sidebarInner').innerHTML=nav.join('');
    $('#progressPill').textContent=pct()+'%';
  }

  /* ---------- 検索 ---------- */
  const sb=$('#searchBox'); let st;
  sb.addEventListener('input',()=>{ clearTimeout(st); st=setTimeout(()=>{ const q=sb.value.trim(); if(q.length>=2) location.hash='#/search/'+encodeURIComponent(q); },400); });
  sb.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const q=sb.value.trim(); if(q) location.hash='#/search/'+encodeURIComponent(q); } });

  /* ---------- ビュー ---------- */
  const V = {};

  V.home = ()=>{
    const tip = C.tips[Math.floor(Math.random()*C.tips.length)];
    const best = Object.values(P.quiz).length? Math.max(...Object.values(P.quiz).map(x=>x.best||0)) : null;
    main.innerHTML = `
<div class="hero"><h1>精密板金加工 学習ツール</h1><p>設計 → 加工 → 検査の流れを、アニメーションと計算ツールで体系的に学びます。初心者は「初級」から順に、実務者は気になる章やノウハウ集からどうぞ。</p>
<svg class="hero-svg" viewBox="0 0 220 120"><rect x="20" y="80" width="180" height="16" rx="3" fill="#fff" opacity=".9"/><path d="M60 80 L60 30 L74 30 L74 68 L146 68 L146 30 L160 30 L160 80 Z" fill="#fbbf24"/><circle cx="110" cy="52" r="6" fill="#1f4e8c"/></svg></div>
<div class="stats"><div class="stat"><div class="v">${lessons.length}</div><div class="l">レッスン</div></div><div class="stat"><div class="v">${doneCount()}</div><div class="l">学習完了</div></div><div class="stat"><div class="v">${pct()}%</div><div class="l">進捗</div></div><div class="stat"><div class="v">${best==null?'—':best+'%'}</div><div class="l">クイズ最高点</div></div><div class="stat"><div class="v">${C.knowhow.length+C.tips.length}</div><div class="l">ノウハウ・アドバイス</div></div></div>
<h2>おすすめの学習パス</h2>
<div class="card">
<p><b>${badge(1)} まずここから(初心者)</b></p><div class="path-steps">${lessons.filter(x=>x.l.level===1).map(x=>`<a class="st" href="#/lesson/${x.key}">${x.l.title}</a>`).join('<span class="ar">›</span>')}</div>
<p><b>${badge(2)} 実務の基本(設計者・作業者)</b></p><div class="path-steps">${lessons.filter(x=>x.l.level===2).map(x=>`<a class="st" href="#/lesson/${x.key}">${x.l.title}</a>`).join('<span class="ar">›</span>')}</div>
<p><b>${badge(3)} 実務レベル(改善・品質・DFM)</b></p><div class="path-steps">${lessons.filter(x=>x.l.level===3).map(x=>`<a class="st" href="#/lesson/${x.key}">${x.l.title}</a>`).join('<span class="ar">›</span>')}</div>
</div>
<h2>学習コンテンツ</h2>
<div class="grid">${C.chapters.map(ch=>{ const d=ch.lessons.filter(l=>P.done[ch.id+'/'+l.id]).length; return `<a class="chapter-card" href="#/chapter/${ch.id}"><div class="ico">${ch.icon}</div><h3>${ch.title}</h3><p>${ch.desc}</p><div class="bar"><i style="width:${Math.round(d/ch.lessons.length*100)}%"></i></div><p style="margin-top:4px;font-size:.8rem">${d}/${ch.lessons.length} 完了</p></a>`; }).join('')}
<a class="chapter-card" href="#/knowhow"><div class="ico">💡</div><h3>ノウハウ集</h3><p>現場の困りごと → 原因 → 対策を${C.knowhow.length}件収録。</p></a>
<a class="chapter-card" href="#/tips"><div class="ico">⭐</div><h3>ワンポイントアドバイス</h3><p>覚えておきたいコツ${C.tips.length}件。</p></a>
<a class="chapter-card" href="#/sim"><div class="ico">🛠️</div><h3>曲げシミュレーター</h3><p>断面形状と条件を入力し、成形過程・展開図・荷重・成形可否を試算。</p></a>
<a class="chapter-card" href="#/calc"><div class="ico">🧮</div><h3>計算ツール</h3><p>展開長・曲げトン数・設計ルール・質量・公差・角度誤差。</p></a>
<a class="chapter-card" href="#/quiz"><div class="ico">📝</div><h3>理解度クイズ</h3><p>章別・レベル別のランダム出題で理解度を確認。</p></a>
</div>
<h2>今日のワンポイント</h2>
<div class="tip-card"><div class="n">${tip.cat}</div><div class="t">${esc(tip.t)}</div><div>${esc(tip.d)}</div><p style="margin:8px 0 0"><a href="#/tips">もっと見る →</a></p></div>`;
  };

  V.chapter = (id)=>{
    const ch=C.chapters.find(c=>c.id===id); if(!ch) return V.home();
    main.innerHTML=`<div class="crumb"><a href="#/home">ホーム</a> › ${ch.title}</div><h1>${ch.icon} ${ch.title}</h1><p>${ch.desc}</p>
<div class="grid">${ch.lessons.map((l,i)=>{ const k=ch.id+'/'+l.id; return `<a class="chapter-card" href="#/lesson/${k}"><div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--muted);font-size:.85rem">Lesson ${i+1}</span>${P.done[k]?'<span class="badge" style="background:var(--ok-soft);color:var(--ok)">✓ 完了</span>':''}</div><h3>${l.title}</h3><p>${badge(l.level)} 約${l.minutes}分 ・ クイズ${(l.quiz||[]).length}問</p></a>`; }).join('')}</div>`;
  };

  V.lesson = (cid,lid)=>{
    const idx=lessons.findIndex(x=>x.ch.id===cid&&x.l.id===lid); if(idx<0) return V.home();
    const {ch,l,key}=lessons[idx]; const prev=lessons[idx-1], next=lessons[idx+1];
    main.innerHTML=`<div class="crumb"><a href="#/home">ホーム</a> › <a href="#/chapter/${ch.id}">${ch.title}</a> › ${l.title}</div>
<div class="lesson-head"><h1 style="margin:0">${l.title}</h1>${badge(l.level)}<span class="badge cat">約${l.minutes}分</span>${P.done[key]?'<span class="badge" style="background:var(--ok-soft);color:var(--ok)">✓ 学習済み</span>':''}</div>
<div class="lesson-body">${l.body}</div>
${(l.tips&&l.tips.length)?`<h2>⭐ ワンポイントアドバイス</h2>${l.tips.map(t=>`<div class="callout tip"><b>POINT</b>${esc(t)}</div>`).join('')}`:''}
${(l.quiz&&l.quiz.length)?`<h2>📝 理解度チェック</h2><div id="lq"></div>`:''}
<div class="card" style="text-align:center"><button class="btn ${P.done[key]?'secondary':'ok'}" id="doneBtn">${P.done[key]?'学習済みを取り消す':'✓ このレッスンを学習完了にする'}</button></div>
<div class="lesson-nav">${prev?`<a class="btn secondary" href="#/lesson/${prev.key}">‹ ${prev.l.title}</a>`:'<span></span>'}${next?`<a class="btn" href="#/lesson/${next.key}">${next.l.title} ›</a>`:'<a class="btn" href="#/quiz">総合クイズへ ›</a>'}</div>`;
    if(l.quiz&&l.quiz.length) renderQuiz($('#lq'), l.quiz, (score,total)=>{ P.lq[key]={score,total}; store.save(P); });
    $('#doneBtn').onclick=()=>{ if(P.done[key]) delete P.done[key]; else P.done[key]=Date.now(); store.save(P); renderSidebar(key); V.lesson(cid,lid); dis(); window.scrollTo(0,document.body.scrollHeight); };
    SM_ANIM.mount(main);
  };

  function renderQuiz(box, qs, onDone){
    let answered=0, score=0;
    box.innerHTML = qs.map((q,i)=>`<div class="quiz-q" data-i="${i}"><div class="qtext">Q${i+1}. ${esc(q.q)} ${q.src?`<span class="badge cat">${esc(q.src)}</span>`:''}</div>${q.opts.map((o,j)=>`<div class="opt" data-j="${j}">${esc(o)}</div>`).join('')}<div class="expl"></div></div>`).join('') + `<div class="card" id="qres" style="display:none"></div>`;
    box.querySelectorAll('.quiz-q').forEach(qd=>{
      const i=+qd.dataset.i, q=qs[i];
      qd.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{
        if(qd.classList.contains('answered')) return;
        qd.classList.add('answered'); const j=+o.dataset.j; const ok=j===q.a; if(ok) score++; answered++;
        qd.querySelectorAll('.opt').forEach((oo,jj)=>{ if(jj===q.a) oo.classList.add('correct'); else if(jj===j) oo.classList.add('wrong'); });
        qd.querySelector('.expl').innerHTML=`<b>${ok?'○ 正解!':'× 不正解'}</b> ${esc(q.e||'')}`;
        if(answered===qs.length){ const r=box.querySelector('#qres'); r.style.display='block'; const pc=Math.round(score/qs.length*100); r.innerHTML=`<div class="score">結果: ${score} / ${qs.length} (${pc}%)</div><p>${pc===100?'素晴らしい! 完璧です。':pc>=70?'よく理解できています。間違えた問題の解説を確認しましょう。':'もう一度本文を読み直してから再挑戦してみましょう。'}</p>`; onDone&&onDone(score,qs.length); }
      });
    });
  }

  V.knowhow = (cat)=>{
    const cats=['すべて',...new Set(C.knowhow.map(k=>k.cat))]; cat=cat?decodeURIComponent(cat):'すべて';
    const list=C.knowhow.filter(k=>cat==='すべて'||k.cat===cat);
    main.innerHTML=`<h1>💡 ノウハウ集</h1><p>現場でよくある「困りごと」を <b>症状 → 原因 → 対策</b> の形で整理しました。クリックで展開します。</p>
<div class="filter-bar">${cats.map(c=>`<button class="${c===cat?'active':''}" onclick="location.hash='#/knowhow/${encodeURIComponent(c)}'">${c}</button>`).join('')}</div>
${list.map(k=>`<details class="kh"><summary>${esc(k.title)} <span class="badge cat">${k.cat}</span>${badge(k.level)}</summary><div class="kh-body"><div class="row"><b>困りごと</b><div>${esc(k.problem)}</div></div><div class="row"><b>原因</b><div>${esc(k.cause)}</div></div><div class="row"><b>対策</b><div>${esc(k.action)}</div></div></div></details>`).join('')}`;
  };

  V.tips = (cat)=>{
    const cats=['すべて',...new Set(C.tips.map(k=>k.cat))]; cat=cat?decodeURIComponent(cat):'すべて';
    const list=C.tips.filter(k=>cat==='すべて'||k.cat===cat);
    const tip=list[Math.floor(Math.random()*list.length)];
    main.innerHTML=`<h1>⭐ ワンポイントアドバイス</h1>
<div class="tip-card"><div class="n">ランダム表示 ・ ${tip.cat}</div><div class="t">${esc(tip.t)}</div><div>${esc(tip.d)}</div><p style="margin:8px 0 0"><button class="btn small secondary" onclick="location.hash='#/tips/${encodeURIComponent(cat)}?r='+Math.random()">別のアドバイスを表示</button></p></div>
<div class="filter-bar">${cats.map(c=>`<button class="${c===cat?'active':''}" onclick="location.hash='#/tips/${encodeURIComponent(c)}'">${c}</button>`).join('')}</div>
<ul class="tip-list">${list.map((k,i)=>`<li><span class="badge cat">${k.cat}</span> <span class="t">${esc(k.t)}</span><div style="color:var(--muted);font-size:.92rem">${esc(k.d)}</div></li>`).join('')}</ul>`;
  };

  V.calc = (tab)=>{ SM_CALC.render(main, tab); };

  V.sim = ()=>{ SM_SIM.render(main); };

  V.quiz = (mode)=>{
    const pool=allQuiz();
    if(mode&&mode.startsWith('run')){
      const [,ch,lv,n]=mode.split(':');
      const qs=shuffle(pool.filter(q=>(ch==='all'||q.ch===ch)&&(lv==='all'||String(q.level)===lv))).slice(0,+n||10);
      main.innerHTML=`<h1>📝 理解度クイズ</h1><p>${qs.length}問出題。選択肢をクリックすると即座に正誤と解説が表示されます。</p><div id="qz"></div><p><a class="btn secondary" href="#/quiz">設定に戻る</a></p>`;
      renderQuiz($('#qz'), qs, (s,t)=>{ const k=`${ch}:${lv}`; const pc=Math.round(s/t*100); P.quiz[k]=P.quiz[k]||{best:0,tries:0}; P.quiz[k].tries++; P.quiz[k].best=Math.max(P.quiz[k].best,pc); P.quiz[k].last=pc; store.save(P); });
      return;
    }
    main.innerHTML=`<h1>📝 理解度クイズ</h1><p>各レッスンの問題と総合問題(合計 ${pool.length} 問)からランダム出題します。</p>
<div class="card"><div class="calc-form">
<label>出題範囲<select id="qz_ch"><option value="all">すべての章</option>${C.chapters.map(c=>`<option value="${c.id}">${c.title}</option>`).join('')}</select></label>
<label>レベル<select id="qz_lv"><option value="all">すべて</option><option value="1">初級</option><option value="2">中級</option><option value="3">実務</option></select></label>
<label>問題数<select id="qz_n"><option>5</option><option selected>10</option><option>20</option><option>30</option></select></label>
</div><button class="btn" id="qz_go">クイズを開始</button></div>
<h2>これまでの成績</h2>
${Object.keys(P.quiz).length?`<div class="table-wrap"><table class="lesson-body"><tr><th>範囲</th><th>最高点</th><th>前回</th><th>回数</th></tr>${Object.entries(P.quiz).map(([k,v])=>{ const [ch,lv]=k.split(':'); const chn=ch==='all'?'すべて':(C.chapters.find(c=>c.id===ch)||{}).title; return `<tr><td>${chn} / ${lv==='all'?'全レベル':LV[lv]}</td><td>${v.best}%</td><td>${v.last}%</td><td>${v.tries}</td></tr>`; }).join('')}</table></div>`:'<p style="color:var(--muted)">まだ記録がありません。</p>'}`;
    $('#qz_go').onclick=()=>{ location.hash=`#/quiz/run:${$('#qz_ch').value}:${$('#qz_lv').value}:${$('#qz_n').value}`; };
  };

  V.glossary = ()=>{
    main.innerHTML=`<h1>📖 用語集</h1><p>板金でよく使う用語 ${C.glossary.length} 語。検索ボックスからも探せます。</p><input type="search" id="glf" placeholder="用語を絞り込み" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)"><dl class="gl" id="gll"></dl>`;
    const render=q=>{ q=(q||'').toLowerCase(); $('#gll').innerHTML=C.glossary.filter(g=>!q||(g.t+g.r+g.d).toLowerCase().includes(q)).map(g=>`<dt>${esc(g.t)} ${g.r?`<small style="color:var(--muted);font-weight:400">(${esc(g.r)})</small>`:''}</dt><dd>${esc(g.d)}</dd>`).join('')||'<p>該当なし</p>'; };
    $('#glf').oninput=e=>render(e.target.value); render('');
  };

  V.search = (q)=>{
    q=decodeURIComponent(q||''); const ql=q.toLowerCase(); const hits=[];
    const mark=s=>{ const i=s.toLowerCase().indexOf(ql); if(i<0) return esc(s.slice(0,120)); const a=Math.max(0,i-50); return esc(s.slice(a,i))+'<mark>'+esc(s.slice(i,i+q.length))+'</mark>'+esc(s.slice(i+q.length,i+q.length+80)); };
    lessons.forEach(x=>{ const txt=x.l.title+' '+strip(x.l.body)+' '+(x.l.tips||[]).join(' '); if(txt.toLowerCase().includes(ql)) hits.push({h:`#/lesson/${x.key}`,t:x.l.title,c:x.ch.title,s:mark(txt)}); });
    C.knowhow.forEach(k=>{ const txt=k.title+' '+k.problem+' '+k.cause+' '+k.action; if(txt.toLowerCase().includes(ql)) hits.push({h:`#/knowhow/${encodeURIComponent(k.cat)}`,t:k.title,c:'ノウハウ集',s:mark(txt)}); });
    C.tips.forEach(k=>{ const txt=k.t+' '+k.d; if(txt.toLowerCase().includes(ql)) hits.push({h:`#/tips/${encodeURIComponent(k.cat)}`,t:k.t,c:'ワンポイント',s:mark(txt)}); });
    C.glossary.forEach(g=>{ const txt=g.t+' '+g.r+' '+g.d; if(txt.toLowerCase().includes(ql)) hits.push({h:'#/glossary',t:g.t,c:'用語集',s:mark(txt)}); });
    main.innerHTML=`<h1>🔎 検索: 「${esc(q)}」</h1><p>${hits.length} 件</p>${hits.map(h=>`<a class="search-hit" href="${h.h}"><b>${esc(h.t)}</b> <small>— ${esc(h.c)}</small><div style="font-size:.9rem;color:var(--muted)">…${h.s}…</div></a>`).join('')||'<p>該当するコンテンツがありません。別のキーワードでお試しください。</p>'}`;
  };

  V.progress = ()=>{
    main.innerHTML=`<h1>📊 学習進捗</h1>
<div class="stats"><div class="stat"><div class="v">${pct()}%</div><div class="l">全体進捗</div></div><div class="stat"><div class="v">${doneCount()}/${lessons.length}</div><div class="l">完了レッスン</div></div><div class="stat"><div class="v">${Object.keys(P.lq).length}</div><div class="l">レッスン内クイズ受験</div></div></div>
${C.chapters.map(ch=>`<div class="card"><h3>${ch.icon} ${ch.title}</h3><div class="table-wrap"><table class="lesson-body" style="margin:0"><tr><th>レッスン</th><th>レベル</th><th>状態</th><th>理解度チェック</th></tr>${ch.lessons.map(l=>{ const k=ch.id+'/'+l.id; const q=P.lq[k]; return `<tr><td><a href="#/lesson/${k}">${l.title}</a></td><td>${badge(l.level)}</td><td>${P.done[k]?'<span style="color:var(--ok)">✓ 完了</span>':'<span style="color:var(--muted)">未</span>'}</td><td>${q?`${q.score}/${q.total}`:'—'}</td></tr>`; }).join('')}</table></div></div>`).join('')}
<div class="card"><h3>データ管理</h3><p>進捗はこのブラウザ内(localStorage)に保存されています。</p><button class="btn secondary" id="resetBtn">進捗をリセット</button></div>`;
    $('#resetBtn').onclick=()=>{ if(confirm('学習進捗とクイズ成績をすべて削除します。よろしいですか?')){ P={done:{},quiz:{},lq:{}}; store.save(P); renderSidebar(); V.progress(); dis(); } };
  };

  V.disclaimer = ()=>{
    main.innerHTML=`<div class="crumb"><a href="#/home">ホーム</a> › 免責事項</div>
<h1>⚠️ 免責事項・ご利用上の注意</h1>
<div class="callout warn"><b>本サイトは仮公開中です</b>内容は予告なく変更・修正されることがあります。業務で参照される場合は、必ず自社の基準書・規格原本と併せてご確認ください。</div>
<div class="card dis-page">
<h3>1. 本サイトの位置づけ</h3>
<p>本サイト「精密板金加工 学習ツール」は、精密板金加工の設計・加工・検査に関する一般的な技術知識を、学習目的で体系的にまとめた<b>教材</b>です。特定の企業の作業標準書・技術基準・品質基準を示すものではありません。</p>
<h3>2. 掲載内容について</h3>
<ol>
<li>掲載している数値(伸び値・K値・V幅・最小フランジ・曲げ内R・穴と曲げ線の距離・クリアランス・トン数・公差・膜厚・板厚など)は、<b>一般的な代表値および目安</b>です。実際の値は、機械・金型・材料メーカー・材料ロット・潤滑条件・図面指示によって変動します。</li>
<li>計算ツールの結果は概算です。設計・加工の可否判断は、<b>自社の伸び値表・金型仕様・設備能力</b>に基づいて行ってください。</li>
<li>JIS(日本産業規格)等の規格値を参照している箇所がありますが、規格は改正されることがあります。適用にあたっては<b>必ず最新の規格原本</b>をご確認ください。本サイトは規格原本の代替とはなりません。</li>
<li>材料・金型・薬品等の取り扱いは、各メーカーの技術資料・安全データシート(SDS)の指示が優先されます。</li>
</ol>
<h3>3. 安全に関する注意</h3>
<p>板金加工の現場には、切創・挟まれ・巻き込まれ・感電・アーク光・ヒューム・粉じん・火災などの危険があります。本サイトの安全に関する記述は一般的な注意事項であり、網羅的なものではありません。実作業にあたっては、<b>労働安全衛生法をはじめとする関係法令、所属する事業場の安全衛生規程・作業手順書、および機械メーカーの取扱説明書</b>に従ってください。必要な資格・特別教育を要する作業があります。</p>
<h3>4. 商標・第三者の権利</h3>
<p>本文中に記載されている会社名・製品名・規格名は、各社の商標または登録商標です。本サイトは特定の企業・製品・サービスを推奨するものではありません。</p>
<h3>5. 免責</h3>
<ol>
<li>作成者は、本サイトの内容の正確性・完全性・有用性・特定目的への適合性について、いかなる保証も行いません。</li>
<li>本サイトの情報を利用したこと、または利用できなかったことにより生じた、いかなる損害(寸法不良・不良品の発生・設備の損傷・人身事故・逸失利益等を含みますが、これらに限りません)についても、作成者は一切の責任を負いません。</li>
<li>本サイトの内容は予告なく変更・削除されることがあります。</li>
</ol>
<h3>6. データの取り扱い</h3>
<p>学習進捗およびクイズの成績は、ご利用のブラウザ内(localStorage)にのみ保存されます。外部サーバーへの送信・収集は行っていません。ブラウザのデータを消去すると進捗も削除されます。</p>
<h3>7. お問い合わせ・誤りのご指摘</h3>
<p>内容の誤りや改善のご指摘は、本サイトの公開元リポジトリの Issue 等でお知らせください。仮公開期間中は特に、現場の実情に合わせたご指摘を歓迎します。</p>
</div>
<p style="text-align:center"><a class="btn secondary" href="#/home">ホームに戻る</a></p>`;
  };

  /* ---------- ルーター ---------- */
  function route(){
    SM_ANIM.unmountAll();
    if(window.SM_SIM) SM_SIM.stop();
    const h=(location.hash||'#/home').replace(/^#\/?/,'').split('?')[0]; const p=h.split('/');
    const v=p[0]||'home';
    sidebar.classList.remove('open'); backdrop.classList.remove('show');
    let active=null;
    switch(v){
      case 'chapter': V.chapter(p[1]); break;
      case 'lesson': active=p[1]+'/'+p[2]; V.lesson(p[1],p[2]); break;
      case 'knowhow': active='knowhow'; V.knowhow(p[1]); break;
      case 'tips': V.tips(p[1]); break;
      case 'calc': V.calc(p[1]); break;
      case 'sim': V.sim(); break;
      case 'quiz': V.quiz(p[1]); break;
      case 'glossary': V.glossary(); break;
      case 'search': V.search(p.slice(1).join('/')); break;
      case 'progress': V.progress(); break;
      case 'disclaimer': V.disclaimer(); break;
      default: V.home();
    }
    if(v!=='disclaimer') dis();
    renderSidebar(active);
    if(v!=='tips') window.scrollTo({top:0,left:0,behavior:'instant'});
    document.title = (v==='lesson'&&lessons.find(x=>x.key===active)? lessons.find(x=>x.key===active).l.title+' — ':'') + '精密板金加工 学習ツール';
  }
  window.addEventListener('hashchange',route);
  route();
})();
