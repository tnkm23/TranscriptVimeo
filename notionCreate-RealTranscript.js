const https = require('https');
const fs = require('fs');
const path = require('path');

// Notion API credentials (read from environment)
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PAGE_ID = process.env.NOTION_PARENT_PAGE_ID; // Notion parent page ID (database or page)

const pageTitle = 'How to Create Complex Patterns with Custom UVs';

const transcriptPath = process.argv[2] || path.join(__dirname, 'transcript-latest.txt');

function loadTranscript(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.replace(/\r\n/g, '\n').trim();
}

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.notion.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(body))
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data: JSON.parse(data || '{}') });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function createNotionPageWithTranscript() {
  try {
    if (!NOTION_TOKEN || !PAGE_ID) {
      throw new Error('Missing environment: set NOTION_TOKEN and NOTION_PARENT_PAGE_ID');
    }
    console.log('Creating Notion page with real transcript...');
    console.log(`Source: ${transcriptPath}`);

    const transcript = loadTranscript(transcriptPath);
    const lines = transcript.split('\n');

    // Split transcript into chunks (max 2000 chars per block) for paragraph blocks
    const chunks = [];
    let currentChunk = '';
    
    for (const line of lines) {
      if ((currentChunk + line + '\n').length > 1800) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    
    console.log(`Transcript split into ${chunks.length} blocks`);
    
    const blocks = [
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: `Transcript (${lines.length} lines)` } }]
        }
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `Total lines: ${lines.length} | Video: Houdini Academy - How to Create Complex Patterns with Custom UVs` } }
          ]
        }
      }
    ];
    
    // Add paragraph blocks for each chunk (plain text)
    chunks.forEach((chunk) => {
      blocks.push({
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: chunk } }]
        }
      });
    });

    const body = {
      parent: { page_id: PAGE_ID },
      properties: {
        title: {
          title: [{ type: 'text', text: { content: pageTitle } }]
        }
      },
      children: blocks
    };

    const result = await makeRequest('POST', '/v1/pages', body);
    
    console.log('\n✅ Page Created Successfully!');
    console.log('Status:', result.status);
    console.log('Page ID:', result.data.id);
    console.log('Page URL:', result.data.url);
    console.log('Transcript Lines:', lines.length);
    console.log('Paragraph Blocks:', chunks.length);
    console.log('First 100 chars:', transcript.substring(0, 100));
    console.log('Last 100 chars:', transcript.substring(transcript.length - 100));
    
    return result.data;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

createNotionPageWithTranscript();
