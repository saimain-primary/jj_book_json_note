import { useState, useCallback, useEffect, useRef } from "react";
import { FileNode, WorkspaceStats } from "@/types";
import { findFirstFile, findNodeById } from "@/lib/tree-utils";
import LZString from "lz-string";

export function useFileSystem() {
  const [isReadOnlyMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return !!params.get("share") && !params.get("collab");
  });
  
  const [files, setFiles] = useState<FileNode[]>([]);
  const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats>({ totalFiles: 0, totalSize: 0 });
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [fileNotes, setFileNotes] = useState<Record<string, string>>({});
  
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>("");

  const fileContentsRef = useRef(fileContents);
  useEffect(() => { fileContentsRef.current = fileContents; }, [fileContents]);

  const fetchContent = useCallback(async (id: string) => {
    if (isReadOnlyMode) return;
    try {
      const res = await fetch(`/api/fs/content?path=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        let content = data.content as string;
        const note = data.note as string || "";
        try {
          // Try to pretty print if it's minified JSON
          const parsed = JSON.parse(content);
          content = JSON.stringify(parsed, null, 2);
        } catch { /* ignore */ }
        setFileContents(prev => ({ ...prev, [id]: content }));
        setFileNotes(prev => ({ ...prev, [id]: note }));
      }
    } catch {
      console.error("Failed to fetch content");
    }
  }, [isReadOnlyMode]);

  const refreshFiles = useCallback(async () => {
    if (isReadOnlyMode) return;
    try {
      const res = await fetch('/api/fs');
      if (res.ok) {
        const data = await res.json();
        const newFiles = data.tree;
        setWorkspaceStats(data.stats);
        
        setFiles(prev => {
          // Preserve open state of folders
          const syncOpenState = (oldNodes: FileNode[], newNodes: FileNode[]): FileNode[] => {
            return newNodes.map(n => {
              const old = oldNodes.find(o => o.id === n.id);
              if (n.type === 'folder' && n.children && old?.children) {
                return { ...n, isOpen: old.isOpen, children: syncOpenState(old.children, n.children) };
              }
              return { ...n, isOpen: old?.isOpen ?? n.isOpen };
            });
          };
          return syncOpenState(prev, newFiles);
        });
      }
    } catch {
      console.error("Failed to refresh tree");
    }
  }, [isReadOnlyMode]);

  // Initial data fetch
  useEffect(() => {
    const init = async () => {
      if (!isReadOnlyMode) {
        await refreshFiles();
      }
    };
    init();
  }, [isReadOnlyMode, refreshFiles]);

  // Initial share data load
  useEffect(() => {
    let ignore = false;
    if (isReadOnlyMode) {
      const params = new URLSearchParams(window.location.search);
      const sharedData = params.get("share");
      if (sharedData) {
        try {
          const decoded = LZString.decompressFromEncodedURIComponent(sharedData);
          if (decoded) {
            const folder: FileNode = JSON.parse(decoded);
            const setReadOnly = (n: FileNode) => {
              n.isReadonly = true;
              if (n.children) n.children.forEach(setReadOnly);
            };
            setReadOnly(folder);
            
            // Calculate stats for read-only mode
            let count = 0; let size = 0;
            const contents: Record<string, string> = {};
            const calc = (n: FileNode) => {
              if (n.type === 'file') {
                count++;
                size += (n.content?.length || 0);
                if (n.content !== undefined) contents[n.id] = n.content;
              }
              if (n.children) n.children.forEach(calc);
            }
            calc(folder);

            const firstId = findFirstFile(folder);
            
            // Wrap in a promise to create an async boundary
            Promise.resolve().then(() => {
              if (ignore) return;
              setFiles([folder]);
              setWorkspaceStats({ totalFiles: count, totalSize: size });
              setFileContents(contents);
              if (firstId) {
                setOpenFileIds([firstId]);
                setActiveFileId(firstId);
              }
            });
          }
        } catch {
          console.error("Failed to decode share");
        }
      }
    }
    return () => { ignore = true; };
  }, [isReadOnlyMode, setActiveFileId]);

  // Initial file selection
  useEffect(() => {
    let ignore = false;
    if (!isReadOnlyMode && files.length > 0 && openFileIds.length === 0) {
      const first = findFirstFile(files[0]);
      if (first) {
        Promise.resolve().then(() => {
          if (ignore) return;
          setOpenFileIds([first]);
          setActiveFileId(first);
          fetchContent(first);
        });
      }
    }
    return () => { ignore = true; };
  }, [isReadOnlyMode, files, openFileIds.length, fetchContent, setActiveFileId]);

  const handleFileSelect = useCallback((id: string) => {
    const node = findNodeById(files, id);
    if (node?.type === "file") {
      setOpenFileIds(prev => Array.from(new Set([...prev, id])));
      setActiveFileId(id);
      if (!fileContents[id]) fetchContent(id);
    }
  }, [files, fileContents, fetchContent]);

  const closeTab = useCallback((id: string) => {
    setOpenFileIds(prev => {
      const next = prev.filter(fId => fId !== id);
      if (activeFileId === id) {
        setActiveFileId(next.length > 0 ? next[next.length - 1] : "");
      }
      return next;
    });
  }, [activeFileId]);

  const updateFileContentLocal = useCallback((id: string, newContent: string | undefined) => {
    if (newContent === undefined || isReadOnlyMode) return;
    setFileContents(prev => ({ ...prev, [id]: newContent }));
  }, [isReadOnlyMode]);

  const updateFileNoteLocal = useCallback((id: string, newNote: string) => {
    if (isReadOnlyMode) return;
    setFileNotes(prev => ({ ...prev, [id]: newNote }));
  }, [isReadOnlyMode]);

  const saveFile = useCallback(async (id: string, content: string, note?: string) => {
    if (isReadOnlyMode) return;
    try {
      await fetch('/api/fs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'content', path: id, content })
      });
      if (note !== undefined) {
        await fetch('/api/fs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'note', path: id, content: note })
        });
      }
    } catch {
      console.error('Failed to save file');
    }
  }, [isReadOnlyMode]);

  const setNodeStatus = useCallback(async (id: string, status: string) => {
    if (isReadOnlyMode) return;
    try {
      await fetch('/api/fs/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: id, status })
      });
      setFiles(prev => {
        const updateNodes = (nodes: FileNode[]): FileNode[] => nodes.map(n => {
          if (n.id === id) return { ...n, status };
          if (n.children) return { ...n, children: updateNodes(n.children) };
          return n;
        });
        return updateNodes(prev);
      });
    } catch {
      console.error('Failed to set status');
    }
  }, [isReadOnlyMode]);

  const deleteNode = useCallback(async (id: string) => {
    if (id === "root" || isReadOnlyMode) return;
    try {
      await fetch(`/api/fs?path=${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshFiles();
      setOpenFileIds(prev => {
        const next = prev.filter(fId => !fId.startsWith(id));
        if (activeFileId.startsWith(id)) setActiveFileId(next.length > 0 ? next[next.length - 1] : "");
        return next;
      });
    } catch {
      console.error("Delete failed");
    }
  }, [isReadOnlyMode, refreshFiles, activeFileId]);

  const duplicateNode = useCallback(async (id: string) => {
    const node = findNodeById(files, id);
    if (!node || id === "root" || isReadOnlyMode) return;
    try {
      if (node.type === "file") {
        let contentToCopy = fileContentsRef.current[id];
        if (contentToCopy === undefined) {
          const res = await fetch(`/api/fs/content?path=${encodeURIComponent(id)}`);
          if (res.ok) contentToCopy = (await res.json()).content;
        }
        const basePath = id.substring(0, id.lastIndexOf('/'));
        const newName = node.name.replace('.json', '') + '_copy.json';
        const newPath = basePath ? `${basePath}/${newName}` : newName;
        await fetch('/api/fs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: newPath, type: 'file', content: contentToCopy })
        });
        await refreshFiles();
      }
    } catch {
      console.error("Duplicate failed");
    }
  }, [files, isReadOnlyMode, refreshFiles]);

  const moveNode = useCallback(async (sourceId: string, targetParentId: string) => {
    if (isReadOnlyMode || sourceId === "root") return;
    
    // Prevent moving a node into itself or its own children
    if (targetParentId === sourceId || targetParentId.startsWith(`${sourceId}/`)) return;

    const sourceNode = findNodeById(files, sourceId);
    if (!sourceNode) return;

    const newPath = targetParentId ? `${targetParentId}/${sourceNode.name}` : sourceNode.name;
    
    // If target is the same as current path, do nothing
    if (newPath === sourceId) return;

    try {
      const res = await fetch('/api/fs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', oldPath: sourceId, newPath })
      });
      
      if (res.ok) {
        // If it's a file and it's open, we should update the open tabs
        if (sourceNode.type === 'file') {
          setOpenFileIds(prev => prev.map(id => id === sourceId ? newPath : id));
          if (activeFileId === sourceId) setActiveFileId(newPath);
          
          // Update contents cache
          setFileContents(prev => {
            const next = { ...prev };
            if (next[sourceId]) {
              next[newPath] = next[sourceId];
              delete next[sourceId];
            }
            return next;
          });

          // Update notes cache
          setFileNotes(prev => {
            const next = { ...prev };
            if (next[sourceId]) {
              next[newPath] = next[sourceId];
              delete next[sourceId];
            }
            return next;
          });
        }
        
        await refreshFiles();
      }
    } catch {
      console.error("Move failed");
    }
  }, [isReadOnlyMode, files, refreshFiles, activeFileId, setActiveFileId]);

  const toggleFolder = useCallback((id: string) => {
    setFiles(prev => {
      const updateNodes = (nodes: FileNode[]): FileNode[] => nodes.map((node) => {
        if (node.id === id) return { ...node, isOpen: !node.isOpen };
        if (node.children) return { ...node, children: updateNodes(node.children) };
        return node;
      });
      return updateNodes(prev);
    });
  }, []);

  const savePreset = useCallback(async (nodeId: string, value: string) => {
    if (isReadOnlyMode) return;
    try {
      await fetch('/api/fs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preset', path: nodeId, content: value })
      });
      await refreshFiles();
    } catch {
      console.error('Failed to save preset');
    }
  }, [isReadOnlyMode, refreshFiles]);

  return {
    files, setFiles,
    workspaceStats,
    fileContents, setFileContents,
    fileNotes, setFileNotes,
    openFileIds, setOpenFileIds,
    activeFileId, setActiveFileId,
    isReadOnlyMode,
    refreshFiles,
    handleFileSelect,
    closeTab,
    updateFileContentLocal,
    updateFileNoteLocal,
    saveFile,
    setNodeStatus,
    deleteNode,
    duplicateNode,
    moveNode,
    fetchContent,
    toggleFolder,
    savePreset
  };
}
