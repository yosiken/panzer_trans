/*
 * パンツァー語翻訳エンジン
 *
 * 資料「日本語_パンツァー語翻訳手順」の方針に沿って翻訳する:
 *   ・文法は英語 (主語 → 動詞 → 目的語 → その他 の語順に並べ替える)
 *   ・単語を辞書のパンツァー語 (ラテン語〜ギリシャ語由来) に置き換える
 *   ・カタカナ読みで出力する
 *
 * 日本語は形態素解析 (kuromoji.js のトークン) を受け取って処理する。
 * kuromoji が使えない環境では fallbackTokenize() の簡易解析を使う。
 * ブラウザでもNode.jsでも動くように UMD 形式で書いている。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PanzerTranslator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------
  // 文法語 (辞書の「～の」「（否定）」などに対応するもの)
  // ---------------------------------------------------------------------
  var GRAMMAR = {
    neg: 'デ',          // （否定）
    guess: 'メト',      // （推定） だろう・でしょう
    maybe: 'ミトス',    // ～かもしれない
    seems: 'ミリス',    // ～らしい
    want: 'ペス',       // ～したい
    must: 'ウイ',       // ～ねばならない
    prohibit: 'ヌンカ', // ～するな
    passive: 'イェ',    // ～される
    causative: 'アディア', // させる
    past: 'エデ',       // ～した
    copula: 'イエ',     // ～です
    can: 'イエナ',      // ～できる
    cond: 'アヌ',       // もし～なら
    but: 'タブ',        // でも・しかし
    and: 'カイ',        // そして
    because: 'カウサ',  // ～のため
    too: 'エティア',    // ～すぎる
    please: 'クェソ',   // ～ください
    before: 'アパット', // ～する前に
    gen: 'ル',          // ～の (属するの意)
    question: 'トゥーン エス' // （疑問詞）
  };

  // 格助詞 → 前置詞 (英語の前置詞のように名詞の前に置く)
  var PREPOSITIONS = {
    'から': 'アイオ',
    'まで': 'ウスクェ',
    'で': 'インタス',
    'と': 'イン',
    'より': 'メサ'
  };

  // 辞書にない日常語を辞書の見出し語へ寄せるための同義語表
  var JA_SYNONYMS = {
    '行く': '向かう', 'いく': '向かう', '助ける': '助け', '播く': 'まく', '蒔く': 'まく',
    '燃やす': '燃える', '焼ける': '焼く', 'する': '実行する', 'やる': '実行する',
    '僕': '私', '俺': '私', 'わたし': '私', 'あたし': '私', 'わし': '私', 'うち': '私',
    '我々': '私たちは', '僕ら': '私たちは', '俺たち': '私たちは', '私たち': '私たちは', '俺達': '私たちは', '我ら': '私たちは',
    '君': 'お前', 'きみ': 'お前', 'おまえ': 'お前', 'あんた': 'お前', '貴方': 'あなた',
    '彼': '彼は', '彼女': '彼は', '彼ら': '彼らは', '彼女ら': '彼らは', 'あいつ': '彼は',
    'これら': 'これ', 'あの': 'あれ', 'その': 'それ', 'こいつ': 'こいつは',
    '何': '何を', 'なに': '何を', 'どこ': 'どこに',
    '見える': '見る', 'みる': '見る', '聞こえる': '聞く', '話す': '言う', 'いう': '言う', '喋る': '言う',
    'わかる': '知る', '分かる': '知る', '解る': '知る', '知れる': '知る',
    '欲しい': '望む', 'ほしい': '望む', '願う': '望む',
    '良い': '良い', 'いい': '良い', 'よい': '良い', '悪い': '嫌',
    '大きい': '巨大な', 'でかい': '巨大な', '暑い': 'あつい', '熱い': 'あつい',
    '怖い': '恐怖', 'こわい': '恐怖', '恐れる': '恐怖', '怖がる': '怯えた', 'おびえる': '怯えた', '怯える': '怯えた',
    '寂しい': '孤独', 'さびしい': '孤独', '一人': '孤独', 'ひとり': '孤独',
    '戦う': '戦闘', '戦い': '戦闘', 'いくさ': '戦闘', '争う': '戦闘',
    '守る': '守っている', '殺る': '殺す', '倒す': '殺す', '討つ': '殺す',
    '生まれる': '生まれる', '産まれる': '生まれる', '住む': '生きる', '暮らす': '生きる',
    '来る': '来る', 'くる': '来る', '帰る': '戻る', '逃れる': '逃げる',
    '止まる': '止める', 'とめる': '止める', '探る': '探す', '見つける': '発見', '見つかる': '発見',
    '持っる': '持つ', '使える': '使う', '作れる': '作る', '造る': '作る', '創る': '作る',
    '始まる': '始まる', 'はじめる': '始める', '開ける': '開く', '閉める': '閉じる',
    '死': '死', '亡くなる': '死ぬ', '眠い': '眠る', '寝る': '眠る', '起きる': '目覚める',
    '空': '空', 'そら': '空', '竜': 'ドラゴン', '龍': 'ドラゴン', 'りゅう': 'ドラゴン',
    '母': '母親', 'お母さん': '母親', '父': '父親', 'お父さん': '父親', '爺さん': '祖父', 'じいさん': '祖父',
    '友': '友達', '友人': '友達', '仲間': '味方', '人間': '人', '人々': '人', 'みんな': '全員', '皆': '全員',
    '全部': '全て', 'すべて': '全て', 'いっぱい': '沢山', 'たくさん': '沢山',
    '黙る': ['(否定)', '言う'], '黙れ': ['(否定)', '言う'], 'まさか': '(推定)', 'たぶん': '(推定)', '多分': '(推定)',
    '夜': '黄昏', '晩': '夕方', '畑': '地面', '土': '地面', '大地': '地上', '国': '帝国', '王': '皇帝陛下',
    'たてつく': '反逆', '逆らう': '反逆', '裏切る': '反逆', 'やむ': '止める', '止む': '止める',
    '歌う': '=カネーレ', 'ささやく': '=カネーレ', '一緒': '=イン', '共': '=イン',
    'きさま': 'お前', '貴様': 'お前', '奴': 'お前', 'やつ': 'お前', 'ちっ': 'くそ', 'ちぇっ': 'くそ',
    'もらう': '手に入れる', '貰う': '手に入れる', '拾う': '手に入れる', '引く': '避ける', '退く': '避ける', '一旦': '時',
    '片付ける': '殺す', '切り刻む': '殺す', '怒る': '暴走', '憎む': '仇', '恨む': '仇', '拒む': ['(否定)', '進む'],
    '珍しい': '不思議な', '面白い': 'すごい', 'かわいそう': '孤独', '可哀想': '孤独', '悲しい': '孤独', '悲しみ': '孤独',
    '縛る': '捕獲する', '捕まえる': '捕獲する', '閉じ込める': '捕獲する', '生む': '産む', '逃がす': '逃げる',
    '残す': '捨てる', '呪う': '不吉な', '呪い': '不吉な', '破壊': '破壊する', '壊す': '破壊する', '生き物': '生物',
    '今度': '今', '客': '人', '厄介': '嫌', 'いる': '=エッセ', 'ある': '=エッセ', 'はじめ': '=プロト', '初め': '=プロト',
    'こごえる': '凍らせる', '凍える': '凍らせる', 'ふむ': 'はい', 'うむ': 'はい', 'それほど': '(強調)',
    '暗い': ['(否定)', '光'], '明るい': '光', '育てる': '生きる', '育つ': '生きる', '満ちる': '完全に',
    '伝える': '連絡', '伝わる': '連絡', '不幸': '不吉な', '怒り': '仇',
    'いまわしい': '忌まわしい', '恐ろしい': '恐怖', 'おそろしい': '恐怖', 'こりゃ': 'これ', 'なんて': '=シ',
    '涙': '水', '心配': '悩む', '大丈夫': '安心', '平気': '安心',
    '早く': '急いで', '急ぐ': '急いで', 'いま': '今', 'きょう': '今日', 'あした': '明日', 'あす': '明日',
    '名': '名前', '剣': '矢', '銃': '機連銃', '砲': '砲台', '飛ぶ': '飛ぶ', '飛行する': '飛行',
    '夜明ける': '夜明け', '明ける': '夜明け', '光る': '光', '輝く': '光',
    'ありがとう': 'ありがとう', 'すみません': 'すまん', 'ごめん': 'すまん', 'ごめんなさい': 'すまん',
    'さよなら': 'さようなら', 'じゃあね': 'さようなら', 'うん': 'はい', 'ええ': 'はい',
    'こんにちは': 'よし', 'おはよう': '朝', 'こんばんは': '夕方', '好き': '愛する', '好む': '愛する',
    'すごく': 'すごい', 'とても': 'すごい', '凄く': 'すごい', '本当に': 'すごい',
    'いつか': '永久', 'ずっと': '永久', 'もう': '既に', 'また': '何度でも'
  };

  // 疑問・感嘆など文頭に置く品詞
  var FRONT_POS = { '接続詞': 1, '感動詞': 1 };
  // 文頭に置く副詞 (それ以外の副詞は英語と同じく述語の直前に置く)
  var FRONT_ADVERBS = { 'なぜ': 1, 'どうして': 1, 'もし': 1, 'まさか': 1, 'たぶん': 1, '多分': 1, 'おそらく': 1, 'きっと': 1,
    'でも': 1, 'しかし': 1, 'だから': 1, 'そして': 1, 'それから': 1, 'いつ': 1, 'どう': 1, 'どうやって': 1 };
  // 「AはBが好き」のように、が格が目的語になる述語
  var LIKE_PREDICATES = { '好き': 1, '嫌い': 1, '欲しい': 1, 'わかる': 1, '分かる': 1, '得意': 1, '苦手': 1,
    '上手': 1, '下手': 1, '必要': 1, '大好き': 1, '大嫌い': 1 };

  // ---------------------------------------------------------------------
  // カタカナ → ローマ字 (表示用の簡易変換)
  // ---------------------------------------------------------------------
  var KANA = {
    'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo', 'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho', 'シェ': 'she',
    'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho', 'チェ': 'che', 'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
    'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo', 'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
    'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo', 'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
    'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo', 'ジェ': 'je', 'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
    'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo', 'ティ': 'ti', 'ディ': 'di', 'トゥ': 'tu', 'ドゥ': 'du',
    'デュ': 'dyu', 'テュ': 'tyu', 'ファ': 'fa', 'フィ': 'fi', 'フェ': 'fe', 'フォ': 'fo', 'フュ': 'fyu',
    'ヴァ': 'va', 'ヴィ': 'vi', 'ヴェ': 've', 'ヴォ': 'vo', 'ヴュ': 'vyu', 'ウィ': 'wi', 'ウェ': 'we', 'ウォ': 'wo',
    'ツァ': 'tsa', 'ツィ': 'tsi', 'ツェ': 'tse', 'ツォ': 'tso', 'スィ': 'si', 'ズィ': 'zi', 'クェ': 'que',
    'クァ': 'qua', 'クィ': 'qui', 'クォ': 'quo', 'グァ': 'gua', 'イェ': 'ye', 'キェ': 'kye', 'ツゥ': 'tsu',
    'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o', 'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
    'サ': 'sa', 'シ': 'shi', 'ス': 'su', 'セ': 'se', 'ソ': 'so', 'タ': 'ta', 'チ': 'chi', 'ツ': 'tsu', 'テ': 'te', 'ト': 'to',
    'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no', 'ハ': 'ha', 'ヒ': 'hi', 'フ': 'fu', 'ヘ': 'he', 'ホ': 'ho',
    'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo', 'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
    'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro', 'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
    'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go', 'ザ': 'za', 'ジ': 'ji', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
    'ダ': 'da', 'ヂ': 'ji', 'ヅ': 'zu', 'デ': 'de', 'ド': 'do', 'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
    'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po', 'ヴ': 'vu',
    'ァ': 'a', 'ィ': 'i', 'ゥ': 'u', 'ェ': 'e', 'ォ': 'o', 'ャ': 'ya', 'ュ': 'yu', 'ョ': 'yo', 'ヮ': 'wa'
  };

  function toKatakana(s) {
    return String(s || '').replace(/[\u3041-\u3096]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) + 0x60);
    });
  }

  function kanaToRoman(kana, plain) {
    var s = toKatakana(kana);
    var out = '';
    for (var i = 0; i < s.length;) {
      var two = s.substr(i, 2);
      var ch = s[i];
      if (KANA[two]) { out += KANA[two]; i += 2; continue; }
      if (ch === 'ッ') {
        var next = KANA[s.substr(i + 1, 2)] || KANA[s[i + 1]] || '';
        out += next ? next[0] : '';
        i++; continue;
      }
      if (ch === 'ー' || ch === '―' || ch === '－') { i++; continue; }
      out += KANA[ch] !== undefined ? KANA[ch] : ch;
      i++;
    }
    if (plain) return out;
    // 語末の母音を落としてラテン語風の綴りにする (ナウス → naus)
    return out.replace(/su(?=[bcdfghjklmnpqrstvwxz])/g, 's')
      .replace(/([aeiou])(s|m|k|t|v)u$/, '$1$2').replace(/([aeiou])ru$/, '$1r');
  }

  // 漢字の読みを外来語風の長音表記にする (トウキョウ → トーキョー、センセイ → センセー)
  function toLoanword(kana) {
    return toKatakana(kana)
      .replace(/([オコソトノホモヨロゴゾドボポョ])[ウオ]/g, '$1ー')
      .replace(/([ウクスツヌフムユルグズヅブプュ])ウ/g, '$1ー')
      .replace(/([エケセテネヘメレゲゼデベペ])イ/g, '$1ー');
  }

  function isKatakanaWord(s) { return /^[\u30A0-\u30FF]+$/.test(s); }
  function hasJapanese(s) { return /[\u3040-\u30FF\u3400-\u9FFF]/.test(s); }

  // ---------------------------------------------------------------------
  // 辞書インデックス
  // ---------------------------------------------------------------------
  function buildIndex(entries) {
    var ja = Object.create(null);   // 見出し語 → entry
    var en = Object.create(null);   // 英語 → entry
    var roman = Object.create(null); // パンツァー語 → 綴り
    var maxJaLen = 1, maxEnWords = 1;
    entries.forEach(function (e) {
      var key = e.ja;
      if ((e.kind === 'word' || e.kind === 'marker') && !ja[key]) {
        ja[key] = e;
        maxJaLen = Math.max(maxJaLen, key.length);
      }
      if (e.roman && !roman[e.pz]) roman[e.pz] = e.roman;
      (e.en || []).forEach(function (w) {
        w = w.toLowerCase();
        if (!en[w]) en[w] = e;
        maxEnWords = Math.max(maxEnWords, w.split(' ').length);
      });
    });
    return { ja: ja, en: en, roman: roman, maxJaLen: maxJaLen, maxEnWords: maxEnWords };
  }

  // ---------------------------------------------------------------------
  // 簡易形態素解析 (kuromoji が読み込めない場合の代替)
  // ---------------------------------------------------------------------
  var FALLBACK_PARTICLES = [
    ['かもしれない', '助動詞'], ['ません', '助動詞'], ['ました', '助動詞'], ['ている', '助動詞'], ['ない', '助動詞'],
    ['たい', '助動詞'], ['です', '助動詞'], ['ます', '助動詞'], ['だ', '助動詞'], ['た', '助動詞'],
    ['から', '助詞'], ['まで', '助詞'], ['より', '助詞'], ['は', '助詞'], ['が', '助詞'], ['を', '助詞'], ['に', '助詞'],
    ['へ', '助詞'], ['で', '助詞'], ['と', '助詞'], ['の', '助詞'], ['も', '助詞'], ['か', '助詞'], ['ね', '助詞'], ['よ', '助詞']
  ];
  var CAT_POS = { '名詞': '名詞', '動詞': '動詞', '形容詞': '形容詞', '感嘆、間投詞そのほか': '感動詞' };

  function fallbackTokenize(text, index) {
    var tokens = [];
    var i = 0;
    var pending = '';
    function flush() {
      if (!pending) return;
      // 漢字＋送り仮名は漢字部分だけを未知語として残し、ひらがなは付属語として読み飛ばす
      var m = pending.match(/^([^\u3040-\u309F]*)([\u3040-\u309F]*)$/);
      var head = m ? m[1] : pending;
      var tail = m ? m[2] : '';
      if (head) {
        tokens.push({ surface_form: head, pos: '名詞', pos_detail_1: isKatakanaWord(head) ? '固有名詞' : '一般',
          basic_form: head, reading: toKatakana(head) });
      }
      if (tail) tokens.push({ surface_form: tail, pos: '助動詞', pos_detail_1: '*', basic_form: tail });
      pending = '';
    }
    while (i < text.length) {
      var ch = text[i];
      if (/[、。，．,.!！?？…\s「」『』（）()]/.test(ch)) {
        flush();
        if (!/\s/.test(ch)) tokens.push({ surface_form: ch, pos: '記号', pos_detail_1: ch === '、' ? '読点' : '一般', basic_form: ch });
        i++; continue;
      }
      var hit = null;
      for (var len = Math.min(index.maxJaLen, text.length - i); len > 0; len--) {
        var w = text.substr(i, len);
        if (index.ja[w] || JA_SYNONYMS[w]) { hit = w; break; }
      }
      if (hit && (hit.length > 1 || !/[\u3040-\u309F]/.test(hit))) {
        flush();
        var e = index.ja[hit] || (typeof JA_SYNONYMS[hit] === 'string' && index.ja[JA_SYNONYMS[hit]]) || {};
        var pos = CAT_POS[e.cat] || '名詞';
        tokens.push({ surface_form: hit, pos: pos, pos_detail_1: pos === '動詞' ? '自立' : '一般', basic_form: hit });
        i += hit.length; continue;
      }
      var p = null;
      for (var k = 0; k < FALLBACK_PARTICLES.length; k++) {
        if (text.substr(i, FALLBACK_PARTICLES[k][0].length) === FALLBACK_PARTICLES[k][0]) { p = FALLBACK_PARTICLES[k]; break; }
      }
      if (p && (pending || (tokens.length && tokens[tokens.length - 1].pos !== '記号'))) {
        flush();
        tokens.push({ surface_form: p[0], pos: p[1], pos_detail_1: p[1] === '助詞' ? '格助詞' : '*',
          basic_form: p[0] === 'ません' ? 'ん' : p[0] === 'ました' ? 'た' : p[0] });
        i += p[0].length; continue;
      }
      pending += ch;
      i++;
    }
    flush();
    return tokens;
  }

  // ---------------------------------------------------------------------
  // 翻訳器
  // ---------------------------------------------------------------------
  function createTranslator(entries, options) {
    var index = buildIndex(entries);
    var opts = Object.assign({ pastMarker: false }, options || {});

    function setUserEntries(list) {
      // 利用者が追加した単語を優先する
      (list || []).forEach(function (e) {
        if (!e || !e.ja || !e.pz) return;
        var entry = { ja: e.ja, pz: e.pz, cat: 'ユーザー', kind: 'word', en: e.en ? [e.en] : [] };
        index.ja[e.ja] = entry;
        index.maxJaLen = Math.max(index.maxJaLen, e.ja.length);
        if (e.en) index.en[e.en.toLowerCase()] = entry;
      });
    }

    function word(pz, src, extra) {
      var item = { type: 'word', pz: pz, src: src };
      if (extra) Object.keys(extra).forEach(function (k) { item[k] = extra[k]; });
      return item;
    }
    function grammar(key, src) { return word(GRAMMAR[key], src || key, { grammar: key }); }

    function lookupJa(key) {
      if (!key) return null;
      var e = index.ja[key];
      if (e) return e;
      var syn = JA_SYNONYMS[key];
      if (Array.isArray(syn)) {
        var parts = syn.map(function (k) { return index.ja[k]; });
        if (parts.every(Boolean)) {
          return { ja: key, pz: parts.map(function (p) { return p.pz; }).join(' '), cat: parts[parts.length - 1].cat, kind: 'word' };
        }
        return null;
      }
      if (syn && syn.charAt(0) === '=') return { ja: key, pz: syn.slice(1), cat: '', kind: 'word' };
      if (syn) return index.ja[syn] || null;
      return null;
    }

    // ---------------- 日本語 ----------------

    function isContent(t) {
      var p = t.pos;
      if (p === '名詞' && /^(特殊|非自立|接尾)$/.test(t.pos_detail_1) && /^(特殊|非自立)$/.test(t.pos_detail_1)) return false;
      if (p === '名詞' || p === '形容詞' || p === '副詞' || p === '連体詞' || p === '接続詞' || p === '感動詞' || p === '接頭詞') {
        return t.pos_detail_1 !== '非自立' || p !== '名詞';
      }
      if (p === '動詞') return t.pos_detail_1 === '自立';
      return false;
    }
    function isFunctionalAdj(t) {
      return t.pos === '形容詞' && (t.basic_form === 'ない' || t.pos_detail_1 === '非自立');
    }

    // トークン列を文節に分ける
    function toPhrases(tokens) {
      var phrases = [];
      var cur = null;
      tokens.forEach(function (t) {
        if (/^\s+$/.test(t.surface_form)) return;
        if (t.pos === '記号' || /^[、。！？!?…]+$/.test(t.surface_form)) {
          cur = null;
          var last = phrases[phrases.length - 1];
          if (last && last.punct) last.surface += t.surface_form;
          else phrases.push({ punct: true, surface: t.surface_form });
          return;
        }
        var prev = cur && (cur.func.length ? cur.func[cur.func.length - 1] : cur.content[cur.content.length - 1]);
        var content = isContent(t) && !(isFunctionalAdj(t) && cur) &&
          // 「かもしれない」の「しれ」は付属語として扱う
          !(prev && prev.surface_form === 'かも' && /^(しれる|知れる)$/.test(t.basic_form));
        var continues = cur && (
          !content ? true :
          // 名詞の連続 (複合語)、サ変名詞＋する、形容動詞語幹など
          (cur.func.length === 0 && (
            (t.pos === '名詞' && cur.content[cur.content.length - 1].pos === '名詞') ||
            (t.pos === '動詞' && (t.basic_form === 'する' || t.basic_form === 'できる') &&
              cur.content[cur.content.length - 1].pos === '名詞') ||
            (cur.content[cur.content.length - 1].pos === '接頭詞')
          ))
        );
        if (!continues) {
          cur = { content: [], func: [] };
          phrases.push(cur);
        }
        if (content && cur.func.length === 0) cur.content.push(t);
        else cur.func.push(t);
      });
      return phrases;
    }

    // 文節の内容語を辞書引きして単語の列にする
    function translateContent(phrase) {
      var toks = phrase.content;
      var out = [];
      var consumedParticle = false;

      // 「私は」「それを」のように助詞込みの見出し語を先に試す
      var whole = toks.map(function (t) { return t.surface_form; }).join('');
      if (phrase.func.length && phrase.func[0].pos === '助詞') {
        var withP = lookupJa(whole + phrase.func[0].surface_form);
        if (withP) {
          return { words: [word(withP.pz, whole + phrase.func[0].surface_form, { entry: withP })], consumed: 1 };
        }
      }

      var i = 0;
      while (i < toks.length) {
        // 地名・人名などの固有名詞は訳さず、外来語として読む (資料の固有名詞 オルタ・アバド などは除く)
        if (toks[i].pos_detail_1 === '固有名詞' && !(index.ja[toks[i].surface_form] && index.ja[toks[i].surface_form].src === '資料')) {
          out.push(unknownToken(toks[i]));
          i++;
          continue;
        }
        // サ変名詞のあとの「する」「できる」は動詞化するだけなので訳さない (操作する → 操作)
        if (i > 0 && toks[i].pos === '動詞' && (toks[i].basic_form === 'する' || toks[i].basic_form === 'できる') &&
          toks[i - 1].pos === '名詞') { i++; continue; }
        var found = null, foundEnd = i;
        for (var j = toks.length; j > i; j--) {
          var seg = toks.slice(i, j);
          var surf = seg.map(function (t) { return t.surface_form; }).join('');
          var base = seg.slice(0, -1).map(function (t) { return t.surface_form; }).join('') +
            (seg[seg.length - 1].basic_form && seg[seg.length - 1].basic_form !== '*' ? seg[seg.length - 1].basic_form : seg[seg.length - 1].surface_form);
          found = lookupJa(surf) || lookupJa(base);
          if (found) { foundEnd = j; break; }
        }
        var src = found ? toks.slice(i, foundEnd).map(function (t) { return t.surface_form; }).join('') : '';
        // 形態素の境界をまたぐ見出し語 (亞人種 → 亞 + 人種 → 「亞人」、きさま → き + さま) を文字単位で探す
        var rest = toks.slice(i).map(function (t) { return t.surface_form; }).join('');
        var charHit = null;
        for (var n = Math.min(index.maxJaLen, rest.length); n >= 2 && n > src.length; n--) {
          if (n >= toks[i].surface_form.length && lookupJa(rest.slice(0, n))) { charHit = rest.slice(0, n); break; }
        }
        if (found && !charHit) {
          out.push(word(found.pz, src, { entry: found }));
          i = foundEnd;
          continue;
        }
        if (charHit) {
          var ce = lookupJa(charHit);
          out.push(word(ce.pz, charHit, { entry: ce }));
          var used = 0;
          while (i < toks.length && used + toks[i].surface_form.length <= charHit.length) { used += toks[i].surface_form.length; i++; }
          if (used < charHit.length && i < toks.length) i++; // 語の途中で終わった残り (亞人種の「種」) は読み飛ばす
          continue;
        }
        var t = toks[i];
        // 1語の中に見出し語が並んでいる場合は分割する (時半 → 時 + 半)
        // (一般名詞は外来語として読むので、助数詞などの接尾語と数だけを対象にする)
        var pieces = /^(接尾|数)$/.test(t.pos_detail_1) ? splitIntoEntries(t.surface_form) : null;
        if (pieces) {
          pieces.forEach(function (e) { out.push(word(e.entry.pz, e.text, { entry: e.entry })); });
          i++;
          continue;
        }
        // 接尾語 (～め、～たち など) や記号的な語は読み飛ばす
        if (t.pos === '名詞' && t.pos_detail_1 === '接尾' && i > 0) { i++; continue; }
        // サ変名詞のあとの「する」「できる」は動詞化するだけなので訳さない
        if (t.pos === '動詞' && (t.basic_form === 'する' || t.basic_form === 'できる') && i > 0) { i++; continue; }
        if (t.pos === '接頭詞' || /^[\u3083\u3085\u3087\u3063\u30E3\u30E5\u30E7\u30C3]/.test(t.surface_form)) { i++; continue; }
        out.push(unknownToken(t));
        i++;
      }
      return { words: out, consumed: consumedParticle ? 1 : 0 };
    }

    function splitIntoEntries(text) {
      if (text.length < 2) return null;
      var pieces = [];
      for (var p = 0; p < text.length;) {
        var hit = null;
        for (var n = Math.min(index.maxJaLen, text.length - p); n >= 1; n--) {
          var e = index.ja[text.substr(p, n)];
          if (e) { hit = { entry: e, text: text.substr(p, n) }; break; }
        }
        if (!hit) return null;
        pieces.push(hit);
        p += hit.text.length;
      }
      return pieces;
    }

    // 辞書にない語: 名詞・固有名詞は外来語として読み、それ以外は未知語にする
    function unknownToken(t) {
      if (t.pos === '名詞' && t.pos_detail_1 === '数' && /^[0-9０-９]+$/.test(t.surface_form)) {
        var n = parseInt(t.surface_form.replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }), 10);
        var nw = number(n);
        if (nw.length === 1) return nw[0];
        return word(nw.map(function (w) { return w.pz; }).join(' '), t.surface_form, { entry: null });
      }
      var reading = t.reading && t.reading !== '*' ? t.reading : toKatakana(t.surface_form);
      if (isKatakanaWord(t.surface_form)) return word(t.surface_form, t.surface_form, { loan: true });
      if (t.pos === '名詞') return word(toLoanword(reading), t.surface_form, { loan: true });
      return word(reading, t.surface_form, { unknown: true });
    }

    // 付属語 (助詞・助動詞) から文法情報を読み取る
    function analyzeFunc(phrase, startAt) {
      var info = { role: null, prep: null, gen: false, neg: false, past: false, want: false, must: false,
        passive: false, causative: false, maybe: false, guess: false, seems: false, question: false,
        copula: false, cond: false, but: false, and: false, because: false, before: false, prohibit: false, quote: false };
      var func = phrase.func.slice(startAt);
      var surf = func.map(function (t) { return t.surface_form; }).join('');
      if (/かもしれ|かも$/.test(surf)) info.maybe = true;
      if (/なければ|なきゃ|ねば|なくては|なくちゃ/.test(surf)) info.must = true;
      if (/^前に/.test(surf)) info.before = true;
      var copulaNeg = /^(では|じゃ)(ない|なかっ|なく|ありません|ねえ)/.test(surf);
      if (copulaNeg) { info.copula = true; info.neg = true; }
      func.forEach(function (t, k) {
        var b = t.basic_form !== '*' ? t.basic_form : t.surface_form;
        var s = t.surface_form;
        var d = t.pos_detail_1;
        if (t.pos === '助詞') {
          if (d === '格助詞' || d === '係助詞' || d === '副助詞' || d === '連体化' || d === '並立助詞' || /副助詞|並立助詞/.test(d)) {
            if (s === 'は' || s === 'が' || s === 'も') { if (!info.role && !copulaNeg) { info.role = 'subj'; info.particle = s; } }
            else if (s === 'を') info.role = 'obj';
            else if (s === 'の' && d === '連体化') info.gen = true;
            else if (s === 'に' || s === 'へ') { if (!info.role) info.role = 'dat'; }
            else if (s === 'と' && d === '引用') info.quote = true;
            else if (PREPOSITIONS[s] && !(copulaNeg && k === 0)) { info.role = 'adjunct'; info.prep = PREPOSITIONS[s]; }
            else if (s === 'か' && k === func.length - 1) info.question = true;
            else if (s === 'の' && k === func.length - 1) info.gen = true;
          } else if (d === '接続助詞') {
            if (s === 'ば') info.cond = true;
            else if (s === 'けど' || s === 'けれど' || s === 'けれども' || s === 'のに' || s === 'が') info.but = true;
            else if (s === 'から' || s === 'ので') info.because = true;
            else if (s === 'し') info.and = true;
          } else if (d === '終助詞' || /終助詞/.test(d)) {
            if (s === 'か' || s === 'かい' || s === 'の') info.question = true;
            if (s === 'な' && phrase.content.length && phrase.content[phrase.content.length - 1].pos === '動詞' &&
              phrase.content[phrase.content.length - 1].conjugated_form === '基本形') info.prohibit = true;
          } else if (s === 'か') {
            info.question = true;
          }
        } else if (t.pos === '助動詞' || (t.pos === '動詞' && d !== '自立') || t.pos === '形容詞') {
          if ((b === 'ない' || b === 'ぬ' || b === 'ん') && !info.maybe && !info.must) info.neg = true;
          else if (b === 'た') { if (t.conjugated_form === '仮定形') info.cond = true; else info.past = true; }
          else if (b === 'たい') info.want = true;
          else if (b === 'れる' || b === 'られる') info.passive = true;
          else if (b === 'せる' || b === 'させる') info.causative = true;
          else if (b === 'らしい') info.seems = true;
          else if (b === 'べし' || b === 'べき') info.must = true;
          else if (b === 'すぎる') info.too = true;
          else if (b === 'くださる' || b === 'ください') info.please = true;
          else if (b === 'だろう' || b === 'でしょう' || (b === 'う' && /^(だろ|でしょ)/.test(func[k - 1] ? func[k - 1].surface_form : ''))) info.guess = true;
          else if (b === 'だ' || b === 'です' || b === 'である') {
            if (t.conjugated_form === '仮定形' || s === 'なら') info.cond = true;
            else if (s === 'だろ' || s === 'でしょ') info.guess = true;
            else info.copula = true;
          }
          else if (b === 'できる' || b === 'える' || b === 'うる') info.can = true;
        }
      });
      if (/^なら|たら$|ったら$/.test(surf)) info.cond = true;
      if (info.must) info.cond = false; // 「しなければ」の「ば」は条件ではない
      // 「食べませんか」「行かないか」は否定ではなく勧誘
      if (info.neg && /(ません|ない)か$/.test(surf)) info.neg = false;
      return info;
    }

    // 文節の中心語 (基本形)
    function headWord(u) {
      var c = u.phrase.content;
      if (!c.length) return '';
      var last = c[c.length - 1];
      var base = last.basic_form && last.basic_form !== '*' ? last.basic_form : last.surface_form;
      if (c.length > 1 && last.pos === '動詞' && (base === 'する' || base === 'できる')) {
        last = c[c.length - 2];
        base = last.basic_form && last.basic_form !== '*' ? last.basic_form : last.surface_form;
      }
      return base;
    }

    function headType(phrase) {
      var c = phrase.content;
      if (!c.length) return 'none';
      var last = c[c.length - 1];
      if (last.pos === '動詞') return 'verb';
      if (last.pos === '形容詞') return 'adj';
      if (last.pos === '名詞' && last.pos_detail_1 === '形容動詞語幹') return 'adjn';
      if (last.pos === '副詞') return 'adv';
      if (last.pos === '接続詞') return 'conj';
      if (last.pos === '感動詞') return 'interj';
      if (last.pos === '連体詞') return 'det';
      if (last.pos === '名詞' && last.pos_detail_1 === '副詞可能' && !phrase.func.length) return 'adv';
      return 'noun';
    }

    // 1つの節 (句読点や接続助詞で区切られた範囲) を英語の語順に並べる
    function arrangeClause(phrases) {
      var units = phrases.map(function (p) {
        var tr = translateContent(p);
        var info = analyzeFunc(p, tr.consumed);
        if (tr.consumed && p.func[0]) {
          var s0 = p.func[0].surface_form;
          if (s0 === 'は' || s0 === 'が') { info.role = info.role || 'subj'; info.particle = info.particle || s0; }
          else if (s0 === 'を') info.role = 'obj';
          else if (s0 === 'の') info.gen = true;
        }
        return { phrase: p, words: tr.words, info: info, type: headType(p) };
      });

      // 「Aの」「静かな」「その」など、次の名詞を修飾するものをまとめる
      var merged = [];
      var carry = [];
      var mod = [];
      for (var m = units.length - 1; m >= 0; m--) {
        var nu = units[m + 1];
        mod[m] = !!nu && (nu.type === 'noun' || mod[m + 1]) && isModifier(units[m], nu);
      }
      function isModifier(u, next) {
        return !u.info.role && !u.info.prep && (
          u.info.gen || u.type === 'det' ||
          ((u.type === 'adj' || u.type === 'adjn' || u.type === 'verb') && !u.info.question &&
            (!u.phrase.func.length || /^(な|の|た|い)$/.test(u.phrase.func[u.phrase.func.length - 1].surface_form) ||
              u.phrase.content[u.phrase.content.length - 1].conjugated_form === '基本形')) ||
          (u.type === 'noun' && !u.phrase.func.length && u.words.length && next.words.length && next.type === 'noun')
        );
      }
      units.forEach(function (u, k) {
        if (mod[k]) {
          var ws = u.words.slice();
          if (u.info.gen && ws.length && !(ws[ws.length - 1].entry && /の$/.test(ws[ws.length - 1].entry.ja))) {
            var lastW = ws[ws.length - 1];
            ws[ws.length - 1] = word(lastW.pz + GRAMMAR.gen, lastW.src + 'の', { entry: lastW.entry, unknown: lastW.unknown, name: lastW.name });
          }
          carry = carry.concat(ws);
          return;
        }
        if (carry.length) { u.words = carry.concat(u.words); carry = []; }
        merged.push(u);
      });
      if (carry.length) merged.push({ words: carry, info: analyzeFunc({ func: [], content: [] }, 0), type: 'noun', phrase: { func: [], content: [] } });

      // 述語 = 最後の動詞・形容詞・コピュラを持つ文節 (なければ最後の文節)
      var predIdx = -1;
      for (var k = merged.length - 1; k >= 0; k--) {
        var u = merged[k];
        if (u.type === 'verb' || u.type === 'adj' || u.info.copula || u.type === 'adjn') { predIdx = k; break; }
      }
      if (predIdx < 0) {
        for (k = merged.length - 1; k >= 0; k--) {
          if (merged[k].type !== 'conj' && merged[k].type !== 'interj' && merged[k].type !== 'adv') { predIdx = k; break; }
        }
      }

      var front = [], subj = [], obj = [], rest = [], pred = [], tail = [], preAdv = [];
      var clauseInfo = predIdx >= 0 ? merged[predIdx].info : analyzeFunc({ func: [], content: [] }, 0);
      var predHead = predIdx >= 0 ? headWord(merged[predIdx]) : '';
      var likePred = !!LIKE_PREDICATES[predHead];

      // 「AとBが」は並列 (A カイ B)、それ以外の「Aと」は「～と一緒に」
      for (var c = merged.length - 2; c >= 0; c--) {
        var cu = merged[c], cn = merged[c + 1];
        if (c !== predIdx && cu.info.prep === PREPOSITIONS['と'] && cn.type === 'noun' && cn.info.role === 'subj') {
          cn.words = cu.words.concat([grammar('and', 'と')], cn.words);
          merged.splice(c, 1);
          if (predIdx > c) predIdx--;
        }
      }
      // 「好き」「欲しい」などは、が格を目的語にする (私は猫が好き → I like cats)
      if (likePred) {
        merged.forEach(function (u, k) {
          if (k !== predIdx && u.info.role === 'subj' && u.info.particle === 'が') u.info.role = 'obj';
        });
      }

      merged.forEach(function (u, k) {
        if (k === predIdx) return;
        if (FRONT_POS[u.phrase.content[0] && u.phrase.content[0].pos] && !u.info.role) { front = front.concat(u.words); return; }
        if (u.type === 'adv' && !u.info.role) {
          var first = u.phrase.content[0];
          var isAdverb = first && first.pos === '副詞';
          var entry = u.words[0] && u.words[0].entry;
          var sentenceLevel = !isAdverb || FRONT_ADVERBS[headWord(u)] ||
            (entry && /疑問|接続|挨拶|応答/.test(entry.cat || ''));
          if (sentenceLevel) front = front.concat(u.words);
          else preAdv = preAdv.concat(u.words);
          return;
        }
        if (u.info.role === 'subj') { subj = subj.concat(u.words); return; }
        if (u.info.role === 'obj') { obj = obj.concat(u.words); return; }
        var ws = u.words;
        if (u.info.prep) ws = [word(u.info.prep, u.phrase.func.map(function (t) { return t.surface_form; }).join(''), { grammar: 'prep' })].concat(ws);
        if (u.info.question) tail.push('？');
        rest = rest.concat(ws);
      });

      if (predIdx >= 0) {
        var p = merged[predIdx];
        var aux = [];
        if (clauseInfo.prohibit) aux.push(grammar('prohibit', 'な'));
        if (clauseInfo.must) aux.push(grammar('must', 'ねばならない'));
        if (clauseInfo.neg) aux.push(grammar('neg', 'ない'));
        if (clauseInfo.want) aux.push(grammar('want', 'たい'));
        if (clauseInfo.maybe) aux.push(grammar('maybe', 'かもしれない'));
        if (clauseInfo.guess) aux.push(grammar('guess', 'だろう'));
        if (clauseInfo.seems) aux.push(grammar('seems', 'らしい'));
        if (clauseInfo.passive) aux.push(grammar('passive', 'れる'));
        if (clauseInfo.causative) aux.push(grammar('causative', 'せる'));
        if (clauseInfo.too) aux.push(grammar('too', 'すぎる'));
        if (clauseInfo.past && opts.pastMarker && p.type === 'verb') aux.push(grammar('past', 'た'));
        var isNominal = p.type === 'noun' || p.type === 'adjn';
        // 「AはBだ」「Aは美しい」には英語の be 動詞にあたる「イエ」を入れる
        if (!likePred && subj.length && ((clauseInfo.copula && isNominal) || p.type === 'adj' || (p.type === 'adjn' && clauseInfo.copula))) {
          aux.push(grammar('copula', 'です'));
        }
        aux = aux.concat(preAdv);
        preAdv = [];
        var pw = p.words;
        if (p.info.role === 'obj') { obj = obj.concat(pw); pw = []; }
        else if (p.info.role === 'subj') { subj = subj.concat(pw); pw = []; }
        else if (p.info.prep) pw = [word(p.info.prep, '', { grammar: 'prep' })].concat(pw);
        pred = aux.concat(pw);
        if (clauseInfo.question) tail.push('？');
      }

      var lead = [];
      if (clauseInfo.cond) lead.push(grammar('cond', 'なら'));
      if (clauseInfo.before) lead.push(grammar('before', '前に'));
      if (clauseInfo.please) lead.push(grammar('please', 'ください'));

      var words = lead.concat(front, subj, preAdv, pred, obj, rest);
      return { words: words, tail: tail.length ? tail[0] : '', info: clauseInfo };
    }

    function translateJapaneseTokens(tokens) {
      var phrases = toPhrases(tokens);
      var sentences = [];
      var current = [];
      var clause = [];
      var pendingLead = [];

      function closeClause(punct) {
        if (clause.length) {
          var r = arrangeClause(clause);
          var ws = pendingLead.concat(r.info.because ? [grammar('because', 'から')] : [], r.words);
          pendingLead = [];
          if (r.info.but) pendingLead.push(grammar('but', 'けど'));
          if (r.info.and) pendingLead.push(grammar('and', 'し'));
          current = current.concat(ws);
          if (r.tail && !(punct && /[？?]/.test(punct))) current.push({ type: 'punct', pz: r.tail });
        }
        clause = [];
        if (punct) current.push({ type: 'punct', pz: punct });
      }

      phrases.forEach(function (p) {
        if (p.punct) {
          closeClause(p.surface);
          if (/[。！？!?]/.test(p.surface)) { sentences.push(current); current = []; pendingLead = []; }
          return;
        }
        clause.push(p);
        // 接続助詞 (ば・けど・から・て など) で節を区切る
        var last = p.func[p.func.length - 1];
        var hasConj = p.func.some(function (t) { return t.pos_detail_1 === '接続助詞' && t.surface_form !== 'て' && t.surface_form !== 'で'; });
        var isCond = last && (last.conjugated_form === '仮定形' || /^(たら|なら|ば)$/.test(last.surface_form));
        if (hasConj || isCond) closeClause('');
      });
      closeClause('');
      if (current.length) sentences.push(current);
      return finalize(sentences);
    }

    // ---------------- 英語 ----------------

    var EN_IRREGULAR = {
      went: 'go', gone: 'go', goes: 'go', came: 'come', saw: 'see', seen: 'see', said: 'say', told: 'tell',
      knew: 'know', known: 'know', thought: 'think', found: 'find', gave: 'give', given: 'give', took: 'take',
      taken: 'take', made: 'make', got: 'get', gotten: 'get', had: 'have', has: 'have', ate: 'eat', eaten: 'eat',
      flew: 'fly', flown: 'fly', fell: 'fall', fallen: 'fall', ran: 'run', left: 'leave', heard: 'hear',
      held: 'hold', kept: 'keep', lost: 'lose', met: 'meet', sold: 'sell', sent: 'send', slept: 'sleep',
      spoke: 'speak', spoken: 'speak', stood: 'stand', taught: 'teach', understood: 'understand', woke: 'wake',
      woken: 'wake', wore: 'wear', worn: 'wear', won: 'win', wrote: 'write', written: 'write', began: 'begin',
      begun: 'begin', broke: 'break', broken: 'break', brought: 'bring', built: 'build', burnt: 'burn',
      caught: 'capture', chose: 'choose', drew: 'draw', drove: 'drive', felt: 'feel', fought: 'fight',
      forgave: 'forgive', forgiven: 'forgive', froze: 'freeze', frozen: 'freeze', hid: 'hide', hurt: 'hurt',
      led: 'lead', let: 'let', lived: 'live', meant: 'mean', paid: 'pay', put: 'put', rose: 'rise', risen: 'rise',
      shot: 'shoot', shook: 'shake', shut: 'shut', sang: 'sing', sung: 'sing', sat: 'sit', stole: 'steal',
      stolen: 'steal', struck: 'strike', swore: 'swear', threw: 'throw', thrown: 'throw', died: 'die',
      children: 'children', people: 'people', men: 'man', women: 'woman', better: 'good', best: 'good',
      sown: 'sow', bore: 'bear', born: 'born', knit: 'knit', knitted: 'knit', did: 'do', done: 'done'
    };
    var EN_SKIP = { a: 1, an: 1, the: 1, do: 1, does: 1, did: 1, will: 1, shall: 1, would: 1, should: 1, to: 1,
      let: 0, us: 0, of: 1, at: 1, by: 1, so: 1, very: 0, just: 0, 'there': 1, 'let\'s': 1, oh: 0 };
    var EN_BE = { am: 1, is: 1, are: 1, was: 1, were: 1, be: 1, been: 1, being: 1 };
    var EN_PRON = {
      i: 'エナ', me: 'ム', my: 'ム', mine: 'ム', myself: 'イーゴ',
      you: 'トゥ', your: 'トゥース', yours: 'トゥース', yourself: 'トゥ',
      he: 'ノル', him: 'ノル', his: 'ノルル', she: 'ノル', her: 'ノル', hers: 'ノルル',
      we: 'ノスター', us: 'ノスター', our: 'ノステム', ours: 'ノステム',
      they: 'アフテ', them: 'アフテ', their: 'アフテル',
      this: 'ヒック', these: 'ホデ', that: 'アルヴォ', those: 'イド', here: 'エンタ', there: 'エケイ'
    };
    var EN_NEG = { not: 1, no: 1, never: 1, "n't": 1 };
    var EN_CONTRACTIONS = [
      [/\bcan't\b/g, 'can not'], [/\bwon't\b/g, 'will not'], [/\bshan't\b/g, 'shall not'], [/n't\b/g, ' not'],
      [/\bi'm\b/g, 'i am'], [/'re\b/g, ' are'], [/'ve\b/g, ' have'], [/'ll\b/g, ' will'], [/'d\b/g, ' would'],
      [/\b(it|that|what|where|who|he|she|there|here)'s\b/g, '$1 is'], [/\blet's\b/g, 'let us']
    ];

    function enLookupWord(w) {
      if (index.en[w]) return { entry: index.en[w], lemma: w };
      var cands = [];
      if (EN_IRREGULAR[w]) cands.push(EN_IRREGULAR[w]);
      if (/ies$/.test(w)) cands.push(w.slice(0, -3) + 'y');
      if (/ied$/.test(w)) cands.push(w.slice(0, -3) + 'y');
      if (/es$/.test(w)) cands.push(w.slice(0, -2));
      if (/s$/.test(w)) cands.push(w.slice(0, -1));
      if (/ed$/.test(w)) { cands.push(w.slice(0, -2)); cands.push(w.slice(0, -1)); cands.push(w.slice(0, -3)); }
      if (/ing$/.test(w)) { cands.push(w.slice(0, -3)); cands.push(w.slice(0, -3) + 'e'); cands.push(w.slice(0, -4)); }
      if (/ly$/.test(w)) cands.push(w.slice(0, -2));
      if (/er$/.test(w)) { cands.push(w.slice(0, -2)); cands.push(w.slice(0, -1)); }
      if (/est$/.test(w)) { cands.push(w.slice(0, -3)); cands.push(w.slice(0, -2)); }
      for (var i = 0; i < cands.length; i++) if (index.en[cands[i]]) return { entry: index.en[cands[i]], lemma: cands[i] };
      return null;
    }

    function isVerbEntry(e) { return e && (e.cat === '動詞' || /する$|る$|う$|く$|す$|つ$|ぶ$|む$|ぐ$/.test(e.ja) && e.cat !== '名詞'); }
    function looksParticiple(w) { return /(ed|en|wn|lt|ught)$/.test(w) || (EN_IRREGULAR[w] && EN_IRREGULAR[w] !== w); }

    function translateEnglish(text) {
      var sentences = [];
      var original = Object.create(null);
      (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []).forEach(function (w) { original[w.toLowerCase()] = w; });
      var lower = text.toLowerCase().replace(/[’‘]/g, "'");
      EN_CONTRACTIONS.forEach(function (c) { lower = lower.replace(c[0], c[1]); });
      var raw = lower.match(/[a-z0-9]+(?:[-'][a-z0-9]+)*|[.,!?;:…]+/g) || [];
      var current = [];
      var prevKind = 'start';
      for (var i = 0; i < raw.length; i++) {
        var w = raw[i];
        if (/^[.,!?;:…]+$/.test(w)) {
          var mark = w.replace(/\./g, '。').replace(/,/g, '、').replace(/[;:]/g, '、').replace(/\?/g, '？').replace(/!/g, '！');
          current.push({ type: 'punct', pz: mark });
          if (/[。！？]/.test(mark)) { sentences.push(current); current = []; prevKind = 'start'; }
          else prevKind = 'start';
          continue;
        }
        // 複数語の見出し (thank you, look for など)
        var multi = null;
        for (var n = Math.min(index.maxEnWords, raw.length - i); n > 1; n--) {
          var phrase = raw.slice(i, i + n).join(' ');
          if (index.en[phrase]) { multi = { entry: index.en[phrase], n: n, src: phrase }; break; }
        }
        if (multi) {
          current.push(word(multi.entry.pz, multi.src, { entry: multi.entry }));
          prevKind = isVerbEntry(multi.entry) ? 'verb' : 'word';
          i += multi.n - 1;
          continue;
        }
        if (/'s$/.test(w)) {
          var owner = w.slice(0, -2);
          var oe = enLookupWord(owner);
          current.push(word((oe ? oe.entry.pz : owner) + GRAMMAR.gen, w, { entry: oe && oe.entry, unknown: !oe }));
          prevKind = 'word';
          continue;
        }
        if (EN_NEG[w]) { current.push(grammar('neg', w)); continue; }
        if (EN_BE[w]) {
          var nx = raw[i + 1] || '';
          if (EN_NEG[nx]) { nx = raw[i + 2] || ''; }
          if (/ing$/.test(nx) && enLookupWord(nx)) continue; // 進行形
          if (looksParticiple(nx) && enLookupWord(nx) && isVerbEntry(enLookupWord(nx).entry)) {
            if (EN_NEG[raw[i + 1]]) { current.push(grammar('neg', raw[i + 1])); i++; }
            current.push(grammar('passive', w)); continue;
          }
          if (prevKind === 'start' && (raw[i + 1] && EN_PRON[raw[i + 1]])) { continue; } // Are you ...? の倒置
          current.push(grammar('copula', w));
          prevKind = 'verb';
          continue;
        }
        if (w === 'can' || w === 'could') { current.push(grammar('can', w)); prevKind = 'aux'; continue; }
        if (w === 'must') { current.push(grammar('must', w)); prevKind = 'aux'; continue; }
        if (w === 'maybe' || w === 'might' || w === 'may' || w === 'perhaps') { current.push(grammar('maybe', w)); continue; }
        if ((w === 'want' || w === 'wanna') && raw[i + 1] === 'to') { current.push(grammar('want', 'want to')); i++; prevKind = 'aux'; continue; }
        if (w === 'it') {
          current.push(word(prevKind === 'verb' || prevKind === 'prep' ? 'ツァ' : 'ダナ', w));
          prevKind = 'word';
          continue;
        }
        if (EN_PRON[w]) { current.push(word(EN_PRON[w], w)); prevKind = 'word'; continue; }
        if (EN_SKIP[w]) continue;
        if (/^\d+$/.test(w)) {
          number(parseInt(w, 10)).forEach(function (x) { current.push(x); });
          prevKind = 'word';
          continue;
        }
        var hit = enLookupWord(w);
        if (hit) {
          current.push(word(hit.entry.pz, w, { entry: hit.entry }));
          prevKind = isVerbEntry(hit.entry) ? 'verb' : (hit.entry.cat === '前置詞' ? 'prep' : 'word');
        } else {
          var orig = original[w] || w;
          // 辞書にない英単語は外来語としてそのまま読む
          current.push(word(orig, orig, { loan: true, latin: true }));
          prevKind = 'word';
        }
      }
      if (current.length) sentences.push(current);
      return finalize(sentences);
    }

    function number(n) {
      var e = lookupJa(String(n));
      if (e) return [word(e.pz, String(n), { entry: e })];
      if (n < 100) {
        var tens = Math.floor(n / 10) * 10, ones = n % 10;
        return number(tens).concat(ones ? number(ones) : []);
      }
      return [word(String(n), String(n), { unknown: true })];
    }

    // ---------------- 出力の整形 ----------------

    function romanOf(item) {
      if (item.latin) return item.pz;
      if (item.loan) return kanaToRoman(item.pz, true);
      var parts = item.pz.split(/\s+/);
      return parts.map(function (p) {
        if (index.roman[p]) return index.roman[p].toLowerCase();
        return kanaToRoman(p);
      }).join(' ');
    }

    function finalize(sentences) {
      var allWords = [];
      var text = [], roman = [];
      sentences.forEach(function (s) {
        var t = '', r = '';
        s.forEach(function (it) {
          if (it.type === 'punct') {
            t += it.pz;
            r += it.pz.replace(/、/g, ',').replace(/。/g, '.').replace(/？/g, '?').replace(/！/g, '!');
            return;
          }
          if (t && !/[、。…！？]$/.test(t)) t += ' ';
          if (r) r += ' ';
          t += it.pz;
          r += romanOf(it);
          allWords.push(it);
        });
        text.push(t.trim());
        roman.push(r.trim());
      });
      return {
        sentences: sentences,
        text: text.join(' '),
        roman: capitalize(roman.join(' ')),
        words: allWords,
        unknown: allWords.filter(function (w) { return w.unknown; }).map(function (w) { return w.src; }),
        loanwords: allWords.filter(function (w) { return w.loan; }).map(function (w) { return w.src; })
      };
    }

    function capitalize(s) { return s.replace(/(^|[.!?]\s+)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); }

    return {
      index: index,
      options: opts,
      setUserEntries: setUserEntries,
      translateJapaneseTokens: translateJapaneseTokens,
      translateEnglish: translateEnglish,
      // tokenizer: kuromoji の tokenizer (省略時は簡易解析)
      translate: function (text, tokenizer) {
        text = String(text || '').trim();
        if (!text) return finalize([]);
        // 形態素解析で分割されやすい語は先に漢字表記へ寄せる
        text = text.replace(/きさま/g, '貴様').replace(/おまえ/g, 'お前')
          .replace(/気をつけ/g, '用心し').replace(/気を付け/g, '用心し').replace(/気にし/g, '心配し');
        text = text.replace(/[（(][^）)]*[）)]/g, ' ').replace(/[「」『』【】〈〉《》"“”〝〟]/g, '').replace(/[\s\u3000]+/g, ' ').trim();
        if (hasJapanese(text)) {
          var tokens = tokenizer ? tokenizer.tokenize(text) : fallbackTokenize(text, index);
          return translateJapaneseTokens(tokens);
        }
        return translateEnglish(text);
      }
    };
  }

  return {
    createTranslator: createTranslator,
    fallbackTokenize: fallbackTokenize,
    kanaToRoman: kanaToRoman,
    toLoanword: toLoanword,
    hasJapanese: hasJapanese,
    GRAMMAR: GRAMMAR
  };
});
