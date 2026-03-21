/**
 * Transcript → 学習ノート Markdown 生成スクリプト
 *
 * Usage:
 *   node scripts/generateStudyNotes.js <transcript-file> --title "Title" [--model gpt-4o-mini] [--post-notion]
 *
 * 環境変数:
 *   OPENAI_API_KEY         - OpenAI API キー
 *   NOTION_TOKEN           - Notion 統合トークン (--post-notion 使用時)
 *   NOTION_PARENT_PAGE_ID  - 親ページ ID (--post-notion 使用時)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const DEFAULT_MODEL = 'gpt-4o-mini';
const OUTPUT_DIR = path.join(__dirname, '..', 'output', 'study-notes');

/**
 * CLI 引数をパースする。
 *
 * @param {string[]} argv - process.argv
 * @returns {{ filePath: string|null, title: string|null, model: string, postNotion: boolean }}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  let filePath = null;
  let title = null;
  let model = DEFAULT_MODEL;
  let postNotion = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--title' && args[i + 1]) {
      title = args[++i];
    } else if (args[i] === '--model' && args[i + 1]) {
      model = args[++i];
    } else if (args[i] === '--post-notion') {
      postNotion = true;
    } else if (!filePath) {
      filePath = args[i];
    }
  }
  return { filePath, title, model, postNotion };
}

/**
 * 音声認識トランスクリプトの前処理。
 * フィラーの除去、分割数値の結合、既知の転写エラーを修正する。
 *
 * @param {string} text - 生のトランスクリプトテキスト
 * @returns {string} 前処理済みテキスト
 */
function preprocessTranscript(text) {
  return text
    // 分割数値の結合: "0.\n6" → "0.6"
    .replace(/(\d+)\.\n(\d)/g, '$1.$2')
    // センテンス先頭の "Um," / "Uh," を除去
    .replace(/^(Um|Uh),\s*/gim, '')
    // 既知の転写エラーを修正
    .replace(/\berian\b/gi, 'Eulerian')
    .replace(/\blaine\b/gi, 'Lagrangian')
    .replace(/\bmanl\b/gi, 'mandrel')
    .replace(/\bdist distort\b/gi, 'distort')
    // 独立したフィラー行を削除 (行全体が感嘆詞のみ)
    .replace(/^(uh|um|okay|alright|right|yeah|yep|oh|ah|hmm|oops)[.,!]*\s*$/gim, '')
    // 連続する空行を1行に圧縮
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 前処理済みトランスクリプトから学習ノート Markdown を生成する。
 * OpenAI API を使用して構造化された日本語学習ノートを生成する。
 *
 * @param {string} transcript - 前処理済みトランスクリプトテキスト
 * @param {string} title - 動画タイトル
 * @param {string} model - OpenAI モデル名
 * @returns {Promise<string>} 生成された Markdown 文字列
 */
async function callOpenAI(transcript, title, model) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `You are a technical educator creating structured learning notes from a Houdini/Copernicus 3D software tutorial transcript.

Create comprehensive learning notes in JAPANESE following this EXACT structure. Do not deviate from this format:

# {title}

## 学習ノート

### 概要
[2–3 paragraphs in Japanese summarizing the overall content, the workflow covered, and key insights]

## 重要な概念

### [Concept Name in English]
- [Japanese explanation]
- [Japanese explanation]

(Repeat ### block for each major technical concept covered. Typically 6–10 concepts.)

## 実装手順

### [Phase Name in Japanese]
1. [Step in Japanese]
2. [Step in Japanese]

(Repeat ### block for each logical phase. Group related steps together.)

## 応用方法
- [How to apply or extend this knowledge — in Japanese]
- (2–5 bullet points)

## まとめ
[1–2 paragraph summary of key learnings in Japanese]

---

# トランスクリプト

{preprocessed transcript here}

RULES:
- Write ALL explanatory content (概要, 重要な概念 descriptions, 実装手順 steps, etc.) in Japanese
- Keep technical terms, node names, Houdini UI labels, and proper nouns in English
- Be specific and technical — do not oversimplify
- Focus on learnable, actionable content
- Omit filler words, self-corrections, and UI navigation narration from summaries
- Include the preprocessed transcript verbatim under the # トランスクリプト section`;

  const userMessage = `Title: "${title}"

Transcript:
${transcript}`;

  const response = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  return response.choices[0].message.content;
}

/**
 * Markdown を output/study-notes/ に保存する。
 *
 * @param {string} markdown - 保存する Markdown コンテンツ
 * @param {string} title - ページタイトル (ファイル名に使用)
 * @returns {string} 保存したファイルの絶対パス
 */
function saveMarkdown(markdown, title) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  const filename = `${slug}-${Date.now()}.md`;
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, markdown, 'utf8');
  return filePath;
}

/**
 * トランスクリプトファイルから学習ノートを生成し Markdown として保存する。
 * --post-notion 指定時は Notion にも投稿する。
 *
 * @param {string} transcriptPath - transcript テキストファイルのパス
 * @param {string} title - 学習ノートのタイトル
 * @param {{ model?: string, postNotion?: boolean }} [options]
 * @returns {Promise<{ mdPath: string, notionPage: object|null }>}
 */
async function generateStudyNotes(transcriptPath, title, options = {}) {
  const { model = DEFAULT_MODEL, postNotion = false } = options;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing environment variable: set OPENAI_API_KEY in .env');
  }
  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file not found: ${transcriptPath}`);
  }

  console.log('\n📖 学習ノート生成 開始');
  console.log(`   Transcript: ${transcriptPath}`);
  console.log(`   Title: ${title}`);
  console.log(`   Model: ${model}`);

  const raw = fs.readFileSync(transcriptPath, 'utf8');
  const processed = preprocessTranscript(raw);
  const lineCount = processed.split('\n').length;
  console.log(`   前処理後: ${lineCount} 行`);

  console.log('\n🤖 OpenAI に送信中...');
  const markdown = await callOpenAI(processed, title, model);
  console.log(`   生成完了: ${markdown.length} 文字`);

  const mdPath = saveMarkdown(markdown, title);
  console.log(`\n💾 Markdown 保存: ${mdPath}`);

  let notionPage = null;
  if (postNotion) {
    const { createStudyNotesPage } = require('./notionCreate-StudyNotes');
    console.log('\n📤 Notion に投稿中...');
    notionPage = await createStudyNotesPage(mdPath, title);
    console.log(`   Notion ページ: ${notionPage.url}`);
  }

  console.log('\n✅ 学習ノート生成 完了');
  return { mdPath, notionPage };
}

module.exports = { generateStudyNotes };

// CLI entry point
if (require.main === module) {
  const { filePath, title, model, postNotion } = parseArgs(process.argv);

  if (!filePath) {
    console.error('Usage: node scripts/generateStudyNotes.js <transcript-file> --title "Title" [--model gpt-4o-mini] [--post-notion]');
    process.exit(1);
  }
  if (!title) {
    console.error('Error: --title is required.');
    console.error('Usage: node scripts/generateStudyNotes.js <transcript-file> --title "Title"');
    process.exit(1);
  }

  generateStudyNotes(filePath, title, { model, postNotion }).catch((err) => {
    console.error('\n❌ Fatal error:', err.message);
    process.exit(1);
  });
}
