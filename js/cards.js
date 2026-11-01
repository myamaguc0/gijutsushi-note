/* キーワード暗記カード：間隔反復（覚えた度合いに応じて次の出題日を延ばす） */
window.Pages = window.Pages || {};

window.Cards = (() => {
  // box（習熟度）ごとの次回出題までの日数
  const INTERVALS = [0, 1, 3, 7, 14, 30, 60];
  const isDue = (c) => !c.due || c.due <= U.ymd();
  function grade(c, g) {
    if (g === 'again') c.box = 1;
    else if (g === 'good') c.box = Math.min(INTERVALS.length - 1, (c.box || 0) + 1);
    else c.box = Math.max(1, c.box || 1);
    c.due = U.addDays(U.ymd(), g === 'again' ? 0 : INTERVALS[c.box]);
    c.reviews = (c.reviews || 0) + 1;
    c.lastReviewed = U.ymd();
    return c;
  }
  const level = (c) => (!c.reviews ? '未学習' : c.box >= 5 ? '定着' : c.box >= 3 ? '習得中' : '要復習');
  const LEVEL_BADGE = { 未学習: '', 要復習: 'badge-red', 習得中: 'badge-amber', 定着: 'badge-green' };
  return { INTERVALS, isDue, grade, level, LEVEL_BADGE };
})();

Pages.cards = async (view) => {
  let cards = await DB.all('cards');
  const cats = [...new Set(cards.map((c) => c.cat))];
  const state = { cat: sessionStorage.getItem('cards.cat') || '', q: '' };

  view.innerHTML = `
    <div class="page-head">
      <div><h1>キーワードカード</h1><p>用語を見て「定義・課題・対策」を言えるか確認します。覚えた度合いに応じて、次に出題する日が自動で決まります。</p></div>
      <div class="actions"><button class="btn" id="add">＋ カードを追加</button><button class="btn btn-primary" id="study">今日の復習を始める</button></div>
    </div>
    <div class="grid grid-4" style="margin-bottom:16px" id="stats"></div>
    <div class="card">
      <div class="toolbar">
        <select class="input" id="cat"><option value="">すべての分類</option>${cats.map((c) => `<option ${c === state.cat ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}</select>
        <input class="input" id="q" placeholder="用語・内容で検索">
      </div>
      <div id="list"></div>
    </div>`;
  const $ = (s) => view.querySelector(s);

  function draw() {
    const due = cards.filter(Cards.isDue).length;
    const count = (lv) => cards.filter((c) => Cards.level(c) === lv).length;
    $('#stats').innerHTML = `
      <div class="card stat"><div class="label">今日の復習</div><div class="value ${due ? 'warn-text' : ''}">${due}枚</div><div class="sub">全${cards.length}枚</div></div>
      <div class="card stat"><div class="label">定着</div><div class="value">${count('定着')}枚</div><div class="sub">2週間以上の間隔で正解</div></div>
      <div class="card stat"><div class="label">習得中・要復習</div><div class="value">${count('習得中') + count('要復習')}枚</div></div>
      <div class="card stat"><div class="label">未学習</div><div class="value">${count('未学習')}枚</div></div>`;
    $('#study').textContent = due ? `今日の復習を始める（${due}枚）` : '今日の復習は完了';
    $('#study').disabled = !due;
    const list = cards.filter((c) => (!state.cat || c.cat === state.cat) && (!state.q || (c.term + c.body).includes(state.q)))
      .sort((a, b) => a.cat.localeCompare(b.cat, 'ja') || a.term.localeCompare(b.term, 'ja'));
    $('#list').innerHTML = list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>分類</th><th>用語</th><th>習熟度</th><th>次回</th></tr></thead><tbody>
      ${list.map((c) => `<tr class="clickable" data-id="${c.id}"><td class="nowrap small">${U.esc(c.cat)}</td><td><b>${U.esc(c.term)}</b></td>
        <td><span class="badge ${Cards.LEVEL_BADGE[Cards.level(c)]}">${Cards.level(c)}</span></td><td class="nowrap small">${c.due ? (Cards.isDue(c) ? '今日' : U.esc(c.due)) : '—'}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">該当するカードはありません。</div>';
  }

  function edit(c) {
    const isNew = !c;
    c = c || { cat: state.cat || cats[0] || '電力・エネルギーシステム', term: '', body: '定義：\n課題：\n対策：', box: 0, due: '', reviews: 0 };
    U.modal({
      title: isNew ? 'カードを追加' : 'カードを編集', wide: true,
      body: `<div class="form-grid" id="cf">
        <label class="field"><span>分類</span><input name="cat" value="${U.esc(c.cat)}" list="catlist"><datalist id="catlist">${cats.map((x) => `<option value="${U.esc(x)}">`).join('')}</datalist></label>
        <label class="field"><span>用語</span><input name="term" value="${U.esc(c.term)}"></label>
        <label class="field span-2"><span>内容（定義・課題・対策など、論文でそのまま使える形で）</span><textarea name="body" rows="9">${U.esc(c.body)}</textarea></label></div>
        ${isNew ? '' : '<p style="margin-top:12px"><button class="btn btn-sm btn-ghost danger-text" id="cdel">このカードを削除</button></p>'}`,
      okText: '保存',
      onOk: async (m) => {
        const d = U.formData(m.querySelector('#cf'));
        if (!d.term) { U.toast('用語を入力してください', 'err'); return false; }
        await DB.put('cards', Object.assign(c, d));
        cards = await DB.all('cards');
        draw();
      },
    });
    const del = document.getElementById('cdel');
    if (del) del.onclick = async () => { await DB.remove('cards', c.id); cards = cards.filter((x) => x.id !== c.id); document.querySelector('#modal [data-x]').click(); draw(); };
  }

  $('#cat').onchange = (e) => { state.cat = e.target.value; sessionStorage.setItem('cards.cat', state.cat); draw(); };
  $('#q').oninput = U.debounce((e) => { state.q = e.target.value.trim(); draw(); });
  $('#list').onclick = (e) => { const tr = e.target.closest('[data-id]'); if (tr) edit(cards.find((c) => c.id === tr.dataset.id)); };
  $('#add').onclick = () => edit(null);
  $('#study').onclick = () => (location.hash = '#/study');
  draw();
};

