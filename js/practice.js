/* 論文練習：答案用紙（24字×25行）、制限時間とペース表示、自動チェック、AI添削依頼文 */
window.Pages = window.Pages || {};

window.Exam = (() => {
  // 1枚 = 24字 × 25行 = 600字
  const COLS = 24, ROWS = 25;
  const FORMATS = {
    I: { label: '必須科目Ⅰ', sheets: 3, minutes: 120, parts: 4, note: '本番：600字×3枚・2時間' },
    'II-1': { label: '選択科目Ⅱ-1', sheets: 1, minutes: 35, parts: 0, note: '本番はⅡ・Ⅲ合わせて3時間30分（1枚あたり約35分）' },
    'II-2': { label: '選択科目Ⅱ-2', sheets: 2, minutes: 70, parts: 3, note: '本番はⅡ・Ⅲ合わせて3時間30分（1枚あたり約35分）' },
    III: { label: '選択科目Ⅲ', sheets: 3, minutes: 105, parts: 3, note: '本番はⅡ・Ⅲ合わせて3時間30分（1枚あたり約35分）' },
    free: { label: '自由練習', sheets: 1, minutes: 30, parts: 0, note: '枚数と時間を自由に設定' },
  };
  // 答案用紙では英数字は1マスに2文字入れるのが一般的なので、半角は0.5マスで数える
  const cellWidth = (ch) => (/[\x20-\x7E｡-ﾟ]/.test(ch) ? 0.5 : 1);
  function rowsUsed(text) {
    return String(text || '').split('\n').reduce((sum, para) => {
      const w = [...para].reduce((a, ch) => a + cellWidth(ch), 0);
      return sum + Math.max(1, Math.ceil(w / COLS));
    }, 0);
  }
  const charCount = (text) => [...String(text || '').replace(/\n/g, '')].length;

  // 自動チェック。論文の「型」と「書き方」の基本的な抜け漏れを機械的に拾う
  function check(text, kind, cards) {
    const F = FORMATS[kind] || FORMATS.free;
    const rows = rowsUsed(text);
    const capacity = F.sheets * ROWS;
    const items = [];
    const add = (level, title, detail) => items.push({ level, title, detail });

    const fill = rows / capacity;
    if (rows > capacity) add('ng', '答案用紙からはみ出しています', `${rows}行／${capacity}行。本番では枠外は採点されません。`);
    else if (fill < 0.8) add('ng', '分量が不足しています', `${rows}行／${capacity}行（${Math.round(fill * 100)}%）。最終枚の半分以上、できれば8割以上を目安に書きましょう。`);
    else add('ok', '分量は十分です', `${rows}行／${capacity}行（${Math.round(fill * 100)}%）`);

    const desu = (text.match(/です。|ます。|でした。|ました。/g) || []).length;
    const dearu = (text.match(/である。|だ。|する。|した。|ている。|られる。|ない。|れる。/g) || []).length;
    if (desu && dearu) add('ng', '文体が混在しています', `「です・ます」${desu}箇所と「である」${dearu}箇所。技術論文では「である」調に統一するのが一般的です。`);
    else if (desu) add('warn', '「です・ます」調です', '技術論文では「である」調が一般的です。');
    else add('ok', '文体は統一されています', '');

    const vague = ['と思う', 'と思われる', 'かもしれない', '様々な', 'いろいろ', '色々', 'なるべく', 'できるだけ', 'しっかり'];
    const found = vague.filter((w) => text.includes(w));
    if (found.length) add('warn', 'あいまいな表現があります', `「${found.join('」「')}」→ 技術士は「〜すべきである」「〜を行う」と言い切る表現が評価されます。`);
    const tou = (text.match(/等/g) || []).length;
    if (tou > 4) add('warn', '「等」が多すぎます', `${tou}回。具体的に列挙するか、代表例に絞りましょう。`);

    const long = text.split(/[。\n]/).filter((s) => [...s].length > 90);
    if (long.length) add('warn', '一文が長すぎる箇所があります', `${long.length}文が90字超。「${long[0].slice(0, 30)}…」など。読みやすさのため60字前後を目安に分けましょう。`);

    if (F.parts) {
      const heads = [];
      for (let i = 1; i <= F.parts; i++) {
        const z = '０１２３４５６７８９'[i];
        if (new RegExp(`(^|\\n)\\s*([（(]\\s*[${i}${z}]\\s*[)）]|[${i}${z}]\\s*[.．、])`).test(text)) heads.push(i);
      }
      const miss = Array.from({ length: F.parts }, (_, i) => i + 1).filter((i) => !heads.includes(i));
      if (miss.length) add('ng', '設問に対応する見出しが不足しています', `設問 (${miss.join(')(')}) に対応する見出しが見つかりません。「1.」「(1)」のように設問番号と対応させると、採点者が読みやすくなります。`);
      else add('ok', `設問(1)〜(${F.parts})の見出しがそろっています`, '');
    }
    if ((kind === 'I' || kind === 'III') && !/観点/.test(text)) add('ng', '「観点」が明記されていません', '設問(1)では、課題ごとに「〇〇の観点から」と観点を明記することが求められます。');
    if ((kind === 'I' || kind === 'III') && !/リスク/.test(text)) add('warn', '「リスク」の記述が見当たりません', '設問(3)では、解決策を実行しても新たに生じるリスクと、その対策を書きます。');
    if (kind === 'I' && !/倫理/.test(text)) add('warn', '「倫理」の記述が見当たりません', '設問(4)では、技術者倫理と社会の持続可能性の観点を両方書きます。');

    // カードの用語を「（）」「・」「と」で区切った語句ごとに照合する（例：「変圧器の損失と低減策」→「変圧器の損失」「低減策」）
    const terms = new Set();
    (cards || []).forEach((c) => c.term.split(/[（()）・／/、]/).forEach((p) => p.split(/(?<=[^\u3040-\u309F]{2})と(?=[^\u3040-\u309F]{2})/).forEach((w) => {
      w = w.trim().replace(/^と|と$/g, '');
      if (([...w].length >= 3 || /^[A-Z0-9+]{2,}$/.test(w)) && !['低減策', '保守・診断'].includes(w)) terms.add(w);
    })));
    const used = [...terms].filter((w) => text.includes(w));
    add(used.length >= 3 ? 'ok' : 'warn', `専門用語：${used.length}語を使用`, used.length ? used.join('、') : 'キーワードカードの用語を、定義と一緒に盛り込みましょう。');
    return { items, rows, capacity, chars: charCount(text) };
  }

  // 技術士に求められる資質能力（コンピテンシー）に沿った自己採点
  const COMPETENCY = [
    ['専門的学識', '専門用語を正しく使い、原理・数値・規格を根拠に書けているか'],
    ['問題解決', '課題を多面的に抽出し、原因に対応した複数の解決策を示せているか'],
    ['評価', '解決策の効果と、新たに生じるリスク・波及効果を評価できているか'],
    ['マネジメント', '品質・コスト・納期・人員・安全などの制約を踏まえているか（Ⅱ-2）'],
    ['コミュニケーション', '設問に正対し、読み手に伝わる構成・文章になっているか'],
    ['リーダーシップ', '関係者の利害を調整し、合意形成を図る方策を示せているか（Ⅱ-2）'],
    ['技術者倫理', '公益の確保、法令遵守、持続可能性の観点を具体的に書けているか（Ⅰ）'],
  ];

  function aiPrompt(q, ans, kind) {
    const F = FORMATS[kind] || FORMATS.free;
    return `あなたは技術士第二次試験（電気電子部門・電力・エネルギーシステム）の経験豊富な採点者・添削指導者です。
以下の答案を、本試験の採点基準（技術士に求められる資質能力＝コンピテンシー：専門的学識、問題解決、評価、マネジメント、コミュニケーション、リーダーシップ、技術者倫理）に沿って添削してください。

# 出力してほしいこと
1. 総合評価（A：合格水準／B：あと一歩／C：不合格水準）と、その理由
2. 設問ごとの評価：設問に正対しているか、不足している観点
3. 技術的な誤り・あいまいな記述の指摘（該当箇所を引用）
4. 加点につながる具体的な改善案（追加すべきキーワードや、書き換え例）
5. 次に練習すべきポイントを3つ

# 試験形式
${F.label}：600字（24字×25行）×${F.sheets}枚

# 問題
${q}

# 答案
${ans}`;
  }

  return { COLS, ROWS, FORMATS, rowsUsed, charCount, check, COMPETENCY, aiPrompt };
})();

