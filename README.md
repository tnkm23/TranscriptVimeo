# TranscriptVimeo
Extract transcripts from Vimeo

## 仮想スクロール対応抽出スクリプト

これはChromeのDevtoolでVimeoの動画からtranscriptを抽出するコードです。

### 説明

「特定のコンテナ内を少しずつスクロール」→「現れた要素を保存」→「さらにスクロール」という処理を繰り返すことで、仮想スクロールされているトランスクリプト全体を抽出します。

### 実行方法

1. Vimeo/SideFXのページを開き、トランスクリプトが表示されている状態にします。
   - デフォルトでは表示されていないので、"transcript"をクリックして表示する必要があります。

2. F12キー（または右クリック > 検証）でコンソールを開きます。

3. `extract-transcript.js` のコードを貼り付けてEnterを押します。

4. 画面が自動で少しずつスクロールされ、最後にファイルがダウンロードされます。

## Notion への投稿

Notion へページを作成するスクリプト（notionCreate-RealTranscript.js / notionTest.js）は、トークン等を環境変数から読み込みます。リポジトリに秘密情報を含めないための設定です。

- 必要な環境変数:
  - NOTION_TOKEN: Notion の統合トークン（例: ntn_xxx...）
  - NOTION_PARENT_PAGE_ID: 親ページまたはデータベースのID（ハイフン無し）

### セットアップ手順

1. .env.example を参考に .env を作成し、上記2つの値を設定します。
2. Windows PowerShell で環境を読み込む例:
   - `$env:NOTION_TOKEN = "ntn_xxx_your_token"`
   - `$env:NOTION_PARENT_PAGE_ID = "bc60fd201be74d06adc8ddcbf8a45a5c"`
3. 実行例:
   - `node notionCreate-RealTranscript.js transcript-latest.txt`

※ .gitignore により .env はコミット対象外です。過去のコミットにトークンが含まれている場合は、履歴の書き換え（filter-repo/BFG）とトークンのローテーションを行ってください。
