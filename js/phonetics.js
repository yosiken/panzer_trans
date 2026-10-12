/*
 * パンツァー語の読み上げ表記
 *
 * カタカナのパンツァー語を、欧米の言語の綴りに変換する。
 * その言語の音声合成で読み上げると、カタカナの音に近いまま
 * ドイツ語・イタリア語などの発音と抑揚で発声できる。
 *
 *   ナウス       → de: naus     it: naus
 *   サルヴェ     → de: salweh   it: salve
 *   ヘスペリオス → de: hesperios it: hesperios
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PanzerPhonetics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------
  // カタカナ → 音節 (子音 + 母音)
  // ---------------------------------------------------------------------
  var ROWS = {
    '': 'アイウエオ', k: 'カキクケコ', g: 'ガギグゲゴ', s: 'サ-スセソ', z: 'ザ-ズゼゾ', t: 'タ--テト', d: 'ダ--デド',
    n: 'ナニヌネノ', h: 'ハヒ-ヘホ', b: 'バビブベボ', p: 'パピプペポ', m: 'マミムメモ', y: 'ヤ-ユ-ヨ', r: 'ラリルレロ', w: 'ワ---ヲ'
  };
  var VOWELS = 'aiueo';
  var SYL = Object.create(null);
  Object.keys(ROWS).forEach(function (c) {
    ROWS[c].split('').forEach(function (ch, i) {
      if (ch !== '-') SYL[ch] = [c, VOWELS[i]];
    });
  });
  SYL['ヲ'] = ['', 'o'];
  SYL['シ'] = ['sh', 'i']; SYL['ジ'] = ['j', 'i']; SYL['チ'] = ['ch', 'i']; SYL['ツ'] = ['ts', 'u'];
  SYL['ヂ'] = ['j', 'i']; SYL['ヅ'] = ['z', 'u']; SYL['フ'] = ['f', 'u']; SYL['ヴ'] = ['v', 'u'];
  // 小さい母音・ャュョ単独
  'ァィゥェォ'.split('').forEach(function (ch, i) { SYL[ch] = ['', VOWELS[i]]; });
  SYL['ャ'] = ['y', 'a']; SYL['ュ'] = ['y', 'u']; SYL['ョ'] = ['y', 'o']; SYL['ヮ'] = ['w', 'a'];

  // 2文字の組み合わせ
  var PAIRS = Object.create(null);
  function addYoon(base, c) {
    PAIRS[base + 'ャ'] = [c, 'a']; PAIRS[base + 'ュ'] = [c, 'u']; PAIRS[base + 'ョ'] = [c, 'o']; PAIRS[base + 'ェ'] = [c, 'e'];
  }
  addYoon('キ', 'ky'); addYoon('ギ', 'gy'); addYoon('ニ', 'ny'); addYoon('ヒ', 'hy'); addYoon('ビ', 'by');
  addYoon('ピ', 'py'); addYoon('ミ', 'my'); addYoon('リ', 'ry');
  addYoon('シ', 'sh'); addYoon('ジ', 'j'); addYoon('チ', 'ch');
  [['テ', 't'], ['デ', 'd']].forEach(function (p) {
    PAIRS[p[0] + 'ィ'] = [p[1], 'i']; PAIRS[p[0] + 'ュ'] = [p[1] + 'y', 'u'];
  });
  PAIRS['トゥ'] = ['t', 'u']; PAIRS['ドゥ'] = ['d', 'u']; PAIRS['ツゥ'] = ['ts', 'u'];
  ['ファ', 'フィ', 'フェ', 'フォ'].forEach(function (k, i) { PAIRS[k] = ['f', 'aieo'[i]]; });
  PAIRS['フュ'] = ['fy', 'u'];
  ['ヴァ', 'ヴィ', 'ヴェ', 'ヴォ'].forEach(function (k, i) { PAIRS[k] = ['v', 'aieo'[i]]; });
  ['ウィ', 'ウェ', 'ウォ'].forEach(function (k, i) { PAIRS[k] = ['w', 'ieo'[i]]; });
  ['ツァ', 'ツィ', 'ツェ', 'ツォ'].forEach(function (k, i) { PAIRS[k] = ['ts', 'aieo'[i]]; });
  ['クァ', 'クィ', 'クェ', 'クォ'].forEach(function (k, i) { PAIRS[k] = ['kw', 'aieo'[i]]; });
  PAIRS['ウァ'] = ['w', 'a']; PAIRS['グァ'] = ['gw', 'a']; PAIRS['スィ'] = ['s', 'i']; PAIRS['ズィ'] = ['z', 'i']; PAIRS['イェ'] = ['y', 'e'];

  function toKatakana(s) {
    return String(s || '').replace(/[\u3041-\u3096]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); });
  }

  // 1語を音節の列にする: { c: 子音, v: 母音, long: 長音, gem: 促音 } / { n: true } (撥音)
  function parse(word) {
    var s = toKatakana(word);
    var out = [];
    var gem = false;
    for (var i = 0; i < s.length;) {
      var ch = s[i];
      if (ch === 'ッ') { gem = true; i++; continue; }
      if (ch === 'ン') { out.push({ n: true }); i++; continue; }
      if (ch === 'ー' || ch === '―' || ch === '－') {
        var last = out[out.length - 1];
        if (last && !last.n) last.long = true;
        i++; continue;
      }
      var pair = PAIRS[s.substr(i, 2)];
      var syl = pair || SYL[ch];
      if (!syl) { i++; continue; }
      out.push({ c: syl[0], v: syl[1], gem: gem });
      gem = false;
      i += pair ? 2 : 1;
    }
    // ラテン語風に母音の「ウ」を落とす (後ろから決める)
    //   語末:        ナウス → naus、ノル → nol、タブ → tab
    //   子音の前:    エクス → eks、サルヴェ → salve、スピリトゥス → spiritus
    var NO_MUTE = /^(|y|w|h|n|sh|ch|j|ts|ky|gy|ny|hy|by|py|my|ry|ty|dy|fy|kw|gw|v)$/;
    for (var k = out.length - 1; k >= 0; k--) {
      var x = out[k];
      if (x.n || x.long || x.v !== 'u' || NO_MUTE.test(x.c)) continue;
      var next = out[k + 1];
      if (!next) { if (out.length > 1) x.mute = true; continue; }
      if (next.n || !next.c || /^[yw]$/.test(next.c)) continue;
      if (next.mute && !(x.c === 'k' && next.c === 's')) continue;
      if (/^[skgbpf]$/.test(x.c) || (x.c === 'r' && k > 0)) x.mute = true; // エクスペ → ekspe も含む
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // 言語ごとの綴り
  // ---------------------------------------------------------------------
  function front(v) { return v === 'e' || v === 'i'; }

  var LANGS = {
    de: {
      name: 'ドイツ語風',
      voiceLang: 'de',
      cons: function (c) {
        return { '': '', k: 'k', g: 'g', s: 's', sh: 'sch', z: 's', j: 'dsch', t: 't', ts: 'z', ch: 'tsch', d: 'd',
          n: 'n', h: 'h', f: 'f', b: 'b', p: 'p', m: 'm', y: 'j', r: 'r', w: 'w', v: 'w',
          ky: 'kj', gy: 'gj', ny: 'nj', hy: 'hj', by: 'bj', py: 'pj', my: 'mj', ry: 'rj', ty: 'tj', dy: 'dj', fy: 'fj',
          kw: 'qu', gw: 'gu' }[c];
      },
      vowel: function (v, long, isFinal) {
        if (long) return { a: 'ah', i: 'ie', u: 'uh', e: 'eh', o: 'oh' }[v];
        if (isFinal && v === 'e') return 'eh'; // 語末の e が弱く (シュワーに) ならないように
        return v;
      },
      gem: function (cons) { return cons === 'k' ? 'ck' : cons === 'z' ? 'tz' : cons ? cons[0] + cons : cons; }
    },
    it: {
      name: 'イタリア語風',
      voiceLang: 'it',
      cons: function (c, v) {
        var f = front(v);
        switch (c) {
          case 'k': return f ? 'ch' : 'c';
          case 'g': return f ? 'gh' : 'g';
          case 'sh': return f ? 'sc' : 'sci';
          case 'ch': return f ? 'c' : 'ci';
          case 'j': return f ? 'g' : 'gi';
          case 'ky': return 'chi';
          case 'gy': return 'ghi';
          case 'ny': return 'gn';
        }
        return { '': '', s: 's', z: 's', t: 't', ts: 'z', d: 'd', n: 'n', h: 'h', f: 'f', b: 'b', p: 'p', m: 'm',
          y: 'i', r: 'r', w: 'v', v: 'v', hy: 'i', by: 'bi', py: 'pi', my: 'mi', ry: 'ri', ty: 'ti', dy: 'di', fy: 'fi',
          kw: 'qu', gw: 'gu' }[c];
      },
      vowel: function (v) { return v; },
      gem: function (cons) { return cons ? cons[0] + cons : cons; }
    },
    es: {
      name: 'スペイン語風',
      voiceLang: 'es',
      cons: function (c, v) {
        var f = front(v);
        switch (c) {
          case 'k': return f ? 'qu' : 'c';
          case 'g': return f ? 'gu' : 'g';
          case 'ky': return 'qui';
          case 'gy': return 'gui';
          case 'kw': return 'cu';
        }
        return { '': '', s: 's', sh: 'sh', z: 's', j: 'y', t: 't', ts: 'ts', ch: 'ch', d: 'd', n: 'n', h: 'j', f: 'f',
          b: 'b', p: 'p', m: 'm', y: 'y', r: 'r', w: 'v', v: 'v', ny: 'ñ', hy: 'ji', by: 'bi', py: 'pi', my: 'mi',
          ry: 'ri', ty: 'ti', dy: 'di', fy: 'fi', gw: 'gu' }[c];
      },
      vowel: function (v) { return v; },
      gem: function (cons) { return cons; }
    },
    en: {
      name: '英語風',
      voiceLang: 'en',
      cons: function (c) {
        return { '': '', k: 'k', g: 'g', s: 's', sh: 'sh', z: 'z', j: 'j', t: 't', ts: 'ts', ch: 'ch', d: 'd', n: 'n',
          h: 'h', f: 'f', b: 'b', p: 'p', m: 'm', y: 'y', r: 'r', w: 'w', v: 'v',
          ky: 'ky', gy: 'gy', ny: 'ny', hy: 'hy', by: 'by', py: 'py', my: 'my', ry: 'ry', ty: 'ty', dy: 'dy', fy: 'fy',
          kw: 'qu', gw: 'gw' }[c];
      },
      vowel: function (v, long, isFinal) {
        // 英語の綴りは母音の読みが揺れるので、音が決まりやすい綴りにする
        if (isFinal || long) return { a: 'ah', i: 'ee', u: 'oo', e: 'eh', o: 'oh' }[v];
        return { a: 'a', i: 'i', u: 'u', e: 'e', o: 'o' }[v];
      },
      gem: function (cons) { return cons ? cons[0] + cons : cons; }
    }
  };

  function word(katakana, lang) {
    var L = LANGS[lang];
    if (!L) return katakana;
    var syls = parse(katakana);
    var out = '';
    syls.forEach(function (x, i) {
      var next = syls[i + 1];
      if (x.n) {
        out += next && !next.n && /^[bpm]/.test(next.c || '') ? 'm' : 'n';
        return;
      }
      var cons = L.cons(x.c, x.v) || '';
      // 子音の前・語末で母音を落とした「ル」はラテン語の l にあたる (サルヴェ → salve)
      if (x.mute && x.c === 'r') cons = 'l';
      if (x.gem && !x.mute) cons = L.gem(cons);
      if (x.mute) { out += cons; return; }
      // 母音が連続するときは区切りが読まれるように y / w を補わない (de: "naus")
      out += cons + L.vowel(x.v, !!x.long, i === syls.length - 1);
    });
    return out;
  }

  // 資料 (アゼルの綴り) や拡張辞書にラテン語・ギリシャ語の綴りがある語はその綴りで読む。
  // 英語の音声はラテン語の綴りを英語読みしてしまうので、英語風ではカタカナから作った綴りを使う。
  function spelling(item, lang) {
    if (lang === 'en' || !item.entry || !item.entry.roman) return '';
    var r = item.entry.roman.toLowerCase().replace(/-/g, ' ');
    return /^[a-z ]+$/.test(r) ? r : '';
  }

  var PUNCT = { '、': ',', '。': '.', '？': '?', '！': '!', '…': '...', '?': '?', '!': '!' };

  // 翻訳結果の1文 (items) を読み上げ用の文字列にする
  function sentence(items, lang) {
    var text = '';
    items.forEach(function (it) {
      if (it.type === 'punct') {
        text += it.pz.split('').map(function (c) { return PUNCT[c] || ''; }).join('');
        return;
      }
      var w = it.latin ? it.pz : spelling(it, lang) || it.pz.split(/\s+/).map(function (p) { return word(p, lang); }).join(' ');
      if (!w) return;
      text += (text && !/\s$/.test(text) ? ' ' : '') + w;
    });
    text = text.replace(/\s+([,.?!])/g, '$1').trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  return {
    LANGS: LANGS,
    parse: parse,
    word: word,
    sentence: sentence
  };
});
