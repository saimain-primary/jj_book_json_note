"use client";

import { useState } from 'react';
import { Users, Lock, X } from 'lucide-react';

type Props = {
  roomId: string;
  onJoined: (token: string, clientId: string, name: string, color: string) => void;
  onCancel: () => void;
};

export function JoinCollabDialog({ roomId, onJoined, onCancel }: Props) {
  const [passcode, setPasscode] = useState('');
  const [customName, setCustomName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (!passcode.trim()) { setError('Enter the passcode'); return; }
    setIsJoining(true);
    setError('');
    try {
      const res = await fetch(`/api/collab/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'Wrong passcode') setError('Wrong passcode — try again');
        else if (data.error?.includes('full')) setError('Session is full — only 2 people allowed');
        else setError('Room not found or expired');
        return;
      }
      const { token, clientId, name: randomName, color } = await res.json();
      const finalName = customName.trim() || randomName;
      onJoined(token, clientId, finalName, color);
    } catch {
      setError('Connection failed — is the server running?');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md font-mono">
      <div className="w-[420px] bg-[#252526] border border-[#454545] shadow-2xl rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[#2b2b2b] flex items-center justify-between bg-[#1e1e1e]">
          <div className="flex items-center gap-3 text-white font-bold tracking-tight text-[15px]">
            <Users size={20} className="text-[#007acc]" />
            <span>JOIN LIVE SESSION</span>
          </div>
          <button onClick={onCancel} className="opacity-50 hover:opacity-100 p-1 hover:bg-[#333333] rounded-lg transition-opacity">
            <X size={18} />
          </button>
        </div>
        <div className="p-8 space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#cccccc] opacity-60 flex items-center gap-1.5">
              <Lock size={11} /> Passcode
            </label>
            <input
              type="text"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Enter the session passcode"
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-4 py-3 text-[13px] text-white outline-none focus:border-[#007acc] transition-all"
              autoFocus
            />
            {error && <p className="text-red-400 text-[12px]">{error}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#cccccc] opacity-40">
              Your Name <span className="normal-case font-normal opacity-60">(optional)</span>
            </label>
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="Leave empty for a random name"
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg px-4 py-3 text-[13px] text-white outline-none focus:border-[#007acc] transition-all"
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={isJoining}
            className="w-full py-3 bg-[#007acc] hover:bg-[#0062a3] text-white rounded-lg font-bold text-[12px] uppercase tracking-wider transition-all disabled:opacity-50 active:scale-[0.99]"
          >
            {isJoining ? 'Joining...' : 'Join Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
