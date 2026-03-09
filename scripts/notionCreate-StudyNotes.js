const https = require('https');
const fs = require('fs');
const path = require('path');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PAGE_ID = process.env.NOTION_PARENT_PAGE_ID;

const studyNotesPath = process.argv[2] || path.join(__dirname, 'study-notes-986452691.md');

function loadStudyNotes(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content;
}

function makeRequest(method, pathStr, body) {
  return new Promise((resolve, reject) => {
    if (!NOTION_TOKEN || !PAGE_ID) {
      reject(new Error('Missing environment: set NOTION_TOKEN and NOTION_PARENT_PAGE_ID'));
    }

    const options = {
      hostname: 'api.notion.com',
      port: 443,
      path: pathStr,
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

async function createNotionPageWithStudyNotes() {
  try {
    console.log('Creating Notion page with study notes...');
    console.log(`Source: ${studyNotesPath}`);

    const studyNotes = loadStudyNotes(studyNotesPath);
    
    // Create blocks from markdown with content chunking
    const blocks = [
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '📚 Learning Notes: Houdini Complex Patterns Tutorial' } }]
        }
      },
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: 'Study notes summarizing key concepts from the tutorial on creating complex patterns using custom UVs in Houdini.' } }]
        }
      }
    ];

    // Split content by sections and add as paragraphs/headings
    const lines = studyNotes.split('\n');
    let currentSection = '';
    
    for (const line of lines) {
      if (line.startsWith('## ') || line.startsWith('### ')) {
        if (currentSection) {
          blocks.push({
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: currentSection.trim() } }]
            }
          });
          currentSection = '';
        }
        const level = line.match(/^#+/)[0].length;
        const text = line.replace(/^#+\s*/, '').trim();
        blocks.push({
          type: `heading_${Math.min(level, 3)}`,
          [`heading_${Math.min(level, 3)}`]: {
            rich_text: [{ type: 'text', text: { content: text } }]
          }
        });
      } else if (line.trim() && !line.startsWith('#')) {
        currentSection += (currentSection ? '\n' : '') + line;
      }
    }
    
    if (currentSection) {
      blocks.push({
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: currentSection.trim() } }]
        }
      });
    }

    // Limit to 95 blocks for safety
    const finalBlocks = blocks.slice(0, 95);
    console.log(`Using ${finalBlocks.length} blocks (max 95 per page)`);

    const body = {
      parent: { page_id: PAGE_ID },
      properties: {
        title: {
          title: [{ type: 'text', text: { content: '[Learning Notes] How to Create Complex Patterns with Custom UVs' } }]
        }
      },
      children: finalBlocks
    };

    const result = await makeRequest('POST', '/v1/pages', body);

    console.log('\n✅ Study Notes Page Created Successfully!');
    console.log('Status:', result.status);
    console.log('Page ID:', result.data.id);
    console.log('Page URL:', result.data.url);
    console.log('Total Blocks:', finalBlocks.length);

    return result.data;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

createNotionPageWithStudyNotes();
