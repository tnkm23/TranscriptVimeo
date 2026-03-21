# TranscriptVimeo
Vimeo の動画からトランスクリプトを抽出し、Notion の学習ノートとして自動保存します。

---

## 🚀 自動パイプライン（推奨）

Playwright を使い、1コマンドで「抽出 → 保存 → Notion アップロード」を自動実行します。

### セットアップ

```powershell
# 依存パッケージのインストール (初回のみ)
npm install

# Chromium ブラウザのインストール (初回のみ)
npx playwright install chromium

# .env.example をコピーして環境変数を設定
copy .env.example .env
# .env を編集して NOTION_TOKEN, NOTION_PARENT_PAGE_ID, OPENAI_API_KEY を設定
```

### 実行

```powershell
# トランスクリプトのみ Notion に投稿
node scripts/pipeline.js https://vimeo.com/1164757132 --title "Building a Fluid Solver"

# トランスクリプト + AI 学習ノートの両方を Notion に投稿
node scripts/pipeline.js https://vimeo.com/1164757132 --title "Building a Fluid Solver" --notes

# タイトルを省略する場合（ページ <h1> から自動検出）
node scripts/pipeline.js https://vimeo.com/1164757132

# 別の AI モデルを使う場合 (default: gpt-4o-mini)
node scripts/pipeline.js https://vimeo.com/1164757132 --title "..." --notes --model gpt-4o
```

**パイプラインの処理フロー:**
1. Chromium ブラウザ（表示あり）で Vimeo URL を開く
2. トランスクリプトパネルを自動でクリックして開く
3. 仮想スクロールで全テキストを収集する
4. `output/transcripts/<videoId>-<timestamp>.txt` に保存する
5. Notion ページを作成してトランスクリプトをアップロードする
6. `--notes` 指定時: OpenAI で学習ノートを生成し `output/study-notes/` に保存後 Notion に投稿する

---

## 📚 学習ノート単体生成

既存のトランスクリプトファイルから学習ノートを生成できます。

```powershell
# Markdown のみ生成 (output/study-notes/ に保存)
node scripts/generateStudyNotes.js output/transcripts/1164757132-xxx.txt --title "Building a Fluid Solver"

# Markdown 生成 + Notion 投稿
node scripts/generateStudyNotes.js output/transcripts/1164757132-xxx.txt --title "Building a Fluid Solver" --post-notion

# モデルを指定する場合
node scripts/generateStudyNotes.js output/transcripts/xxx.txt --title "..." --model gpt-4o --post-notion
```

**生成される学習ノートの構成:**
```
# タイトル
## 学習ノート
### 概要
## 重要な概念
## 実装手順
## 応用方法
## まとめ
---
# トランスクリプト
[前処理済み原文]
```

---

## 🛠️ 手動スクリプト（DevTools）

### 仮想スクロール対応抽出

Vimeo のトランスクリプトパネルをスクロールしながら全テキストを収集します。

#### 実行方法

1. Vimeo の動画ページを開きます
2. `F12` でデベロッパーツールのコンソールを開きます
3. `scripts/browser/extractVirtualTranscript.js` の内容を貼り付けて実行します
4. スクロールが自動実行され、完了するとファイルがダウンロードされます

> トランスクリプトパネルが閉じていても、スクリプトが自動で開きます。

---

## 📤 Notion へ手動アップロード

```powershell
# トランスクリプトを Notion に手動投稿
node scripts/notionCreate-RealTranscript.js output/transcripts/1164757132-xxx.txt --title "Building a Fluid Solver"

# 学習ノート Markdown を Notion に手動投稿
node scripts/notionCreate-StudyNotes.js output/study-notes/building-a-fluid-solver-xxx.md --title "Building a Fluid Solver - 学習ノート"
```

---

## 🔍 トランスクリプト品質分析

抽出したトランスクリプトが AI 要約に適しているか事前に評価できます。

```powershell
node .github/skills/transcript-quality-analysis/scripts/analyze.js output/transcripts/<file>.txt
```

**出力例:**
```
=== Transcript Quality Report ===
File        : 1164757132-xxx.txt
Total lines : 709

[Filler Words]     74.2%  (um, so, uh が上位)
[Technical Content] 33.0%  (density, velocity, VDB 等)
[Transcription Errors] 6 件  (erian → Eulerian 等)
[Line Length]       84.6 chars 平均

Score  : 69 / 100
Rating : ⚠️ FAIR — preprocessTranscript() を通してから要約
```

| スコア | 判定 | 推奨アクション |
|---|---|---|
| 80–100 | ✅ GOOD | そのまま `generateStudyNotes.js` で要約可 |
| 50–79 | ⚠️ FAIR | 前処理後に要約（現行の `preprocessTranscript()` で対応） |
| 0–49 | ❌ POOR | 手動確認後、追加前処理を実施 |

JSON 形式での出力も可能：
```powershell
node .github/skills/transcript-quality-analysis/scripts/analyze.js <file>.txt --json
```

---

## 📁 ファイル構成

```
scripts/
├── pipeline.js                      # 自動パイプライン (Playwright)
├── generateStudyNotes.js            # transcript → 学習ノート Markdown 生成 (OpenAI)
├── notionCreate-RealTranscript.js   # transcript → Notion ページ作成
├── notionCreate-StudyNotes.js       # 学習ノート Markdown → Notion ページ作成
├── notionTest.js                    # Notion API 接続テスト
└── browser/
    ├── extractVirtualTranscript.js  # DevTools 用 (仮想スクロール対応)
    └── extract-transcript.js        # DevTools 用 (シンプル版)

output/
├── transcripts/   # 抽出したトランスクリプト (.txt)
└── study-notes/   # 生成した学習ノート (.md)

.github/skills/
└── transcript-quality-analysis/    # トランスクリプト品質分析スキル
    ├── SKILL.md                     # スキル定義・ワークフロー手順
    ├── scripts/analyze.js           # 品質分析スクリプト
    └── references/                  # 評価基準・前処理パターン集
```

---

## 🔑 必要な環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `NOTION_TOKEN` | Notion 統合トークン（`ntn_xxx...`） | 常に |
| `NOTION_PARENT_PAGE_ID` | 親ページまたはデータベースの ID（ハイフン無し） | 常に |
| `OPENAI_API_KEY` | OpenAI API キー（`sk-proj-xxx...`） | `--notes` / `generateStudyNotes.js` 使用時 |

`.env.example` を参考に `.env` を作成してください（`.gitignore` で除外済みです）。

```powershell
copy .env.example .env
# .env を編集して各値を設定
```

2026.3.21 chatGPTの有料プラン契約していないのでgenerateStudyNotesのパイプラインは断念。  
抽出したtranscriptを手動でchatGPTに投げて要約はできる。
トランスクリプトのみ Notion に投稿（node scripts/pipeline.js 　--コマンドなし）で運用する。
