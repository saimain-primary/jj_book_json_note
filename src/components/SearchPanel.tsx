"use client";

import { useState, useCallback } from 'react';
import { Search, FileJson, X } from 'lucide-react';

type SearchResult = {
  fileId: string;
  fileName: string;
  line: number;
  text: string;
  matchStart: number;
};

type Props = {
  onSelectFile: (fileId: string, line: number) => void;
};

export function SearchPanel({ onSelectFile }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/fs/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    } catch { /* ignore */ } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    search(q);
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.fileId]) acc[r.fileId] = [];
    acc[r.fileId].push(r);
    return acc;
  }, {});

  const highlightMatch = (text: string, q: string, matchStart: number) => {
    const trimmed = text.trimStart();
    const trimOffset = text.length - trimmed.length;
    const start = Math.max(0, matchStart - trimOffset);
    const end = start + q.length;
    return (
      <>
        <span className="opacity-50">{trimmed.slice(0, start)}</span>
        <mark className="bg-yellow-400/30 text-yellow-200 rounded-[2px] not-italic">{trimmed.slice(start, end)}</mark>
        <span className="opacity-50">{trimmed.slice(end)}</span>
      </>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[#2b2b2b]">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#cccccc] opacity-40 pointer-events-none" />
          <input
            value={query}
            onChange={handleChange}
            placeholder="Search across files..."
            className="w-full bg-[#3c3c3c] border border-[#454545] focus:border-[#007acc] rounded px-3 py-1.5 pl-7 text-[12px] text-white outline-none font-mono"
            autoFocus
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto text-[12px] font-mono">
        {isSearching && <div className="px-4 py-3 text-[11px] text-[#cccccc] opacity-40">Searching...</div>}
        {!isSearching && query.length >= 2 && results.length === 0 && (
          <div className="px-4 py-3 text-[11px] text-[#cccccc] opacity-40">No results for &quot;{query}&quot;</div>
        )}
        {Object.entries(grouped).map(([fileId, fileResults]) => (
          <div key={fileId}>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#2a2d2e] border-b border-[#1e1e1e] text-[11px] font-bold text-[#cccccc] opacity-80 sticky top-0 z-10">
              <FileJson size={11} className="text-yellow-500 shrink-0" />
              <span className="truncate flex-1">{fileResults[0].fileName}</span>
              <span className="opacity-40 shrink-0 font-normal">{fileResults.length}</span>
            </div>
            {fileResults.map((r, i) => (
              <div
                key={i}
                onClick={() => onSelectFile(r.fileId, r.line)}
                className="flex gap-2 px-3 py-0.5 hover:bg-[#094771] cursor-pointer items-baseline"
              >
                <span className="text-[10px] text-[#007acc] opacity-50 w-7 shrink-0 text-right">{r.line}</span>
                <span className="text-[11px] truncate">{highlightMatch(r.text, query, r.matchStart)}</span>
              </div>
            ))}
          </div>
        ))}
        {results.length >= 200 && (
          <div className="px-4 py-2 text-[10px] text-center text-[#cccccc] opacity-30">Showing first 200 results</div>
        )}
      </div>
    </div>
  );
}
