# MCP Server 設定変更ログ

## 2026-03-21 — 端末Cubewin（Windows）での接続エラー修正

### 背景

元の `.vscode/mcp.json` は **端末LnvId** で構築・動作確認済みのもの。  
**端末Cubewin**（本変更を加えた端末）にリポジトリをコピーして GitHub Copilot CLI を起動したところ、以下のエラーが発生した。

```
! Failed to connect to MCP server 'youtube-dlp'
! Failed to connect to MCP server 'git'
! Failed to connect to MCP server 'filesystem'
! Failed to connect to MCP server 'youtube-transcript'
! MCP server 'Notion' is taking longer than expected to connect.
```

---

### 端末依存の差異

| 項目 | LnvId（元の環境） | 端末Cubewin（本端末） |
|---|---|---|
| `uvx` | インストール済み | **未インストール**（`uv` ツール自体が無かった） |
| `filesystem` パス | LnvId のローカルパスが設定済み | プレースホルダーのまま（`/path/to/allowed/files`） |
| `@modelcontextprotocol/server-youtube-transcript` | npm に存在 / LnvIdで動作 | npm registry に **404** (現在は存在しないか削除されたパッケージ) |

---

### 変更内容

#### 1. `youtube-transcript` — パッケージ名を変更

LnvId の npm キャッシュには存在していたが、現在の npm registry には見つからない。  
代替パッケージ `@kimtaeyoon83/mcp-server-youtube-transcript` (v0.1.1, MIT) に変更。

```json
// 変更前（LnvId で動作していた設定）
"youtube-transcript": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-youtube-transcript"],
    "type": "stdio"
}

// 変更後（端末Cubewin 用）
"youtube-transcript": {
    "command": "npx",
    "args": ["-y", "@kimtaeyoon83/mcp-server-youtube-transcript"],
    "type": "stdio"
}
```

> ⚠️ LnvId で `@modelcontextprotocol/server-youtube-transcript` が再び動作するなら、LnvId の設定は元に戻す必要はない。

#### 2. `filesystem` — パスを端末Cubewin のローカルパスに変更

```json
// 変更前（プレースホルダー／LnvId では実パスが入っていたはず）
"args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"]

// 変更後（端末Cubewin のプロジェクトパス）
"args": ["-y", "@modelcontextprotocol/server-filesystem", "D:/python/TranscriptVimeo"]
```

> ⚠️ このパスは **端末依存**。別の端末では自分の環境に合わせて変更すること。

#### 3. `git` / `youtube-dlp` — `uvx` をインストールして解決

設定ファイルの変更は不要。端末Cubewin に `uv`（`uvx` を含む）が未インストールだったことが原因。

```powershell
# 端末Cubewin で実行したインストールコマンド
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

---

### LnvId に戻す場合の注意点

- `filesystem` のパスはLnvId のローカルパスに変更すること
- `youtube-transcript` のパッケージはLnvId のキャッシュ状況を確認し、必要なら `@kimtaeyoon83/mcp-server-youtube-transcript` のままでも動作する

---

### 変更後の `.vscode/mcp.json`（端末Cubewin 用）

```json
{
    "servers": {
        "youtube-transcript": {
            "command": "npx",
            "args": ["-y", "@kimtaeyoon83/mcp-server-youtube-transcript"],
            "type": "stdio"
        },
        "filesystem": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem", "D:/python/TranscriptVimeo"],
            "type": "stdio"
        },
        "git": {
            "command": "uvx",
            "args": ["mcp-server-git"],
            "type": "stdio"
        },
        "youtube-dlp": {
            "command": "uvx",
            "args": ["youtube-dlp-server"],
            "type": "stdio"
        },
        "chrome-devtools": {
            "command": "npx",
            "args": ["chrome-devtools-mcp@latest"]
        },
        "Notion": {
            "url": "https://mcp.notion.com/mcp"
        },
        "context7": {
            "command": "npx",
            "args": ["-y", "@upstash/context7-mcp@latest"]
        }
    },
    "inputs": []
}
```
