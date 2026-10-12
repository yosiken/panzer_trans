const test = require('node:test');
const assert = require('node:assert');
const F = require('../js/phonetics.js');
const Panzer = require('../js/translator.js');
const DICT = require('../data/dictionary.js');

test('カタカナを各言語の綴りにする', () => {
  assert.strictEqual(F.word('ナウス', 'de'), 'naus');
  assert.strictEqual(F.word('サルヴェ', 'it'), 'salve');
  assert.strictEqual(F.word('ウァルデ', 'it'), 'valde');
  assert.strictEqual(F.word('スピリトゥス', 'de'), 'spiritus');
  assert.strictEqual(F.word('シャ', 'de'), 'scha');
  assert.strictEqual(F.word('チェ', 'it'), 'ce');
  assert.strictEqual(F.word('ケーキ', 'es'), 'quequi');
  assert.strictEqual(F.word('トーキョー', 'de'), 'tohkjoh');
  assert.strictEqual(F.word('ブラッキオン', 'de'), 'brackion');
});

test('綴りのある語はラテン語の綴りで読み、句読点と大文字を整える', () => {
  const t = Panzer.createTranslator(DICT);
  const r = t.translate('Hello! I like cats and dogs?');
  const s = r.sentences.map((x) => F.sentence(x, 'de'));
  assert.strictEqual(s[0], 'Salve!');
  assert.match(s[1], /^Ena amare feles kai canis\?$/);
  // 英語風はラテン語の綴りを使わない
  assert.strictEqual(F.sentence(r.sentences[0], 'en'), 'Salveh!');
});
