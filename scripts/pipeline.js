/**
 * Vimeo トランスクリプト抽出 → Notion アップロード 自動パイプライン
 *
 * Usage:
 *   node scripts/pipeline.js <vimeo-url> [--title "Video Title"]
 *
 * Examples:
 *   node scripts/pipeline.js https://vimeo.com/1164757132 --title "Building a Fluid Solver"
 *   node scripts/pipeline.js https://vimeo.com/1164757132   # タイトルはページから自動検出
 *
 * 環境変数:
 *   NOTION_TOKEN           - Notion 統合トークン
 *   NOTION_PARENT_PAGE_ID  - 親ページ ID
 */

require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createNotionPage } = require('./notionCreate-RealTranscript');

/**
 * CLI 引数をパースして url と title を返す。
 *
 * @param {string[]} argv - process.argv
 * @returns {{ url: string|null, title: string|null }}
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  let url = null;
  let title = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--title' && args[i + 1]) {
      title = args[++i];
    } else if (!url) {
      url = args[i];
    }
  }
  return { url, title };
}

/**
 * Vimeo URL から動画 ID を抽出する。
 *
 * @param {string} url
 * @returns {string}
 */
function extractVideoId(url) {
  return url.match(/vimeo\.com\/(\d+)/)?.[1] || `unknown-${Date.now()}`;
}

/**
 * Playwright を使って Vimeo からトランスクリプトを抽出し、
 * output/transcripts/ に保存して Notion にアップロードする。
 *
 * @param {string} url - Vimeo 動画 URL
 * @param {string|null} titleArg - タイトル (null の場合はページから自動検出)
 */
async function runPipeline(url, titleArg) {
  const videoId = extractVideoId(url);
  console.log('\n🎬 Vimeo Pipeline 開始');
  console.log(`   URL: ${url}`);
  console.log(`   Video ID: ${videoId}`);

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const page = await browser.newPage();

  try {
    console.log('\n📡 Vimeo ページを開いています...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // 動画ページの JS がレンダリングされるのを待つ
    await page.waitForTimeout(3000);

    // タイトル自動検出 (--title 未指定時)
    const title = titleArg || await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (h1?.textContent?.trim()) return h1.textContent.trim();
      return document.title.replace(/\s*[|·–\-]\s*Vimeo\s*$/i, '').trim() ||
        `Untitled-${Date.now()}`;
    });
    console.log(`   Title: ${title}`);

    // トランスクリプト抽出 (ブラウザコンテキスト内で実行)
    console.log('\n📝 トランスクリプトを抽出中...');
    const transcript = await page.evaluate(async () => {
      // ---- 抽出コアロジック (extractVirtualTranscript.js と同等) ----

      const splitIntoSentences = (text) => {
        const compact = text.replace(/\s+/g, ' ').trim();
        const matches = compact.match(/[^.!?]+[.!?]/g) || [];
        const remainder = compact.slice(matches.join('').length).trim();
        if (remainder) matches.push(remainder);
        return matches.map(s => s.trim()).filter(Boolean);
      };

      const findTranscriptRoot = () => (
        document.querySelector('.group p') ||
        document.querySelector('[class*="TranscriptList"] p') ||
        document.querySelector('[class*="Transcript"] p')
      );

      const openTranscriptPanel = () => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          b => /トランスクリプト|transcript/i.test(b.textContent)
        );
        if (btn) { btn.click(); return true; }
        return false;
      };

      const waitForTranscript = (waitMs = 8000) =>
        new Promise((resolve) => {
          const interval = 200;
          let elapsed = 0;
          const timer = setInterval(() => {
            const el = findTranscriptRoot();
            if (el) { clearInterval(timer); resolve(el); return; }
            elapsed += interval;
            if (elapsed >= waitMs) { clearInterval(timer); resolve(null); }
          }, interval);
        });

      let transcriptCueEl = findTranscriptRoot();
      if (!transcriptCueEl) {
        openTranscriptPanel();
        transcriptCueEl = await waitForTranscript(8000);
      }
      if (!transcriptCueEl) return null;

      const findScrollable = (el) => {
        let node = el.parentElement;
        while (node && node !== document.body) {
          const style = getComputedStyle(node);
          const overflowY = style.overflowY || style.overflow;
          if (['auto', 'scroll'].includes(overflowY) && node.scrollHeight > node.clientHeight + 20) {
            return node;
          }
          node = node.parentElement;
        }
        return document.scrollingElement || document.body;
      };

      const scrollContainer = findScrollable(transcriptCueEl);
      const transcriptMap = new Map();
      const scrollStep = 300;
      const scrollDelay = 300;
      // maxIterations はフェイルセーフのみ。底到達を検出して即停止するため
      // 300px × 2000 = 600,000px 相当まで対応（数時間の動画でも十分）
      const maxIterations = 2000;

      const collectVisibleText = () => {
        scrollContainer.querySelectorAll('p').forEach(node => {
          let text = (node.textContent || '').trim();
          if (!text) return;
          text = text.replace(/\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/, '').trim();
          if (!text) return;
          const hasEnglishWords = /\b(the|this|to|a|and|in|of|for|is|that|it|we|you|are|have|with|on|be)\b/i.test(text);
          if (!/矢印キー/.test(text) && text.length > 10 && hasEnglishWords) {
            transcriptMap.set(text, true);
          }
        });
      };

      for (let i = 0; i < maxIterations; i++) {
        collectVisibleText();
        // 底に達したら即終了（maxStable ループを待たない）
        if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 2) {
          break;
        }
        scrollContainer.scrollTop += scrollStep;
        await new Promise(r => setTimeout(r, scrollDelay));
      }
      collectVisibleText();
      scrollContainer.scrollTop = 0;

      const sentences = splitIntoSentences(Array.from(transcriptMap.keys()).join(' '));
      return sentences.length > 0 ? sentences.join('\n') : null;
    });

    if (!transcript) {
      throw new Error(
        'トランスクリプトの抽出に失敗しました。' +
        'このVimeoページでトランスクリプト機能が利用可能か確認してください。'
      );
    }

    const lineCount = transcript.split('\n').length;
    console.log(`   抽出完了: ${lineCount} 行`);

    // output/transcripts/ に保存
    const outputDir = path.join(__dirname, '..', 'output', 'transcripts');
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `${videoId}-${Date.now()}.txt`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, transcript, 'utf8');
    console.log(`\n💾 トランスクリプト保存: ${filePath}`);

    // Notion アップロード
    console.log('\n📤 Notion にアップロード中...');
    const notionPage = await createNotionPage(filePath, title);

    console.log('\n✅ パイプライン完了!');
    console.log(`   Notion ページ: ${notionPage.url}`);
  } finally {
    await browser.close();
  }
}

// Main
const { url, title } = parseArgs(process.argv);
if (!url) {
  console.error('Usage: node scripts/pipeline.js <vimeo-url> [--title "Video Title"]');
  console.error('Example: node scripts/pipeline.js https://vimeo.com/1164757132 --title "My Video"');
  process.exit(1);
}

runPipeline(url, title).catch((err) => {
  console.error('\n❌ Pipeline error:', err.message);
  process.exit(1);
});
