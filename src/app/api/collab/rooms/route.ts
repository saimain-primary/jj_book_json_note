import { NextResponse } from 'next/server';
import { rooms, generateId } from '@/lib/collab-store';

export async function POST(req: Request) {
  const { folderId, passcode } = await req.json();
  if (!folderId || !passcode) {
    return NextResponse.json({ error: 'folderId and passcode required' }, { status: 400 });
  }
  const roomId = generateId(6);
  rooms.set(roomId, {
    passcode,
    folderId,
    clients: new Map(),
    sessionTokens: new Map(),
    fileContents: new Map(),
  });
  return NextResponse.json({ roomId });
}
