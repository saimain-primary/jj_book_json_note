import { NextResponse } from 'next/server';
import { rooms, broadcastToRoom, CollabEvent } from '@/lib/collab-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';

  const room = rooms.get(roomId);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const clientInfo = room.sessionTokens.get(token);
  if (!clientInfo) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });

  room.sessionTokens.delete(token);
  const { clientId, name, color } = clientInfo;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: CollabEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      room.clients.set(clientId, { clientId, name, color, broadcast: send });

      const currentClients = Array.from(room.clients.values()).map(c => ({
        clientId: c.clientId,
        name: c.name,
        color: c.color,
      }));

      // Send full state: clients + all known file contents + all known notes
      send({
        type: 'state_sync',
        clients: currentClients,
        fileContents: Object.fromEntries(room.fileContents || new Map()),
        fileNotes: Object.fromEntries(room.fileNotes || new Map()),
      });

      broadcastToRoom(room, { type: 'user_join', clientId, name, color }, clientId);

      const keepAlive = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keepalive\n\n')); }
        catch { clearInterval(keepAlive); }
      }, 20_000);

      req.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        room.clients.delete(clientId);
        broadcastToRoom(room, { type: 'user_leave', clientId });
        try { controller.close(); } catch { /* already closed */ }

        if (room.clients.size === 0) {
          setTimeout(() => {
            if (rooms.get(roomId)?.clients.size === 0) rooms.delete(roomId);
          }, 120_000);
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = rooms.get(roomId);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  // Initialize room.fileNotes if it doesn't exist (safety for legacy sessions)
  if (!room.fileNotes) room.fileNotes = new Map();

  const event: CollabEvent = await req.json();

  // Persist file contents in room state so new joiners get them
  if (event.type === 'content_change') {
    room.fileContents.set(event.fileId, event.content);
  } else if (event.type === 'note_change') {
    room.fileNotes.set(event.fileId, event.content);
  }

  broadcastToRoom(room, event, 'clientId' in event ? event.clientId : undefined);

  return NextResponse.json({ ok: true });
}
