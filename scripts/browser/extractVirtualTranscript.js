(async function extractVirtualTranscript() {
  console.log('仮想スクロール対応トランスクリプト抽出を開始...');

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

  /** トランスクリプトボタンを探してクリックする（パネルが未開の場合）。 */
  const openTranscriptPanel = () => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      b => /トランスクリプト|transcript/i.test(b.textContent)
    );
    if (btn) { btn.click(); return true; }
    return false;
  };

  /** findTranscriptRoot が要素を返すまで最大 waitMs 待機する。 */
  const waitForTranscript = (waitMs = 5000) =>
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

  // パネルが既に開いているか確認し、未開なら自動クリック
  let transcriptCueEl = findTranscriptRoot();
  if (!transcriptCueEl) {
    console.log('トランスクリプトパネルを自動で開きます...');
    const clicked = openTranscriptPanel();
    if (clicked) {
      transcriptCueEl = await waitForTranscript(6000);
    }
  }
  if (!transcriptCueEl) {
    console.error('トランスクリプトが見つかりません。トランスクリプトパネルを開いていることを確認してください。');
    return;
  }
  console.log('トランスクリプト要素を検出しました。');

  const findScrollable = (el) => {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      const overflowY = style.overflowY || style.overflow;
      const canScroll = ['auto', 'scroll'].includes(overflowY) && node.scrollHeight > node.clientHeight + 20;
      if (canScroll) return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.body;
  };

  const scrollContainer = findScrollable(transcriptCueEl);
  
  const transcriptMap = new Map(); // テキストをキーとして重複を防ぐ
  const scrollStep = 300; // スクロール量（ピクセル）
  const scrollDelay = 250; // 読み込み待機時間（ミリ秒）
  let lastScrollTop = -1;
  let stableCount = 0;
  const maxStable = 5; // スクロール位置が変わらない回数
  let iteration = 0;
  const maxIterations = 100; // 最大スクロール回数

  console.log('スクロールして全トランスクリプトを収集中...');
  
  const collectVisibleText = () => {
    const nodes = scrollContainer.querySelectorAll('p');
    nodes.forEach(node => {
      let text = (node.textContent || '').trim();
      if (!text) return;
      text = text.replace(/\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/, '').trim();
      if (!text) return;
      const hasEnglishWords = /\b(the|this|to|a|and|in|of|for|is|that|it|we|you|are|have|with|on|be|at|by|from|as|or|an|will|can|so|if|but|not|all|would|there|their|what|up|out|when|your|how|about|which|get)\b/i.test(text);
      const isNavHint = /矢印キー/.test(text);
      if (!isNavHint && text.length > 10 && hasEnglishWords) {
        transcriptMap.set(text, true);
      }
    });
  };

  while (stableCount < maxStable && iteration < maxIterations) {
    collectVisibleText();

    const beforeScroll = scrollContainer.scrollTop;
    scrollContainer.scrollTop = Math.min(scrollContainer.scrollTop + scrollStep, scrollContainer.scrollHeight);
    await new Promise(resolve => setTimeout(resolve, scrollDelay));

    if (scrollContainer.scrollTop === beforeScroll || scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 2) {
      stableCount++;
    } else {
      stableCount = 0;
      lastScrollTop = scrollContainer.scrollTop;
    }

    iteration++;

    if (iteration % 5 === 0) {
      console.log(`${iteration}回目のスクロール - ${transcriptMap.size}行収集済み`);
    }
  }

  collectVisibleText();
  
  console.log('==========================================');
  console.log(`抽出完了！合計: ${transcriptMap.size}行`);
  console.log(`スクロール回数: ${iteration}`);
  console.log('==========================================');
  
  // トランスクリプトを結合し、文末で改行
  const collected = Array.from(transcriptMap.keys());
  const sentences = splitIntoSentences(collected.join(' '));
  const fullTranscript = sentences.join('\n');
  
  // クリップボードにコピー
  try {
    await navigator.clipboard.writeText(fullTranscript);
    console.log('✅ クリップボードに全内容をコピーしました！');
  } catch (err) {
    console.log('⚠️ クリップボードへのコピーに失敗しました。');
  }

  // ファイルとしてダウンロード
  const blob = new Blob([fullTranscript], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vimeo-transcript-${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  console.log('✅ ファイルをダウンロードしました！');
  
  // 一番上に戻す
  scrollContainer.scrollTop = 0;
})();