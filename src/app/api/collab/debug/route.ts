import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: rooms } = await supabase.from('collab_rooms').select('*');
  const { data: nodes } = await supabase.from('nodes').select('id, type');

  return NextResponse.json({
    platform: 'Supabase Cloud',
    roomCount: rooms?.length || 0,
    nodeCount: nodes?.length || 0,
    rooms: rooms?.map(r => ({ id: r.id, folderId: r.folder_id })),
    timestamp: new Date().toISOString()
  });
}
