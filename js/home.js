/* ホーム：試験日までのカウントダウン、今日のタスク、学習記録（カレンダー） */
window.Pages = window.Pages || {};

window.Log = {
  // 学習記録は日付ごとに1件。種類別の分数・件数を足していく
  async add(kind, minutes, count = 0) {
    const id = 'd' + U.ymd();
    const d = (await DB.get('logs', id)) || { id, date: U.ymd(), minutes: 0, cards: 0, practice: 0, manual: 0 };
    d.minutes += Math.max(0, Number(minutes) || 0);
    if (kind === 'cards') d.cards += count;
    if (kind === 'practice') d.practice += count;
    if (kind === 'manual') d.manual += Number(minutes) || 0;
    return DB.put('logs', d);
  },
  streak(logs) {
    const set = new Set(logs.filter((l) => l.minutes > 0).map((l) => l.date));
    let n = 0, day = U.ymd();
    if (!set.has(day)) day = U.addDays(day, -1); // 今日まだ学習していなくても、昨日までの連続日数は途切れさせない
    while (set.has(day)) { n++; day = U.addDays(day, -1); }
    return n;
  },
};

window.Settings = {
  async get() { return { examDate: '', dailyGoal: 30, ...((await DB.get('settings', 'prefs')) || {}) }; },
  async save(d) { return DB.put('settings', { ...(await this.get()), ...d, id: 'prefs' }); },
};

Pages.home = async (view) => {
  const [s, cards, answers, logs] = await Promise.all([Settings.get(), DB.all('cards'), DB.all('answers'), DB.all('logs')]);
  const due = cards.filter(Cards.isDue).length;
  const days = s.examDate ? U.daysFromToday(s.examDate) : null;
  const done = answers.filter((a) => a.done);
  const today = logs.find((l) => l.date === U.ymd());
  const weekMin = logs.filter((l) => U.daysFromToday(l.date) > -7).reduce((a, l) => a + l.minutes, 0);
  const scored = done.filter((a) => a.score != null).sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
  const lastNotes = done.filter((a) => a.note).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 3);

  view.innerHTML = `
    <div class="page-head">
      <div><h1>技術士二次 合格ノート</h1><p>電気電子部門・発送配変電　${U.jpDate(U.ymd())}</p></div>
      <div class="actions"><button class="btn" id="manual">＋ 学習時間を記録</button><a class="btn btn-primary" href="#/study">今日の復習（${due}枚）</a></div>
    </div>

    <div class="grid grid-4" style="margin-bottom:16px">
      <div class="card stat"><div class="label">試験まで</div>
        ${days == null ? '<div class="value" style="font-size:16px"><a href="#/settings">試験日を設定</a></div><div class="sub">筆記試験は例年7月中旬</div>'
          : `<div class="value ${days <= 30 ? 'danger-text' : ''}">${days < 0 ? '終了' : days + '日'}</div><div class="sub">${U.jpDate(s.examDate)}</div>`}</div>
      <div class="card stat"><div class="label">連続学習</div><div class="value">${Log.streak(logs)}日</div><div class="sub">今日 ${today ? today.minutes : 0}分／目標 ${s.dailyGoal}分</div></div>
      <div class="card stat"><div class="label">直近7日の学習時間</div><div class="value">${Math.floor(weekMin / 60)}時間${weekMin % 60}分</div></div>
      <div class="card stat"><div class="label">書いた答案</div><div class="value">${done.length}本</div><div class="sub">${scored.length ? `直近の自己評価 ${scored[scored.length - 1].score}点` : '自己採点はまだありません'}</div></div>
    </div>

    <div class="grid grid-2" style="align-items:start">
      <div class="card">
        <h2>今日やること</h2>
        <ul class="list-plain">
          <li><span>キーワードカードの復習</span>${due ? `<a class="btn btn-sm btn-primary" href="#/study">${due}枚</a>` : '<span class="badge badge-green">完了</span>'}</li>
          <li><span>論文を1本（Ⅱ-1なら35分）書く</span><a class="btn btn-sm" href="#/practice">練習する</a></li>
          <li><span>週末：Ⅱ＋Ⅲを3時間30分で通して書く</span><a class="btn btn-sm" href="#/mock">通し模試</a></li>
          <li><span>前回の答案の改善点を確認する</span><a class="btn btn-sm" href="#/practice">一覧へ</a></li>
        </ul>
        ${lastNotes.length ? `<h3 style="font-size:13px; margin:16px 0 6px">最近の改善メモ</h3><ul class="list-plain small">${lastNotes.map((a) => `<li style="display:block"><b>${U.esc(a.theme)}</b><div class="muted">${U.esc(a.note)}</div></li>`).join('')}</ul>` : ''}
      </div>
      <div class="card">
        <div class="card-head"><h2>学習カレンダー（直近16週）</h2><span class="small muted">色が濃いほど学習時間が長い日</span></div>
        <div class="heat" id="heat"></div>
        <div class="small muted" style="margin-top:8px">論文練習とカードの復習は自動で記録されます。参考書を読んだ時間などは「＋ 学習時間を記録」で追加できます。</div>
      </div>
    </div>`;

  // 16週分のヒートマップ（列＝週、行＝曜日）
  const map = new Map(logs.map((l) => [l.date, l.minutes]));
  const start = new Date(U.addDays(U.ymd(), -7 * 15) + 'T00:00:00');
  start.setDate(start.getDate() - start.getDay());
  const cells = [];
  for (let i = 0; i < 16 * 7; i++) {
    const d = U.ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const m = map.get(d) || 0;
    const lv = d > U.ymd() ? -1 : m === 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4;
    cells.push(`<i class="h${lv}" title="${d}：${m}分"></i>`);
  }
  view.querySelector('#heat').innerHTML = cells.join('');

  view.querySelector('#manual').onclick = () => U.modal({
    title: '学習時間を記録',
    body: '<div class="form-grid" id="mf"><label class="field"><span>学習時間（分）</span><input type="number" name="min" min="1" value="30"></label><label class="field"><span>内容（任意）</span><input name="what" placeholder="例：電気学会の解説を読んだ"></label></div>',
    okText: '記録する',
    onOk: async (m) => {
      const d = U.formData(m.querySelector('#mf'));
      if (!d.min) return false;
      await Log.add('manual', d.min);
      U.toast(`${d.min}分を記録しました`);
      Pages.home(view);
    },
  });
};

