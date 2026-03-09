// Vimeo transcript extraction with virtual scroll support
// Paste this into DevTools console while the transcript panel is open (player view).

(async function() {
  const hasEnglishWords = (text) => /\b[a-zA-Z]{3,}\b/.test(text);
  const isTimestampOnly = (text) => /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/.test(text);

  const transcriptRoot =
    document.querySelector('.TranscriptList_lazy_module_listContainer__f67b6693') ||
    document.querySelector('.Transcript_lazy_module_transcript__4f2662ee') ||
    document.querySelector('[class*="Transcript"]');

  if (!transcriptRoot) {
    alert('Transcript panel not found. Click the Transcript button in the player and try again.');
    return;
  }

  const findFirstTranscriptNode = () => {
    const candidates = Array.from(
      transcriptRoot.querySelectorAll('.TranscriptCue_lazy_module_cueText__d61e74ab, p, span, div')
    );
    return candidates.find((el) => {
      const text = (el.textContent || '').trim();
      if (!text || text.length < 6 || text.length > 500) return false;
      if (isTimestampOnly(text)) return false;
      return hasEnglishWords(text);
    });
  };

  const firstParagraph = findFirstTranscriptNode();
  if (!firstParagraph) {
    alert('Transcript text not found. Ensure the transcript is visible.');
    return;
  }

  const findScrollable = (el) => {
    let node = el;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      const overflowY = style.overflowY || style.overflow;
      const canScroll = ['auto', 'scroll'].includes(overflowY);
      if (canScroll && node.scrollHeight > node.clientHeight + 20) return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.body;
  };

  const scrollable = findScrollable(transcriptRoot);
  const seen = new Map(); // preserve order while deduping

  const collectVisibleText = () => {
    const nodes = scrollable.querySelectorAll('.TranscriptCue_lazy_module_cueText__d61e74ab, p, span, div');
    nodes.forEach((node) => {
      const text = (node.textContent || '').trim();
      if (!text) return;
      if (text.length < 3 || text.length > 600) return;
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
