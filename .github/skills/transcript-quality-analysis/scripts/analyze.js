#!/usr/bin/env node
/**
 * Transcript Quality Analyzer
 *
 * Vimeo 動画から抽出したトランスクリプトの品質を定量的に評価し、
 * AI 要約（学習ノート生成）への適合度をスコアリングする。
 *
 * Usage:
 *   node .github/skills/transcript-quality-analysis/scripts/analyze.js <transcript-file> [--domain technical|general]
 *
 * Output:
 *   標準出力に品質レポートを表示。--json フラグで JSON 出力も可。
 */

'use strict';

const fs = require('fs');
const path = require('path');

// --- 設定 ---

const FILLER_PATTERNS = [
  /\b(uh|um|uhm)\b/gi,
  /\b(okay|ok)\b[,.]?\s*(?=\w)/gi,
  /\b(alright|right|yeah|yep|so|like|you know|i mean)\b/gi,
  /\b(oh|ah|hmm|hm|oops)\b[,.]?\s*$/gim,
];

const FILLER_LINE_REGEX = /\b(uh|um|uhm|okay|alright|yeah|yep|hmm)\b/i;

/** 技術用語リスト（Houdini / CG / シミュレーション系） */
const TECHNICAL_TERMS = [
  'velocity', 'density', 'pressure', 'voxel', 'vdb', 'grid', 'field',
  'solver', 'simulation', 'particle', 'fluid', 'euler', 'eulerian',
  'lagrangian', 'divergence', 'advect', 'curl', 'vector', 'scalar',
  'gradient', 'iteration', 'convergence', 'diffusion', 'viscosity',
  'turbulence', 'vorticity', 'sdf', 'volume', 'mesh', 'uv', 'shader',
  'texture', 'normal', 'geometry', 'primitive', 'attribute', 'point',
  'copernicus', 'cops', 'houdini', 'dop', 'sop', 'vop', 'mantra', 'karma',
  'opencl', 'kernel', 'buffer', 'node', 'network', 'parm', 'wrangle',
  'block', 'feedback', 'loop', 'iteration', 'ramp', 'transform',
  'distort', 'warp', 'noise', 'voronoi', 'perlin', 'fbm',
];

const TECHNICAL_LINE_REGEX = new RegExp(
  `\\b(${TECHNICAL_TERMS.join('|')})\\b`, 'i'
);

/** 既知の転写エラーパターン（誤表記 → 正表記） */
const TRANSCRIPTION_ERRORS = [
  { pattern: /\berian\b/g, correct: 'Eulerian' },
  { pattern: /\blaine\b/g, correct: 'Lagrangian' },
  { pattern: /\bmanl\b/g, correct: 'mandrel' },
  { pattern: /\bdist distort\b/g, correct: 'distort' },
  { pattern: /\bcop net\b/gi, correct: 'COP net' },
  { pattern: /\bconet\b/gi, correct: 'COP net' },
  { pattern: /\btur[n]? around\b/gi, correct: 'turn around' },
];

// --- コア解析関数 ---

/**
 * ファイルを読み込み、テキストを返す。JSON 形式の場合は content フィールドを抽出。
 *
 * @param {string} filePath - トランスクリプトファイルのパス
 * @returns {string} テキストコンテンツ
 */
function readTranscript(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    const json = JSON.parse(raw);
    return json.content || raw;
  } catch {
    return raw;
  }
}

/**
 * フィラーワード解析。
 *
 * @param {string[]} lines - 行配列
 * @returns {{ fillerLines: number, fillerInstances: number, topFillers: Record<string,number> }}
 */
function analyzeFillers(lines) {
  let fillerLines = 0;
  let fillerInstances = 0;
  const counts = {};

  for (const line of lines) {
    if (!line.trim()) continue;
    let hasFillerInLine = false;
    for (const pat of FILLER_PATTERNS) {
      const matches = line.match(pat) || [];
      for (const m of matches) {
        const key = m.toLowerCase().replace(/[,.\s]+$/, '');
        counts[key] = (counts[key] || 0) + 1;
        fillerInstances++;
        hasFillerInLine = true;
      }
    }
    if (hasFillerInLine || FILLER_LINE_REGEX.test(line)) fillerLines++;
  }

  const topFillers = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});

  return { fillerLines, fillerInstances, topFillers };
}

/**
 * 技術用語密度解析。
 *
 * @param {string[]} lines - 行配列
 * @returns {{ technicalLines: number, termCounts: Record<string,number> }}
 */
function analyzeTechnicalContent(lines) {
  let technicalLines = 0;
  const termCounts = {};

  for (const line of lines) {
    if (!line.trim()) continue;
    let hasTermInLine = false;
    for (const term of TECHNICAL_TERMS) {
      const re = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = line.match(re) || [];
      if (matches.length > 0) {
        termCounts[term.toLowerCase()] = (termCounts[term.toLowerCase()] || 0) + matches.length;
        hasTermInLine = true;
      }
    }
    if (hasTermInLine) technicalLines++;
  }

  return { technicalLines, termCounts };
}

/**
 * 転写エラー推定。既知の誤表記パターンを検出する。
 *
 * @param {string} text - 全文テキスト
 * @returns {{ count: number, examples: Array<{found: string, correct: string}> }}
 */
function analyzeTranscriptionErrors(text) {
  const examples = [];
  for (const { pattern, correct } of TRANSCRIPTION_ERRORS) {
    const matches = text.match(pattern) || [];
    if (matches.length > 0) {
      examples.push({ found: matches[0], correct, count: matches.length });
    }
  }
  return { count: examples.reduce((s, e) => s + e.count, 0), examples };
}

