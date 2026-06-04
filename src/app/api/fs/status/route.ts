import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_DIR = path.join(process.cwd(), 'workspace');
const METADATA_FILE = path.join(WORKSPACE_DIR, '.metadata.json');

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
    const data = await fs.readFile(METADATA_FILE, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(req: Request) {
  await ensureWorkspace();
  const { path: id, status } = await req.json();
  
  try {
    let metadata: Record<string, { status?: string }> = {};
    try {
      const data = await fs.readFile(METADATA_FILE, 'utf-8');
      metadata = JSON.parse(data);
    } catch {
      // file doesn't exist
    }

    if (!metadata[id]) metadata[id] = {};
    metadata[id].status = status;

    await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8');
    return NextResponse.json({ success: true, metadata });
  } catch {
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
