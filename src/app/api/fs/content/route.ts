import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_DIR = path.join(process.cwd(), 'workspace');

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const reqPath = searchParams.get('path');
  
  if (!reqPath) return NextResponse.json({ error: 'Path required' }, { status: 400 });

  const fullPath = path.join(WORKSPACE_DIR, reqPath);
  if (!fullPath.startsWith(WORKSPACE_DIR)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    
    let note: string | undefined;
    try {
      const dirPath = path.dirname(fullPath);
      const fileName = path.basename(fullPath);
      const notePath = path.join(dirPath, `.${fileName}.note`);
      note = await fs.readFile(notePath, 'utf-8');
    } catch {
      // No note found
    }

    return NextResponse.json({ content, note });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
