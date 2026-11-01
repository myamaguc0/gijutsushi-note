/* 選択科目 通し模試：Ⅱ-1 → Ⅱ-2 → Ⅲ を本番と同じ 3時間30分 で続けて書く */
window.Pages = window.Pages || {};

window.Mock = (() => {
  // 本番の時間配分の目安（分）。合計 210 分
  const PLAN = [
    { kind: 'II-1', label: 'Ⅱ-1', minutes: 30 },
    { kind: 'II-2', label: 'Ⅱ-2', minutes: 60 },
    { kind: 'III', label: 'Ⅲ', minutes: 105 },
  ];
  const REVIEW = 15;
  const TOTAL = PLAN.reduce((a, p) => a + p.minutes, 0) + REVIEW;
  // 着手順。本番は順番自由なので、配点の大きいⅢから書く順も練習できるようにする
  const ORDERS = {
    std: { label: 'Ⅱ-1 → Ⅱ-2 → Ⅲ（出題順）', kinds: ['II-1', 'II-2', 'III'] },
    iii: { label: 'Ⅲ → Ⅱ-1 → Ⅱ-2（Ⅲ先行。Ⅲの分量不足を防ぐ）', kinds: ['III', 'II-1', 'II-2'] },
    iii2: { label: 'Ⅲ → Ⅱ-2 → Ⅱ-1（配点順）', kinds: ['III', 'II-2', 'II-1'] },
  };
  const of = (a) => ({ label: a.planLabel || PLAN.find((p) => p.kind === a.kind)?.label || a.kind, minutes: a.planMinutes || PLAN.find((p) => p.kind === a.kind)?.minutes || 30 });
  // 設問の開始予定時刻（分）：模試の答案セット（着手順）から計算する
  const startAt = (set, i) => set.slice(0, i).reduce((s, a) => s + of(a).minutes, 0);
  return { PLAN, REVIEW, TOTAL, ORDERS, of, startAt };
})();