/* ---------- 練習の開始（問題の選択） ---------- */
Pages.practice = async (view) => {
  const questions = (await DB.all('questions')).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const answers = (await DB.all('answers')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  let kind = sessionStorage.getItem('pr.kind') || 'I';

  view.innerHTML = `
    <div class="page-head">
      <div><h1>論文練習</h1><p>本番と同じ答案用紙（24字×25行）と制限時間で練習し、書き終えたら自動チェックと添削依頼文で振り返ります。</p></div>
      <div class="actions"><button class="btn" id="addQ">＋ 問題を追加</button><a class="btn btn-primary" href="#/mock">⏱ 選択科目 通し模試（3時間30分）</a></div>
    </div>
    <div class="card">
      <div class="toolbar"><div class="seg" id="seg">${Object.entries(Exam.FORMATS).filter(([k]) => k !== 'free').map(([k, f]) => `<button data-k="${k}">${f.label}</button>`).join('')}</div>
        <span class="small muted" id="note" style="align-self:center"></span></div>
      <div id="qs"></div>
    </div>
    <div class="card">
      <h2>これまでの答案</h2>
      ${answers.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>日付</th><th>形式</th><th>テーマ</th><th class="r">行数</th><th class="r">時間</th><th>状態</th></tr></thead><tbody>
        ${answers.map((a) => `<tr class="clickable" data-a="${a.id}"><td class="nowrap">${U.esc((a.updatedAt || '').slice(0, 10))}</td><td class="nowrap">${U.esc(Exam.FORMATS[a.kind]?.label || '')}</td><td>${U.esc(a.theme)}</td>
          <td class="r">${Exam.rowsUsed(a.text)}/${(Exam.FORMATS[a.kind]?.sheets || 1) * Exam.ROWS}</td><td class="r nowrap">${a.elapsed ? Math.round(a.elapsed / 60) + '分' : '—'}</td>
          <td>${a.done ? `<span class="badge badge-green">提出済${a.score != null ? `・自己評価${a.score}点` : ''}</span>` : '<span class="badge badge-amber">書きかけ</span>'}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted small">まだ答案はありません。上の問題から1つ選んで、まずは時間を計って書いてみましょう。</p>'}
    </div>`;

  const $ = (s) => view.querySelector(s);
  function drawQs() {
    view.querySelectorAll('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.k === kind));
    $('#note').textContent = Exam.FORMATS[kind].note;
    const list = questions.filter((q) => q.kind === kind);
    $('#qs').innerHTML = list.length ? `<ul class="list-plain">${list.map((q) => `<li><div style="flex:1; min-width:0"><b>${U.esc(q.theme)}</b>
      <div class="small muted" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${U.esc(q.text.split('\n')[0])}</div></div>
      <span class="actions"><button class="btn btn-sm btn-ghost" data-edit="${q.id}">編集</button><button class="btn btn-sm btn-primary" data-start="${q.id}">この問題で練習</button></span></li>`).join('')}</ul>`
      : '<p class="muted small">この形式の問題はありません。「＋ 問題を追加」から過去問や予想問題を登録してください。</p>';
  }
  $('#seg').onclick = (e) => { if (e.target.dataset.k) { kind = e.target.dataset.k; sessionStorage.setItem('pr.kind', kind); drawQs(); } };
  $('#qs').onclick = async (e) => {
    const st = e.target.closest('[data-start]');
    if (st) {
      const q = questions.find((x) => x.id === st.dataset.start);
      const a = await DB.put('answers', { qid: q.id, kind: q.kind, theme: q.theme, question: q.text, text: '', elapsed: 0, done: false });
      location.hash = `#/practice/${a.id}`;
    }
    const ed = e.target.closest('[data-edit]');
    if (ed) editQuestion(questions.find((x) => x.id === ed.dataset.edit));
  };
  view.querySelectorAll('[data-a]').forEach((tr) => (tr.onclick = () => (location.hash = `#/practice/${tr.dataset.a}`)));

  function editQuestion(q) {
    const isNew = !q;
    q = q || { kind, theme: '', text: '' };
    U.modal({
      title: isNew ? '問題を追加' : '問題を編集', wide: true,
      body: `<div class="form-grid" id="qf">
        <label class="field"><span>形式</span><select name="kind">${Object.entries(Exam.FORMATS).map(([k, f]) => `<option value="${k}" ${k === q.kind ? 'selected' : ''}>${f.label}</option>`).join('')}</select></label>
        <label class="field"><span>テーマ（一覧に表示する短い名前）</span><input name="theme" value="${U.esc(q.theme)}" placeholder="例：R6 Ⅱ-1-1 変圧器の損失"></label>
        <label class="field span-2"><span>問題文</span><textarea name="text" rows="10">${U.esc(q.text)}</textarea>
          <small>過去問は日本技術士会のWebサイトで公開されています。個人の学習用に書き写して使いましょう。</small></label></div>
        ${isNew ? '' : '<p style="margin-top:12px"><button class="btn btn-sm btn-ghost danger-text" id="qdel">この問題を削除</button></p>'}`,
      okText: '保存',
      onOk: async (m) => {
        const d = U.formData(m.querySelector('#qf'));
        if (!d.theme || !d.text) { U.toast('テーマと問題文を入力してください', 'err'); return false; }
        await DB.put('questions', Object.assign(q, d));
        sessionStorage.setItem('pr.kind', d.kind);
        Pages.practice(view);
      },
    });
    const del = document.getElementById('qdel');
    if (del) del.onclick = async () => { await DB.remove('questions', q.id); document.querySelector('#modal [data-x]').click(); Pages.practice(view); };
  }
  $('#addQ').onclick = () => editQuestion(null);
  drawQs();
};

