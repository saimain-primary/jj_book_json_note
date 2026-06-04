import { NextResponse } from 'next/server';
import { rooms, assignName, generateId } from '@/lib/collab-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const { passcode } = await req.json();

  const availableRooms = Array.from(rooms.keys());
  console.log(`[Collab][PID:${process.pid}] Join attempt for: ${roomId}. Available rooms in this route:`, availableRooms);

  const room = rooms.get(roomId);
  if (!room) {
    console.error(`[Collab][PID:${process.pid}] Room not found for join: ${roomId}`);
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }
  if (room.passcode !== passcode) {
    console.error(`[Collab][PID:${process.pid}] Wrong passcode for room: ${roomId}`);
    return NextResponse.json({ error: 'Wrong passcode' }, { status: 403 });
  }
  
  console.log(`[Collab][PID:${process.pid}] Join success for room: ${roomId}`);

  // Max 2 people (owner + 1 collaborator)
  const total = room.clients.size + room.sessionTokens.size;
  if (total >= 2) {
    return NextResponse.json({ error: 'Room is full (max 2 people)' }, { status: 403 });
  }

  const clientId = generateId(8);
  const { name, color } = assignName(room);
  const token = generateId(20);

  room.sessionTokens.set(token, { clientId, name, color });
  rooms.save(); // Sync to disk immediately for multi-process environments
  
  setTimeout(() => {
    room.sessionTokens.delete(token);
    rooms.save();
  }, 120_000); // Increased to 2 mins for slow networks

  return NextResponse.json({ token, clientId, name, color });
}
