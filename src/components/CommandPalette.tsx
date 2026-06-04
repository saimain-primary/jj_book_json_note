import React, { useState, useEffect, useRef } from "react";
import { Search, FileJson } from "lucide-react";
import { FileNode } from "@/types";

export function CommandPalette({
  isOpen,
  onClose,
  files,
  onSelect
}: {
  isOpen: boolean;
  onClose: () => void;
  files: FileNode[];
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Flatten the tree to a list of files
  const flattenFiles = (nodes: FileNode[], path = ""): { id: string, name: string, fullPath: string }[] => {
    let result: { id: string, name: string, fullPath: string }[] = [];
    for (const node of nodes) {
      if (node.type === "file") {
        result.push({ id: node.id, name: node.name, fullPath: path ? `${path}/${node.name}` : node.name });
      }
      if (node.children) {
        result = result.concat(flattenFiles(node.children, path ? `${path}/${node.name}` : node.name));
      }
    }
    return result;
  };

  const allFiles = flattenFiles(files);
  const filtered = allFiles.filter(f => f.fullPath.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex justify-center items-start pt-[15vh] font-mono" onClick={onClose}>
      <div className="w-[500px] bg-[#252526] border border-[#454545] rounded-xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center px-4 py-3 border-b border-[#2b2b2b] bg-[#1e1e1e]">
          <Search size={16} className="text-[#cccccc] opacity-50 mr-3" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-[#cccccc] placeholder:text-[#cccccc]/30 text-sm"
            placeholder="Search files by name..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && filtered.length > 0) {
                onSelect(filtered[0].id);
                onClose();
              }
            }}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {filtered.length > 0 ? (
            <div className="py-2">
              {filtered.map(f => (
                <div 
                  key={f.id}
                  className="px-4 py-2 hover:bg-[#094771] cursor-pointer flex flex-col group transition-colors"
                  onClick={() => { onSelect(f.id); onClose(); }}
                >
                  <div className="flex items-center gap-2 text-sm text-[#cccccc] group-hover:text-white">
                    <FileJson size={14} className="text-yellow-500 group-hover:text-yellow-400" />
                    <span>{f.name}</span>
                  </div>
                  <div className="text-[10px] text-[#cccccc]/40 group-hover:text-white/60 truncate pl-5">
                    {f.fullPath}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-[12px] text-[#cccccc]/40">
              No files found matching &quot;{query}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
