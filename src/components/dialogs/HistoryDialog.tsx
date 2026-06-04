"use client";

import React from "react";
import { X, History, RotateCcw, Clock, FileJson } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Snapshot {
  content: string;
  ts: number;
}

interface HistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: Snapshot[];
  onRestore: (content: string) => void;
  fileName: string;
}

export function HistoryDialog({
  isOpen,
  onClose,
  snapshots,
  onRestore,
  fileName
}: HistoryDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md font-mono" onClick={onClose}>
      <div className="w-[550px] bg-[#252526] border border-[#454545] shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-[#2b2b2b] flex items-center justify-between bg-[#1e1e1e] shrink-0">
          <div className="flex items-center gap-3 text-white font-bold tracking-tight text-[15px]">
            <History size={20} className="text-orange-400" />
            <span>SAVE HISTORY — {fileName}</span>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 p-1 hover:bg-[#333333] rounded-lg transition-opacity">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          {snapshots.length > 0 ? (
            <div className="grid gap-3">
              {snapshots.map((snapshot, index) => (
                <div 
                  key={index}
                  className="group flex items-center justify-between p-4 bg-[#1e1e1e] border border-[#3c3c3c] hover:border-[#007acc] rounded-lg transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#333333] flex items-center justify-center text-[#cccccc] group-hover:bg-[#007acc] group-hover:text-white transition-colors">
                      <Clock size={20} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[13px] text-white font-bold">
                        {index === 0 ? "Latest Version" : `Snapshot #${snapshots.length - index}`}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-[#cccccc] opacity-50">
                        <FileJson size={12} />
                        <span>{formatBytes(snapshot.content.length)}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(snapshot.ts, { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onRestore(snapshot.content);
                      onClose();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#333333] hover:bg-orange-600 text-[#cccccc] hover:text-white rounded-md font-bold text-[11px] uppercase tracking-wider transition-all"
                  >
                    <RotateCcw size={13} />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <History size={48} className="text-[#cccccc] opacity-10" />
              <p className="text-[13px] text-[#cccccc] opacity-40 max-w-[200px]">
                No save history found for this file yet. History is saved locally when you press Cmd+S.
              </p>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 bg-[#1e1e1e]/50 border-t border-[#2b2b2b] text-[10px] text-[#cccccc] opacity-40 text-center italic">
          History is stored in your browser&apos;s local storage and is unique to this machine.
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