/* ---------- 答案の作成（タイマー付き） ---------- */
Pages.answer = async (view, { id }) => {
  const a = await DB.get('answers', id);
  if (!a) { view.innerHTML = '<div class="card empty">答案が見つかりません。<a href="#/practice">論文練習へ</a></div>'; return; }
  if (a.done) return Pages.review(view, { id });
  const F = Exam.FORMATS[a.kind] || Exam.FORMATS.free;
  const limit = (a.minutes || F.minutes) * 60;
  const capacity = F.sheets * Exam.ROWS;
  let running = false, timer = null, lastTick = 0;

  view.innerHTML = `
    <div class="page-head">
      <div><p class="small"><a href="#/practice">← 論文練習</a></p><h1>${U.esc(a.theme)}</h1><p>${F.label}・${F.sheets}枚（${capacity}行）・制限時間 ${limit / 60}分</p></div>
      <div class="actions"><button class="btn" id="toggle">▶ 開始</button><button class="btn btn-primary" id="finish">書き終えた（振り返りへ）</button></div>
    </div>
    <div class="answer-layout">
      <div>
        <details class="card q-card" open><summary><b>問題</b></summary><div class="q-text">${U.esc(a.question)}</div></details>
        <div class="card" style="margin-top:16px">
          <h2>骨子メモ（任意）</h2>
          <textarea id="memo" rows="10" class="input" placeholder="書き始める前に5〜10分で骨子を作るのがおすすめです。\n例）\n1. 課題：①供給力（安定供給の観点）②系統制約（技術の観点）③コスト（経済性の観点）\n2. 最重要課題：② → 解決策：(1)… (2)… (3)…\n3. リスク：… → 対策：…">${U.esc(a.memo || '')}</textarea>
        </div>
      </div>
      <div class="sheet-col">
        <div class="timer card" id="tm">
          <div><div class="small muted">残り時間</div><div class="big-num" id="left"></div></div>
          <div><div class="small muted">使用行数</div><div class="big-num"><span id="rows">0</span><small>/${capacity}</small></div></div>
          <div><div class="small muted">現在</div><div class="big-num"><span id="sheet">1</span><small>枚目</small></div></div>
          <div style="flex:1; min-width:180px"><div class="small muted" id="paceT">ペース</div><div class="pace"><div id="paceBar"></div><i id="paceMark"></i></div></div>
        </div>
        <div class="sheet-wrap"><textarea id="ans" class="sheet" style="height: calc(var(--line) * ${capacity} + 2px)" spellcheck="false" placeholder="ここに答案を書きます。1行24字、25行で1枚です。">${U.esc(a.text)}</textarea></div>
        <p class="small muted">半角英数字は1マスに2文字として数えます。本番の答案用紙と同じく、見出しや段落の改行も1行として数えます。</p>
      </div>
    </div>`;

  const $ = (s) => view.querySelector(s);
  const fmt = (sec) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  function update() {
    const rows = Exam.rowsUsed($('#ans').value);
    $('#rows').textContent = rows;
    $('#rows').parentElement.classList.toggle('danger-text', rows > capacity);
    $('#sheet').textContent = Math.min(F.sheets, Math.floor(Math.max(0, rows - 1) / Exam.ROWS) + 1);
    const left = limit - a.elapsed;
    $('#left').textContent = (left < 0 ? '-' : '') + fmt(Math.abs(left));
    $('#left').classList.toggle('danger-text', left < 300);
    // 時間の経過に対して、書けているべき行数との差を表示（最初の15%は骨子づくりの時間とみなす）
    const plan = Math.max(0, Math.min(1, (a.elapsed / limit - 0.15) / 0.8)) * capacity;
    const diff = Math.round(rows - plan);
    $('#paceT').textContent = a.elapsed ? (diff >= 0 ? `ペース：予定より ${diff}行 先行` : `ペース：予定より ${-diff}行 遅れ`) : 'ペース（開始すると表示）';
    $('#paceT').className = 'small ' + (a.elapsed && diff < -10 ? 'danger-text' : 'muted');
    $('#paceBar').style.width = Math.min(100, (rows / capacity) * 100) + '%';
    $('#paceMark').style.left = (plan / capacity) * 100 + '%';
  }

  const save = U.debounce(() => { if (!$('#ans')) return; a.text = $('#ans').value; a.memo = $('#memo').value; DB.put('answers', a); }, 800);
  $('#ans').addEventListener('input', () => { update(); save(); });
  $('#memo').addEventListener('input', save);

  function tick() {
    const now = Date.now();
    a.elapsed += (now - lastTick) / 1000;
    lastTick = now;
    update();
    if (Math.floor(a.elapsed) % 10 === 0) save();
  }
  $('#toggle').onclick = () => {
    running = !running;
    if (running) { lastTick = Date.now(); timer = setInterval(tick, 500); $('#ans').focus(); }
    else { clearInterval(timer); save(); }
    $('#toggle').textContent = running ? '⏸ 一時停止' : '▶ 再開';
  };
  $('#finish').onclick = async () => {
    clearInterval(timer);
    a.text = $('#ans').value; a.memo = $('#memo').value; a.done = true;
    await DB.put('answers', a);
    await Log.add('practice', Math.round(a.elapsed / 60), 1);
    location.hash = `#/practice/${a.id}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  update();
  return () => { clearInterval(timer); if (!a.done && $('#ans')) { a.text = $('#ans').value; DB.put('answers', a); } };
};

/* ---------- 振り返り（自動チェック・自己採点・AI添削依頼） ---------- */
Pages.review = async (view, { id }) => {
  const a = await DB.get('answers', id);
  const cards = await DB.all('cards');
  const F = Exam.FORMATS[a.kind] || Exam.FORMATS.free;
  const r = Exam.check(a.text, a.kind, cards);
  a.selfScore = a.selfScore || {};
  const icon = { ok: '<span class="badge badge-green">OK</span>', warn: '<span class="badge badge-amber">注意</span>', ng: '<span class="badge badge-red">要改善</span>' };

  view.innerHTML = `
    <div class="page-head">
      <div><p class="small"><a href="${a.mockId ? '#/mock/' + a.mockId : '#/practice'}">← ${a.mockId ? '模試の振り返り' : '論文練習'}</a></p><h1>振り返り：${U.esc(a.theme)}</h1>
        <p>${F.label}・${r.rows}/${r.capacity}行（${r.chars.toLocaleString()}字）・所要時間 ${a.elapsed ? Math.round(a.elapsed / 60) + '分' : '—'}／制限 ${F.minutes}分</p></div>
      <div class="actions"><button class="btn" id="reopen">答案を書き直す</button><button class="btn" id="del">削除</button><button class="btn btn-primary" id="ai">AI添削の依頼文をコピー</button></div>
    </div>
    <div class="grid grid-2" style="align-items:start">
      <div>
        <div class="card"><h2>自動チェック</h2><ul class="list-plain">${r.items.map((it) => `<li style="align-items:flex-start"><div><b>${U.esc(it.title)}</b>${it.detail ? `<div class="small muted">${U.esc(it.detail)}</div>` : ''}</div>${icon[it.level]}</li>`).join('')}</ul>
          <p class="small muted" style="margin:8px 0 0">機械的なチェックです。内容の妥当性は、下の自己採点とAI添削・第三者の添削で確認しましょう。</p></div>
        <div class="card"><h2>自己採点（コンピテンシー）</h2>
          <table class="table"><tbody>${Exam.COMPETENCY.map(([k, hint]) => `<tr><td><b>${k}</b><div class="small muted">${hint}</div></td>
            <td class="nowrap"><div class="seg" data-c="${k}">${[0, 1, 2].map((v) => `<button data-v="${v}" class="${a.selfScore[k] === v ? 'on' : ''}">${['×', '△', '○'][v]}</button>`).join('')}</div></td></tr>`).join('')}</tbody></table>
          <p class="small" id="score"></p>
          <label class="field" style="margin-top:8px"><span>反省・次回への改善点</span><textarea id="note" rows="4" placeholder="例：課題(1)の観点がかぶった。リスクの対策が抽象的。">${U.esc(a.note || '')}</textarea></label>
        </div>
      </div>
      <div>
        <details class="card q-card"><summary><b>問題</b></summary><div class="q-text">${U.esc(a.question)}</div></details>
        <div class="card" style="margin-top:16px"><h2>答案</h2><div class="sheet-view">${U.esc(a.text) || '<span class="muted">（未記入）</span>'}</div></div>
        <div class="card"><h2>添削の受け方</h2>
          <ol class="small" style="padding-left:18px; margin:0">
            <li>「AI添削の依頼文をコピー」を押し、ChatGPT・Claude・Geminiなどに貼り付けます。</li>
            <li>指摘された改善点を「反省・次回への改善点」にメモし、同じ問題をもう一度書きます。</li>
            <li>AIの指摘には誤りが含まれることもあります。技術的な内容は参考書や規程で確認し、可能なら合格者や指導者の添削も受けましょう。</li>
          </ol></div>
      </div>
    </div>`;

  const $ = (s) => view.querySelector(s);
  function drawScore() {
    const vals = Exam.COMPETENCY.map(([k]) => a.selfScore[k]).filter((v) => v != null);
    a.score = vals.length ? Math.round((vals.reduce((x, y) => x + y, 0) / (Exam.COMPETENCY.length * 2)) * 100) : null;
    $('#score').innerHTML = a.score == null ? '<span class="muted">各項目を ×・△・○ で評価してください。</span>' : `自己評価：<b>${a.score}点</b>／100点（6割以上が合格の目安）`;
  }
  view.querySelectorAll('[data-c]').forEach((seg) => (seg.onclick = async (e) => {
    const v = e.target.dataset.v;
    if (v == null) return;
    a.selfScore[seg.dataset.c] = Number(v);
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    drawScore();
    await DB.put('answers', a);
  }));
  $('#note').oninput = U.debounce(() => { a.note = $('#note').value; DB.put('answers', a); }, 500);
  $('#ai').onclick = () => U.copy(Exam.aiPrompt(a.question, a.text, a.kind));
  $('#reopen').onclick = async () => {
    const copy = await DB.put('answers', { qid: a.qid, kind: a.kind, theme: a.theme, question: a.question, text: a.text, memo: a.memo, elapsed: 0, done: false });
    location.hash = `#/practice/${copy.id}`;
  };
  $('#del').onclick = () => U.confirm('答案を削除', 'この答案を削除します。', async () => { await DB.remove('answers', a.id); location.hash = '#/practice'; });
  drawScore();
};
