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

declare global {
  var __collabRooms: Map<string, CollabRoom> | undefined;
}

export const rooms: Map<string, CollabRoom> =
  globalThis.__collabRooms ?? (globalThis.__collabRooms = new Map());

// Debug room lifecycle on server
const log = (msg: string) => console.log(`[Collab] ${msg}`);

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