/* ---------- 業務内容の詳細（720字） ---------- */
Pages.career = async (view) => {
  const saved = (await DB.get('settings', 'career')) || {};
  const PARTS = [
    ['title', '業務名（タイトル）', '例：〇〇変電所における主要変圧器更新計画の立案と実施', '業務の対象・規模・自分の役割が伝わる具体的な名前にする。', 1],
    ['role', '立場と役割', '例：私は設計グループの主任技術者として、計画の立案から工事の監理まで、技術的な責任を担った。', '「担当者」ではなく「責任者・主導者」として何を判断したかを書く。', 2],
    ['issue', '業務の概要と技術的課題', '例：運転開始から40年を経過した変圧器2台の更新にあたり、供給を継続しながら…という課題があった。', '課題は「技術的な難しさ」がわかるように、制約条件（停電できない、工期、敷地など）を添えて書く。', 4],
    ['solution', '技術的な提案・工夫', '例：(1)仮設変圧器の… (2)… (3)…を提案し、関係部署と調整して採用された。', '複数の選択肢を比較・評価したうえで選んだことを示すと、口頭試験でも説明しやすい。', 5],
    ['result', '成果と現時点での評価', '例：その結果、停電時間をゼロとし、工期を〇か月短縮した。現時点では…の点に改善の余地があると考える。', '定量的な成果と、現時点での自己評価（反省点・今後への展開）を書く。', 3],
  ];
  view.innerHTML = `
    <div class="page-head">
      <div><h1>業務内容の詳細（720字）</h1><p>受験申込書の「業務内容の詳細」の下書きです。口頭試験ではここから質問されるため、筆記対策と同じくらい重要です。</p></div>
      <div class="actions"><button class="btn" id="copyText">本文をコピー</button><button class="btn btn-primary" id="ai">AI添削の依頼文をコピー</button></div>
    </div>
    <div class="grid grid-2" style="align-items:start">
      <div class="card" id="f">
        ${PARTS.map(([k, label, ph, help, rows]) => `<label class="field" style="margin-bottom:14px"><span>${label}</span>
          <textarea name="${k}" rows="${rows}" placeholder="${U.esc(ph)}">${U.esc(saved[k] || '')}</textarea><small>${help}</small></label>`).join('')}
      </div>
      <div class="preview-col">
        <div class="card">
          <div class="card-head"><h2>仕上がり（タイトルを除く本文）</h2><span id="cnt" class="badge"></span></div>
          <div class="sheet-view" id="pv"></div>
          <div class="pace" style="margin-top:12px"><div id="bar"></div></div>
          <ul class="small muted" style="padding-left:18px; margin:12px 0 0">
            <li>720字以内（改行は字数に含めずに数えています）。上限の9割以上を使うのがおすすめです。</li>
            <li>「私は」で始め、主体的に判断・行動したことを書きます。</li>
            <li>受験する選択科目（発送配変電）の内容であることが伝わる用語を使います。</li>
            <li>申込書の様式や字数は年度で変わることがあります。最新の受験申込み案内で必ず確認してください。</li>
          </ul>
        </div>
      </div>
    </div>`;
  const $ = (s) => view.querySelector(s);
  const body = (d) => ['role', 'issue', 'solution', 'result'].map((k) => d[k]).filter(Boolean).join('');
  function draw() {
    const d = U.formData($('#f'));
    const text = body(d);
    const n = Exam.charCount(text);
    $('#pv').innerHTML = d.title || text ? `${d.title ? `<b>${U.esc(d.title)}</b>\n\n` : ''}${U.esc(text)}` : '<span class="muted">左の欄に入力すると、ここに本文が表示されます。</span>';
    $('#cnt').textContent = `${n} / 720字`;
    $('#cnt').className = 'badge ' + (n > 720 ? 'badge-red' : n >= 648 ? 'badge-green' : 'badge-amber');
    $('#bar').style.width = Math.min(100, (n / 720) * 100) + '%';
    $('#bar').style.background = n > 720 ? 'var(--danger)' : '';
    return d;
  }
  $('#f').addEventListener('input', U.debounce(async () => { const d = draw(); await DB.put('settings', { ...d, id: 'career' }); }, 300));
  $('#copyText').onclick = () => U.copy(body(U.formData($('#f'))));
  $('#ai').onclick = () => {
    const d = U.formData($('#f'));
    U.copy(`あなたは技術士第二次試験（電気電子部門・発送配変電）の指導者です。以下は受験申込書の「業務内容の詳細」（720字以内）の下書きです。
次の観点で添削し、改善した文案（720字以内）も示してください。
1. 技術士にふさわしい「高度な専門的応用能力」を発揮した業務として読めるか
2. 受験者の立場・役割と、主体的な判断が明確か
3. 技術的課題・提案・成果の筋道が通っているか（成果は定量的か）
4. 口頭試験で突っ込まれそうな点と、その想定問答

# 業務名
${d.title}

# 本文（${Exam.charCount(body(d))}字）
${body(d)}`);
  };
  draw();
};

