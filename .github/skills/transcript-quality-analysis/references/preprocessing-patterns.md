# Transcript Preprocessing Patterns

品質評価 (FAIR / POOR) の結果を受けて、`generateStudyNotes.js` の `preprocessTranscript()` に
追加できる前処理パターンをカタログ化したリファレンスです。

## 現在実装済みの前処理 (generateStudyNotes.js)

```js
text
  .replace(/(\d+)\.\n(\d)/g, '$1.$2')        // 分割数値の結合: "0.\n6" → "0.6"
  .replace(/^(Um|Uh),\s*/gim, '')             // センテンス先頭の "Um," / "Uh," を除去
  .replace(/\berian\b/gi, 'Eulerian')          // 既知転写エラー修正
  .replace(/\blaine\b/gi, 'Lagrangian')
  .replace(/\bmanl\b/gi, 'mandrel')
  .replace(/\bdist distort\b/gi, 'distort')
  .replace(/^(uh|um|okay|alright|right|yeah|yep|oh|ah|hmm|oops)[.,!]*\s*$/gim, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim()
```

---

## 追加パターン集

### カテゴリ 1: フィラーワード除去強化

フィラー率が 40% 超の場合に追加を検討。

```js
// 行中のフィラー語（文脈を壊さない軽度のもの）を除去
.replace(/,\s*(uh|um|uhm)\s*,/gi, ',')        // "A, uh, B" → "A, B"
.replace(/\s+(uh|um|uhm)\s+/gi, ' ')          // 行中の uh/um を空白1つに
.replace(/\byou know\b[,]?\s*/gi, '')          // "you know" を除去
.replace(/\bi mean\b[,]?\s*/gi, '')            // "i mean" を除去
.replace(/\bkind of\b\s*/gi, '')               // "kind of" を除去（文意に影響少）
```

> ⚠️ 注意: 行中フィラー除去は文意を壊すリスクがある。POOR 判定時のみ適用を推奨。

---

### カテゴリ 2: 転写エラー修正の拡張

新しい固有名詞エラーが見つかった場合に追加。

```js
// Houdini 固有名詞
.replace(/\bcop net\b/gi, 'COP net')
.replace(/\bconet\b/gi, 'COP net')
.replace(/\bvd b\b/gi, 'VDB')                 // スペース入りの VDB
.replace(/\bsd f\b/gi, 'SDF')                 // スペース入りの SDF
.replace(/\bopen cl\b/gi, 'OpenCL')
.replace(/\bman tray\b/gi, 'Mantra')           // レンダラー名
.replace(/\bkar ma\b/gi, 'Karma')              // レンダラー名

// 数値・単位の正規化
.replace(/(\d+)\s*x\s*(\d+)/g, '$1×$2')       // "100 x 100" → "100×100"
.replace(/(\d+)\s*k\b/gi, '$1K')               // "16 k" → "16K"
```

---

### カテゴリ 3: 構造改善

平均行長が短い（< 40 文字）場合に、断片的な短文をセンテンスに結合。

```js
// 小文字で始まる行（文の継続）を前の行に結合
.replace(/\n([a-z])/g, ' $1')

// 句読点なしで終わる行の後に続く行を結合（積極的）
.replace(/([^.!?\n])\n(?=[A-Za-z])/g, '$1 ')
```

> ⚠️ 注意: これは攻撃的な変換です。意図的な改行（箇条書き等）を壊す可能性があります。
> POOR 判定 かつ 行長が 40 文字未満の場合にのみ使用してください。

---

### カテゴリ 4: 反復・重複の除去

同一または類似したセンテンスが繰り返される場合。

```js
// 連続する重複行を除去
const dedupedLines = [];
let prevLine = '';
for (const line of text.split('\n')) {
  const normalized = line.toLowerCase().trim();
  if (normalized && normalized !== prevLine) {
    dedupedLines.push(line);
    prevLine = normalized;
  }
}
return dedupedLines.join('\n');
```

---

## パターン適用の判断フロー

```
analyze.js でスコア確認
       │
       ├─ GOOD (80+)  → そのまま generateStudyNotes.js を実行
       │
       ├─ FAIR (50-79)
       │      ├─ フィラー率 > 35%  → カテゴリ 1 を追加
       │      ├─ 転写エラー > 10    → カテゴリ 2 を確認・追加
       │      └─ それ以外           → 既存の前処理のみで十分
       │
       └─ POOR (0-49)
              ├─ 行長 < 40 文字    → カテゴリ 3 を検討
              ├─ フィラー率 > 50%  → カテゴリ 1 + 4 を追加
              └─ 人間によるレビューを推奨
```

---

## generateStudyNotes.js への追加方法

`scripts/generateStudyNotes.js` の `preprocessTranscript()` 関数内の
`.trim()` の前に追記します：

```js
function preprocessTranscript(text) {
  return text
    // --- 既存処理 ---
    .replace(/(\d+)\.\n(\d)/g, '$1.$2')
    // ... (既存コード) ...

    // --- 追加処理（analyze.js の判定結果に基づいて追加） ---
    .replace(/,\s*(uh|um|uhm)\s*,/gi, ',')   // 行中フィラー除去
    .replace(/\bvd b\b/gi, 'VDB')             // 転写エラー修正追加

    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```
