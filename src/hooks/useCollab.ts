"use client";

import { useEffect, useRef, useState, useCallback } from 'react';

export type CollabSession = {
  roomId: string;
  token: string;
  clientId: string;
  name: string;
  color: string;
};

export type RemoteCursor = {
  fileId: string;
  lineNumber: number;
  column: number;
  name: string;
  color: string;
};

export type RemoteClient = {
  clientId: string;
  name: string;
  color: string;
};

type UseCollabOptions = {
  session: CollabSession | null;
  onContentChange: (fileId: string, content: string, fromClientId: string) => void;
  onNoteChange?: (fileId: string, content: string, fromClientId: string) => void;
  onStateSyncContents: (fileContents: Record<string, string>) => void;
  onStateSyncNotes?: (fileNotes: Record<string, string>) => void;
};

export function useCollab({ session, onContentChange, onNoteChange, onStateSyncContents, onStateSyncNotes }: UseCollabOptions) {
  const [clients, setClients] = useState<RemoteClient[]>([]);
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());

  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle: track last-sent time for content changes
  const lastContentSentRef = useRef<Record<string, number>>({});
  const lastNoteSentRef = useRef<Record<string, number>>({});
  const contentPendingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const notePendingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!session) return;
    const { roomId, token, clientId } = session;

    const es = new EventSource(`/api/collab/rooms/${roomId}/events?token=${token}`);

    es.onmessage = (e) => {
      const event = JSON.parse(e.data as string);

      switch (event.type) {
        case 'state_sync':
          setClients((event.clients as RemoteClient[]).filter(c => c.clientId !== clientId));
          if (event.fileContents && Object.keys(event.fileContents).length > 0) {
            onStateSyncContents(event.fileContents as Record<string, string>);
          }
          if (event.fileNotes && onStateSyncNotes && Object.keys(event.fileNotes).length > 0) {
            onStateSyncNotes(event.fileNotes as Record<string, string>);
          }
          break;
        case 'user_join':
          if (event.clientId !== clientId) {
            setClients(prev => [
              ...prev.filter(c => c.clientId !== event.clientId),
              { clientId: event.clientId, name: event.name, color: event.color },
            ]);
          }
          break;
        case 'user_leave':
          setClients(prev => prev.filter(c => c.clientId !== event.clientId));
          setCursors(prev => { const m = new Map(prev); m.delete(event.clientId); return m; });
          break;
        case 'content_change':
          if (event.clientId !== clientId) {
            onContentChange(event.fileId, event.content, event.clientId);
          }
          break;
        case 'note_change':
          if (event.clientId !== clientId && onNoteChange) {
            onNoteChange(event.fileId, event.content, event.clientId);
          }
          break;
        case 'cursor_move':
          if (event.clientId !== clientId) {
            setCursors(prev => {
              const m = new Map(prev);
              m.set(event.clientId, {
                fileId: event.fileId,
                lineNumber: event.lineNumber,
                column: event.column,
                name: event.name,
                color: event.color,
              });
              return m;
            });
          }
          break;
      }
    };

    return () => es.close();
  }, [session, onContentChange, onNoteChange, onStateSyncContents, onStateSyncNotes]);

  const broadcastRaw = useCallback(async (event: object) => {
    if (!session) return;
    try {
      await fetch(`/api/collab/rooms/${session.roomId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...event, clientId: session.clientId }),
      });
    } catch { /* network error — ignore */ }
  }, [session]);

  const sendCursorMove = useCallback((fileId: string, lineNumber: number, column: number) => {
    if (!session) return;
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = setTimeout(() => {
      broadcastRaw({ type: 'cursor_move', fileId, lineNumber, column, name: session.name, color: session.color });
    }, 80);
  }, [broadcastRaw, session]);

  // Throttle helper
  const sendThrottled = useCallback((fileId: string, content: string, type: 'content_change' | 'note_change') => {
    if (!session) return;
    const now = Date.now();
    const ref = type === 'content_change' ? lastContentSentRef : lastNoteSentRef;
    const pendingRef = type === 'content_change' ? contentPendingRef : notePendingRef;
    const last = ref.current[fileId] ?? 0;
    const INTERVAL = 150;

    if (pendingRef.current[fileId]) {
      clearTimeout(pendingRef.current[fileId]);
      delete pendingRef.current[fileId];
    }

    if (now - last >= INTERVAL) {
      ref.current[fileId] = now;
      broadcastRaw({ type, fileId, content, name: session.name });
    } else {
      const remaining = INTERVAL - (now - last);
      pendingRef.current[fileId] = setTimeout(() => {
        ref.current[fileId] = Date.now();
        broadcastRaw({ type, fileId, content, name: session.name });
        delete pendingRef.current[fileId];
      }, remaining);
    }
  }, [broadcastRaw, session]);

  const sendContentChange = useCallback((fileId: string, content: string) => {
    sendThrottled(fileId, content, 'content_change');
  }, [sendThrottled]);

  const sendNoteChange = useCallback((fileId: string, content: string) => {
    sendThrottled(fileId, content, 'note_change');
  }, [sendThrottled]);

  // Push current file contents to room immediately (for initial sync)
  const pushFileContents = useCallback((fileContents: Record<string, string>, fileNotes: Record<string, string>) => {
    if (!session) return;
    Object.entries(fileContents).forEach(([fileId, content]) => {
      if (content) {
        broadcastRaw({ type: 'content_change', fileId, content, name: session.name });
      }
    });
    Object.entries(fileNotes).forEach(([fileId, content]) => {
      if (content) {
        broadcastRaw({ type: 'note_change', fileId, content, name: session.name });
      }
    });
  }, [broadcastRaw, session]);

  return { clients, cursors, sendCursorMove, sendContentChange, sendNoteChange, pushFileContents };
}
