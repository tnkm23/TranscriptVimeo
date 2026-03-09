#!/usr/bin/env node

// 4つのVimeo動画からトランスクリプトを取得するスクリプト
// Node.jsのfetchを使用

const videos = [
  {
    id: '1106202933',
    title: '45 | Rendering Basics | COPs',
    url: 'https://vimeo.com/1106202933'
  },
  {
    id: '1084749425',
    title: '2 | Copernicus Texturing',
    url: 'https://vimeo.com/1084749425'
  },
  {
    id: '1094743839',
    title: 'Project Skylark | Plant Pots 3 | Texture Using Copernicus',
    url: 'https://vimeo.com/1094743839'
  },
  {
    id: '970685082',
    title: 'Don\'t Run from COPs | Nikola Damjanov | Houdini 20.5 HIVE Paris',
    url: 'https://vimeo.com/970685082'
  }
];

// Vimeo API経由でトランスクリプトを取得
// ページのHTMLからtranscriptデータを抽出
async function fetchVimeoPage(url) {
  console.log(`Fetching: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    
    // ページのHTMLからconfig JSONを探す
    const configMatch = html.match(/"config":\s*(\{[^}]*"transcript"[^}]*\})/);
    if (configMatch) {
      console.log(`Found config for ${url}`);
      return configMatch[1];
    }
    
    // xhruploadデータを探す
    const xhrMatch = html.match(/"xhrUpload":\s*(\{.*?"transcript".*?\})/s);
    if (xhrMatch) {
      console.log(`Found xhrUpload for ${url}`);
      return xhrMatch[1];
    }
    
    // id="__PLAYER_CONFIG__"のスクリプトタグを探す
    const scriptMatch = html.match(/<script[^>]*id="__PLAYER_CONFIG__"[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      console.log(`Found player config for ${url}`);
      const configText = scriptMatch[1];
      try {
        const config = JSON.parse(configText);
        if (config.transcript) {
          return config.transcript;
        }
      } catch (e) {
        // JSONパース失敗、別の方法を試す
      }
    }
    
    // window.configを探す
    const windowConfigMatch = html.match(/window\.config\s*=\s*(\{[\s\S]*?\});/);
    if (windowConfigMatch) {
      console.log(`Found window.config for ${url}`);
      return windowConfigMatch[1];
    }
    
    console.log(`⚠️ Transcript config not found in HTML for ${url}`);
    return null;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

// Vimeo API v3を使用（トークンなし公開データ）
async function fetchTranscriptViaAPI(videoId) {
  console.log(`Trying API for video ${videoId}...`);
  
  try {
    // Vimeo公開API
    const response = await fetch(`https://vimeo.com/${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    
    // トランスクリプトデータをHTMLから抽出
    // data-config属性またはscriptタグを探す
    const transcriptMatch = html.match(/"transcript":\s*(\[[\s\S]*?\])/);
    if (transcriptMatch) {
      try {
        const transcript = JSON.parse(transcriptMatch[1]);
        return transcript;
      } catch (e) {
        console.warn(`Failed to parse transcript JSON: ${e.message}`);
      }
    }
    
    // 別パターン: cues配列を探す
    const cuesMatch = html.match(/"cues":\s*(\[[\s\S]*?\])/);
    if (cuesMatch) {
      try {
        const cues = JSON.parse(cuesMatch[1]);
        return cues;
      } catch (e) {
        console.warn(`Failed to parse cues JSON: ${e.message}`);
      }
    }
    
    return null;
  } catch (error) {
    console.error(`API error for ${videoId}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Vimeo トランスクリプト取得スクリプト');
  console.log('='.repeat(60));
  console.log('');
  
  for (const video of videos) {
    console.log(`\n📺 動画: ${video.title}`);
    console.log(`🔗 URL: ${video.url}`);
    console.log('-'.repeat(60));
    
    // 方法1: HTMLから抽出
    const htmlTranscript = await fetchVimeoPage(video.url);
    if (htmlTranscript) {
      console.log('✅ HTMLから取得成功');
      console.log(htmlTranscript.substring(0, 200));
    } else {
      console.log('❌ HTMLから取得失敗');
    }
    
    // 方法2: APIから抽出
    const apiTranscript = await fetchTranscriptViaAPI(video.id);
    if (apiTranscript) {
      console.log('✅ APIから取得成功');
      console.log(JSON.stringify(apiTranscript).substring(0, 200));
    } else {
      console.log('❌ APIから取得失敗');
    }
    
    // 待機
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('⚠️  注記: Vimeoのトランスクリプトはプレーヤー側で');
  console.log('ブラウザAPI経由でのみ取得可能です。');
  console.log('DevTools コンソールのスクリプトを使用してください。');
  console.log('='.repeat(60));
}

main().catch(console.error);
