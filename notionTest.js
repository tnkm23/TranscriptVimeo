// Notion API テスト - 新規ページ作成
const https = require('https');

// 設定（環境変数から読み込み）
const NOTION_TOKEN = process.env.NOTION_TOKEN; // あなたの Notion 統合トークンを環境に設定
const PAGE_ID = process.env.NOTION_PARENT_PAGE_ID; // ハイフン削除済みのページ/データベースIDを環境に設定
const VIDEO_TITLE = 'How to Create Complex Patterns with Custom UVs';

// 前回抽出したトランスクリプト（一部）
const transcript = `トランスクリプト内を移動するには、上下の矢印キーを使用します。Enterキーを押して、選択したキューに移動します。スペースを押して再生を切り替えます。

So in the previous part we looked at how we can create intricate mosaic patterns where we isolate certain features of a tile, adjusting them individually. In this part, we are not going to be looking so much at how we can work with individual tiles, but rather how we can integrate multiple different systems together, such as geometry, rasterization, tiling, UV warping, all into a single texture so that we can end up with extremely complex textures.

【要約】
このチュートリアルでは、Houdini Copernicusを用いて複数のシステム（ジオメトリ、ラスタライズ、タイリング、UVワープ）を統合し、極めて複雑なテクスチャを作成する手法を解説。

【テスト日時】
${new Date().toISOString()}`;

// Notion API リクエスト構築
function createNotionRequest() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      parent: {
        page_id: PAGE_ID
      },
      properties: {
        title: [
          {
            text: {
              content: `[Test] ${VIDEO_TITLE}`
            }
          }
        ]
      },
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                text: {
                  content: '抽出されたトランスクリプト'
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'code',
          code: {
            language: 'plain text',
            rich_text: [
              {
                text: {
                  content: transcript
                }
              }
            ]
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: '✅ テスト完了: このページは Notion API により自動作成されました。'
                }
              }
            ]
          }
        }
      ]
    });

    const options = {
      hostname: 'api.notion.com',
      port: 443,
      path: '/v1/pages',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            status: res.statusCode,
            response: response
          });
        } catch (e) {
          reject({
            status: res.statusCode,
            error: e.message,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// 実行
(async () => {
  console.log('🔄 Notion API テスト開始...');
  console.log(`📌 対象Page ID: ${PAGE_ID}`);
  console.log(`📄 ページタイトル: [Test] ${VIDEO_TITLE}\n`);

  try {
    if (!NOTION_TOKEN || !PAGE_ID) {
      throw new Error('環境変数 NOTION_TOKEN と NOTION_PARENT_PAGE_ID を設定してください');
    }
    const result = await createNotionRequest();
    
    if (result.status === 200) {
      console.log('✅ 成功！ページが作成されました。');
      console.log(`\n📖 作成されたページURL:`);
      console.log(result.response.url);
      console.log(`\n📊 ページID: ${result.response.id}`);
    } else {
      console.log(`⚠️ ステータスコード: ${result.status}`);
      console.log('レスポンス:', JSON.stringify(result.response, null, 2));
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:');
    console.error(error);
  }
})();
