import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('path');

  if (!id) return NextResponse.json({ error: 'Path required' }, { status: 400 });

  try {
    const { data: node, error } = await supabase
      .from('nodes')
      .select('content, note')
      .eq('id', id)
      .single();

    if (error || !node) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      content: node.content || '{\n  \n}', 
      note: node.note || '' 
    });
  } catch (error) {
    console.error('[Supabase] Fetch error:', error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}
