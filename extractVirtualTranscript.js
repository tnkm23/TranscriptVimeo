(async function extractVirtualTranscript() {
  console.log('仮想スクロール対応トランスクリプト抽出を開始...');

  const splitIntoSentences = (text) => {
    const compact = text.replace(/\s+/g, ' ').trim();
    const matches = compact.match(/[^.!?]+[.!?]/g) || [];
    const remainder = compact.slice(matches.join('').length).trim();
    if (remainder) matches.push(remainder);
    return matches.map(s => s.trim()).filter(Boolean);
  };

  const findTranscriptRoot = () => {
    return (
      document.querySelector('[role="listbox"]') ||
      document.querySelector('.TranscriptList_lazy_module_listContainer__f67b6693') ||
      document.querySelector('.Transcript_lazy_module_transcript__4f2662ee') ||
      document.querySelector('[class*="Transcript"]')
    );
  };

  const transcriptRoot = findTranscriptRoot();
  if (!transcriptRoot) {
    console.error('トランスクリプトが見つかりません。トランスクリプトパネルを開いていることを確認してください。');
    return;
  }

  const findScrollable = (el) => {
    let node = el;
    for (let i = 0; i < 30 && node; i++) {
      const style = getComputedStyle(node);
      const overflowY = style.overflowY || style.overflow;
      const canScroll = ['auto', 'scroll'].includes(overflowY) && node.scrollHeight > node.clientHeight + 20;
      if (canScroll) return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.body;
  };

  const scrollContainer = findScrollable(transcriptRoot);
  
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
    const nodes = scrollContainer.querySelectorAll('[role="option"], p, span, div');
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