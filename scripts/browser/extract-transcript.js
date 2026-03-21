// Vimeo transcript extraction with virtual scroll support
// Paste this into DevTools console while the transcript panel is open (player view).

(async function() {
  const hasEnglishWords = (text) => /\b[a-zA-Z]{3,}\b/.test(text);
  const isTimestampOnly = (text) => /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/.test(text);

  /**
   * トランスクリプトのキュー要素と、スクロール可能なコンテナを検出する。
   * Vimeo は Chakra UI のハッシュクラスを使うため、クラス名依存を最小化し
   * 構造的特徴（group クラス + 英語テキストの p 要素）を手がかりにする。
   */
  const findTranscriptScrollable = () => {
    // "group" クラスを持つ div の中の <p> が各トランスクリプトキュー
    const cueEl = document.querySelector('.group p') ||
                  document.querySelector('[class*="TranscriptList"] p') ||
                  document.querySelector('[class*="Transcript"] p');
    if (!cueEl) return null;

    // <p> の親をたどって overflow:auto/scroll のコンテナを返す
    let node = cueEl.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      const oy = style.overflowY;
      if (['auto', 'scroll'].includes(oy) && node.scrollHeight > node.clientHeight + 20) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

  const scrollable = findTranscriptScrollable();

  if (!scrollable) {
    alert('Transcript panel not found. Click the Transcript button and try again.');
    return;
  }

  const seen = new Map();

  /**
   * 現在表示されているトランスクリプトテキストを収集する。
   * スクロールコンテナ内の <p> 要素のみを対象にすることで誤検出を防ぐ。
   */
  const collectVisibleText = () => {
    scrollable.querySelectorAll('p').forEach((node) => {
      const text = (node.textContent || '').trim();
      if (!text || text.length < 5 || text.length > 600) return;
      if (isTimestampOnly(text)) return;
      if (!hasEnglishWords(text)) return;
      if (!seen.has(text)) seen.set(text, seen.size);
    });
  };

  const maxIterations = 160;
  const stableThreshold = 6;
  const scrollStep = Math.max(300, Math.floor(scrollable.clientHeight * 0.7));
  let stableCount = 0;
  let lastHeight = -1;
  let lastCount = -1;

  console.log('Starting transcript extraction...');

  for (let i = 0; i < maxIterations; i++) {
    collectVisibleText();

    const { scrollTop, scrollHeight, clientHeight } = scrollable;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 4;
    if (atBottom) {
      stableCount++;
    } else {
      scrollable.scrollTo({ top: Math.min(scrollTop + scrollStep, scrollHeight), behavior: 'auto' });
    }

    await new Promise((r) => setTimeout(r, 150));

    const heightUnchanged = scrollable.scrollHeight === lastHeight;
    const countUnchanged = seen.size === lastCount;
    if (heightUnchanged && countUnchanged) {
      stableCount++;
    } else {
      stableCount = 0;
    }
    lastHeight = scrollable.scrollHeight;
    lastCount = seen.size;

    if (i % 10 === 0) {
      console.log(`Scroll ${i}/${maxIterations}, collected ${seen.size} lines...`);
    }

    if (stableCount >= stableThreshold) {
      console.log('Reached stable scroll height, stopping.');
      break;
    }
  }

  collectVisibleText();
  scrollable.scrollTo({ top: 0, behavior: 'auto' });

  const lines = Array.from(seen.keys());
  const transcript = lines.join('\n');
  console.log(`Finished: collected ${lines.length} lines.`);

  try {
    await navigator.clipboard.writeText(transcript);
    console.log('Transcript copied to clipboard.');
  } catch (err) {
    console.warn('Clipboard copy failed:', err);
  }

  const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vimeo-transcript-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  console.log('Download triggered.');
})();
