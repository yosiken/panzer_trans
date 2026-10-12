/* パンツァー語翻訳機: 画面の操作と音声合成 */
(function () {
  'use strict';

  // 形態素解析 (kuromoji.js) の読み込み先。GitHub Pages では同じサイトに置いた辞書 (vendor/) を使い、
  // ない場合 (ローカルで index.html を開いたときなど) は CDN から読み込む。
  var KUROMOJI_SOURCES = [
    { script: 'vendor/kuromoji/kuromoji.js', dict: 'vendor/kuromoji/dict/' },
    { script: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/build/kuromoji.js', dict: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/' },
    { script: 'https://unpkg.com/kuromoji@0.1.2/build/kuromoji.js', dict: 'https://unpkg.com/kuromoji@0.1.2/dict/' }
  ];

  var EXAMPLES = {};
  EXAMPLES.ja = [
    'こんにちは、私の名前は田中です。',
    '東京から大阪まで電車で行きます',
    '私は猫と犬が好きです',
    '夜が明けたら畑に麦を播こう',
    'なぜ、私を助けた？',
    'まさか、あれは…ドラゴン！？',
    '私は帝国の兵士ではない',
    '黙れ！',
    '早く逃げろ！',
    'Thank you, my friend.',
    "I don't know what you are protecting."
  ];
  EXAMPLES.en = [
    'Hello, how are you?',
    'I like cats and dogs.',
    'Good morning! Let\'s eat breakfast together.',
    'Thank you, my friend.',
    "I don't know what you are protecting.",
    'The dragon is flying in the sky!',
    'I want to go to Tokyo tomorrow.',
    'こんにちは、私の名前は田中です。',
    'まさか、あれは…ドラゴン！？'
  ];

  var PRESETS = {
    normal: { rate: 1.0, pitch: 1.0 },
    soldier: { rate: 1.2, pitch: 0.6 },
    oracle: { rate: 0.85, pitch: 1.5 },
    machine: { rate: 0.7, pitch: 0.2 }
  };

  var USER_DICT_KEY = 'panzer-trans.user-dict';
  var SETTINGS_KEY = 'panzer-trans.settings';

  var $ = function (id) { return document.getElementById(id); };
  var I18n = window.PanzerI18n;
  var t = I18n.t;

  // 既定の声 (見つからなければ自然な声を優先して選ぶ)
  var DEFAULT_VOICE = /Diego/i;

  var el = {
    source: $('source'), langBadge: $('lang-badge'), examples: $('examples'),
    translate: $('btn-translate'), clear: $('btn-clear'), status: $('analyzer-status'),
    speak: $('btn-speak'), stop: $('btn-stop'), copy: $('btn-copy'),
    result: $('result'), roman: $('roman'), words: $('words'), unknown: $('unknown'),
    voice: $('voice'), style: $('style'), intonation: $('intonation'), phonetic: $('phonetic'), preset: $('preset'), rate: $('rate'), pitch: $('pitch'),
    rateOut: $('rate-out'), pitchOut: $('pitch-out'), autoSpeak: $('auto-speak'), pastMarker: $('past-marker'),
    voiceWarning: $('voice-warning'), dictSearch: $('dict-search'), dictBody: $('dict-body'), dictCount: $('dict-count'),
    userForm: $('user-form'), userList: $('user-list'), uiLang: $('ui-lang')
  };

  var translator = PanzerTranslator.createTranslator(window.PANZER_DICT || []);
  var tokenizer = null;
  var lastResult = null;

  // ---------------------------------------------------------------- 保存

  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 保存できなくても動作は続ける */ }
  }

  var userDict = load(USER_DICT_KEY, []);
  translator.setUserEntries(userDict);

  // ---------------------------------------------------------------- 形態素解析

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('load failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function buildTokenizer(dicPath) {
    return new Promise(function (resolve, reject) {
      window.kuromoji.builder({ dicPath: dicPath }).build(function (err, tk) {
        if (err) reject(err); else resolve(tk);
      });
    });
  }

  var analyzerState = 'loading';

  // 読み込みが止まったまま (辞書の取得やエラーで kuromoji のコールバックが呼ばれない) にならないよう、
  // 1つの読み込み先につき一定時間で打ち切って次へ進む
  var ANALYZER_TIMEOUT_MS = 30000;

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('timeout')); }, ms);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function initAnalyzer() {
    var i = 0;
    var done = false;
    function attempt() {
      if (done) return;
      if (i >= KUROMOJI_SOURCES.length) {
        done = true;
        analyzerState = 'fallback';
        el.status.textContent = t('status.fallback');
        return;
      }
      var src = KUROMOJI_SOURCES[i++];
      var ready = window.kuromoji ? Promise.resolve() : loadScript(src.script);
      withTimeout(ready.then(function () { return buildTokenizer(src.dict); }), ANALYZER_TIMEOUT_MS)
        .then(function (built) {
          if (done) return;
          done = true;
          tokenizer = built;
          analyzerState = 'ready';
          el.status.textContent = t('status.ready');
          if (el.source.value.trim()) translate(false);
        })
        .catch(function (err) { if (window.console) console.warn('kuromoji (' + src.dict + '):', err); attempt(); });
    }
    attempt();
  }

  // ---------------------------------------------------------------- 翻訳

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 句読点の直後には空白を入れない (翻訳エンジンの出力と同じ規則)
  function sentenceParts(sentence) {
    var parts = [];
    sentence.forEach(function (it) {
      if (it.type === 'punct') { parts.push({ text: it.pz, punct: true }); return; }
      var prev = parts[parts.length - 1];
      parts.push({ text: it.pz, space: !!prev && !/[、。…！？]$/.test(prev.text) });
    });
    return parts;
  }

  function sentenceText(sentence) {
    return sentenceParts(sentence).map(function (p) { return (p.space ? ' ' : '') + p.text; }).join('');
  }

  function sentenceHtml(sentence) {
    return sentenceParts(sentence).map(function (p) {
      return (p.space ? ' ' : '') + (p.punct ? escapeHtml(p.text) : '<span class="w">' + escapeHtml(p.text) + '</span>');
    }).join('');
  }

  function translate(speakAfter) {
    var text = el.source.value;
    translator.options.pastMarker = el.pastMarker.checked;
    renderBadge();
    var r = translator.translate(text, tokenizer);
    lastResult = r;
    render(r);
    if (speakAfter && r.words.length) speak();
  }

  function renderBadge() {
    var text = el.source.value;
    el.langBadge.textContent = !text.trim() ? t('input.auto') : t(PanzerTranslator.hasJapanese(text) ? 'input.ja' : 'input.en');
  }

  function render(r) {
    var has = r.words.length > 0;
    el.speak.disabled = el.copy.disabled = !has;
    if (!has) {
      el.result.innerHTML = '<span class="placeholder">' + escapeHtml(t('output.placeholder')) + '</span>';
      el.roman.textContent = '';
      el.phonetic.hidden = true;
      el.words.innerHTML = '';
      el.unknown.hidden = true;
      return;
    }
    el.result.innerHTML = r.sentences.map(function (s, i) {
      return '<span class="sentence" data-i="' + i + '">' + sentenceHtml(s) + '</span>';
    }).join(' ');
    el.roman.textContent = r.roman;
    renderPhonetic();
    el.words.innerHTML = r.words.map(function (w) {
      var cls = 'chip' + (w.unknown ? ' unknown' : '') + (w.loan ? ' loan' : '') + (w.grammar ? ' grammar' : '') +
        (w.entry && w.entry.src === '拡張' ? ' extended' : '');
      var title = w.unknown ? t('word.unknown') : w.loan ? t('word.loan') : w.grammar ? t('word.grammar') :
        (w.entry ? w.entry.ja + (w.entry.src === '拡張' ? t('word.extended') : '') : '');
      return '<button type="button" class="' + cls + '" data-say="' + escapeHtml(w.pz) + '" title="' + escapeHtml(title) + '">' +
        '<span class="pz">' + escapeHtml(w.pz) + '</span><span class="src">' + escapeHtml(w.src || '') + '</span></button>';
    }).join('');
    var notes = [];
    if (r.loanwords.length) notes.push(t('note.loan', { list: r.loanwords.join(t('list.sep')) }));
    if (r.unknown.length) notes.push(t('note.unknown', { list: r.unknown.join(t('list.sep')) }));
    el.unknown.hidden = !notes.length;
    el.unknown.innerHTML = notes.map(function (n, i) {
      return '<span class="' + (i === notes.length - 1 && r.unknown.length ? 'note-unknown' : 'note-loan') + '">' + escapeHtml(n) + '</span>';
    }).join('<br>');
  }

  // ---------------------------------------------------------------- 音声

  var synth = window.speechSynthesis;
  var voices = [];
  var activeStyle = 'ja'; // 実際に使っている発音スタイル (選んだ言語の音声がなければ日本語)
  var STYLE_LANG = { ja: 'ja', de: 'de', it: 'it', es: 'es', en: 'en' };

  function voicesFor(lang) {
    if (!synth) return [];
    var re = new RegExp('^' + lang, 'i');
    return synth.getVoices().filter(function (v) { return re.test(v.lang.replace('_', '-')); });
  }

  // 自然な声 (Google / Microsoft Natural など) を先に並べる
  function rankVoice(v) {
    return (/natural|online|neural|premium|enhanced/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : 2) + (v.localService ? 0.5 : 0);
  }

  function refreshVoices() {
    if (!synth) return;
    var all = synth.getVoices();
    var style = el.style.value;
    var list = voicesFor(STYLE_LANG[style]);
    activeStyle = style;
    var warning = '';
    if (!list.length && style !== 'ja') {
      warning = t('warn.noStyleVoice', { lang: t('lang.' + style) });
      activeStyle = 'ja';
      list = voicesFor('ja');
    }
    if (!list.length) {
      list = all;
      if (all.length && activeStyle === 'ja') warning = t('warn.noJaVoice');
    }
    voices = list.slice().sort(function (a, b) { return rankVoice(a) - rankVoice(b); });
    var saved = (load(SETTINGS_KEY, {}).voices || {})[activeStyle];
    var pick = voices.findIndex(function (v) { return v.name === saved; });
    if (pick < 0) pick = voices.findIndex(function (v) { return DEFAULT_VOICE.test(v.name); });
    if (pick < 0) pick = 0;
    el.voice.innerHTML = voices.map(function (v, i) {
      return '<option value="' + i + '"' + (i === pick ? ' selected' : '') + '>' + escapeHtml(v.name + ' (' + v.lang + ')') + '</option>';
    }).join('');
    el.voiceWarning.hidden = !(all.length && warning);
    el.voiceWarning.textContent = warning;
    renderPhonetic();
  }

  function currentVoice() { return voices[parseInt(el.voice.value, 10)] || null; }

  // 発声する文字列: 日本語スタイルはカタカナ、それ以外はその言語の綴り
  function speechText(items) {
    if (activeStyle === 'ja') return sentenceText(items).replace(/…/g, '、');
    return PanzerPhonetics.sentence(items, activeStyle);
  }

  function renderPhonetic() {
    if (!lastResult || !lastResult.words.length || activeStyle === 'ja') { el.phonetic.hidden = true; return; }
    el.phonetic.hidden = false;
    el.phonetic.innerHTML = escapeHtml(t('output.phonetic', { style: t('lang.' + activeStyle) })) + '<b>' +
      escapeHtml(lastResult.sentences.map(function (s) { return speechText(s); }).join(' ')) + '</b>';
  }

  function makeUtterance(text, pitchScale, rateScale) {
    var u = new SpeechSynthesisUtterance(text);
    var v = currentVoice();
    if (v) u.voice = v;
    u.lang = v ? v.lang : (activeStyle === 'ja' ? 'ja-JP' : activeStyle);
    u.rate = Math.min(2, parseFloat(el.rate.value) * (rateScale || 1));
    u.pitch = Math.max(0, Math.min(2, parseFloat(el.pitch.value) * (pitchScale || 1)));
    return u;
  }

  // 抑揚を強調: 文を句 (読点ごと、最大3語) に分け、文頭を高く・文末へ下げる。
  // 疑問文は文末を上げ、感嘆文は文頭を強く速くする。
  function intonationChunks(sentence) {
    var chunks = [];
    var cur = [];
    var words = 0;
    sentence.forEach(function (it) {
      if (it.type === 'punct') {
        // 句読点は直前の句に付ける (疑問符・感嘆符で文末の抑揚が付く)
        if (!cur.length && chunks.length) { chunks[chunks.length - 1].push(it); return; }
        cur.push(it);
        if (/[、。！？…]/.test(it.pz)) { chunks.push(cur); cur = []; words = 0; }
        return;
      }
      cur.push(it);
      words++;
      if (words >= 3) { chunks.push(cur); cur = []; words = 0; }
    });
    if (cur.length) {
      if (chunks.length && cur.every(function (it) { return it.type === 'punct'; })) chunks[chunks.length - 1] = chunks[chunks.length - 1].concat(cur);
      else chunks.push(cur);
    }
    var endMark = sentenceText(sentence).slice(-1);
    var n = chunks.length;
    return chunks.map(function (items, k) {
      var pitch = n > 1 ? 1.18 - 0.36 * (k / (n - 1)) : 1;
      var rate = 1;
      if (k === n - 1 && /[？?]/.test(endMark)) pitch = 1.35;
      if (/[！!]/.test(endMark)) { if (k === 0) pitch = Math.max(pitch, 1.3); rate = 1.08; }
      return { items: items, pitch: pitch, rate: rate };
    });
  }

  function clearHighlight() {
    Array.prototype.forEach.call(el.result.querySelectorAll('.speaking'), function (n) { n.classList.remove('speaking'); });
  }

  function speak() {
    if (!synth || !lastResult) return;
    synth.cancel();
    clearHighlight();
    el.stop.disabled = false;
    var sentences = lastResult.sentences;
    sentences.forEach(function (s, i) {
      // 長い文は Chrome で途中終了することがあるので、文 (抑揚強調時は句) ごとに分けて読み上げる
      var parts = el.intonation.checked ? intonationChunks(s) : [{ items: s, pitch: 1, rate: 1 }];
      parts.forEach(function (part, k) {
        var text = speechText(part.items);
        if (!text.replace(/[\s,.!?、。！？…]/g, '')) return;
        var u = makeUtterance(text, part.pitch, part.rate);
        if (k === 0) {
          u.onstart = function () {
            clearHighlight();
            var node = el.result.querySelector('.sentence[data-i="' + i + '"]');
            if (node) node.classList.add('speaking');
          };
        }
        if (i === sentences.length - 1 && k === parts.length - 1) {
          u.onend = u.onerror = function () { clearHighlight(); el.stop.disabled = true; };
        }
        synth.speak(u);
      });
    });
  }

  function sayWord(text) {
    if (!synth) return;
    synth.cancel();
    var spoken = activeStyle === 'ja' || !/[\u30A0-\u30FF]/.test(text) ? text :
      text.split(/\s+/).map(function (w) { return PanzerPhonetics.word(w, activeStyle); }).join(' ');
    synth.speak(makeUtterance(spoken));
  }

  function saveVoiceSettings() {
    var v = currentVoice();
    var prev = load(SETTINGS_KEY, {}) || {};
    var savedVoices = prev.voices || {};
    if (v) savedVoices[activeStyle] = v.name;
    save(SETTINGS_KEY, {
      voices: savedVoices, style: el.style.value, intonation: el.intonation.checked,
      preset: el.preset.value, rate: el.rate.value, pitch: el.pitch.value,
      autoSpeak: el.autoSpeak.checked, pastMarker: el.pastMarker.checked
    });
  }

  function syncOutputs() {
    el.rateOut.textContent = parseFloat(el.rate.value).toFixed(2);
    el.pitchOut.textContent = parseFloat(el.pitch.value).toFixed(2);
  }

  // ---------------------------------------------------------------- 辞書

  var entries = (window.PANZER_DICT || []).filter(function (e) { return e.kind === 'word' || e.kind === 'suffix' || e.kind === 'frame'; });

  function renderDict() {
    var q = el.dictSearch.value.trim().toLowerCase();
    var list = userDict.map(function (u) { return { ja: u.ja, pz: u.pz, en: u.en ? [u.en] : [], cat: '', user: true }; }).concat(entries);
    var hits = !q ? list : list.filter(function (e) {
      return e.ja.toLowerCase().indexOf(q) >= 0 || e.pz.indexOf(q) >= 0 ||
        (e.roman || '').toLowerCase().indexOf(q) >= 0 ||
        (e.en || []).some(function (w) { return w.indexOf(q) >= 0; });
    });
    el.dictCount.textContent = t('dict.count', { hits: hits.length, total: list.length });
    el.dictBody.innerHTML = hits.slice(0, 300).map(function (e) {
      var roman = e.roman ? e.roman : PanzerTranslator.kanaToRoman(e.pz);
      return '<tr><td>' + escapeHtml(e.ja) + '</td><td>' + escapeHtml(e.pz) + '</td><td>' + escapeHtml(roman) + '</td><td>' +
        escapeHtml((e.en || []).join(', ')) + '</td><td>' +
        escapeHtml(e.user ? t('dict.user') : (e.src === '拡張' ? t('dict.extended') : '') + I18n.category(e.cat)) + '</td>' +
        '<td><button type="button" data-say="' + escapeHtml(e.pz) + '" aria-label="' + escapeHtml(t('dict.say', { word: e.pz })) + '">▶</button></td></tr>';
    }).join('');
  }

  function renderUserList() {
    el.userList.innerHTML = userDict.map(function (u, i) {
      return '<li>' + escapeHtml(u.ja) + ' → ' + escapeHtml(u.pz) + (u.en ? '（' + escapeHtml(u.en) + '）' : '') +
        '<button type="button" data-remove="' + i + '">' + escapeHtml(t('dict.remove')) + '</button></li>';
    }).join('');
  }

  function rebuildTranslator() {
    translator = PanzerTranslator.createTranslator(window.PANZER_DICT || []);
    translator.setUserEntries(userDict);
  }

  // ---------------------------------------------------------------- イベント

  function renderExamples() {
    el.examples.innerHTML = EXAMPLES[I18n.getLang()].map(function (x) {
      return '<button type="button" data-example="' + escapeHtml(x) + '">' + escapeHtml(x) + '</button>';
    }).join('');
  }
  renderExamples();
  el.examples.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-example]');
    if (!b) return;
    el.source.value = b.getAttribute('data-example');
    translate(el.autoSpeak.checked);
  });

  var timer = null;
  el.source.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { translate(false); }, 250);
  });
  el.source.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); translate(true); }
  });
  el.translate.addEventListener('click', function () { translate(true); });
  el.clear.addEventListener('click', function () {
    el.source.value = '';
    if (synth) synth.cancel();
    translate(false);
    el.source.focus();
  });
  el.speak.addEventListener('click', speak);
  el.stop.addEventListener('click', function () { if (synth) synth.cancel(); clearHighlight(); el.stop.disabled = true; });
  el.copy.addEventListener('click', function () {
    if (!lastResult) return;
    var text = lastResult.text + '\n' + lastResult.roman;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        el.copy.textContent = t('output.copied');
        setTimeout(function () { el.copy.textContent = t('output.copy'); }, 1500);
      });
    }
  });

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-say]');
    if (b) sayWord(b.getAttribute('data-say'));
  });

  el.preset.addEventListener('change', function () {
    var p = PRESETS[el.preset.value];
    if (p) { el.rate.value = p.rate; el.pitch.value = p.pitch; }
    syncOutputs();
    saveVoiceSettings();
  });
  [el.rate, el.pitch].forEach(function (r) {
    r.addEventListener('input', function () { syncOutputs(); saveVoiceSettings(); });
  });
  [el.voice, el.autoSpeak, el.intonation].forEach(function (c) { c.addEventListener('change', saveVoiceSettings); });
  el.style.addEventListener('change', function () { refreshVoices(); saveVoiceSettings(); });
  el.pastMarker.addEventListener('change', function () { saveVoiceSettings(); translate(false); });

  el.dictSearch.addEventListener('input', renderDict);

  el.userForm.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = new FormData(el.userForm);
    var item = { ja: String(f.get('ja')).trim(), pz: String(f.get('pz')).trim(), en: String(f.get('en') || '').trim() };
    if (!item.ja || !item.pz) return;
    userDict = userDict.filter(function (u) { return u.ja !== item.ja; }).concat([item]);
    save(USER_DICT_KEY, userDict);
    rebuildTranslator();
    el.userForm.reset();
    renderUserList();
    renderDict();
    translate(false);
  });
  el.userList.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-remove]');
    if (!b) return;
    userDict.splice(parseInt(b.getAttribute('data-remove'), 10), 1);
    save(USER_DICT_KEY, userDict);
    rebuildTranslator();
    renderUserList();
    renderDict();
    translate(false);
  });

  // ---------------------------------------------------------------- 初期化

  // ---------------------------------------------------------------- 表示言語 (日本語 / English)

  function renderStatus() {
    el.status.textContent = t(analyzerState === 'ready' ? 'status.ready' : analyzerState === 'fallback' ? 'status.fallback' : 'status.loading');
  }

  function rerenderAll() {
    renderStatus();
    renderExamples();
    renderBadge();
    render(lastResult || { words: [], sentences: [], unknown: [], loanwords: [] });
    if (synth) refreshVoices();
    renderDict();
    renderUserList();
  }

  I18n.apply();
  renderStatus();
  render({ words: [], sentences: [], unknown: [], loanwords: [] });
  el.uiLang.addEventListener('click', function () { I18n.setLang(I18n.getLang() === 'ja' ? 'en' : 'ja'); });
  I18n.onChange(rerenderAll);

  (function restore() {
    var s = load(SETTINGS_KEY, null);
    if (!s) return;
    if (s.preset) el.preset.value = s.preset;
    if (s.rate) el.rate.value = s.rate;
    if (s.pitch) el.pitch.value = s.pitch;
    if (typeof s.autoSpeak === 'boolean') el.autoSpeak.checked = s.autoSpeak;
    if (typeof s.pastMarker === 'boolean') el.pastMarker.checked = s.pastMarker;
    if (s.style && el.style.querySelector('option[value="' + s.style + '"]')) el.style.value = s.style;
    if (typeof s.intonation === 'boolean') el.intonation.checked = s.intonation;
  })();
  syncOutputs();

  if (synth) {
    refreshVoices();
    if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = refreshVoices;
  } else {
    el.voiceWarning.hidden = false;
    el.voiceWarning.textContent = t('warn.noSpeech');
  }

  renderDict();
  renderUserList();
  initAnalyzer();
})();
