"use client";

import { useState } from 'react';
import { Users, Copy, Check, X, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  folderId: string;
  folderName: string;
  onClose: () => void;
  onSessionCreated: (roomId: string, token: string, clientId: string, name: string, color: string) => void;
};

export function ShareLiveDialog({ folderId, folderName, onClose, onSessionCreated }: Props) {
  const [passcode, setPasscode] = useState('');
  const [roomUrl, setRoomUrl] = useState('');
  const [hasCopied, setHasCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!passcode.trim()) { setError('Passcode is required'); return; }
    setIsCreating(true);
    setError('');
    try {
      const createRes = await fetch('/api/collab/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, passcode }),
      });
      const { roomId } = await createRes.json();

      const joinRes = await fetch(`/api/collab/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const { token, clientId, name, color } = await joinRes.json();

      const url = `${window.location.origin}${window.location.pathname}?collab=${roomId}`;
      setRoomUrl(url);
      onSessionCreated(roomId, token, clientId, name, color);
    } catch {
      setError('Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md font-mono"
      onClick={onClose}
    >
      <div
        className="w-[500px] bg-[#252526] border border-[#454545] shadow-2xl rounded-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-[#2b2b2b] flex items-center justify-between bg-[#1e1e1e]">
          <div className="flex items-center gap-3 text-white font-bold tracking-tight text-[15px]">
            <Users size={20} className="text-[#007acc]" />
            <span>SHARE LIVE — {folderName}</span>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 p-1 hover:bg-[#333333] rounded-lg transition-opacity">
            <X size={18} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {!roomUrl ? (
            <>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#cccccc] opacity-60 flex items-center gap-1.5">
                  <Lock size={11} /> Passcode
                </label>
                <input
                  type="text"
                  value={passcode}
                  onChange={e => setPasscode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Set a passcode for collaborators"
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-4 py-3 text-[13px] text-white outline-none focus:border-[#007acc] transition-all"
                  autoFocus
                />
                {error && <p className="text-red-400 text-[12px]">{error}</p>}
              </div>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full py-3 bg-[#007acc] hover:bg-[#0062a3] text-white rounded-lg font-bold text-[12px] uppercase tracking-wider transition-all disabled:opacity-50 active:scale-[0.99]"
              >
                {isCreating ? 'Starting...' : 'Start Live Session'}
              </button>
            </>
          ) : (
            <div className="space-y-5">
              <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg text-green-400 text-[12px] text-center font-bold">
                ✓ Live session active
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#cccccc] opacity-40">Room Link</label>
                <div className="flex gap-2 p-1.5 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg items-center">
                  <input readOnly value={roomUrl} className="flex-1 bg-transparent border-none outline-none text-[12px] text-[#cccccc] px-2 font-mono opacity-80 select-all truncate" />
                  <button
                    onClick={() => { navigator.clipboard.writeText(roomUrl); setHasCopied(true); setTimeout(() => setHasCopied(false), 2000); }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-md font-bold text-[11px] transition-all whitespace-nowrap",
                      hasCopied ? "bg-green-600 text-white" : "bg-[#007acc] hover:bg-[#0062a3] text-white"
                    )}
                  >
                    {hasCopied ? <><Check size={13} />Copied!</> : <><Copy size={13} />Copy Link</>}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-[#cccccc] opacity-40">Passcode to share</label>
                <div className="flex gap-2 p-1.5 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg items-center">
                  <span className="flex-1 px-2 text-[13px] text-[#cccccc] font-mono select-all">{passcode}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(passcode)}
                    className="flex items-center gap-2 px-4 py-2 rounded-md font-bold text-[11px] bg-[#333333] hover:bg-[#444444] text-white transition-all"
                  >
                    <Copy size={13} />Copy
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#cccccc] opacity-30 text-center">Share the link + passcode with your collaborator</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
