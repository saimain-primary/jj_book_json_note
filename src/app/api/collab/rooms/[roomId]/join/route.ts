import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function generateId(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const ADJECTIVES = ['swift', 'brave', 'calm', 'wise', 'bold', 'keen', 'dark', 'fleet', 'sharp', 'crisp'];
const ANIMALS = ['fox', 'hawk', 'wolf', 'owl', 'bear', 'lynx', 'raven', 'deer', 'cat', 'elk'];
const COLORS = ['#f97316', '#a78bfa', '#22c55e', '#06b6d4', '#ec4899'];

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { passcode } = await req.json();

    const { data: room, error } = await supabase
      .from('collab_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (error || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.passcode !== passcode) {
      return NextResponse.json({ error: 'Wrong passcode' }, { status: 403 });
    }

    // Generate collaborator identity
    const clientId = generateId(8);
    const name = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]}-${ANIMALS[Math.floor(Math.random() * ANIMALS.length)]}`;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    return NextResponse.json({ token: 'sb-realtime', clientId, name, color });
  } catch (error) {
    console.error('[Collab] Join error:', error);
    return NextResponse.json({ error: 'Join failed' }, { status: 500 });
  }
}
