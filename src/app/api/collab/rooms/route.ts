import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function generateId(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { folderId, passcode } = await req.json();
    if (!folderId || !passcode) {
      return NextResponse.json({ error: 'folderId and passcode required' }, { status: 400 });
    }

    const roomId = generateId(6);
    const { error } = await supabase
      .from('collab_rooms')
      .insert({ id: roomId, passcode, folder_id: folderId });

    if (error) throw error;

    console.log(`[Collab] Created Supabase room: ${roomId}`);
    return NextResponse.json({ roomId });
  } catch (error) {
    console.error('[Collab] Room creation error:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}
