import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: snippets, error } = await supabase
      .from('snippets')
      .select('name, content');

    if (error) throw error;

    const snippetMap: Record<string, string> = {};
    snippets?.forEach(s => {
      snippetMap[s.name] = s.content;
    });

    return NextResponse.json(snippetMap);
  } catch (error) {
    console.error('[Supabase] Snippets fetch error:', error);
    return NextResponse.json({});
  }
}

export async function POST(req: Request) {
  try {
    const { name, content } = await req.json();

    const { error } = await supabase
      .from('snippets')
      .upsert({ name, content });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Supabase] Snippet save error:', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
