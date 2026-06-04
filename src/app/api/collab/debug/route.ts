import { NextResponse } from 'next/server';
import { rooms } from '@/lib/collab-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
    id,
    folderId: room.folderId,
    clientCount: room.clients.size,
    tokenCount: room.sessionTokens.size,
    hasContents: room.fileContents.size > 0,
    hasNotes: room.fileNotes.size > 0,
  }));

  return NextResponse.json({
    processId: process.pid,
    uptime: process.uptime(),
    roomCount: rooms.size,
    rooms: roomList,
    memory: process.memoryUsage(),
  });
}
