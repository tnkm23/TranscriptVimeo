(async function extractVirtualTranscript() {
  console.log('仮想スクロール対応トランスクリプト抽出を開始...');

  // pipeline.js と同一ロジック: 小数点・略語で誤分割しない
  const splitIntoSentences = (text) => {
    const compact = text.replace(/\s+/g, ' ').trim();
    // 小数点(0.6, 3.14)と略語(Mr. Dr. vs. etc.)を一時的に保護して誤分割を防ぐ
    const safe = compact
      .replace(/(\d+)\.(\d)/g, '$1\x00$2')
      .replace(/\b(Mr|Dr|Ms|Mrs|Jr|Sr|vs|etc)\.\s/gi, '$1\x00 ');
    const matches = safe.match(/[^.!?]+[.!?]/g) || [];
    const remainder = safe.slice(matches.join('').length).trim();
    if (remainder) matches.push(remainder);
    return matches.map(s => s.trim().replace(/\x00/g, '.')).filter(Boolean);
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

  // パネルが既に開いているか確認し、未開なら自動クリック
  let transcriptCueEl = findTranscriptRoot();
  if (!transcriptCueEl) {
    console.log('トランスクリプトパネルを自動で開きます...');
    const clicked = openTranscriptPanel();
    if (clicked) {
      transcriptCueEl = await waitForTranscript(8000);
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
  const scrollStep = 300;  // pipeline.js と統一
  const scrollDelay = 300; // pipeline.js と統一
  // maxIterations はフェイルセーフのみ。底到達を検出して即停止するため
  // 300px × 2000 = 600,000px 相当まで対応（数時間の動画でも十分）
  const maxIterations = 2000;

  console.log('スクロールして全トランスクリプトを収集中...');

  // pipeline.js と同一ロジック: 英語テキストのフィルタリング
  const collectVisibleText = () => {
    scrollContainer.querySelectorAll('p').forEach(node => {
      let text = (node.textContent || '').trim();
      if (!text) return;
      text = text.replace(/\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/, '').trim();
      if (!text) return;
      const hasEnglishWords = /\b(the|this|to|a|and|in|of|for|is|that|it|we|you|are|have|with|on|be|at|by|from|as|or|an|will|can|so|if|but|not|all|would|there|their|what|up|out|when|your|how|about|which|get)\b/i.test(text);
      if (!/矢印キー/.test(text) && text.length > 10 && hasEnglishWords) {
        transcriptMap.set(text, true);
      }
    });
  };

  // pipeline.js と同一スクロールループ: 底到達を検知して即停止
  for (let i = 0; i < maxIterations; i++) {
    collectVisibleText();
    // 底に達したら即終了
    if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 2) {
      break;
    }
    scrollContainer.scrollTop += scrollStep;
    await new Promise(r => setTimeout(r, scrollDelay));

    if ((i + 1) % 10 === 0) {
      console.log(`${i + 1}回目のスクロール - ${transcriptMap.size}行収集済み`);
    }
  }

  collectVisibleText();

  console.log('==========================================');
  console.log(`抽出完了！合計: ${transcriptMap.size}行`);
  console.log('==========================================');

  // トランスクリプトを結合し、1文1行に分割（pipeline.js と同一形式）
  const sentences = splitIntoSentences(Array.from(transcriptMap.keys()).join(' '));
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