/* ---------- 設定・バックアップ ---------- */
Pages.settings = async (view) => {
  const s = await Settings.get();
  view.innerHTML = `
    <div class="page-head"><div><h1>設定・バックアップ</h1></div><div class="actions"><button class="btn btn-primary" id="save">保存する</button></div></div>
    <div class="card"><h2>学習の設定</h2><div class="form-grid" id="f">
      <label class="field"><span>筆記試験日</span><input type="date" name="examDate" value="${U.esc(s.examDate)}"><small>受験申込み案内で公表された日付を入力してください。</small></label>
      <label class="field"><span>1日の目標学習時間（分）</span><input type="number" name="dailyGoal" min="5" value="${U.esc(s.dailyGoal)}"></label>
    </div></div>
    <div class="card"><h2>バックアップ</h2>
      <p class="muted small" style="margin-top:-6px">データはこのブラウザの中だけに保存されています。PCの買い替えやブラウザのデータ削除に備えて、定期的に書き出してください。スマホとPCでデータを移すときにも使えます。</p>
      <div class="actions"><button class="btn" id="exp">⬇ すべてのデータを書き出す</button><label class="btn">⬆ バックアップから復元<input type="file" id="imp" accept=".json" hidden></label></div></div>`;
  const $ = (q) => view.querySelector(q);
  $('#save').onclick = async () => { await Settings.save(U.formData($('#f'))); U.toast('保存しました'); };
  $('#exp').onclick = async () => U.download(`gijutsushi-note-backup-${U.ymd()}.json`, JSON.stringify(await DB.exportAll(), null, 2), 'application/json');
  $('#imp').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    U.modal({ title: 'バックアップから復元', body: '<p>現在のデータはすべて置き換えられます。よろしいですか？</p>', okText: '復元する', danger: true,
      onOk: async () => { try { await DB.importAll(JSON.parse(await file.text())); U.toast('復元しました'); location.hash = '#/'; } catch (err) { U.toast('復元できませんでした：' + err.message, 'err'); } } });
  };
};
