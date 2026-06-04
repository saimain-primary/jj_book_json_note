import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_DIR = path.join(process.cwd(), 'workspace');
const SNIPPETS_FILE = path.join(WORKSPACE_DIR, '.snippets.json');

async function ensureWorkspace() {
  try {
    await fs.access(WORKSPACE_DIR);
  } catch {
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  }
}

export async function GET() {
  await ensureWorkspace();
  try {
    const data = await fs.readFile(SNIPPETS_FILE, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(req: Request) {
  await ensureWorkspace();
  const { name, content } = await req.json();
  
  try {
    let snippets: Record<string, string> = {};
    try {
      const data = await fs.readFile(SNIPPETS_FILE, 'utf-8');
      snippets = JSON.parse(data);
    } catch {
      // file doesn't exist
    }

    snippets[name] = content;
    await fs.writeFile(SNIPPETS_FILE, JSON.stringify(snippets, null, 2), 'utf-8');
    return NextResponse.json({ success: true, snippets });
  } catch {
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
