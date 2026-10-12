/* 画面表示の日本語 / 英語切り替え */
(function (root) {
  'use strict';

  var TEXT = {
    ja: {
      'page.title': 'パンツァー語翻訳機',
      'page.description': '日本語・英語をパンツァー語に翻訳して発声するブラウザアプリ',
      'header.title': 'パンツァー語',
      'header.titleSub': '翻訳機',
      'header.tagline': '日本語・英語 → パンツァー語。翻訳して、そのまま声に出します。',
      'header.switch': 'English',
      'header.switchLabel': 'Switch to English',

      'input.title': '入力',
      'input.auto': '自動判定',
      'input.ja': '日本語',
      'input.en': 'English',
      'input.placeholder': '例）夜が明けたら畑に麦を播こう / I don\'t know what you are protecting.',
      'input.examples': '例文',
      'input.translate': '翻訳して発声',
      'input.clear': 'クリア',
      'status.loading': '形態素解析を読み込み中…',
      'status.ready': '形態素解析: 準備完了',
      'status.fallback': '簡易解析モード（形態素解析を読み込めませんでした。オンラインで開くと精度が上がります）',

      'output.title': 'パンツァー語',
      'output.speak': '▶ 発声',
      'output.stop': '■ 停止',
      'output.copy': 'コピー',
      'output.copied': 'コピーしました',
      'output.placeholder': 'ここに翻訳結果が表示されます',
      'output.words': '単語ごとの対応',
      'output.phonetic': '読み上げ表記（{style}風）: ',
      'word.unknown': '辞書にない語',
      'word.loan': '外来語（訳さずに読む）',
      'word.grammar': '文法語',
      'word.extended': '（拡張辞書）',
      'note.loan': '外来語として読んだ語: {list}',
      'note.unknown': '辞書にない語: {list}（読みのまま発声します）',
      'list.sep': '、',

      'voice.title': '声の設定',
      'voice.style': '発音スタイル',
      'voice.voice': '声',
      'voice.preset': 'プリセット',
      'voice.rate': '速さ',
      'voice.pitch': '高さ',
      'voice.autoSpeak': '翻訳したら自動で発声',
      'voice.intonation': '抑揚を強調する（句ごとに声の高さを変える）',
      'voice.pastMarker': '過去形に「エデ」を付ける',
      'style.de': 'ドイツ語風',
      'style.it': 'イタリア語風（ラテン語に近い）',
      'style.es': 'スペイン語風',
      'style.en': '英語風',
      'style.ja': '日本語（カタカナ読み）',
      'preset.normal': '標準',
      'preset.soldier': '帝国兵（低く重く）',
      'preset.oracle': '巫女（高く静かに）',
      'preset.machine': '古代機械（ゆっくり）',
      'lang.ja': '日本語', 'lang.de': 'ドイツ語', 'lang.it': 'イタリア語', 'lang.es': 'スペイン語', 'lang.en': '英語',
      'warn.noStyleVoice': '{lang}の音声がこの端末にないため、日本語音声のカタカナ読みで発声します。OS の設定で{lang}の音声を追加するか、Chrome / Edge をお使いください。',
      'warn.noJaVoice': '日本語の音声が見つかりません。OS の設定で日本語の音声を追加してください。',
      'warn.noSpeech': 'このブラウザは音声合成に対応していません。Chrome / Edge / Safari などをお使いください。',

      'dict.title': '辞書',
      'dict.search': '日本語・パンツァー語・英語で検索',
      'dict.count': '{hits} / {total} 語',
      'dict.colJa': '日本語',
      'dict.colPz': 'パンツァー語',
      'dict.colSpell': '綴り',
      'dict.colEn': '英語',
      'dict.colCat': '分類',
      'dict.say': '{word}を発声',
      'dict.extended': '拡張・',
      'dict.user': 'ユーザー追加',
      'dict.addSummary': '単語を追加する（このブラウザにだけ保存されます）',
      'dict.addJa': '日本語（例：畑）',
      'dict.addPz': 'パンツァー語（例：アグロス）',
      'dict.addEn': '英語（任意）',
      'dict.add': '追加',
      'dict.remove': '削除',

      'about.title': '翻訳のしくみ',
      'about.step1': '日本語を形態素解析して、主語・目的語・述語などの文の役割を判定します。',
      'about.step2': '資料の翻訳手順「文法は英語」に合わせて、語順を主語 → 述語 → 目的語 → その他に並べ替えます。',
      'about.step3': '単語を辞書（パンツァードラグーン／AZEL／ORTA ＋ 一般会話用の拡張辞書）のパンツァー語に置き換え、カタカナ読みで出力します。',
      'about.step4': 'カタカナをドイツ語・イタリア語などの綴りに置き換え（例: サルヴェ → salve）、その言語の音声で読み上げます。欧米の言語らしい発音と抑揚になります。',
      'about.loan': '地名・人名などの固有名詞と、辞書にない名詞は訳さずに<span class="loan-sample">外来語</span>として読みます（例: 東京 → トーキョー）。それ以外で辞書にない語は<span class="unknown-sample">この色</span>で表示し、元の読みのまま発声します。必要に応じて「単語を追加する」から登録してください。',
      'about.dict': '辞書は資料の約690語に、会話用に資料と同じ方法（日本語 → 英語 → ラテン語・ギリシャ語 → カタカナ）で作った拡張語を加えています。資料に同じ語があれば資料の訳を優先します。',
      'footer.source': '辞書データ: パンツァー語翻訳資料（パンツァー語辞典_ORTA.xls / パンツァー語辞書.xlsx）'
    },
    en: {
      'page.title': 'Panzer Language Translator',
      'page.description': 'Translate Japanese or English into the Panzer language and hear it spoken in your browser',
      'header.title': 'Panzer Language',
      'header.titleSub': 'Translator',
      'header.tagline': 'Japanese / English → Panzer language. Translate it and hear it spoken.',
      'header.switch': '日本語',
      'header.switchLabel': '日本語に切り替え',

      'input.title': 'Input',
      'input.auto': 'Auto detect',
      'input.ja': 'Japanese',
      'input.en': 'English',
      'input.placeholder': 'e.g. I don\'t know what you are protecting. / 夜が明けたら畑に麦を播こう',
      'input.examples': 'Examples',
      'input.translate': 'Translate & speak',
      'input.clear': 'Clear',
      'status.loading': 'Loading the Japanese analyzer…',
      'status.ready': 'Japanese analyzer: ready',
      'status.fallback': 'Simple mode (the Japanese analyzer could not be loaded; open the page online for better accuracy)',

      'output.title': 'Panzer language',
      'output.speak': '▶ Speak',
      'output.stop': '■ Stop',
      'output.copy': 'Copy',
      'output.copied': 'Copied',
      'output.placeholder': 'The translation appears here',
      'output.words': 'Word by word',
      'output.phonetic': 'Spoken as ({style}): ',
      'word.unknown': 'Not in the dictionary',
      'word.loan': 'Loanword (read as is)',
      'word.grammar': 'Grammar word',
      'word.extended': ' (extended dictionary)',
      'note.loan': 'Read as loanwords: {list}',
      'note.unknown': 'Not in the dictionary: {list} (spoken as written)',
      'list.sep': ', ',

      'voice.title': 'Voice',
      'voice.style': 'Pronunciation',
      'voice.voice': 'Voice',
      'voice.preset': 'Preset',
      'voice.rate': 'Speed',
      'voice.pitch': 'Pitch',
      'voice.autoSpeak': 'Speak automatically after translating',
      'voice.intonation': 'Stronger intonation (vary the pitch per phrase)',
      'voice.pastMarker': 'Mark the past tense with “エデ (ede)”',
      'style.de': 'German style',
      'style.it': 'Italian style (close to Latin)',
      'style.es': 'Spanish style',
      'style.en': 'English style',
      'style.ja': 'Japanese (katakana)',
      'preset.normal': 'Normal',
      'preset.soldier': 'Imperial soldier (low, heavy)',
      'preset.oracle': 'Oracle (high, calm)',
      'preset.machine': 'Ancient machine (slow)',
      'lang.ja': 'Japanese', 'lang.de': 'German', 'lang.it': 'Italian', 'lang.es': 'Spanish', 'lang.en': 'English',
      'warn.noStyleVoice': 'No {lang} voice is installed on this device, so the Japanese voice reads the katakana instead. Add a {lang} voice in your OS settings, or use Chrome / Edge.',
      'warn.noJaVoice': 'No Japanese voice was found. Add a Japanese voice in your OS settings.',
      'warn.noSpeech': 'This browser does not support speech synthesis. Please use Chrome, Edge or Safari.',

      'dict.title': 'Dictionary',
      'dict.search': 'Search in Japanese, Panzer or English',
      'dict.count': '{hits} / {total} words',
      'dict.colJa': 'Japanese',
      'dict.colPz': 'Panzer',
      'dict.colSpell': 'Spelling',
      'dict.colEn': 'English',
      'dict.colCat': 'Type',
      'dict.say': 'Speak {word}',
      'dict.extended': 'Extended · ',
      'dict.user': 'Added by you',
      'dict.addSummary': 'Add a word (saved in this browser only)',
      'dict.addJa': 'Japanese (e.g. 畑)',
      'dict.addPz': 'Panzer (e.g. アグロス)',
      'dict.addEn': 'English (optional)',
      'dict.add': 'Add',
      'dict.remove': 'Remove',

      'about.title': 'How it works',
      'about.step1': 'Japanese input is split into words and each phrase gets a role: subject, object, predicate and so on.',
      'about.step2': 'Following the source notes (“the grammar is English”), words are reordered as subject → verb → object → the rest.',
      'about.step3': 'Each word is replaced with its Panzer word from the dictionary (Panzer Dragoon / AZEL / ORTA plus an extended dictionary for everyday conversation), written in katakana.',
      'about.step4': 'The katakana is respelled for German, Italian and other voices (e.g. サルヴェ → salve) and read aloud by that language’s voice, giving a European pronunciation and intonation.',
      'about.loan': 'Proper nouns such as places and people, and nouns not in the dictionary, are not translated: they are read as <span class="loan-sample">loanwords</span> (e.g. 東京 → トーキョー / Tokyo). Other words missing from the dictionary are shown in <span class="unknown-sample">this color</span> and read as written. You can add them under “Add a word”.',
      'about.dict': 'The dictionary combines about 690 words from the source material with extra words for everyday conversation, made the same way (Japanese → English → Latin / Greek → katakana). Where both have a word, the source material wins.',
      'footer.source': 'Dictionary data: Panzer language source material (パンツァー語辞典_ORTA.xls / パンツァー語辞書.xlsx)'
    }
  };

  // 辞書の分類 (資料の表記) の英訳
  var CATEGORY_EN = {
    '名詞': 'noun', '動詞': 'verb', '形容詞': 'adjective', '副詞': 'adverb', '代名詞': 'pronoun',
    '代名詞・人称代名詞': 'pronoun', '前置詞': 'preposition', '可能・疑問・否定': 'modal / question / negation',
    '時制関係': 'time', '数字': 'number', '数': 'number', '数量関係': 'quantity', '感嘆、間投詞そのほか': 'interjection',
    '新規パンツァー語': 'new Panzer word', '新規パンツァー語（石井）': 'new Panzer word', '新規パンツァー語(石井)': 'new Panzer word',
    '旧辞書': 'old dictionary', 'アゼル': 'AZEL', '挨拶': 'greeting', '応答': 'response', '疑問詞': 'question word',
    '接続詞': 'conjunction', 'ユーザー': 'user'
  };

  var STORAGE_KEY = 'panzer-trans.ui-lang';
  var lang = 'ja';
  var listeners = [];

  function initialLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ja' || saved === 'en') return saved;
    } catch (e) { /* 保存できない環境では既定値を使う */ }
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'ja';
    return /^ja/i.test(nav) ? 'ja' : 'en';
  }

  function t(key, vars) {
    var s = (TEXT[lang] && TEXT[lang][key]) || TEXT.ja[key] || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
    return s;
  }

  function category(cat) {
    if (lang === 'ja' || !cat) return cat || '';
    return CATEGORY_EN[cat] || cat;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.title = t('page.title');
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', t('page.description'));
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-html]'), function (n) { n.innerHTML = t(n.getAttribute('data-i18n-html')); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-placeholder]'), function (n) { n.setAttribute('placeholder', t(n.getAttribute('data-i18n-placeholder'))); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-aria]'), function (n) { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))); });
  }

  function setLang(next) {
    lang = next === 'en' ? 'en' : 'ja';
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* 保存できなくても切り替えは行う */ }
    apply();
    listeners.forEach(function (fn) { fn(lang); });
  }

  lang = initialLang();

  root.PanzerI18n = {
    t: t,
    category: category,
    apply: apply,
    setLang: setLang,
    getLang: function () { return lang; },
    onChange: function (fn) { listeners.push(fn); }
  };
})(typeof self !== 'undefined' ? self : this);
