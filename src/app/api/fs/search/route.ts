import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_DIR = path.join(process.cwd(), 'workspace');

type SearchResult = {
  fileId: string;
  fileName: string;
  line: number;
  text: string;
  matchStart: number;
};

async function searchFiles(dirPath: string, relativePath: string, query: string, results: SearchResult[]) {
  if (results.length >= 200) return;
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch { return; }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dirPath, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await searchFiles(fullPath, relPath, query, results);
    } else if (entry.name.endsWith('.json')) {
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        const lowerQuery = query.toLowerCase();
        for (let i = 0; i < lines.length && results.length < 200; i++) {
          const lowerLine = lines[i].toLowerCase();
          const idx = lowerLine.indexOf(lowerQuery);
          if (idx !== -1) {
            results.push({ fileId: relPath, fileName: entry.name, line: i + 1, text: lines[i], matchStart: idx });
          }
        }
      } catch { /* skip unreadable */ }
    }
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  if (!query || query.length < 2) return NextResponse.json([]);
  const results: SearchResult[] = [];
  await searchFiles(WORKSPACE_DIR, '', query, results);
  return NextResponse.json(results);
}
