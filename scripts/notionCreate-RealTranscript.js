const https = require('https');
const fs = require('fs');
const nodePath = require('path');

// Notion API credentials (read from environment)
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PAGE_ID = process.env.NOTION_PARENT_PAGE_ID;

const RICH_TEXT_LIMIT = 2000; // Notion rich_text コンテンツの最大文字数
const BLOCK_BATCH_SIZE = 98;  // ページ作成時の最大ブロック数 (API上限100、ヘッダー2ブロック分を除く)

/**
 * CLI 引数をパースして filePath と title を返す。
 * Usage: node notionCreate-RealTranscript.js <file> [--title "Title"]
 *        node notionCreate-RealTranscript.js <file> "Title"
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
 * トランスクリプトファイルを読み込み、改行を正規化して返す。
 *
 * @param {string} filePath - 読み込むファイルのパス
 * @returns {string} 正規化されたトランスクリプトテキスト
 */
function loadTranscript(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.replace(/\r\n/g, '\n').trim();
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
          reject(new Error(`Failed to parse Notion API response: ${e.message} | raw: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * テキストを Notion rich_text の文字数上限 (2000字) 以下のチャンク配列に分割する。
 * 行単位で区切り、1行が上限を超える場合はその行を強制分割する。
 *
 * @param {string[]} lines - トランスクリプトの行配列
 * @returns {string[]} 各要素が2000文字以下のチャンク配列
 */
function buildChunks(lines) {
  const chunks = [];
  let current = '';

  for (const line of lines) {
    if (line.length >= RICH_TEXT_LIMIT) {
      if (current) { chunks.push(current.trim()); current = ''; }
      for (let i = 0; i < line.length; i += RICH_TEXT_LIMIT - 1) {
        chunks.push(line.slice(i, i + RICH_TEXT_LIMIT - 1));
      }
      continue;
    }
    if ((current + line + '\n').length > RICH_TEXT_LIMIT) {
      if (current) chunks.push(current.trim());
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

/**
 * チャンク配列を Notion の paragraph ブロック配列に変換する。
 *
 * @param {string[]} chunks
 * @returns {object[]}
 */
function toBlocks(chunks) {
  return chunks.map((chunk) => ({
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: chunk } }] },
  }));
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
 * トランスクリプトファイルを Notion ページとして作成する。
 * 100ブロック制限を超える場合は PATCH リクエストで分割追記する。
 *
 * @param {string} filePath - transcript テキストファイルの絶対パスまたは相対パス
 * @param {string} title - Notion ページタイトル
 * @returns {Promise<object>} 作成された Notion ページオブジェクト
 */
async function createNotionPage(filePath, title) {
  if (!NOTION_TOKEN || !PAGE_ID) {
    throw new Error('Missing environment variables: set NOTION_TOKEN and NOTION_PARENT_PAGE_ID');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Transcript file not found: ${filePath}`);
  }

  console.log(`Creating Notion page: "${title}"`);
  console.log(`Source: ${filePath}`);

  const transcript = loadTranscript(filePath);
  const lines = transcript.split('\n');
  const chunks = buildChunks(lines);
  const allBlocks = toBlocks(chunks);

  console.log(`Transcript: ${lines.length} lines → ${chunks.length} chunks → ${allBlocks.length} blocks`);

  const headerBlocks = [
    {
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: `Transcript (${lines.length} lines)` } }],
      },
    },
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: `Total lines: ${lines.length} | ${title}` } }],
      },
    },
  ];

  const [firstBatch, ...remainingBatches] = splitIntoBatches(allBlocks, BLOCK_BATCH_SIZE);

  const body = {
    parent: { page_id: PAGE_ID },
    properties: {
      title: { title: [{ type: 'text', text: { content: title } }] },
    },
    children: [...headerBlocks, ...(firstBatch || [])],
  };

  const result = await makeRequest('POST', '/v1/pages', body);
  const pageId = result.data.id;

  console.log(`✅ Page created: ${result.data.url}`);
  console.log(`   Page ID: ${pageId}`);
  console.log(`   First batch: ${(firstBatch || []).length} content blocks`);

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
  console.log(`Total blocks: ${headerBlocks.length + allBlocks.length}`);
  return result.data;
}

module.exports = { createNotionPage };

// CLI entry point
if (require.main === module) {
  const { filePath, title } = parseArgs(process.argv);
  if (!filePath) {
    console.error('Usage: node scripts/notionCreate-RealTranscript.js <transcript-file> --title "Page Title"');
    process.exit(1);
  }
  if (!title) {
    console.error('Error: Title is required.');
    console.error('Usage: node scripts/notionCreate-RealTranscript.js <transcript-file> --title "Page Title"');
    process.exit(1);
  }
  createNotionPage(filePath, title).catch((err) => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  });
}
