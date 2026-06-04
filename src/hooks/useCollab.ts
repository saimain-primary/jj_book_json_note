"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

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
};

export function useCollab({ session, onContentChange, onNoteChange }: UseCollabOptions) {
  const [clients, setClients] = useState<RemoteClient[]>([]);
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [isSubscribed, setIsSubscribed] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);

  const lastContentSentRef = useRef<Record<string, number>>({});
  const lastNoteSentRef = useRef<Record<string, number>>({});
  const contentPendingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const notePendingRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!session) return;
    const { roomId, clientId, name, color } = session;

    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: { key: clientId },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const otherClients: RemoteClient[] = [];
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== clientId) {
            (presences as unknown as RemoteClient[]).forEach((p) => {
              otherClients.push({ clientId: p.clientId, name: p.name, color: p.color });
            });
          }
        });
        setClients(otherClients);
      })
      .on('broadcast', { event: 'cursor_move' }, ({ payload }) => {
        if (payload.clientId !== clientId) {
          console.log(`[Collab] Cursor move received from ${payload.name} (${payload.clientId})`);
          setCursors(prev => {
            const m = new Map(prev);
            m.set(payload.clientId, {
              fileId: payload.fileId,
              lineNumber: payload.lineNumber,
              column: payload.column,
              name: payload.name,
              color: payload.color,
            });
            return m;
          });
        }
      })
      .on('broadcast', { event: 'content_change' }, ({ payload }) => {
        if (payload.clientId !== clientId) {
          onContentChange(payload.fileId, payload.content, payload.clientId);
        }
      })
      .on('broadcast', { event: 'note_change' }, ({ payload }) => {
        if (payload.clientId !== clientId && onNoteChange) {
          onNoteChange(payload.fileId, payload.content, payload.clientId);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ clientId, name, color });
          setIsSubscribed(true);
          isSubscribedRef.current = true;
          console.log('[Collab] Connected to room:', roomId);
        } else {
          setIsSubscribed(false);
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setIsSubscribed(false);
      isSubscribedRef.current = false;
    };
  }, [session, onContentChange, onNoteChange]);

  const broadcastRaw = useCallback(async (event: string, payload: Record<string, unknown>) => {
    if (!channelRef.current || !session || !isSubscribedRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event,
      payload: { ...payload, clientId: session.clientId }
    });
  }, [session]);

  const lastCursorSentRef = useRef<number>(0);
  const cursorPendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendCursorMove = useCallback((fileId: string, lineNumber: number, column: number) => {
    if (!session || !isSubscribedRef.current) return;
    
    const now = Date.now();
    const INTERVAL = 100; // 10 updates per second is enough for smooth-enough cursors
    
    if (cursorPendingRef.current) {
      clearTimeout(cursorPendingRef.current);
      cursorPendingRef.current = null;
    }

    if (now - lastCursorSentRef.current >= INTERVAL) {
      lastCursorSentRef.current = now;
      broadcastRaw('cursor_move', { 
        fileId, 
        lineNumber, 
        column, 
        name: session.name, 
        color: session.color 
      });
    } else {
      cursorPendingRef.current = setTimeout(() => {
        lastCursorSentRef.current = Date.now();
        broadcastRaw('cursor_move', { 
          fileId, 
          lineNumber, 
          column, 
          name: session.name, 
          color: session.color 
        });
        cursorPendingRef.current = null;
      }, INTERVAL - (now - lastCursorSentRef.current));
    }
  }, [broadcastRaw, session]);

  const sendThrottled = useCallback((fileId: string, content: string, type: 'content_change' | 'note_change') => {
    if (!session) return;
    const now = Date.now();
    const ref = type === 'content_change' ? lastContentSentRef : lastNoteSentRef;
    const pendingRef = type === 'content_change' ? contentPendingRef : notePendingRef;
    const last = ref.current[fileId] ?? 0;
    const INTERVAL = 100; // Faster sync for WebSockets

    if (pendingRef.current[fileId]) {
      clearTimeout(pendingRef.current[fileId]);
      delete pendingRef.current[fileId];
    }

    if (now - last >= INTERVAL) {
      ref.current[fileId] = now;
      broadcastRaw(type, { fileId, content, name: session.name });
    } else {
      const remaining = INTERVAL - (now - last);
      pendingRef.current[fileId] = setTimeout(() => {
        ref.current[fileId] = Date.now();
        broadcastRaw(type, { fileId, content, name: session.name });
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

  const pushFileContents = useCallback((fileContents: Record<string, string>, fileNotes: Record<string, string>) => {
    // Initial sync through broadcast is less efficient than state sync, 
    // but works for now in this hybrid model.
    Object.entries(fileContents).forEach(([fileId, content]) => {
      if (content) broadcastRaw('content_change', { fileId, content });
    });
    Object.entries(fileNotes).forEach(([fileId, content]) => {
      if (content) broadcastRaw('note_change', { fileId, content });
    });
  }, [broadcastRaw]);

  return { clients, cursors, isSubscribed, sendCursorMove, sendContentChange, sendNoteChange, pushFileContents };
}
