import React, { useState, useEffect, useRef } from "react";
import { Code, Plus } from "lucide-react";

export function SnippetPalette({
  isOpen,
  onClose,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (content: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [snippets, setSnippets] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      fetch('/api/snippets')
        .then(res => res.json())
        .then(data => setSnippets(data))
        .catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const entries = Object.entries(snippets);
  const filtered = entries.filter(([name]) => name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex justify-center items-start pt-[15vh] font-mono" onClick={onClose}>
      <div className="w-[500px] bg-[#252526] border border-[#454545] rounded-xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3 border-b border-[#2b2b2b] bg-[#1e1e1e]">
          <Code size={16} className="text-[#cccccc] opacity-50 mr-3" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-[#cccccc] placeholder:text-[#cccccc]/30 text-sm"
            placeholder="Search saved snippets..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && filtered.length > 0) {
                onSelect(filtered[0][1]);
                onClose();
              }
            }}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {filtered.length > 0 ? (
            <div className="py-2">
              {filtered.map(([name, content]) => (
                <div 
                  key={name}
                  className="px-4 py-2 hover:bg-[#094771] cursor-pointer flex flex-col group transition-colors"
                  onClick={() => { onSelect(content); onClose(); }}
                >
                  <div className="flex items-center gap-2 text-sm text-[#cccccc] group-hover:text-white font-bold">
                    <Plus size={14} className="text-green-500 group-hover:text-green-400" />
                    <span>{name}</span>
                  </div>
                  <div className="text-[10px] text-[#cccccc]/40 group-hover:text-white/60 truncate pl-5 mt-0.5">
                    {content.substring(0, 80)}{content.length > 80 ? "..." : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-[12px] text-[#cccccc]/40">
              {entries.length === 0 ? "No snippets saved yet. Right click editor to save." : `No snippets found matching "${query}"`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
