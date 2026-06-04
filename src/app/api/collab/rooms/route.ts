import { NextResponse } from 'next/server';
import { rooms, generateId } from '@/lib/collab-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { folderId, passcode } = await req.json();
  if (!folderId || !passcode) {
    return NextResponse.json({ error: 'folderId and passcode required' }, { status: 400 });
  }
  const roomId = generateId(6);
  console.log(`[Collab] Creating room: ${roomId} for folder: ${folderId}`);
  rooms.set(roomId, {
    passcode,
    folderId,
    clients: new Map(),
    sessionTokens: new Map(),
    fileContents: new Map(),
    fileNotes: new Map(),
  });
  return NextResponse.json({ roomId });
}
