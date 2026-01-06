// Vimeo Transcript Extraction Script with Virtual Scroll Support
// このスクリプトはVimeoの動画トランスクリプトを仮想スクロール環境から抽出します

(async function() {
  // トランスクリプトコンテナを探す
  const transcriptContainer = document.querySelector('[data-transcript-container], .transcript-container, [class*="transcript"]');
  
  if (!transcriptContainer) {
    alert('トランスクリプトコンテナが見つかりません。トランスクリプトが表示されているか確認してください。');
    return;
  }

  console.log('トランスクリプト抽出を開始します...');
  
  const extractedTexts = new Set();
  let scrollAttempts = 0;
  const maxScrollAttempts = 100; // 無限ループ防止
  const minScrollAttempts = 5; // スクロール終了判定の最小試行回数
  const scrollDistance = 100; // スクロール距離（ピクセル）
  const waitTime = 200; // 待機時間（ミリ秒）
  
  // スクロール可能な要素を見つける
  const scrollableElement = transcriptContainer.querySelector('[class*="scroll"], [style*="overflow"]') || transcriptContainer;
  
  // 少しずつスクロールしながら要素を取得
  while (scrollAttempts < maxScrollAttempts) {
    // 現在表示されているトランスクリプト要素を取得
    const transcriptElements = scrollableElement.querySelectorAll('[data-transcript-text], [class*="transcript-text"], p, span');
    
    transcriptElements.forEach(element => {
      const text = element.textContent.trim();
      if (text && text.length > 0) {
        extractedTexts.add(text);
      }
    });
    
    // スクロール前の高さを記録
    const currentHeight = scrollableElement.scrollTop;
    
    // スクロール
    scrollableElement.scrollBy(0, scrollDistance);
    
    // 少し待機（新しい要素の読み込みを待つ）
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // スクロール位置が変わらなくなったら終了
    if (scrollableElement.scrollTop === currentHeight && scrollAttempts > minScrollAttempts) {
      console.log('スクロール完了');
      break;
    }
    
    scrollAttempts++;
    
    // 進捗表示
    if (scrollAttempts % 10 === 0) {
      console.log(`スクロール中... (${scrollAttempts}回目, ${extractedTexts.size}個のテキスト取得)`);
    }
  }
  
  // 取得したテキストを整形
  const transcript = Array.from(extractedTexts).join('\n');
  
  console.log(`抽出完了: ${extractedTexts.size}個のテキストを取得しました`);
  
  // ファイルとしてダウンロード
  const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vimeo-transcript-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('ファイルのダウンロードが開始されました');
})();
