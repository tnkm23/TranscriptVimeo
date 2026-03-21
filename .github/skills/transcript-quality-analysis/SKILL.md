---
name: transcript-quality-analysis
description: >
  Analyzes the quality of Vimeo video transcripts extracted via browser DevTools.
  Use when asked to evaluate transcript quality, measure filler word ratio, detect
  transcription errors, assess technical content density, or decide whether a
  transcript is suitable for AI summarization. Produces a structured quality report
  with actionable preprocessing recommendations.
license: Complete terms in LICENSE.txt
---

# Transcript Quality Analysis Skill

このスキルは Vimeo 動画から抽出した音声認識トランスクリプトの品質を定量的に評価し、
AI 要約（学習ノート生成）に適しているかどうかを判定します。

## When to Use This Skill

- 「このトランスクリプトの品質は？」
- 「学習ノートに変換できますか？」
- 「フィラーワードが多すぎますか？」
- 「転写エラーを調べて」
- 「transcript を分析して前処理の提案をして」
- 「動画の内容を理解できるか評価して」

## Prerequisites

- Node.js 18 以上
- 分析対象の `.txt` または `.json` 形式のトランスクリプトファイル
- `output/transcripts/` ディレクトリに保存済みであること

## Quality Metrics

以下の 5 指標でトランスクリプト品質を評価します。詳細は [quality-metrics.md](./references/quality-metrics.md) 参照。

| 指標 | 良好 | 要注意 | 不良 |
|---|---|---|---|
| フィラー率 | < 20% | 20–40% | > 40% |
| 技術用語密度 | > 30% | 15–30% | < 15% |
| 平均行長 | > 60 文字 | 40–60 文字 | < 40 文字 |
| 転写エラー推定数 | < 5 件 | 5–20 件 | > 20 件 |
| 総合判定 | 要約適合 | 前処理推奨 | 手動修正必要 |

## Step-by-Step Workflow

### 1. 分析スクリプトの実行

```powershell
node .github/skills/transcript-quality-analysis/scripts/analyze.js <transcript-file>
```

例：
```powershell
node .github/skills/transcript-quality-analysis/scripts/analyze.js output/transcripts/1164757132-1774082117875.txt
```

### 2. 出力レポートの確認

スクリプトは以下を標準出力に表示します：

```
=== Transcript Quality Report ===
File        : 1164757132-1774082117875.txt
Total lines : 709
Total chars : 59,980

[Filler Words]
  Lines with fillers : 275 / 709 (38.8%)
  Filler instances   : 412
  Most common        : uh(189), um(98), okay(47)

[Technical Content]
  Technical lines    : 270 / 709 (38.1%)
  Top terms          : density(39), velocity(37), VDB(35), grid(28)

[Transcription Errors]
  Suspected errors   : 12
  Examples           : "erian" → Eulerian, "laine" → Lagrangian, "manl" → mandrel

[Line Length]
  Average            : 84.6 chars
  Short lines (<40)  : 52 (7.3%)

[Overall Quality]
  Score  : 72 / 100
  Rating : ⚠️ FAIR — AI 前処理推奨
  Action : generateStudyNotes.js の preprocessTranscript() を通してから要約
```

### 3. 判定結果に応じたアクション

| 判定 | スコア | 推奨アクション |
|---|---|---|
| ✅ GOOD | 80–100 | そのまま `generateStudyNotes.js` で要約可 |
| ⚠️ FAIR | 50–79 | `preprocessTranscript()` 前処理後に要約 |
| ❌ POOR | 0–49 | 手動確認後、カスタム前処理を追加してから要約 |

### 4. 前処理パターンの適用（FAIR / POOR の場合）

転写エラーや固有の前処理が必要な場合は [preprocessing-patterns.md](./references/preprocessing-patterns.md) を参照してください。

## Troubleshooting

| 問題 | 原因 | 解決策 |
|---|---|---|
| `Cannot read file` | パスが間違っている | `output/transcripts/` 以下の正確なファイル名を指定 |
| JSON parse error | ファイルが JSON 形式 | スクリプトは自動で `content` フィールドを抽出 |
| 技術用語が 0% | 一般会話系の動画 | スコア基準を調整（`--domain general`）|
| フィラー率が異常に高い | 認識品質が低い | 別の抽出方法（`fetch-vimeo-transcripts.mjs`）を試す |

## References

- [Quality Metrics 定義](./references/quality-metrics.md)
- [Preprocessing Patterns](./references/preprocessing-patterns.md)
- プロジェクト内の関連スクリプト:
  - `scripts/generateStudyNotes.js` — 前処理 + OpenAI 要約
  - `scripts/browser/extractVirtualTranscript.js` — Vimeo からの抽出