/**
 * 行長解析。
 *
 * @param {string[]} lines - 行配列
 * @returns {{ average: number, shortLines: number }}
 */
function analyzeLineLength(lines) {
  const contentLines = lines.filter(l => l.trim().length > 0);
  if (contentLines.length === 0) return { average: 0, shortLines: 0 };
  const avg = contentLines.reduce((s, l) => s + l.length, 0) / contentLines.length;
  const shortLines = contentLines.filter(l => l.length < 40).length;
  return { average: Math.round(avg * 10) / 10, shortLines };
}

/**
 * 品質スコアを計算し総合判定を返す。
 *
 * @param {{ fillerRate: number, technicalRate: number, avgLineLength: number, errorCount: number }} metrics
 * @param {number} totalLines
 * @returns {{ score: number, rating: string, action: string }}
 */
function calculateScore({ fillerRate, technicalRate, avgLineLength, errorCount }, totalLines) {
  let score = 100;

  // フィラー率ペナルティ (最大 -30)
  if (fillerRate > 0.4) score -= 30;
  else if (fillerRate > 0.2) score -= Math.round((fillerRate - 0.2) / 0.2 * 15) + 10;
  else if (fillerRate > 0.1) score -= Math.round((fillerRate - 0.1) / 0.1 * 10);

  // 技術用語密度ボーナス/ペナルティ (±20)
  if (technicalRate >= 0.3) score += 5;
  else if (technicalRate < 0.15) score -= 20;
  else score -= Math.round((0.3 - technicalRate) / 0.15 * 10);

  // 転写エラーペナルティ (最大 -20)
  if (errorCount > 20) score -= 20;
  else if (errorCount > 5) score -= Math.round((errorCount - 5) / 15 * 15) + 5;
  else if (errorCount > 0) score -= errorCount;

  // 平均行長ペナルティ (最大 -15)
  if (avgLineLength < 40) score -= 15;
  else if (avgLineLength < 60) score -= Math.round((60 - avgLineLength) / 20 * 10);

  score = Math.max(0, Math.min(100, score));

  let rating, action;
  if (score >= 80) {
    rating = '✅ GOOD';
    action = 'そのまま generateStudyNotes.js で要約可能';
  } else if (score >= 50) {
    rating = '⚠️  FAIR';
    action = 'generateStudyNotes.js の preprocessTranscript() を通してから要約';
  } else {
    rating = '❌ POOR';
    action = '手動確認後、カスタム前処理を追加してから要約';
  }

  return { score, rating, action };
}

// --- レポート出力 ---

/**
 * 品質レポートをコンソールに表示する。
 *
 * @param {string} filePath - ファイルパス
 * @param {object} report - 解析結果オブジェクト
 * @param {boolean} asJson - JSON 出力フラグ
 */
function printReport(filePath, report, asJson) {
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const { lines, chars, fillers, technical, errors, lineLength, quality } = report;
  const fillerRate = (fillers.fillerLines / lines * 100).toFixed(1);
  const techRate   = (technical.technicalLines / lines * 100).toFixed(1);
  const shortRate  = (lineLength.shortLines / lines * 100).toFixed(1);

  const topFillerStr = Object.entries(fillers.topFillers)
    .map(([k, v]) => `${k}(${v})`).join(', ');
  const topTermStr = Object.entries(technical.termCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([k, v]) => `${k}(${v})`).join(', ');
  const errorStr = errors.examples.slice(0, 4)
    .map(e => `"${e.found}" → ${e.correct}`).join(', ');

  console.log(`
=== Transcript Quality Report ===
File        : ${path.basename(filePath)}
Total lines : ${lines.toLocaleString()}
Total chars : ${chars.toLocaleString()}

[Filler Words]
  Lines with fillers : ${fillers.fillerLines} / ${lines} (${fillerRate}%)
  Filler instances   : ${fillers.fillerInstances}
  Most common        : ${topFillerStr || '(none)'}

[Technical Content]
  Technical lines    : ${technical.technicalLines} / ${lines} (${techRate}%)
  Top terms          : ${topTermStr || '(none)'}

[Transcription Errors]
  Suspected errors   : ${errors.count}
  Examples           : ${errorStr || '(none detected)'}

[Line Length]
  Average            : ${lineLength.average} chars
  Short lines (<40)  : ${lineLength.shortLines} (${shortRate}%)

[Overall Quality]
  Score  : ${quality.score} / 100
  Rating : ${quality.rating}
  Action : ${quality.action}
=================================
`);
}

// --- エントリーポイント ---

function main() {
  const args = process.argv.slice(2);
  const filePath = args.find(a => !a.startsWith('--'));
  const asJson   = args.includes('--json');

  if (!filePath) {
    console.error('Usage: node analyze.js <transcript-file> [--json]');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const text  = readTranscript(filePath);
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  const fillers    = analyzeFillers(lines);
  const technical  = analyzeTechnicalContent(lines);
  const errors     = analyzeTranscriptionErrors(text);
  const lineLength = analyzeLineLength(lines);

  const fillerRate   = fillers.fillerLines / lines.length;
  const technicalRate = technical.technicalLines / lines.length;

  const quality = calculateScore(
    { fillerRate, technicalRate, avgLineLength: lineLength.average, errorCount: errors.count },
    lines.length
  );

  const report = {
    file: path.basename(filePath),
    lines: lines.length,
    chars: text.length,
    fillers,
    technical,
    errors,
    lineLength,
    quality,
  };

  printReport(filePath, report, asJson);
}

main();
