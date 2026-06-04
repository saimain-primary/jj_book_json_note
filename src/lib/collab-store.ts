import fs from 'fs';
import path from 'path';

// ... (types remain the same)
export type CollabEvent =
  | { type: 'state_sync'; clients: ClientInfo[]; fileContents: Record<string, string>; fileNotes: Record<string, string> }
  | { type: 'user_join'; clientId: string; name: string; color: string }
  | { type: 'user_leave'; clientId: string }
  | { type: 'content_change'; clientId: string; name: string; fileId: string; content: string }
  | { type: 'note_change'; clientId: string; name: string; fileId: string; content: string }
  | { type: 'cursor_move'; clientId: string; name: string; color: string; fileId: string; lineNumber: number; column: number }
  | { type: 'file_open'; clientId: string; fileId: string };

export type ClientInfo = {
  clientId: string;
  name: string;
  color: string;
};

type CollabClientEntry = ClientInfo & {
  broadcast: (event: CollabEvent) => void;
};

export type CollabRoom = {
  passcode: string;
  folderId: string;
  clients: Map<string, CollabClientEntry>;
  sessionTokens: Map<string, ClientInfo>;
  fileContents: Map<string, string>;
  fileNotes: Map<string, string>;
};

const ROOMS_FILE = path.join(process.cwd(), 'workspace', '.active_rooms.json');

// Memory-only tracking for live connections
const ROOMS_KEY = Symbol.for('jjbook.collab.rooms');
const globalStore = globalThis as unknown as { [ROOMS_KEY]: Map<string, CollabRoom> };

if (!globalStore[ROOMS_KEY]) {
  globalStore[ROOMS_KEY] = new Map<string, CollabRoom>();
}
const roomsMemory: Map<string, CollabRoom> = globalStore[ROOMS_KEY];

// Helper to ensure a room exists in memory
function ensureRoomInMemory(roomId: string): CollabRoom | null {
  let room = roomsMemory.get(roomId);

  try {
    if (fs.existsSync(ROOMS_FILE)) {
      const allRooms = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf-8'));
      const data = allRooms[roomId];
      
      if (data) {
        if (!room) {
          room = {
            passcode: data.passcode,
            folderId: data.folderId,
            clients: new Map(),
            sessionTokens: new Map(Object.entries(data.sessionTokens || {})),
            fileContents: new Map(Object.entries(data.fileContents || {})),
            fileNotes: new Map(Object.entries(data.fileNotes || {})),
          };
          roomsMemory.set(roomId, room);
        } else {
          // Sync data from file to existing memory room
          room.passcode = data.passcode;
          room.folderId = data.folderId;
          room.sessionTokens = new Map(Object.entries(data.sessionTokens || {}));
          // Only sync contents if they are newer/different (basic merge)
          Object.entries(data.fileContents || {}).forEach(([fid, content]) => {
            room!.fileContents.set(fid, content as string);
          });
          Object.entries(data.fileNotes || {}).forEach(([fid, note]) => {
            room!.fileNotes.set(fid, note as string);
          });
        }
        return room;
      }
    }
  } catch (e) {
    console.error('[Collab] Failed to load/sync room from disk', e);
  }
  
  return room || null;
}

// Global Rooms Proxy
export const rooms = {
  get: (id: string) => ensureRoomInMemory(id),
  has: (id: string) => ensureRoomInMemory(id) !== null,
  set: (id: string, room: CollabRoom) => {
    roomsMemory.set(id, room);
    persistRoomsToDisk();
  },
  delete: (id: string) => {
    roomsMemory.delete(id);
    persistRoomsToDisk();
  },
  save: () => persistRoomsToDisk(), // Allow manual trigger
  keys: () => {
    return roomsMemory.keys();
  },
  entries: () => {
    return roomsMemory.entries();
  },
  get size() { return roomsMemory.size; }
};

function persistRoomsToDisk() {
  try {
    const data: Record<string, { passcode: string; folderId: string; sessionTokens: Record<string, ClientInfo>; fileContents: Record<string, string>; fileNotes: Record<string, string> }> = {};
    for (const [id, room] of roomsMemory.entries()) {
      data[id] = {
        passcode: room.passcode,
        folderId: room.folderId,
        sessionTokens: Object.fromEntries(room.sessionTokens),
        fileContents: Object.fromEntries(room.fileContents),
        fileNotes: Object.fromEntries(room.fileNotes),
      };
    }
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Collab] Failed to persist rooms', e);
  }
}

const ADJECTIVES = ['swift', 'brave', 'calm', 'wise', 'bold', 'keen', 'dark', 'fleet', 'sharp', 'crisp'];
const ANIMALS = ['fox', 'hawk', 'wolf', 'owl', 'bear', 'lynx', 'raven', 'deer', 'cat', 'elk'];
const COLORS = ['#f97316', '#a78bfa'];

export function assignName(room: CollabRoom): { name: string; color: string } {
  const all = [
    ...Array.from(room.clients.values()),
    ...Array.from(room.sessionTokens.values()),
  ];
  const usedColors = new Set(all.map(c => c.color));
  const usedAdjs = new Set(all.map(c => c.name.split('-')[0]));

  const color = COLORS.find(c => !usedColors.has(c)) ?? COLORS[Math.floor(Math.random() * COLORS.length)];
  const adj = ADJECTIVES.find(a => !usedAdjs.has(a)) ?? ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];

  return { name: `${adj}-${animal}`, color };
}

export function broadcastToRoom(room: CollabRoom, event: CollabEvent, excludeClientId?: string) {
  for (const [clientId, client] of room.clients) {
    if (clientId !== excludeClientId) {
      try { client.broadcast(event); } catch { /* disconnected */ }
    }
  }
}

export function generateId(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
