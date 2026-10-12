// kuromoji.js 本体と辞書を vendor/kuromoji/ にコピーする (GitHub Pages やローカルサーバーで同じサイトから配信するため)
// 使い方: npm install && npm run vendor
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.dirname(require.resolve('kuromoji/package.json'));
const dest = path.join(root, 'vendor', 'kuromoji');

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(path.join(dest, 'dict'), { recursive: true });
fs.copyFileSync(path.join(src, 'build', 'kuromoji.js'), path.join(dest, 'kuromoji.js'));
for (const f of fs.readdirSync(path.join(src, 'dict'))) {
  fs.copyFileSync(path.join(src, 'dict', f), path.join(dest, 'dict', f));
}
fs.copyFileSync(path.join(src, 'LICENSE-2.0.txt'), path.join(dest, 'LICENSE-2.0.txt'));
console.log('copied kuromoji to ' + path.relative(root, dest));
