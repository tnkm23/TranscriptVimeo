(async function extractVirtualTranscript() {
  console.log('仮想スクロール対応トランスクリプト抽出を開始...');

  // Vimeoのトランスクリプトパネルを探す
  // トランスクリプトの最初の文章から逆算してコンテナを見つける
  const allParagraphs = Array.from(document.querySelectorAll('p'));
  const firstTranscriptPara = allParagraphs.find(p => {
    const text = p.textContent.trim();
    // トランスクリプトらしい段落を探す（英語の文章が含まれる）
    return text.length > 30 && /\b(this|the|to|and|in|is|that|we|you|are|for)\b/i.test(text);
  });
  
  if (!firstTranscriptPara) {
    console.error('トランスクリプトが見つかりません。トランスクリプトパネルを開いていることを確認してください。');
    return;
  }
  
  // トランスクリプトパネルのスクロールコンテナを見つける
  let scrollContainer = firstTranscriptPara;
  for (let i = 0; i < 20; i++) {
    const parent = scrollContainer.parentElement;
    if (!parent) break;
    
    const computedStyle = window.getComputedStyle(parent);
    const hasOverflow = computedStyle.overflowY === 'scroll' || computedStyle.overflowY === 'auto';
    const isScrollable = parent.scrollHeight > parent.clientHeight;
    
    if (hasOverflow && isScrollable) {
      scrollContainer = parent;
      console.log(`✓ スクロールコンテナを発見: ${parent.tagName}`);
      break;
    }
    scrollContainer = parent;
  }
  
  const transcriptMap = new Map(); // テキストをキーとして重複を防ぐ
  const scrollStep = 300; // スクロール量（ピクセル）
  const scrollDelay = 250; // 読み込み待機時間（ミリ秒）
  let lastScrollTop = -1;
  let stableCount = 0;
  const maxStable = 5; // スクロール位置が変わらない回数
  let iteration = 0;
  const maxIterations = 100; // 最大スクロール回数

  console.log('スクロールして全トランスクリプトを収集中...');
  
  while (stableCount < maxStable && iteration < maxIterations) {
    // 現在表示されているすべてのパラグラフを取得
    const paragraphs = scrollContainer.querySelectorAll('p');
    
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      
      // トランスクリプトテキストの条件:
      // 1. タイムスタンプ（00:00形式）ではない
      // 2. 十分な長さがある
      // 3. 英語の文章っぽい（単語が含まれる）
      // 4. ナビゲーションヒント行（矢印キーなど）は除外
      const isTimestamp = /^\d{2}:\d{2}$/.test(text);
      const hasEnglishWords = /\b(the|this|to|a|and|in|of|for|is|that|it|we|you|are|have|with|on|be|at|by|from|as|or|an|will|can|so|if|but|not|all|would|there|their|what|up|out|when|your|how|about|which|get)\b/i.test(text);
      const isNavHint = /矢印キー/.test(text);
      
      if (!isTimestamp && !isNavHint && text.length > 15 && hasEnglishWords) {
        transcriptMap.set(text, true);
      }
    });
    
    // スクロールダウン
    const beforeScroll = scrollContainer.scrollTop;
    scrollContainer.scrollTop += scrollStep;
    await new Promise(resolve => setTimeout(resolve, scrollDelay));
    
    // スクロール位置の変化をチェック
    if (scrollContainer.scrollTop === beforeScroll) {
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
  
  console.log('==========================================');
  console.log(`抽出完了！合計: ${transcriptMap.size}行`);
  console.log(`スクロール回数: ${iteration}`);
  console.log('==========================================');
  
  // トランスクリプトを結合
  const fullTranscript = Array.from(transcriptMap.keys()).join('\n\n');
  
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