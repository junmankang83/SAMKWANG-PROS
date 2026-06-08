#!/usr/bin/env node
/**
 * API JSON (`{ items: PuDelvItemRow[] }`)과 ERP에서 저장한 CSV의 행 키 집합을 비교합니다.
 * 사용: node scripts/compare-pu-delv-to-csv.mjs <api.json> <export.csv>
 *
 * CSV 첫 행은 헤더. 납품번호·품번 열은 헤더 셀에 다음 키워드가 포함되면 자동 매칭합니다.
 * - 납품번호: 납품번호 | 외주납품번호
 * - 품번: 품번 | 외주품번 | ItemNo
 */

import fs from 'fs';
import path from 'path';

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim().replace(/^\uFEFF/, '').replace(/^"|"$/g, ''));
}

function norm(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, '');
}

function findColIdx(headers, keywords) {
  const h = headers.map((x) => norm(x));
  for (const kw of keywords) {
    const k = norm(kw);
    const idx = h.findIndex((cell) => cell.includes(k));
    if (idx >= 0) return idx;
  }
  return -1;
}

function key(delv, item) {
  return `${norm(delv)}|${norm(item)}`;
}

function loadApiKeys(apiPath) {
  const raw = JSON.parse(fs.readFileSync(apiPath, 'utf8'));
  const items = Array.isArray(raw.items) ? raw.items : [];
  const set = new Set();
  for (const row of items) {
    set.add(key(row.delvNo, row.itemCode));
  }
  return { set, count: items.length, schemaMeta: raw.schemaMeta };
}

function loadCsvKeys(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) {
    throw new Error('CSV에 헤더+데이터가 없습니다.');
  }
  const headers = splitCsvLine(lines[0]);
  const delvIdx = findColIdx(headers, ['납품번호', '외주납품번호']);
  const itemIdx = findColIdx(headers, ['품번', '외주품번', 'ItemNo']);
  if (delvIdx < 0 || itemIdx < 0) {
    console.error('헤더:', headers.join(' | '));
    throw new Error(
      `납품번호/외주납품번호 또는 품번/외주품번 열을 찾지 못했습니다. (delvIdx=${delvIdx}, itemIdx=${itemIdx})`,
    );
  }
  const set = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length <= Math.max(delvIdx, itemIdx)) continue;
    set.add(key(cols[delvIdx], cols[itemIdx]));
  }
  return { set, count: lines.length - 1, delvIdx, itemIdx };
}

function diff(a, b) {
  const onlyA = [...a].filter((k) => !b.has(k));
  const onlyB = [...b].filter((k) => !a.has(k));
  return { onlyA, onlyB };
}

function main() {
  const apiPath = path.resolve(process.argv[2] || '');
  const csvPath = path.resolve(process.argv[3] || '');
  if (!apiPath || !csvPath || !fs.existsSync(apiPath) || !fs.existsSync(csvPath)) {
    console.error('사용법: node scripts/compare-pu-delv-to-csv.mjs <api.json> <export.csv>');
    process.exit(1);
  }
  const api = loadApiKeys(apiPath);
  const csv = loadCsvKeys(csvPath);
  const { onlyA, onlyB } = diff(api.set, csv.set);

  console.log('--- pu-delv vs CSV ---');
  console.log('API rows:', api.count, api.schemaMeta ? `schemaMeta: ${JSON.stringify(api.schemaMeta)}` : '');
  console.log('CSV data rows:', csv.count);
  console.log('API keys:', api.set.size, 'CSV keys:', csv.set.size);
  console.log('Only in API (first 30):', onlyA.slice(0, 30).join('; ') || '(none)');
  console.log('Only in CSV (first 30):', onlyB.slice(0, 30).join('; ') || '(none)');
  console.log('Symmetric diff size:', onlyA.length + onlyB.length);
  process.exit(onlyA.length + onlyB.length > 0 ? 2 : 0);
}

main();