/* ---------- 復習モード ---------- */
Pages.study = async (view) => {
  const cat = sessionStorage.getItem('cards.cat') || '';
  // 期限の来たカードを、要復習 → 未学習 の順に最大20枚
  const queue = (await DB.all('cards')).filter((c) => Cards.isDue(c) && (!cat || c.cat === cat))
    .sort((a, b) => (b.reviews ? 1 : 0) - (a.reviews ? 1 : 0) || (a.due || '').localeCompare(b.due || '')).slice(0, 20);
  const total = queue.length;
  let done = 0, shown = false;
  const started = Date.now();

  view.innerHTML = `
    <div class="page-head"><div><p class="small"><a href="#/cards">← キーワードカード</a></p><h1>今日の復習</h1>${cat ? `<p>分類：${U.esc(cat)}</p>` : ''}</div>
      <div class="small muted" id="prog"></div></div>
    <div id="stage"></div>`;
  const $ = (s) => view.querySelector(s);

  async function finish() {
    const min = Math.max(1, Math.round((Date.now() - started) / 60000));
    if (done) await Log.add('cards', min, done);
    $('#prog').textContent = '';
    $('#stage').innerHTML = `<div class="card empty"><div class="big">✓</div><p><b>${done}枚</b>の復習が完了しました（約${min}分）。</p>
      <p class="actions" style="justify-content:center"><a class="btn" href="#/cards">カード一覧へ</a><a class="btn btn-primary" href="#/practice">論文を練習する</a></p></div>`;
  }

  function show() {
    const c = queue[0];
    if (!c) return finish();
    shown = false;
    $('#prog').textContent = `${done + 1} / ${total}`;
    $('#stage').innerHTML = `
      <div class="flash card">
        <div class="small muted">${U.esc(c.cat)}・<span class="badge ${Cards.LEVEL_BADGE[Cards.level(c)]}">${Cards.level(c)}</span></div>
        <div class="flash-term">${U.esc(c.term)}</div>
        <p class="muted small" id="hint">定義・課題・対策を、声に出すか頭の中で説明してから「答えを見る」を押します。</p>
        <div class="flash-body" id="body" hidden>${U.esc(c.body)}</div>
        <div class="actions" style="justify-content:center; margin-top:18px" id="btns">
          <button class="btn btn-primary" id="reveal">答えを見る（スペースキー）</button>
        </div>
      </div>`;
    $('#reveal').onclick = reveal;
  }
  function reveal() {
    if (shown) return;
    shown = true;
    $('#body').hidden = false;
    $('#hint').hidden = true;
    $('#btns').innerHTML = `
      <button class="btn" data-g="again">もう一度<br><span class="small muted">1キー</span></button>
      <button class="btn" data-g="hard">あいまい<br><span class="small muted">2キー</span></button>
      <button class="btn btn-primary" data-g="good">覚えた<br><span class="small">3キー</span></button>`;
    $('#btns').onclick = (e) => { const g = e.target.closest('[data-g]')?.dataset.g; if (g) answer(g); };
  }
  async function answer(g) {
    const c = queue.shift();
    await DB.put('cards', Cards.grade(c, g));
    if (g === 'again') queue.push(c); // 今日のうちにもう一度出す
    else done++;
    show();
  }
  const onKey = (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); reveal(); }
    if (shown && ['1', '2', '3'].includes(e.key)) answer({ 1: 'again', 2: 'hard', 3: 'good' }[e.key]);
  };
  document.addEventListener('keydown', onKey);
  show();
  return () => document.removeEventListener('keydown', onKey);
};
