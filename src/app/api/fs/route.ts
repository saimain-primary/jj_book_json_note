import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_DIR = path.join(process.cwd(), 'workspace');

async function ensureWorkspace() {
  try {
    await fs.access(WORKSPACE_DIR);
  } catch {
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  }
}

export async function GET() {
  await ensureWorkspace();

  let metadata: Record<string, { status?: string }> = {};
  try {
    const data = await fs.readFile(path.join(WORKSPACE_DIR, '.metadata.json'), 'utf-8');
    metadata = JSON.parse(data);
  } catch {
    // metadata doesn't exist
  }

  let totalFiles = 0;
  let totalSize = 0;

  async function buildTree(dirPath: string, relativePath: string): Promise<unknown[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    // Group entries for performance: files and their potential .note hidden files
    const entryMap = new Set(entries.map(e => e.name));
    const nodes = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        // Skip metadata and notes in the main loop (they will be checked via entryMap)
        if (entry.name.endsWith('.note')) continue;
        if (entry.name === '.preset.json') continue;
        if (entry.name === '.metadata.json') continue;
        if (entry.name.startsWith('.') && !entry.name.endsWith('.json')) continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const children = await buildTree(fullPath, relPath);
        
        // Fast check for preset via set lookup instead of fs.access
        let folderPreset: string | undefined;
        if (entryMap.has('.preset.json')) {
          try {
            folderPreset = await fs.readFile(path.join(fullPath, '.preset.json'), 'utf-8');
          } catch { /* ignore */ }
        }

        nodes.push({
          id: relPath,
          name: entry.name,
          type: 'folder',
          preset: folderPreset,
          status: metadata[relPath]?.status,
          children,
        });
      } else if (entry.name.endsWith('.json')) {
        totalFiles++;
        
        // Use stat to get exact file size
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;

        // Fast check for note via entryMap
        const hasNote = entryMap.has(`.${entry.name}.note`);

        nodes.push({
          id: relPath,
          name: entry.name,
          type: 'file',
          size: stats.size,
          hasNote,
          status: metadata[relPath]?.status,
        });
      }
    }

    return nodes.sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((a as any).type !== (b as any).type) return (a as any).type === 'folder' ? -1 : 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (a as any).name.localeCompare((b as any).name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  const tree = await buildTree(WORKSPACE_DIR, '');
  return NextResponse.json({
    tree,
    stats: { totalFiles, totalSize }
  });
}

export async function POST(req: Request) {
  await ensureWorkspace();
  const { path: reqPath, type, content } = await req.json();
  const fullPath = path.join(WORKSPACE_DIR, reqPath);

  if (!fullPath.startsWith(WORKSPACE_DIR)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    if (type === 'folder') {
      await fs.mkdir(fullPath, { recursive: true });
      if (content) {
        await fs.writeFile(path.join(fullPath, '.preset.json'), content, 'utf-8');
      }
    } else {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content || '{\n  \n}', 'utf-8');
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Creation failed' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  await ensureWorkspace();
  const body = await req.json();
  
  try {
    if (body.action === 'rename') {
      const { oldPath, newPath } = body;
      const fullOldPath = path.join(WORKSPACE_DIR, oldPath);
      const fullNewPath = path.join(WORKSPACE_DIR, newPath);
      if (!fullOldPath.startsWith(WORKSPACE_DIR) || !fullNewPath.startsWith(WORKSPACE_DIR)) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }
      await fs.rename(fullOldPath, fullNewPath);
    } else if (body.action === 'content') {
      const { path: reqPath, content } = body;
      const fullPath = path.join(WORKSPACE_DIR, reqPath);
      if (!fullPath.startsWith(WORKSPACE_DIR)) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }
      await fs.writeFile(fullPath, content, 'utf-8');
    } else if (body.action === 'preset') {
      const { path: reqPath, content } = body;
      const fullPath = path.join(WORKSPACE_DIR, reqPath, '.preset.json');
      if (!fullPath.startsWith(WORKSPACE_DIR)) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }
      await fs.writeFile(fullPath, content, 'utf-8');
    } else if (body.action === 'note') {
      const { path: reqPath, content } = body;
      const fullPath = path.join(WORKSPACE_DIR, reqPath);
      if (!fullPath.startsWith(WORKSPACE_DIR)) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }
      const dirPath = path.dirname(fullPath);
      const fileName = path.basename(fullPath);
      const notePath = path.join(dirPath, `.${fileName}.note`);
      await fs.writeFile(notePath, content, 'utf-8');
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  await ensureWorkspace();
  const { searchParams } = new URL(req.url);
  const reqPath = searchParams.get('path');
  
  if (!reqPath) return NextResponse.json({ error: 'Path required' }, { status: 400 });

  const fullPath = path.join(WORKSPACE_DIR, reqPath);
  if (!fullPath.startsWith(WORKSPACE_DIR)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });

  try {
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }
  } catch {
    // Ignore if not found
  }

  return NextResponse.json({ success: true });
}
