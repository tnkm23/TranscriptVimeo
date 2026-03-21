# TranscriptVimeo
Vimeo の動画からトランスクリプトを抽出し、Notion の学習ノートとして自動保存します。

---

## 🚀 自動パイプライン（推奨）

Playwright を使い、1コマンドで「抽出 → 保存 → Notion アップロード」を自動実行します。

### セットアップ

```powershell
# 依存パッケージのインストール (初回のみ)
npm install

# 環境変数を設定 (.env は .gitignore 済み)
$env:NOTION_TOKEN = "ntn_xxx_your_token"
$env:NOTION_PARENT_PAGE_ID = "your_page_ID_here"
```

### 実行

```powershell
# タイトルを指定する場合
node scripts/pipeline.js https://vimeo.com/1164757132 --title "Building a Fluid Solver"

# タイトルを省略する場合（ページ <h1> から自動検出）
node scripts/pipeline.js https://vimeo.com/1164757132
```

**パイプラインの処理フロー:**
1. Chromium ブラウザ（表示あり）で Vimeo URL を開く
2. トランスクリプトパネルを自動でクリックして開く
3. 仮想スクロールで全テキストを収集する
4. `output/transcripts/<videoId>-<timestamp>.txt` に保存する
5. Notion ページを作成してトランスクリプトをアップロードする

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
# 環境変数を設定してからスクリプトを実行
$env:NOTION_TOKEN = "ntn_xxx_your_token"
$env:NOTION_PARENT_PAGE_ID = "your_page_ID_here"

node scripts/notionCreate-RealTranscript.js <transcript-file> --title "Page Title"

# 例
node scripts/notionCreate-RealTranscript.js output/transcripts/1164757132-1234567890.txt --title "Building a Fluid Solver"
```

---

## 📁 ファイル構成

```
scripts/
├── pipeline.js                      # 自動パイプライン (Playwright)
├── notionCreate-RealTranscript.js   # Notion ページ作成
├── notionCreate-StudyNotes.js       # 学習ノート生成
├── notionTest.js                    # Notion API 接続テスト
└── browser/
    ├── extractVirtualTranscript.js  # DevTools 用 (仮想スクロール対応)
    └── extract-transcript.js        # DevTools 用 (シンプル版)

output/
├── transcripts/   # 抽出したトランスクリプト (.txt)
└── study-notes/   # 生成した学習ノート (.md)
```

---

## 🔑 必要な環境変数

| 変数名 | 説明 |
|--------|------|
| `NOTION_TOKEN` | Notion 統合トークン（`ntn_xxx...`） |
| `NOTION_PARENT_PAGE_ID` | 親ページまたはデータベースの ID（ハイフン無し） |

`.env.example` を参考に `.env` を作成してください（`.gitignore` で除外済みです）。
