import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { path: id, status } = await req.json();

    const { error } = await supabase
      .from('nodes')
      .update({ status })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Supabase] Status update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function GET() {
  // Optional: return all statuses as a map for legacy compatibility
  const { data: nodes } = await supabase
    .from('nodes')
    .select('id, status');

  const metadata: Record<string, { status: string }> = {};
  nodes?.forEach(n => {
    if (n.status) metadata[n.id] = { status: n.status };
  });

  return NextResponse.json(metadata);
}
