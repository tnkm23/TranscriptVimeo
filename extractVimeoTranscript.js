(async function extractVirtualTranscript() {
  console.log('仮想スクロール内からの抽出を開始します...');

  // 設定：仮想スクロールの親コンテナとアイテムのクラス
  const scrollerSelector = '[data-test-id="virtuoso-scroller"]'; 
  const itemSelector = '.chakra-text.css-1rbuxqg';
  const scrollStep = 400; // スクロール量（ピクセル）
  const scrollDelay = 300; // 読み込み待機時間（ミリ秒）

  const scroller = document.querySelector(scrollerSelector);
  if (!scroller) {
    console.error('スクロールコンテナが見つかりませんでした。トランスクリプトが表示されているか確認してください。');
    return;
  }

  const collectedData = new Map(); // インデックスをキーにして重複を防ぐ
  let lastScrollTop = -1;
  let noChangeCount = 0;

  console.log('スクロールを開始します。完了までお待ちください...');

  while (noChangeCount < 10) { // しばらく変化がなければ終了
    // 現在表示されている要素を取得
    const items = scroller.querySelectorAll('[data-index]');
    items.forEach(item => {
      const index = item.getAttribute('data-index');
      const textElement = item.querySelector(itemSelector);
      const timeElement = item.querySelector('.chakra-badge'); // タイムスタンプも取得
      
      if (textElement && index) {
        const timestamp = timeElement ? `[${timeElement.textContent}] ` : '';
        collectedData.set(index, timestamp + textElement.textContent.trim());
      }
    });

    // スクロール実行
    scroller.scrollTop += scrollStep;
    await new Promise(resolve => setTimeout(resolve, scrollDelay));

    // スクロール位置のチェック
    if (scroller.scrollTop === lastScrollTop) {
      noChangeCount++;
    } else {
      noChangeCount = 0;
      lastScrollTop = scroller.scrollTop;
    }
    
    if (collectedData.size > 0) {
        console.log(`現在 ${collectedData.size} 行取得中...`);
    }
  }

  // データをインデックス順に並び替え
  const sortedTranscript = Array.from(collectedData.entries())
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(entry => entry[1])
    .join('\n\n');

  console.log('==========================================');
  console.log('抽出完了！ 合計:', collectedData.size, '行');
  console.log('==========================================');

  // クリップボードにコピー
  try {
    await navigator.clipboard.writeText(sortedTranscript);
    console.log('✅ クリップボードに全内容をコピーしました！');
  } catch (err) {
    console.log('⚠️ コピーに失敗しました。以下の内容を手動でコピーしてください。');
    console.log(sortedTranscript);
  }

  // ファイルとして保存
  const blob = new Blob([sortedTranscript], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vimeo_transcript.txt';
  a.click();
  URL.revokeObjectURL(url);
  
  // 最後に一番上に戻す
  scroller.scrollTop = 0;
})();
