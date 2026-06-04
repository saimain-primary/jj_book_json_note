"use client";

import React, { useState } from "react";
import { X, Share2, Copy, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
}

export function ShareFolderDialog({
  isOpen,
  onClose,
  shareUrl
}: ShareFolderDialogProps) {
  const [hasCopied, setHasCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md font-mono" onClick={onClose}>
      <div className="w-[500px] bg-[#252526] border border-[#454545] shadow-2xl rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-[#2b2b2b] flex items-center justify-between bg-[#1e1e1e]">
          <div className="flex items-center gap-3 text-white font-bold tracking-tight text-[15px]">
            <Share2 size={20} className="text-[#007acc]" />
            <span>SHARE FOLDER (SNAPSHOT)</span>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 p-1 hover:bg-[#333333] rounded-lg transition-opacity">
            <X size={18} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-start gap-4 p-4 bg-blue-900/10 border border-blue-800/20 rounded-lg">
            <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-[12px] text-blue-200 font-bold leading-none">Snapshot Sharing</p>
              <p className="text-[11px] text-[#cccccc] leading-relaxed opacity-70">
                This link contains a compressed snapshot of the folder and its current contents. 
                Recipients can view the files in read-only mode. 
                Changes you make after sharing will not be visible to them.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-[#cccccc] opacity-40">Shareable URL</label>
            <div className="flex gap-2 p-1.5 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg items-center group">
              <input 
                readOnly 
                value={shareUrl} 
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-[#cccccc] px-2 font-mono opacity-80 select-all truncate" 
              />
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md font-bold text-[11px] transition-all whitespace-nowrap",
                  hasCopied ? "bg-green-600 text-white" : "bg-[#007acc] hover:bg-[#0062a3] text-white"
                )}
              >
                {hasCopied ? <><Check size={13} />Copied!</> : <><Copy size={13} />Copy Link</>}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-[#cccccc] opacity-30 text-center italic">
            Snapshots are encoded directly in the URL using LZ-String compression.
          </p>
        </div>
      </div>
    </div>
  );
}
