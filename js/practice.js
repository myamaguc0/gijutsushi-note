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

  // 設問番号の見出し「1.」「(1)」「（１）」などの位置で答案を分割する。parts[i] = 設問(i)の本文（parts[0] = 冒頭）
  const headRe = (i) => { const z = '０１２３４５６７８９'[i]; return new RegExp(`(^|\\n)\\s*([（(]\\s*[${i}${z}]\\s*[)）]|[${i}${z}]\\s*[.．、])`); };
  // 「1.」形式と「(1)」形式を別々に探し、多く見つかった方を設問の見出しとみなす（課題の小見出し (1)(2)(3) と区別するため）
  const STYLES = [(i) => `[${i}${'０１２３４５６７８９'[i]}]\\s*[.．、]`, (i) => `[（(]\\s*[${i}${'０１２３４５６７８９'[i]}]\\s*[)）]`];
  function splitParts(text, n) {
    let idx = [];
    for (const st of STYLES) {
      const cand = [];
      for (let i = 1; i <= n; i++) { const m = text.match(new RegExp(`(^|\\n)\\s*${st(i)}`)); cand.push(m ? m.index : -1); }
      if (cand.filter((x) => x >= 0).length > idx.filter((x) => x >= 0).length) idx = cand;
    }
    if (!idx.length) idx = Array(n).fill(-1);
    const parts = [text.slice(0, idx.find((x) => x >= 0) ?? text.length)];
    for (let i = 0; i < n; i++) {
      if (idx[i] < 0) { parts.push(''); continue; }
      const next = idx.slice(i + 1).find((x) => x > idx[i]);
      parts.push(text.slice(idx[i], next ?? text.length));
    }
    return parts;
  }

  // 過去の添削で繰り返し指摘された弱点（Studying・LuckyOcean・匠先生・実践講座の講評から抽出）
  const FEEDBACK = [
    { kinds: ['I', 'III'], text: '課題は「なすべきこと（例：調整力の確保）」で統一し、「障害物（例：慣性力の低下）」と混在させない。課題ごとに観点を明記し、3つの観点が重ならないようにする。' },
    { kinds: ['I', 'III'], text: '問題文が観点の明記を求めていないときは「〜の観点」を書かない（題意に従う）。' },
    { kinds: ['I', 'III'], text: '設問(2)の各解決策の末尾で「〜により課題○○が解決される」と課題とのつながりを明示する。設問(3)のリスクは設問(2)の解決策から派生するものに限る（設問1→2→3の連動）。' },
    { kinds: ['I', 'II-1', 'II-2', 'III'], text: '数値（kV・MW・％・年・時間・回数・費用）で定量的に説明する。「大幅に」「適切に」は数値に置き換える。' },
    { kinds: ['II-1'], text: 'Ⅱ-1は「背景・原理 → 現象・発生メカニズム → 対策 → 数値・規格」の4段で書く。見出しを並べて終わらず、メカニズム（なぜ起きるか）を文章で説明する。見出しは2〜3個まで。' },
    { kinds: ['II-2'], text: 'Ⅱ-2(2)の留意点は「何が起きるおそれがあるか（リスク）」を起点に書く。(3)の調整は「誰と・何を・どのように」をステークホルダー別に書く（例：運用部門と停電枠、メーカーと納期、自治体と搬入経路）。' },
    { kinds: ['I', 'II-1', 'II-2', 'III'], text: '題意ズレを防ぐため、問題文の重要語（例：供給と需給、設備と系統）をそのまま使う。略語は初出で正式名称を書く。' },
    { kinds: ['I', 'III'], text: '得意分野（変電：変圧器・GIS・保護リレー・変電所更新）の具体例に引き込む。一般論で終わらせない。' },
    { kinds: ['I', 'II-1', 'II-2', 'III'], text: '空白行を作らない。1行に満たない改行を繰り返さない（分量不足・読みにくさの原因）。同音異義語（消化／消火、対象／対称）と誤字を見直し時間で確認する。' },
  ];

  // 問題文から「重要語」（2字以上の漢字・カタカナ語）を取り出す。定型の設問文や一般語は除く
  const STOP = ['技術者', '立場', '観点', '課題', '解決策', 'リスク', '対策', '状況', '以下', '内容', '業務', '担当', '責任者', '関係者', '調整', '方策', '手順', '留意', '工夫', '調査', '検討', '事項', '効率', '効果', '前問', '抽出', '明記', '複数', '新た', '実行', '専門', '技術', '倫理', '社会', '持続', '可能性', '要件', '留意点', '題意', '多面的', '重要', '列挙', '項目', '必要', '場合', '説明', '記述', '理由', '回答', '問題', '選択', '科目', '必須', '以上', '近年', '一方', '実現', '確保', '両立', '求め', '踏まえ', '考え', '対応', '提案', '事項', '意見', '具体的', '計画', '中心', '人', '者', '上', '下', '中', '後', '前', '例', '等', '減少', '低下', '不足', '増加', '増大', '顕在化', '拡大', '導入', '発生', '進め', '整備', '構築', '活用', '利用', '維持', '推進', '取組', '取り組み', '期待', '要求'];
  function keyTerms(question) {
    const q = String(question || '').split(/\n\s*[（(]?[1１]\s*[)）.．]/)[0]; // 設問(1)以降の定型文は除く
    const words = q.match(/[一-鿿]{2,}|[゠-ヿーー]{3,}|[A-Z][A-Za-z0-9]{1,}/g) || [];
    return [...new Set(words.filter((w) => !STOP.includes(w) && ![...w].every((ch) => STOP.includes(ch))))];
  }

  // 自動チェック。論文の「型」と「書き方」の基本的な抜け漏れに加え、過去の添削で指摘された弱点を機械的に拾う
  function check(text, kind, cards, question) {
    text = String(text || '');
    const F = FORMATS[kind] || FORMATS.free;
    const rows = rowsUsed(text);
    const capacity = F.sheets * ROWS;
    const items = [];
    const add = (level, title, detail) => items.push({ level, title, detail });
    const parts = splitParts(text, F.parts || 0);
    const lines = text.split('\n');
    const isHead = (l) => l.trim() && [...l.trim()].length <= 16 && !/[。、]/.test(l.trim());

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
    const asksView = !question || /観点/.test(question);
    if (kind === 'I' || kind === 'III') {
      // 指摘①②：観点の明記と、観点が不要な問題で書かない
      const views = [...(parts[1] || text).matchAll(/([^\s、。（()）・：:]{2,10})の観点/g)].map((m) => m[1] + 'の観点');
      if (asksView && !views.length) add('ng', '「観点」が明記されていません', '設問(1)では、課題ごとに「〇〇の観点から」と観点を明記することが求められます。');
      else if (asksView && views.length < 3) add('warn', `観点が${views.length}つしか見つかりません`, `${views.join('、')}。課題3つにそれぞれ異なる観点（例：供給力・系統技術・経済性）を付けます。`);
      else if (asksView && new Set(views).size < views.length) add('warn', '観点が重複している可能性があります', `${views.join('、')}。3つの観点は互いに異なる切り口にします（過去の指摘：観点の整合）。`);
      else if (asksView) add('ok', `観点が${views.length}つ明記されています`, views.join('、'));
      if (!asksView && /観点/.test(text)) add('warn', '問題文は「観点」を求めていません', '題意にない「〇〇の観点」は書かず、その分を課題の内容に使います（過去の指摘：観点不要時は書かない）。');
      // 指摘①：課題の表記（なすべきこと／障害物の混在）
      const p1 = (parts[1] || '').split('\n').filter(isHead).join('\n'); // 課題の見出し行だけを見る
      const todo = (p1.match(/(の確保|の構築|の整備|の確立|の強化|の低減|の向上|の推進|の高度化|の実現|の対応|への対応|の抑制)/g) || []).length;
      const obstacle = (p1.match(/(の低下|の不足|の増大|の増加|の減少|の老朽化|の高経年化|のおそれ|が困難|が不足|が増大)/g) || []).length;
      if (todo && obstacle) add('warn', '課題の表記が「なすべきこと」と「障害物」で混在しています', `なすべきこと形${todo}箇所・障害物形${obstacle}箇所。「〇〇の確保」「〇〇の低減」のように、課題はすべて「なすべきこと」で統一します（過去の指摘：課題の立て方）。`);
      // 指摘③：解決策と課題の連動、設問(3)の連動
      const p2 = parts[2] || '';
      if (p2 && !/(解決|達成|実現|解消|克服)(する|できる|される|に寄与|につながる)/.test(p2)) add('warn', '解決策が課題を解決することが明示されていません', '各解決策の末尾に「〜により、課題である〇〇が解決される」と書き、課題と解決策のつながりを示します（過去の指摘：設問1→2の連動）。');
      const p3 = parts[3] || '';
      if (!/リスク/.test(text)) add('warn', '「リスク」の記述が見当たりません', '設問(3)では、解決策を実行しても新たに生じるリスクと、その対策を書きます。');
      else if (p3 && !/(解決策|対策|上記|前述|[（(][1-3１-３][)）]|①|②|③)/.test(p3.replace(/^.*?\n/, ''))) add('warn', '設問(3)のリスクが設問(2)の解決策と結び付いていません', '「解決策(1)の〇〇を実行すると、新たに△△のリスクが生じる」と、どの解決策から派生するリスクかを明示します（過去の指摘：設問3の連動）。');
      if (p3 && /リスク/.test(p3) && !/(対策|対応|低減|回避|抑制|防止|軽減)/.test(p3)) add('ng', '設問(3)にリスクへの対策がありません', 'リスクを挙げるだけでなく、その対策まで書きます。');
      if (kind === 'I' && !/倫理/.test(text)) add('warn', '「倫理」の記述が見当たりません', '設問(4)では、技術者倫理と社会の持続可能性の観点を両方書きます。');
      // 指摘⑧：得意土俵（変電）
      const dohyo = ['変圧器', '変電所', 'GIS', '遮断器', '保護リレー', '開閉装置', '母線', '避雷器', '調相', '油中ガス', 'LTC', 'IEC 61850', 'IEC61850'];
      const dh = dohyo.filter((w) => text.includes(w));
      if (!dh.length) add('warn', '得意分野（変電）の具体例がありません', '解決策やリスクのどこかに、変圧器・GIS・保護リレー・変電所更新など自分の土俵の具体例を1つ入れて、専門性を示します（過去の指摘：得意土俵へ）。');
      else add('ok', `得意分野（変電）の用語：${dh.join('、')}`, '');
    }
    if (kind === 'II-1') {
      // 指摘⑤：メカニズムの説明と見出し過多
      if (!/(原理|メカニズム|原因|のため|により|起因|生じる|発生する|になる)/.test(text)) add('ng', '発生原因・メカニズムの説明がありません', 'Ⅱ-1は「背景・原理 → 現象・なぜ起きるか → 対策 → 数値・規格」の4段で、因果を文章で説明します（過去の指摘：Ⅱ-1 B−の原因）。');
      const heads = lines.filter(isHead).length;
      if (heads > 4) add('warn', `見出し・箇条書きの行が${heads}行あります`, 'Ⅱ-1（1枚）では見出しは2〜3個にとどめ、残りは説明の文章で埋めます（過去の指摘：見出し過多）。');
      if (!/(規格|JEC|JIS|IEC|電技|解釈|ガイドライン|基準)/.test(text)) add('warn', '規格・基準への言及がありません', '関連する規格（JEC・JIS・IEC・電気設備技術基準など）を1つ挙げると専門的学識の加点になります。');
    }
    if (kind === 'II-2') {
      // 指摘⑥：留意点はリスク起点、調整はステークホルダー別
      const p2 = parts[2] || '';
      if (p2 && !/(リスク|おそれ|懸念|支障|防止|回避)/.test(p2)) add('warn', '設問(2)の留意点が「リスク起点」になっていません', '各手順で「〇〇が起きるおそれがあるため、△△に留意する」とリスクを起点に書きます（過去の指摘：Ⅱ-2 B−の原因）。');
      const p3 = parts[3] || '';
      const sh = ['需要家', '自治体', '発注者', '施工', 'メーカー', '製造者', '工事会社', '運用部門', '保守部門', '関係部署', '行政', '住民', '顧客', '系統運用者', '一般送配電', '発電事業者', '協力会社', '設計部門', '営業部門', '電力会社', '労働基準監督署', '警察', '道路管理者'];
      const found = sh.filter((w) => p3.includes(w));
      if (p3 && found.length < 2) add('warn', '設問(3)の調整相手が具体的ではありません', `見つかった相手：${found.join('、') || 'なし'}。「誰と・何を・どのように調整するか」を相手別に3つ程度書きます（過去の指摘：調整は誰と何をどう）。`);
      else if (p3) add('ok', `調整相手：${found.join('、')}`, '');
    }
    // 指摘④：定量性
    const nums = (text.match(/[0-9０-９][0-9０-９.,．，]*\s*(kV|kA|MW|MVA|MWh|kW|kWh|GW|Hz|V|A|％|%|℃|K|年|か月|ヶ月|カ月|時間|分|秒|回|倍|日|週間|割|件|万円|億円|円|km|m|mm|t|ppm|dB|台|基|回線|人|名|件|cm|MPa)/g) || []).length;
    if (!nums) add('ng', '数値がひとつもありません', '電圧階級・容量・年数・時間・率などの数値を入れて定量的に説明します（過去の指摘：定量化。「大幅に」「適切に」は数値に置き換える）。');
    else if (nums < 3) add('warn', `数値が${nums}箇所しかありません`, '各設問に1つ以上は数値（kV・MW・％・年・時間）を入れましょう。');
    else add('ok', `数値を${nums}箇所使用`, '');
    // 指摘⑦：題意（問題文の重要語の使用率）
    if (question) {
      const keys = keyTerms(question);
      if (keys.length) {
        const unused = keys.filter((w) => !text.includes(w));
        const rate = Math.round(((keys.length - unused.length) / keys.length) * 100);
        if (rate < 50) add('ng', `問題文の重要語の使用率が${rate}%です`, `未使用：${unused.slice(0, 8).join('、')}。問題文の言葉をそのまま使うと題意ズレを防げます（過去の指摘：題意ズレ、供給と需給の取り違え）。`);
        else if (unused.length) add('warn', `問題文の重要語の使用率は${rate}%`, `未使用：${unused.slice(0, 8).join('、')}。意図して使っていないか確認します。`);
        else add('ok', '問題文の重要語をすべて使っています', '');
      }
    }
    // 指摘⑨：空白行・改行過多・同音異義語
    const blank = lines.filter((l, i) => i > 0 && !l.trim() && i < lines.length - 1).length;
    if (blank) add('ng', `空白行が${blank}行あります`, '答案用紙の空白行は分量不足とみなされます。見出しの前後も空けずに詰めて書きます（過去の指摘：半ページ空白・改行過多）。');
    const shortLines = lines.filter((l) => l.trim() && !isHead(l) && [...l].reduce((a, ch) => a + cellWidth(ch), 0) < COLS * 0.5).length;
    if (shortLines > Math.max(3, rows * 0.15)) add('warn', `1行の半分に満たない行が${shortLines}行あります`, '箇条書きや短い改行が多いと、マス目が埋まらず分量不足になります。文章でつないで書きます（過去の指摘：改行過多）。');
    const typo = [[/消化(設備|器|活動|する|を)/, '消化 → 消火'], [/対称(設備|機器|範囲|者|と|に|の設備)/, '対称 → 対象'], [/製御/, '製御 → 制御'], [/低格/, '低格 → 定格'], [/絶援/, '絶援 → 絶縁'], [/射断/, '射断 → 遮断'], [/以外に(も)?(大き|重要|効果)/, '以外に → 意外に？'], [/補償(する|して)品質/, '補償 → 保証？'], [/需給力/, '需給力 → 供給力？'], [/供給バランス/, '供給バランス → 需給バランス？']];
    const typos = typo.filter(([re]) => re.test(text)).map(([, m]) => m);
    if (typos.length) add('ng', '誤字・同音異義語の疑いがあります', `${typos.join('、')}（過去の指摘：消化／消火の誤記）。`);

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

  // history: 過去の答案の「反省・次回への改善点」メモ（新しい順）
  function aiPrompt(q, ans, kind, history = []) {
    const F = FORMATS[kind] || FORMATS.free;
    const fb = FEEDBACK.filter((f) => f.kinds.includes(kind)).map((f, i) => `${i + 1}. ${f.text}`).join('\n');
    const hist = history.filter(Boolean).slice(0, 5).map((h) => `- ${h}`).join('\n');
    return `あなたは技術士第二次試験（電気電子部門・電力・エネルギーシステム）の経験豊富な採点者・添削指導者です。
以下の答案を、本試験の採点基準（技術士に求められる資質能力＝コンピテンシー：専門的学識、問題解決、評価、マネジメント、コミュニケーション、リーダーシップ、技術者倫理）に沿って添削してください。

# 受験者の背景（添削で必ず確認してほしいこと）
受験者は変電設備（変圧器・GIS・保護リレー・変電所更新）が専門です。過去3回の受験と複数の添削講座で、知識の正しさは評価される一方、次の点が繰り返し指摘されています。今回の答案でこれらが再発していないかを、1項目ずつ「再発あり／なし」で判定し、再発している箇所を引用してください。
${fb}
${hist ? `\n# 受験者自身の最近の反省メモ\n${hist}\n` : ''}
# 出力してほしいこと
1. 総合評価（A：合格水準／B：あと一歩／C：不合格水準）と、その理由
2. 上記「繰り返し指摘されている点」の再発チェック（項目ごとに判定と該当箇所）
3. 設問ごとの評価：設問に正対しているか（問題文の言葉を使っているか）、設問1→2→3が連動しているか
4. 技術的な誤り・あいまいな記述・誤字の指摘（該当箇所を引用）
5. 加点につながる具体的な改善案（追加すべき数値・規格・キーワードと、書き換え例。できれば変電分野の具体例で）
6. 次に練習すべきポイントを3つ

# 試験形式
${F.label}：600字（24字×25行）×${F.sheets}枚

# 問題
${q}

# 答案
${ans}`;
  }

  return { COLS, ROWS, FORMATS, rowsUsed, charCount, check, COMPETENCY, aiPrompt, FEEDBACK, keyTerms, splitParts };
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
  const r = Exam.check(a.text, a.kind, cards, a.question);
  // 過去の反省メモ（同じ形式を優先、新しい順）をAI添削の依頼文に添える
  const history = (await DB.all('answers')).filter((x) => x.id !== a.id && x.done && x.note)
    .sort((x, y) => (x.kind === a.kind ? 0 : 1) - (y.kind === a.kind ? 0 : 1) || (y.updatedAt || '').localeCompare(x.updatedAt || ''))
    .map((x) => `${Exam.FORMATS[x.kind]?.label || ''}「${x.theme}」：${x.note}`);
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
        <div class="card"><div class="card-head"><h2>自動チェック</h2><span class="small muted">要改善 ${r.items.filter((i) => i.level === 'ng').length}・注意 ${r.items.filter((i) => i.level === 'warn').length}</span></div><ul class="list-plain">${r.items.map((it) => `<li style="align-items:flex-start"><div><b>${U.esc(it.title)}</b>${it.detail ? `<div class="small muted">${U.esc(it.detail)}</div>` : ''}</div>${icon[it.level]}</li>`).join('')}</ul>
          <p class="small muted" style="margin:8px 0 0">機械的なチェックです。「過去の指摘」と書かれた項目は、これまでの添削講座で繰り返し指摘された弱点です。内容の妥当性は、下の自己採点とAI添削・第三者の添削で確認しましょう。</p></div>
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
  $('#ai').onclick = () => U.copy(Exam.aiPrompt(a.question, a.text, a.kind, history));
  $('#reopen').onclick = async () => {
    const copy = await DB.put('answers', { qid: a.qid, kind: a.kind, theme: a.theme, question: a.question, text: a.text, memo: a.memo, elapsed: 0, done: false });
    location.hash = `#/practice/${copy.id}`;
  };
  $('#del').onclick = () => U.confirm('答案を削除', 'この答案を削除します。', async () => { await DB.remove('answers', a.id); location.hash = '#/practice'; });
  drawScore();
};
