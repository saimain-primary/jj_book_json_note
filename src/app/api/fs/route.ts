import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: nodes, error } = await supabase
    .from('nodes')
    .select('*');

  if (error) {
    console.error('[Supabase] Fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch nodes' }, { status: 500 });
  }

  // Build tree from flat list
  function buildTree(parentId: string | null = null): unknown[] {
    return (nodes || [])
      .filter(node => node.parent_id === parentId)
      .map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        status: node.status,
        preset: node.preset,
        size: node.content?.length || 0,
        children: node.type === 'folder' ? buildTree(node.id) : undefined
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
  }

  const tree = buildTree(null);
  
  // Calculate stats
  const totalFiles = (nodes || []).filter(n => n.type === 'file').length;
  const totalSize = (nodes || []).reduce((acc, n) => acc + (n.content?.length || 0), 0);

  return NextResponse.json({
    tree,
    stats: { totalFiles, totalSize }
  });
}

export async function POST(req: Request) {
  const { path: id, type, content } = await req.json();
  const name = id.split('/').pop() || id;
  const parentId = id.includes('/') ? id.substring(0, id.lastIndexOf('/')) : null;

  const { error } = await supabase
    .from('nodes')
    .insert({
      id,
      name,
      type,
      content: type === 'file' ? (content || '{\n  \n}') : null,
      parent_id: parentId,
      preset: type === 'folder' ? content : null
    });

  if (error) {
    console.error('[Supabase] Insert error:', error);
    return NextResponse.json({ error: 'Creation failed', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request) {
  const body = await req.json();
  
  try {
    if (body.action === 'rename') {
      const { oldPath, newPath } = body;
      
      // Note: Supabase doesn't support recursive path updates easily.
      // For a simple rename of a single file:
      const { error } = await supabase
        .from('nodes')
        .update({ 
          id: newPath, 
          name: newPath.split('/').pop() 
        })
        .eq('id', oldPath);

      if (error) throw error;

    } else if (body.action === 'content') {
      const { path: id, content } = body;
      const { error } = await supabase
        .from('nodes')
        .update({ content })
        .eq('id', id);
      if (error) throw error;

    } else if (body.action === 'preset') {
      const { path: id, content } = body;
      const { error } = await supabase
        .from('nodes')
        .update({ preset: content })
        .eq('id', id);
      if (error) throw error;

    } else if (body.action === 'note') {
      const { path: id, content } = body;
      const { error } = await supabase
        .from('nodes')
        .update({ note: content })
        .eq('id', id);
      if (error) throw error;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Supabase] Update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('path');
  
  if (!id) return NextResponse.json({ error: 'Path required' }, { status: 400 });

  const { error } = await supabase
    .from('nodes')
    .delete()
    .or(`id.eq.${id},parent_id.like.${id}/*`); // Recursive delete simulation

  if (error) {
    console.error('[Supabase] Delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
