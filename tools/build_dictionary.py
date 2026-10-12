#!/usr/bin/env python3
"""辞書の表 (TSV) から data/dictionary.js を生成する。

使い方:  python3 tools/build_dictionary.py

入力:
  tools/source_dictionary.tsv    資料 (パンツァー語辞典_ORTA.xls / パンツァー語辞書.xlsx) から取り出した辞書
  tools/english_glosses.tsv      資料の語の英訳 (英語入力用)
  tools/extended_dictionary.tsv  一般会話用の拡張辞書 (資料に同じ見出しがあれば資料を優先)
"""
import json
import pathlib
import unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE_TSV = ROOT / "tools" / "source_dictionary.tsv"
GLOSS_TSV = ROOT / "tools" / "english_glosses.tsv"
EXTENDED_TSV = ROOT / "tools" / "extended_dictionary.tsv"
OUT = ROOT / "data" / "dictionary.js"


def norm(s):
    """全角英数を半角にし、前後の空白を除く。"""
    return unicodedata.normalize("NFKC", str(s)).strip().replace("　", " ")


def rows(path, ncols):
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        cols = line.split("\t") + [""] * ncols
        yield [c.strip() for c in cols[:ncols]]


def load_glosses():
    return {ja: [w.strip() for w in en.split(",") if w.strip()] for ja, en in rows(GLOSS_TSV, 2)}


def main():
    entries = []
    seen = set()
    gloss = load_glosses()

    # 1. 資料の辞書
    for ja, pz, cat, note, kind, roman in rows(SOURCE_TSV, 6):
        e = {"ja": ja, "pz": pz, "cat": cat, "note": note, "kind": kind or "word"}
        if roman:
            e["roman"] = roman
        if ja in gloss:
            e["en"] = gloss[ja]
        e["src"] = "資料"
        seen.add((ja, pz))
        entries.append(e)

    # 2. 一般会話用の拡張辞書 (資料に同じ見出しがあれば資料を優先)
    official = {e["ja"] for e in entries}
    extended = 0
    for jas, pz, spell, en, cat in rows(EXTENDED_TSV, 5):
        for ja in jas.split("|"):
            ja = norm(ja)
            if not ja or ja in official or (ja, pz) in seen:
                continue
            seen.add((ja, pz))
            official.add(ja)
            entries.append({"ja": ja, "pz": pz, "cat": cat, "note": "", "kind": "word", "src": "拡張",
                            "roman": spell.upper(), "en": [w.strip() for w in en.split(",") if w.strip()]})
            extended += 1

    OUT.parent.mkdir(exist_ok=True)
    body = "[\n" + ",\n".join(json.dumps(e, ensure_ascii=False) for e in entries) + "\n]"
    OUT.write_text(
        "// 自動生成ファイル: tools/build_dictionary.py で再生成してください\n"
        "(function (root) {\n"
        "  var DICT = " + body + ";\n"
        "  if (typeof module === 'object' && module.exports) module.exports = DICT;\n"
        "  else root.PANZER_DICT = DICT;\n"
        "})(typeof self !== 'undefined' ? self : this);\n",
        encoding="utf-8")
    print(f"{len(entries)} entries ({extended} extended) -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
