import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query || query.length < 2) return NextResponse.json([]);

  try {
    const { data: nodes, error } = await supabase
      .from('nodes')
      .select('id, name, content')
      .eq('type', 'file')
      .ilike('content', `%${query}%`);

    if (error) throw error;

    const results: { fileId: string; fileName: string; line: number; text: string; matchStart: number; matchLength: number }[] = [];
    nodes?.forEach(node => {
      const content = node.content || '';
      const lines = content.split('\n');
      lines.forEach((line: string, index: number) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            fileId: node.id,
            fileName: node.name,
            line: index + 1,
            text: line.trim(),
            matchStart: line.toLowerCase().indexOf(query.toLowerCase()),
            matchLength: query.length
          });
        }
      });
    });

    return NextResponse.json(results.slice(0, 200));
  } catch (error) {
    console.error('[Supabase] Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