/* ---------- 模試の準備（問題の選択） ---------- */
Pages.mock = async (view) => {
  const questions = await DB.all('questions');
  const picks = {};
  Mock.PLAN.forEach((p) => { const list = questions.filter((q) => q.kind === p.kind); picks[p.kind] = list[Math.floor(Math.random() * list.length)]?.id || ''; });
  const mocks = (await DB.all('answers')).filter((a) => a.mockId).reduce((m, a) => { (m[a.mockId] = m[a.mockId] || []).push(a); return m; }, {});
  const history = Object.values(mocks).sort((x, y) => (y[0].createdAt || '').localeCompare(x[0].createdAt || ''));

  view.innerHTML = `
    <div class="page-head">
      <div><p class="small"><a href="#/practice">← 論文練習</a></p><h1>選択科目 通し模試</h1>
        <p>Ⅱ-1（1枚）→ Ⅱ-2（2枚）→ Ⅲ（3枚）の6枚を、本番と同じ <b>3時間30分</b> で続けて書きます。途中で休憩せず、最後まで書き切る練習です。</p></div>
    </div>
    <div class="card">
      <h2>時間配分の目安</h2>
      <div class="plan-bar">${Mock.PLAN.map((p) => `<div style="flex:${p.minutes}"><b>${p.label}</b> ${p.minutes}分</div>`).join('')}<div style="flex:${Mock.REVIEW}" class="rev">見直し ${Mock.REVIEW}分</div></div>
      <label class="field" style="margin-top:12px"><span>着手順</span><select id="order">${Object.entries(Mock.ORDERS).map(([k, o]) => `<option value="${k}" ${k === (localStorage.getItem('mock.order') || 'std') ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
        <small>過去の受験ではⅢが時間切れでCになったことがあります。Ⅲ先行で、Ⅲを確実に3枚書き切る練習を月1回入れます。</small></label>
      <ul class="small muted" style="margin:10px 0 0; padding-left:18px">
        <li>各設問とも、最初の5分で骨子（見出しと要点）を作ってから書き始めます。</li>
        <li>目標時間を過ぎたら、<b>未完成でも次の設問に進みます</b>。Ⅲの3枚を白紙に近い状態で終えるのが最悪の結果です。</li>
        <li>配点はⅢが最も大きいので、迷ったらⅢに時間を残します。</li>
      </ul>
    </div>
    <div class="card" id="pick">
      <h2>問題を選ぶ</h2>
      <div class="form-grid">
        ${Mock.PLAN.map((p) => `<label class="field ${p.kind === 'III' ? 'span-2' : ''}"><span>${p.label}（${Exam.FORMATS[p.kind].sheets}枚・${p.minutes}分）</span>
          <select name="${p.kind}">${questions.filter((q) => q.kind === p.kind).map((q) => `<option value="${q.id}" ${q.id === picks[p.kind] ? 'selected' : ''}>${U.esc(q.theme)}</option>`).join('') || '<option value="">（この形式の問題がありません）</option>'}</select></label>`).join('')}
      </div>
      <div class="actions" style="margin-top:14px"><button class="btn btn-primary" id="start">模試を開始する（開始ボタンを押すと時間が進みます）</button></div>
    </div>
    ${history.length ? `<div class="card"><h2>これまでの模試</h2><div class="table-wrap"><table class="table"><thead><tr><th>日付</th><th>Ⅱ-1</th><th>Ⅱ-2</th><th>Ⅲ</th><th class="r">合計時間</th><th></th></tr></thead><tbody>
      ${history.map((set) => { const by = (k) => set.find((a) => a.kind === k); const cell = (k) => { const a = by(k); if (!a) return '—'; const cap = Exam.FORMATS[k].sheets * Exam.ROWS; const r = Exam.rowsUsed(a.text); return `<span class="${r < cap * 0.8 ? 'danger-text' : ''}">${r}/${cap}行</span>${a.score != null ? `<div class="small muted">自己評価${a.score}点</div>` : ''}`; };
        const total = Math.round(set.reduce((s, a) => s + (a.elapsed || 0), 0) / 60);
        return `<tr><td class="nowrap">${U.esc((set[0].createdAt || '').slice(0, 10))}</td><td>${cell('II-1')}</td><td>${cell('II-2')}</td><td>${cell('III')}</td><td class="r nowrap">${total}分</td>
          <td class="nowrap"><a class="btn btn-sm" href="#/mock/${set[0].mockId}">${set.every((a) => a.done) ? '振り返る' : '続きを書く'}</a></td></tr>`; }).join('')}</tbody></table></div></div>` : ''}`;

  view.querySelector('#start').onclick = async () => {
    const sel = U.formData(view.querySelector('#pick'));
    if (Mock.PLAN.some((p) => !sel[p.kind])) return U.toast('すべての形式の問題を選んでください', 'err');
    const mockId = DB.uid();
    const orderKey = view.querySelector('#order').value;
    localStorage.setItem('mock.order', orderKey);
    const kinds = Mock.ORDERS[orderKey].kinds;
    for (const kind of kinds) {
      const p = Mock.PLAN.find((x) => x.kind === kind);
      const q = questions.find((x) => x.id === sel[kind]);
      await DB.put('answers', { qid: q.id, kind: q.kind, theme: q.theme, question: q.text, text: '', memo: '', elapsed: 0, done: false, mockId, mockOrder: kinds.indexOf(kind), planLabel: p.label, planMinutes: p.minutes });
    }
    location.hash = `#/mock/${mockId}`;
  };
};

