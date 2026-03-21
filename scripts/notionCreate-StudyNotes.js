/**
 * 学習ノート Markdown → Notion ページ投稿スクリプト
 *
 * Usage:
 *   node scripts/notionCreate-StudyNotes.js <markdown-file> --title "Title"
 *
 * 環境変数:
 *   NOTION_TOKEN           - Notion 統合トークン
 *   NOTION_PARENT_PAGE_ID  - 親ページ ID
 */

require('dotenv').config();
const https = require('https');
const fs = require('fs');
const nodePath = require('path');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PAGE_ID = process.env.NOTION_PARENT_PAGE_ID;

const RICH_TEXT_LIMIT = 2000;
const BLOCK_BATCH_SIZE = 98;

/**
 * CLI 引数をパースして filePath と title を返す。
 *
 * @param {string[]} argv - process.argv
 * @returns {{ filePath: string|null, title: string|null }}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  let filePath = null;
  let title = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--title' && args[i + 1]) {
      title = args[++i];
    } else if (!filePath) {
      filePath = args[i];
    } else if (!title) {
      title = args[i];
    }
  }
  return { filePath, title };
}

/**
 * Notion API にリクエストを送信する。
 *
 * @param {string} method - HTTP メソッド ('POST' | 'PATCH')
 * @param {string} apiPath - API エンドポイントパス
 * @param {object} body - リクエストボディ
 * @returns {Promise<{status: number, data: object}>}
 */
function makeRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'api.notion.com',
      port: 443,
      path: apiPath,
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data: parsed });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Notion API response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * テキストを 2000 文字以下の rich_text アイテム配列に分割する。
 *
 * @param {string} text
 * @returns {object[]}
 */
function toRichText(text) {
  const items = [];
  for (let i = 0; i < text.length; i += RICH_TEXT_LIMIT) {
    items.push({ type: 'text', text: { content: text.slice(i, i + RICH_TEXT_LIMIT) } });
  }
  return items.length > 0 ? items : [{ type: 'text', text: { content: '' } }];
}

/**
 * Markdown テキストを Notion ブロック配列に変換する。
 * 対応要素: h1/h2/h3, bullet (-), numbered (1.), divider (---), code (```), paragraph
 *
 * @param {string} markdown
 * @returns {object[]}
 */
function markdownToBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Heading 1
    if (/^# [^#]/.test(line)) {
      const text = line.replace(/^# /, '').trim();
      blocks.push({ type: 'heading_1', heading_1: { rich_text: toRichText(text) } });
      i++;
      continue;
    }

    // Heading 2
    if (/^## [^#]/.test(line)) {
      const text = line.replace(/^## /, '').trim();
      blocks.push({ type: 'heading_2', heading_2: { rich_text: toRichText(text) } });
      i++;
      continue;
    }

    // Heading 3
    if (/^### /.test(line)) {
      const text = line.replace(/^### /, '').trim();
      blocks.push({ type: 'heading_3', heading_3: { rich_text: toRichText(text) } });
      i++;
      continue;
    }

    // Divider
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: 'divider', divider: {} });
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*] /.test(line)) {
      const text = line.replace(/^[-*] /, '').trim();
      if (text) {
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: { rich_text: toRichText(text) },
        });
      }
      i++;
      continue;
    }

    // Numbered list
    if (/^\d+\. /.test(line)) {
      const text = line.replace(/^\d+\. /, '').trim();
      if (text) {
        blocks.push({
          type: 'numbered_list_item',
          numbered_list_item: { rich_text: toRichText(text) },
        });
      }
      i++;
      continue;
    }

    // Code block (```)
    if (/^```/.test(line)) {
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const codeText = codeLines.join('\n');
      if (codeText) {
        blocks.push({
          type: 'code',
          code: {
            rich_text: toRichText(codeText.slice(0, RICH_TEXT_LIMIT)),
            language: 'plain text',
          },
        });
      }
      continue;
    }

    // Empty line — skip
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph: accumulate consecutive non-special lines
    let paraText = '';
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3} /.test(lines[i]) &&
      !/^[-*] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^```/.test(lines[i])
    ) {
      paraText += (paraText ? ' ' : '') + lines[i].trim();
      i++;
    }

    if (!paraText) { i++; continue; }

    // Split long paragraphs into 2000-char chunks
    for (let j = 0; j < paraText.length; j += RICH_TEXT_LIMIT) {
      const chunk = paraText.slice(j, j + RICH_TEXT_LIMIT);
      blocks.push({
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] },
      });
    }
  }

  return blocks;
}

/**
 * ブロック配列を指定サイズごとに分割する。
 *
 * @param {object[]} blocks
 * @param {number} size
 * @returns {object[][]}
 */
function splitIntoBatches(blocks, size) {
  const batches = [];
  for (let i = 0; i < blocks.length; i += size) {
    batches.push(blocks.slice(i, i + size));
  }
  return batches;
}

/**
 * 学習ノート Markdown ファイルを Notion ページとして作成する。
 * 100 ブロック制限を超える場合は PATCH リクエストで分割追記する。
 *
 * @param {string} filePath - Markdown ファイルの絶対パスまたは相対パス
 * @param {string} title - Notion ページタイトル
 * @returns {Promise<object>} 作成された Notion ページオブジェクト
 */
async function createStudyNotesPage(filePath, title) {
  if (!NOTION_TOKEN || !PAGE_ID) {
    throw new Error('Missing environment variables: set NOTION_TOKEN and NOTION_PARENT_PAGE_ID');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Study notes file not found: ${filePath}`);
  }

  console.log(`Creating Notion page: "${title}"`);
  console.log(`Source: ${filePath}`);

  const markdown = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const allBlocks = markdownToBlocks(markdown);

  console.log(`Markdown → ${allBlocks.length} blocks`);

  const [firstBatch, ...remainingBatches] = splitIntoBatches(allBlocks, BLOCK_BATCH_SIZE);

  const body = {
    parent: { page_id: PAGE_ID },
    properties: {
      title: { title: [{ type: 'text', text: { content: title } }] },
    },
    children: firstBatch || [],
  };

  const result = await makeRequest('POST', '/v1/pages', body);
  const pageId = result.data.id;

  console.log(`✅ Page created: ${result.data.url}`);
  console.log(`   Page ID: ${pageId}`);
  console.log(`   First batch: ${(firstBatch || []).length} blocks`);

  if (remainingBatches.length > 0) {
    console.log(`Appending ${remainingBatches.length} additional batch(es)...`);
    for (let i = 0; i < remainingBatches.length; i++) {
      await makeRequest('PATCH', `/v1/blocks/${pageId}/children`, {
        children: remainingBatches[i],
      });
      console.log(`   Batch ${i + 2}/${remainingBatches.length + 1} appended (${remainingBatches[i].length} blocks)`);
    }
  }

  console.log('\n✅ All blocks written successfully.');
  console.log(`Total blocks: ${allBlocks.length}`);
  return result.data;
}

module.exports = { createStudyNotesPage };

// CLI entry point
if (require.main === module) {
  const { filePath, title } = parseArgs(process.argv);
  if (!filePath) {
    console.error('Usage: node scripts/notionCreate-StudyNotes.js <markdown-file> --title "Page Title"');
    process.exit(1);
  }
  if (!title) {
    console.error('Error: --title is required.');
    console.error('Usage: node scripts/notionCreate-StudyNotes.js <markdown-file> --title "Page Title"');
    process.exit(1);
  }
  createStudyNotesPage(filePath, title).catch((err) => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  });
}
