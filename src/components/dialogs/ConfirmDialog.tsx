import React from "react";
import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel
}: {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md font-mono" onClick={onCancel}>
      <div className="w-[400px] bg-[#252526] border border-[#454545] shadow-2xl rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-[#2b2b2b] flex items-center gap-3 bg-[#1e1e1e]">
          <AlertTriangle size={22} className="text-red-500" />
          <span className="text-white font-bold tracking-tight text-lg uppercase">{title}</span>
        </div>
        <div className="p-6">
          <p className="text-[#cccccc] text-sm leading-relaxed">{message}</p>
        </div>
        <div className="px-6 py-4 border-t border-[#2b2b2b] bg-[#1e1e1e]/50 flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="px-5 py-2 rounded-md text-xs font-bold text-[#cccccc] hover:bg-[#333333] transition-all uppercase tracking-wider"
          >
            Cancel
          </button>
          <button 
            onClick={() => { onConfirm(); onCancel(); }}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold transition-all uppercase tracking-wider shadow-lg active:scale-95"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