/* ---------- 模試の実施 ---------- */
Pages.mockRun = async (view, { id }) => {
  const set = (await DB.all('answers')).filter((a) => a.mockId === id).sort((a, b) => a.mockOrder - b.mockOrder);
  if (set.length !== Mock.PLAN.length) { view.innerHTML = '<div class="card empty">模試が見つかりません。<a href="#/mock">通し模試へ</a></div>'; return; }
  if (set.every((a) => a.done)) return mockReview(view, set);

  let cur = set.findIndex((a) => !a.done);
  let running = false, timer = null, lastTick = 0;
  const totalSec = Mock.TOTAL * 60;
  const elapsedAll = () => set.reduce((s, a) => s + (a.elapsed || 0), 0);

  view.innerHTML = `
    <div class="page-head">
      <div><p class="small"><a href="#/mock">← 通し模試</a></p><h1>選択科目 通し模試</h1><p>${set.map((a) => Mock.of(a).label).join(' → ')}・3時間30分</p></div>
      <div class="actions"><button class="btn" id="toggle">▶ 開始</button><button class="btn btn-primary" id="next"></button></div>
    </div>
    <div class="card timer" id="tm">
      <div><div class="small muted">全体の残り時間</div><div class="big-num" id="leftAll"></div></div>
      <div><div class="small muted">この設問の目標まで</div><div class="big-num" id="leftQ"></div></div>
      <div><div class="small muted">使用行数</div><div class="big-num"><span id="rows">0</span><small id="cap"></small></div></div>
      <div style="flex:1; min-width:260px"><div class="small muted">進み具合（赤い線＝予定）</div>
        <div class="plan-bar small" id="pb">${set.map((a, i) => `<div style="flex:${Mock.of(a).minutes}" data-seg="${i}">${Mock.of(a).label}</div>`).join('')}<div style="flex:${Mock.REVIEW}" class="rev">見直し</div><i id="mark"></i></div></div>
    </div>
    <div class="tabs" id="tabs">${set.map((a, i) => `<button data-i="${i}" class="${i === cur ? 'on' : ''}">${Mock.of(a).label}　<span class="small">${U.esc(a.theme)}</span>${a.done ? ' ✓' : ''}</button>`).join('')}</div>
    <div class="answer-layout">
      <div>
        <details class="card q-card" open><summary><b>問題</b></summary><div class="q-text" id="qtext"></div></details>
        <div class="card" style="margin-top:16px"><h2>骨子メモ</h2><textarea id="memo" rows="8" class="input"></textarea></div>
      </div>
      <div class="sheet-col">
        <div class="sheet-wrap"><textarea id="ans" class="sheet" spellcheck="false"></textarea></div>
        <p class="small muted">目標時間を過ぎたら、右上の「次の設問へ」で切り替えます。前の設問に戻って書き足すこともできます（時間は全体で管理します）。</p>
      </div>
    </div>`;

  const $ = (s) => view.querySelector(s);
  const fmt = (sec) => { const s = Math.max(0, Math.round(Math.abs(sec))); return (sec < 0 ? '-' : '') + `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  function load() {
    const a = set[cur];
    const cap = Exam.FORMATS[a.kind].sheets * Exam.ROWS;
    $('#qtext').textContent = a.question;
    $('#memo').value = a.memo || '';
    $('#ans').value = a.text || '';
    $('#ans').style.height = `calc(var(--line) * ${cap} + 2px)`;
    $('#cap').textContent = `/${cap}`;
    $('#next').textContent = cur < set.length - 1 ? `${Mock.of(a).label} を終えて次の設問へ →` : '模試を終了して振り返る';
    view.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === cur));
    update();
  }
  function update() {
    const a = set[cur];
    const all = elapsedAll();
    const cap = Exam.FORMATS[a.kind].sheets * Exam.ROWS;
    const rows = Exam.rowsUsed($('#ans').value);
    $('#rows').textContent = rows;
    $('#rows').parentElement.classList.toggle('danger-text', rows > cap);
    $('#leftAll').textContent = fmt(totalSec - all);
    $('#leftAll').classList.toggle('danger-text', totalSec - all < 600);
    // この設問の目標終了時刻（全体の経過時間ベース）までの残り
    const deadline = (Mock.startAt(set, cur) + Mock.of(a).minutes) * 60;
    $('#leftQ').textContent = fmt(deadline - all);
    $('#leftQ').classList.toggle('danger-text', deadline - all < 300);
    $('#mark').style.left = Math.min(100, (all / totalSec) * 100) + '%';
    view.querySelectorAll('[data-seg]').forEach((el, i) => el.classList.toggle('on', i === cur));
  }
  const save = U.debounce(() => { if (!$('#ans')) return; const a = set[cur]; a.text = $('#ans').value; a.memo = $('#memo').value; DB.put('answers', a); }, 800);
  $('#ans').addEventListener('input', () => { update(); save(); });
  $('#memo').addEventListener('input', save);

  function tick() {
    const now = Date.now();
    set[cur].elapsed += (now - lastTick) / 1000;
    lastTick = now;
    update();
    if (Math.floor(set[cur].elapsed) % 10 === 0) save();
    if (elapsedAll() >= totalSec && running) { U.toast('3時間30分が経過しました。鉛筆を置いてください。', 'err'); }
  }
  $('#toggle').onclick = () => {
    running = !running;
    if (running) { lastTick = Date.now(); timer = setInterval(tick, 500); $('#ans').focus(); } else { clearInterval(timer); save(); }
    $('#toggle').textContent = running ? '⏸ 一時停止' : '▶ 再開';
  };
  function flush() { if (!$('#ans')) return Promise.resolve(); const a = set[cur]; a.text = $('#ans').value; a.memo = $('#memo').value; return DB.put('answers', a); }
  $('#tabs').onclick = async (e) => { const b = e.target.closest('[data-i]'); if (!b) return; await flush(); cur = Number(b.dataset.i); load(); };
  $('#next').onclick = async () => {
    await flush();
    set[cur].done = true;
    await DB.put('answers', set[cur]);
    if (cur < set.length - 1) { cur++; load(); U.toast(`${Mock.of(set[cur]).label} に進みました。まず5分で骨子を作りましょう。`); return; }
    clearInterval(timer);
    for (const a of set) { if (!a.done) { a.done = true; await DB.put('answers', a); } }
    await Log.add('practice', Math.round(elapsedAll() / 60), set.length);
    mockReview(view, set);
  };
  load();
  return () => { clearInterval(timer); flush(); };
};

/* ---------- 模試の振り返り（3本まとめて） ---------- */
async function mockReview(view, set) {
  const cards = await DB.all('cards');
  const total = Math.round(set.reduce((s, a) => s + (a.elapsed || 0), 0) / 60);
  view.innerHTML = `
    <div class="page-head">
      <div><p class="small"><a href="#/mock">← 通し模試</a></p><h1>模試の振り返り</h1><p>合計 ${total}分／${Mock.TOTAL}分</p></div>
    </div>
    <div class="card">
      <h2>時間配分と分量</h2>
      <div class="table-wrap"><table class="table"><thead><tr><th>設問</th><th class="r">目標</th><th class="r">実際</th><th class="r">差</th><th class="r">行数</th><th>判定</th><th></th></tr></thead><tbody>
        ${set.map((a, i) => { const plan = Mock.of(a).minutes; const act = Math.round((a.elapsed || 0) / 60); const cap = Exam.FORMATS[a.kind].sheets * Exam.ROWS; const rows = Exam.rowsUsed(a.text); const fill = rows / cap;
          const verdict = fill < 0.5 ? '<span class="badge badge-red">分量不足（C相当のおそれ）</span>' : fill < 0.8 ? '<span class="badge badge-amber">やや不足</span>' : act > plan + 10 ? '<span class="badge badge-amber">時間超過</span>' : '<span class="badge badge-green">OK</span>';
          return `<tr><td><b>${Mock.of(a).label}</b><div class="small muted">${U.esc(a.theme)}</div></td><td class="r">${plan}分</td><td class="r">${act}分</td><td class="r ${act > plan ? 'danger-text' : ''}">${act - plan >= 0 ? '+' : ''}${act - plan}分</td><td class="r">${rows}/${cap}</td><td>${verdict}</td><td><a class="btn btn-sm" href="#/practice/${a.id}">自動チェック・自己採点</a></td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="small muted" style="margin:10px 0 0">Ⅱ＋Ⅲの合計で60%以上が合格基準です。Ⅲ（3枚）の配点が最も大きいため、Ⅲが「分量不足」なら、Ⅱの出来にかかわらず不合格になりやすい構造です。</p>
    </div>
    <div class="card"><h2>次回への改善</h2>
      <ul class="small" style="padding-left:18px; margin:0">
        <li>時間超過した設問は、<b>骨子を5分で固定し、各見出しの行数を先に決める</b>（例：Ⅲなら課題3つ×7行、解決策18行、リスク12行、まとめ3行）。</li>
        <li>Ⅲが未完なら、次回は<b>Ⅲから着手する</b>順番も試してください（本番で順番は自由です）。</li>
        <li>各設問の自動チェックと自己採点を済ませ、AI添削を受けたうえで、同じ問題を<b>1週間後にもう一度</b>通しで書きます。</li>
      </ul></div>`;
}
