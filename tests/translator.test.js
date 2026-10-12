const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const kuromoji = require('kuromoji');
const Panzer = require('../js/translator.js');
const DICT = require('../data/dictionary.js');

const translator = Panzer.createTranslator(DICT);
let tokenizer;

test.before(() => new Promise((resolve, reject) => {
  const dicPath = path.join(path.dirname(require.resolve('kuromoji')), '..', 'dict');
  kuromoji.builder({ dicPath }).build((err, t) => (err ? reject(err) : resolve((tokenizer = t))));
}));

const ja = (s) => translator.translate(s, tokenizer).text;

test('辞書が資料から生成されている', () => {
  assert.ok(DICT.length > 600);
  const dragon = DICT.find((e) => e.ja === 'ドラゴン');
  assert.strictEqual(dragon.pz, 'デュラコーン');
});

test('ゲーム中の台詞と同じ訳になる', () => {
  assert.strictEqual(ja('黙れ！'), 'デ ナルヴ！');
  assert.strictEqual(ja('ちっ！厄介な！'), 'フェ！ インヴィトゥス！');
  assert.strictEqual(ja('一旦引くぞ！'), 'ポース ウィターレ！');
  assert.strictEqual(ja('ポンタ爺さんだ！'), 'ポンタ パッポス！');
});

test('英語の語順 (主語・述語・目的語) に並べ替える', () => {
  assert.strictEqual(ja('なぜ、私を助けた？'), 'ティ、アウクシリオ ム？');
  assert.strictEqual(ja('私は知らない'), 'エナ デ コグニトゥム');
  assert.strictEqual(ja('ドラゴンが空を飛んでいる'), 'デュラコーン ウォラーレ ウーラノス');
});

test('助詞込みの見出し語と所有格「～ル」', () => {
  assert.strictEqual(ja('私の名前はオルタです'), 'ム オノマ イエ オルタ');
  assert.strictEqual(ja('亞人の心'), 'コーレル メンタリ');
});

test('否定・願望・受け身・条件', () => {
  assert.strictEqual(ja('私は帝国の兵士ではない'), 'エナ デ イエ インペニアル ミーレス');
  assert.strictEqual(ja('静かな森へ行きたい'), 'ペス イーレ シーレ ゲノス');
  assert.strictEqual(ja('私は親から捨てられた！！'), 'エナ イェ レリクス アイオ パレンス！！');
  assert.strictEqual(ja('部屋を掃除しなければならない。'), 'ウイ プルガーレ コーラ。');
  assert.strictEqual(ja('一緒に昼ご飯を食べませんか？'), 'エスティ プランディウム イン？');
  assert.match(ja('夜が明けたら畑に麦を播こう'), /^アヌ .*セレーレ クリース/);
});

test('地名・人名と辞書にない名詞は外来語として読む', () => {
  const r = translator.translate('東京から大阪まで電車で行きます', tokenizer);
  assert.strictEqual(r.text, 'イーレ アイオ トーキョー ウスクェ オーサカ インタス トラクトゥス');
  assert.deepStrictEqual(r.loanwords, ['東京', '大阪']);
  assert.deepStrictEqual(r.unknown, []);
  assert.strictEqual(ja('こんにちは、私の名前は田中です。'), 'サルヴェ、ム オノマ イエ タナカ。');
  assert.strictEqual(ja('週末に警察へ行った'), 'イーレ フィニス ヘブドマディス ケーサツ');
  assert.strictEqual(Panzer.toLoanword('センセイ'), 'センセー');
});

test('名詞以外で辞書にない語は未知語として報告する', () => {
  const r = translator.translate('ぴょんぴょん跳ねる', tokenizer);
  assert.ok(r.unknown.length > 0);
});

test('一般会話 (拡張辞書)', () => {
  assert.strictEqual(ja('今日はとても暑いですね'), 'テメール イエ ウァルデ カリドゥス');
  assert.strictEqual(ja('私は猫と犬が好きです'), 'エナ アマーレ フェレス カイ カニス');
  assert.strictEqual(ja('お腹が空いたので、ご飯を食べよう'), 'カウサ ウェンテル エスリエ、エスティ ケーナ');
  assert.strictEqual(ja('ちょっと待ってください。'), 'クェソ パウルム エクスペクタ。');
  assert.strictEqual(ja('三時半です。'), 'トリニ ポース ディミディウム。');
  assert.strictEqual(ja('すみません、駅はどこですか？'), 'イグノスケ、スタティオ イエ ウビ？');
  const ext = DICT.filter((e) => e.src === '拡張');
  assert.ok(ext.length > 700);
  // 資料にある語は資料の訳を優先する
  assert.strictEqual(DICT.find((e) => e.ja === '見る').pz, 'プトラトマ');
});

test('英語入力', () => {
  const en = (s) => translator.translate(s).text;
  assert.strictEqual(en("I don't know what you are protecting."), 'エナ デ コグニトゥム クイッドゥ トゥ ディフェンシオ。');
  assert.strictEqual(en('Thank you, my friend.'), 'ベニグネ、ム エイミクス。');
  assert.strictEqual(en('The dragon is flying in the sky!'), 'デュラコーン ウォラーレ インタス ウーラノス！');
  assert.strictEqual(en('I like cats and dogs.'), 'エナ アマーレ フェレス カイ カニス。');
  assert.strictEqual(en('Please wait a moment.'), 'クェソ ペリトゥス パウルム。');
  const r = translator.translate('I want to go to Tokyo tomorrow.');
  assert.strictEqual(r.text, 'エナ ペス イーレ Tokyo ラス。');
  assert.deepStrictEqual(r.loanwords, ['Tokyo']);
});

test('kuromoji が使えないときの簡易解析でも翻訳できる', () => {
  const r = translator.translate('私の名前はオルタです');
  assert.strictEqual(r.text, 'ム オノマ イエ オルタ');
});

test('ローマ字表記はアゼルの綴りを優先する', () => {
  const r = translator.translate('なぜ、私を助けた？', tokenizer);
  assert.strictEqual(r.roman, 'Ty, auxilio mu?');
  assert.strictEqual(Panzer.kanaToRoman('ナウス'), 'naus');
});

test('利用者が追加した単語を使う', () => {
  const t = Panzer.createTranslator(DICT);
  t.setUserEntries([{ ja: '畑', pz: 'アルウム', en: 'farm' }]);
  assert.strictEqual(t.translate('畑に麦をまく', tokenizer).text, 'セレーレ クリース アルウム');
  assert.strictEqual(t.translate('my farm').text, 'ム アルウム');
});
