"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef, memo } from "react";
import {
  Files,
  Search,
  Settings,
  ChevronRight,
  FileJson,
  FolderPlus,
  FilePlus,
  X,
  Edit2,
  Trash2,
  Copy,
  Save,
  HelpCircle,
  Command,
  Share2,
  Lock,
  Check,
  Columns2,
  AlertTriangle,
  CheckCircle,
  Tag,
  Radio,
  FileText,
  Info,
} from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import dynamic from "next/dynamic";
import { loader } from "@monaco-editor/react";
import { format, applyEdits, parseTree, findNodeAtLocation, parse, getLocation } from "jsonc-parser";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { FileTreeItem } from "@/components/layout/FileTreeItem";
import { CommandPalette } from "@/components/CommandPalette";
import { SnippetPalette } from "@/components/dialogs/SnippetPalette";
import { ShareLiveDialog } from "@/components/collab/ShareLiveDialog";
import { JoinCollabDialog } from "@/components/collab/JoinCollabDialog";
import { useCollab } from "@/hooks/useCollab";
import { useFileSystem } from "@/hooks/useFileSystem";
import { SearchPanel } from "@/components/SearchPanel";
import { flattenJson, unflattenJson } from "@/lib/json-utils";
import { EditorActionsMenu } from "@/components/editor/EditorActionsMenu";
import { ShareFolderDialog } from "@/components/dialogs/ShareFolderDialog";
import { HistoryDialog } from "@/components/dialogs/HistoryDialog";
import { SettingsDialog } from "@/components/dialogs/SettingsDialog";
import { FileNode, InputState, DiffResult, AppSettings } from "@/types";
import { findNodeById, getPathToNode, sortNodes } from "@/lib/tree-utils";
import LZString from "lz-string";

// Configure Monaco loader
loader.config({ paths: { vs: "https://unpkg.com/monaco-editor@0.52.2/min/vs" } });

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#1e1e1e] animate-pulse" />
});

// Sub-components
const ContextMenuItem = memo(({ icon, label, onClick, danger }: { icon: React.ReactNode, label: string, onClick: () => void, danger?: boolean }) => (
  <div onClick={onClick} className={cn("flex items-center gap-2 px-3 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer transition-colors", danger && "hover:bg-red-900")}>
    {icon}<span>{label}</span>
  </div>
));
ContextMenuItem.displayName = "ContextMenuItem";

const ShortcutRow = memo(({ label, keys }: { label: string, keys: string[] }) => (
  <div className="flex items-center justify-between text-[13px] font-mono">
    <span className="text-[#cccccc] opacity-80">{label}</span>
    <div className="flex gap-1.5 items-center">
      {keys.map((key, i) => (
        <React.Fragment key={i}>
          <kbd className="min-w-[28px] h-6 px-1.5 flex items-center justify-center bg-[#3c3c3c] border border-[#454545] border-b-2 rounded-md text-[11px] font-bold text-white uppercase">{key === "Cmd" ? "⌘" : key}</kbd>
          {i < keys.length - 1 && <span className="opacity-30 text-[10px]">+</span>}
        </React.Fragment>
      ))}
    </div>
  </div>
));
ShortcutRow.displayName = "ShortcutRow";

// Helpers
function getLineNumber(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function Workspace() {
  const {
    files,
    workspaceStats,
    fileContents,
    fileNotes,
    openFileIds,
    activeFileId,
    isReadOnlyMode,
    handleFileSelect,
    closeTab,
    updateFileContentLocal,
    updateFileNoteLocal,
    saveFile,
    setNodeStatus,
    deleteNode,
    duplicateNode,
    moveNode,
    refreshFiles,
    toggleFolder,
  } = useFileSystem();

  const collabRoomId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("collab")
    : null;

  const [collabSession, setCollabSession] = useState<any | null>(null);
  const [showJoinDialog, setShowJoinDialog] = useState(() => !!collabRoomId && !collabSession);
  const [isShareLiveVisible, setIsShareLiveVisible] = useState(false);
  const [shareLiveFolderId, setShareLiveFolderId] = useState("");
  const [shareLiveFolderName, setShareLiveFolderName] = useState("");
  
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, nodeId: "", visible: false });
  const [inputState, setInputState] = useState<InputState | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isShortcutsVisible, setIsShortcutsVisible] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window === "undefined") return { fontSize: 14, tabSize: 2, autoSave: false, formatOnSave: true, minimap: false, lineNumbers: "on" };
    const saved = localStorage.getItem("jjbook-settings");
    if (saved) {
      try { return { ...{ fontSize: 14, tabSize: 2, autoSave: false, formatOnSave: true, minimap: false, lineNumbers: "on" }, ...JSON.parse(saved) }; } catch { /* ignore */ }
    }
    return { fontSize: 14, tabSize: 2, autoSave: false, formatOnSave: true, minimap: false, lineNumbers: "on" };
  });
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  useEffect(() => {
    localStorage.setItem("jjbook-settings", JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const [shareUrl, setShareUrl] = useState("");
  const [isShareVisible, setIsShareVisible] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [historySnapshots, setHistorySnapshots] = useState<{ content: string; ts: number }[]>([]);

  const [isCompareVisible, setIsCompareVisible] = useState(false);
  const [compareContent, setCompareContent] = useState("");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSnippetPaletteOpen, setIsSnippetPaletteOpen] = useState(false);
  const [snippetInsertCallback, setSnippetInsertCallback] = useState<((content: string) => void) | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: "", name: "" });

  const [activePanel, setActivePanel] = useState<'explorer' | 'search'>('explorer');
  const [jsonPath, setJsonPath] = useState('');
  const [isFlatView, setIsFlatView] = useState(false);
  const [isNotesVisible, setIsNotesVisible] = useState(false);

  // Sidebar Resizing
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizingRef = useRef(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compareEditorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const compareDecorationsRef = useRef<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cursorWidgetsRef = useRef<any[]>([]);
  const activeFileIdRef = useRef("");

  useEffect(() => { activeFileIdRef.current = activeFileId; }, [activeFileId]);

  const updateJsonPath = useCallback((content: string, lineNumber: number, column: number) => {
    try {
      const lines = content.split('\n');
      let offset = 0;
      for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) offset += lines[i].length + 1;
      offset += column - 1;
      const location = getLocation(content, offset);
      const path = location.path.map((p, i) => typeof p === 'number' ? `[${p}]` : (i === 0 ? p : `.${p}`)).join('');
      setJsonPath(path || '');
    } catch { setJsonPath(''); }
  }, []);

  const handleRemoteContentChange = useCallback((fileId: string, content: string) => {
    updateFileContentLocal(fileId, content);
    if (fileId === activeFileIdRef.current && editorRef.current) {
      if (editorRef.current.getValue() !== content) {
        const pos = editorRef.current.getPosition();
        editorRef.current.setValue(content);
        if (pos) editorRef.current.setPosition(pos);
      }
    }
  }, [updateFileContentLocal]);

  const handleRemoteNoteChange = useCallback((fileId: string, content: string) => {
    updateFileNoteLocal(fileId, content);
  }, [updateFileNoteLocal]);

  const collab = useCollab({
    session: collabSession,
    onContentChange: handleRemoteContentChange,
    onNoteChange: handleRemoteNoteChange,
  });

  const pushFileContentsRef = useRef(collab.pushFileContents);
  useEffect(() => { pushFileContentsRef.current = collab.pushFileContents; }, [collab.pushFileContents]);

  const fileContentsRef = useRef(fileContents);
  useEffect(() => { fileContentsRef.current = fileContents; }, [fileContents]);
  const fileNotesRef = useRef(fileNotes);
  useEffect(() => { fileNotesRef.current = fileNotes; }, [fileNotes]);

  useEffect(() => {
    if (!collabSession || !collab.isSubscribed) return;
    const t = setTimeout(() => {
      pushFileContentsRef.current(fileContentsRef.current, fileNotesRef.current);
    }, 500);
    return () => clearTimeout(t);
  }, [collabSession, collab.isSubscribed]);

  const activeFileNode = useMemo(() => findNodeById(files, activeFileId), [files, activeFileId]);
  const breadcrumbs = useMemo(() => getPathToNode(files, activeFileId), [files, activeFileId]);
  const openFiles = useMemo(() => 
    openFileIds.map(id => findNodeById(files, id)).filter((f): f is FileNode => f !== null),
    [files, openFileIds]
  );
  
  const activeContent = fileContents[activeFileId] || "";
  const activeNote = fileNotes[activeFileId] || "";

  // Derive diffResults from inputs
  const diffResults = useMemo<DiffResult[]>(() => {
    if (!isCompareVisible || !activeContent) return [];
    
    const results: DiffResult[] = [];
    try {
      const text1 = activeContent;
      const text2 = compareContent;
      const obj1 = parse(text1);
      const obj2 = parse(text2);
      const ast1 = parseTree(text1);
      const ast2 = parseTree(text2);

      const compare = (a: unknown, b: unknown, path: string[] = []) => {
        if (!a || !b || typeof a !== "object" || typeof b !== "object") return;
        const recA = a as Record<string, unknown>;
        const recB = b as Record<string, unknown>;
        const keys1 = Object.keys(recA);
        const keys2 = Object.keys(recB);
        const allKeys = Array.from(new Set([...keys1, ...keys2]));

        allKeys.forEach(key => {
          const currentPath = [...path, key];
          const currentPathStr = currentPath.join('.');
          const val1 = recA[key];
          const val2 = recB[key];
          const node1 = ast1 ? findNodeAtLocation(ast1, currentPath) : undefined;
          const node2 = ast2 ? findNodeAtLocation(ast2, currentPath) : undefined;
          const lineLeft = node1 ? getLineNumber(text1, node1.offset) : undefined;
          const lineRight = node2 ? getLineNumber(text2, node2.offset) : undefined;

          if (!(key in recA)) {
            results.push({ path: currentPathStr, type: "missing", message: "Missing in active file", lineRight });
          } else if (!(key in recB)) {
            results.push({ path: currentPathStr, type: "missing", message: "Missing in comparison input", lineLeft });
          } else if (typeof val1 !== typeof val2) {
            results.push({ path: currentPathStr, type: "type_mismatch", message: `Type mismatch: expected ${typeof val1}, got ${typeof val2}`, lineLeft, lineRight });
          } else if (typeof val1 === "object" && val1 !== null && val2 !== null) {
            compare(val1, val2, currentPath);
          } else if (val1 !== val2) {
            results.push({ path: currentPathStr, type: "value_mismatch", message: `Value mismatch: ${String(val1)} vs ${String(val2)}`, lineLeft, lineRight });
          }
        });
      };
      compare(obj1, obj2);
    } catch { /* ignore */ }
    return results;
  }, [isCompareVisible, activeContent, compareContent]);

  // Apply highlight decorations
  useEffect(() => {
    if (!monacoRef.current) return;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leftDecorations: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rightDecorations: any[] = [];

    diffResults.forEach(res => {
      const isError = res.type === "type_mismatch" || res.type === "value_mismatch";
      const className = isError ? "bg-red-500/20" : "bg-yellow-500/20";
      const marginClassName = isError ? "border-l-4 border-red-500" : "border-l-4 border-yellow-500";
      if (res.lineLeft) {
        leftDecorations.push({
          range: new monacoRef.current.Range(res.lineLeft, 1, res.lineLeft, 1),
          options: { isWholeLine: true, className, linesDecorationsClassName: marginClassName }
        });
      }
      if (res.lineRight) {
        rightDecorations.push({
          range: new monacoRef.current.Range(res.lineRight, 1, res.lineRight, 1),
          options: { isWholeLine: true, className, linesDecorationsClassName: marginClassName }
        });
      }
    });

    if (editorRef.current) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, leftDecorations);
    }
    if (compareEditorRef.current) {
      compareDecorationsRef.current = compareEditorRef.current.deltaDecorations(compareDecorationsRef.current, rightDecorations);
    }
  }, [diffResults, activeFileId]);

  // Remote cursor widgets
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    
    // Clear existing widgets
    cursorWidgetsRef.current.forEach(w => { 
      try { editor.removeContentWidget(w); } catch { /* ignore */ } 
    });
    cursorWidgetsRef.current = [];

    if (collab.cursors.size > 0) {
      console.log(`[Collab] Rendering ${collab.cursors.size} cursors`);
    }

    for (const [clientId, cursor] of collab.cursors) {
      if (cursor.fileId !== activeFileId) continue;
      
      const { name, color, lineNumber, column } = cursor;
      const domNode = document.createElement('div');
      domNode.className = 'remote-cursor-widget';
      domNode.style.pointerEvents = 'none';
      domNode.style.zIndex = '100';
      
      domNode.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:flex-start;pointer-events:none;">
          <span style="position:absolute;bottom:100%;left:0;background:${color};color:#fff;font-size:10px;font-family:'JetBrains Mono',monospace;padding:2px 6px;border-radius:4px 4px 4px 0;white-space:nowrap;line-height:1.2;z-index:101;box-shadow:0 2px 4px rgba(0,0,0,0.3);font-weight:bold;">${name}</span>
          <div style="width:2px;height:20px;background:${color};box-shadow:0 0 2px rgba(0,0,0,0.5);"></div>
        </div>`;

      const widget = {
        getId: () => `rc-${clientId}`,
        getDomNode: () => domNode,
        getPosition: () => ({ 
          position: { lineNumber, column }, 
          preference: [monacoRef.current.editor.ContentWidgetPositionPreference.EXACT] 
        }),
      };

      try {
        editor.addContentWidget(widget);
        cursorWidgetsRef.current.push(widget);
      } catch (err) {
        console.error('[Collab] Failed to add cursor widget:', err);
      }
    }

    return () => {
      // Cleanup on unmount or dependency change
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const currentEditor = editorRef.current;
      if (currentEditor) {
        cursorWidgetsRef.current.forEach(w => {
          try { currentEditor.removeContentWidget(w); } catch { /* ignore */ }
        });
      }
    };
  }, [collab.cursors, activeFileId]);

  const handleSave = useCallback(async () => {
    // Use refs to get latest values and avoid stale closures
    const currentFileId = activeFileIdRef.current;
    if (isReadOnlyMode || !currentFileId || !editorRef.current) return;
    
    const contentToSaveRaw = editorRef.current.getValue();
    const noteToSave = fileNotesRef.current[currentFileId] || "";

    setIsSaving(true);
    let contentToSave = contentToSaveRaw;
    try { 
      // Only minify if it's valid JSON, otherwise save as is
      const parsed = JSON.parse(contentToSaveRaw);
      contentToSave = JSON.stringify(parsed); 
    } catch { /* ignore and save raw */ }

    console.log(`[Workspace] Saving file: ${currentFileId}`, { contentLength: contentToSave.length });
    
    await saveFile(currentFileId, contentToSave, noteToSave);
    
    try {
      const key = `history:${activeFileId}`;
      const existing: { content: string; ts: number }[] = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift({ content: activeContent, ts: Date.now() });
      if (existing.length > 20) existing.pop();
      localStorage.setItem(key, JSON.stringify(existing));
    } catch { /* ignore */ }
    setTimeout(() => setIsSaving(false), 1500);
  }, [isReadOnlyMode, saveFile]);

  useEffect(() => {
    if (!settings.autoSave || !activeFileId || activeFileNode?.isReadonly || isReadOnlyMode) return;
    const t = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => clearTimeout(t);
  }, [activeContent, activeNote, settings.autoSave, activeFileId, activeFileNode, isReadOnlyMode, handleSave]);

  const toggleShortcuts = useCallback(() => setIsShortcutsVisible(prev => !prev), []);

  const handleRenameTrigger = useCallback((id: string) => {
    const node = findNodeById(files, id);
    if (node && !node.isReadonly) {
      setInputState({ nodeId: node.id, parentId: "", mode: "rename", type: node.type, initialValue: node.name });
      setInputValue(node.name);
    }
  }, [files]);

  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); setIsCommandPaletteOpen(true); }
      if (e.altKey && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        const firstFolder = files.find(n => n.type === "folder");
        if (firstFolder) { setInputState({ parentId: firstFolder.id, type: "file", mode: "create" }); setInputValue(""); }
      }
      if (e.altKey && e.shiftKey && e.key === 'N') { e.preventDefault(); setInputState({ parentId: "", type: "folder", mode: "create" }); setInputValue(""); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [files]);

  const openHistory = useCallback(() => {
    if (!activeFileId) return;
    try {
      const snapshots = JSON.parse(localStorage.getItem(`history:${activeFileId}`) || '[]');
      setHistorySnapshots(snapshots);
      setIsHistoryVisible(true);
    } catch { /* ignore */ }
  }, [activeFileId]);

  const shareFolder = useCallback((id: string) => {
    const node = findNodeById(files, id);
    if (!node || node.type !== "folder") return;
    const populateContent = (n: FileNode): FileNode => {
      const copy = { ...n };
      if (copy.type === 'file' && fileContentsRef.current[copy.id]) copy.content = fileContentsRef.current[copy.id];
      if (copy.children) copy.children = copy.children.map(populateContent);
      return copy;
    };
    const populatedNode = populateContent(node);
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(populatedNode));
    setShareUrl(`${window.location.origin}${window.location.pathname}?share=${encoded}`);
    setIsShareVisible(true);
  }, [files]);

  const handleSaveSnippet = useCallback(async (content: string) => {
    if (!content.trim()) return;
    const name = window.prompt("Enter a name for this snippet:");
    if (!name) return;
    try {
      await fetch('/api/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content })
      });
      alert(`Snippet '${name}' saved!`);
    } catch { alert("Failed to save snippet."); }
  }, []);

  const expandToNode = useCallback((targetId: string) => {
    const ancestorIds = new Set<string>();
    const findAncestors = (nodes: FileNode[], id: string, path: string[]): boolean => {
      for (const node of nodes) {
        if (node.id === id) { path.forEach(a => ancestorIds.add(a)); return true; }
        if (node.children && findAncestors(node.children, id, [...path, node.id])) return true;
      }
      return false;
    };
    findAncestors(files, targetId, []);
    if (ancestorIds.size === 0) return;
    
    // Expand folders along the path
    ancestorIds.forEach(id => {
      const node = findNodeById(files, id);
      if (node && node.type === 'folder' && !node.isOpen) {
        toggleFolder(id);
      }
    });
  }, [files, toggleFolder]);

  const onFileSelectEnhanced = useCallback((id: string) => {
    expandToNode(id);
    handleFileSelect(id);
  }, [expandToNode, handleFileSelect]);

  const formatJson = useCallback(() => {
    if (!activeContent || activeFileNode?.isReadonly) return;
    try {
      const cleanContent = activeContent.replace(/,(\s*[\]}])/g, '$1');
      const edits = format(cleanContent, undefined, { tabSize: 2, insertSpaces: true, eol: "\n" });
      const formatted = applyEdits(cleanContent, edits);
      updateFileContentLocal(activeFileId, formatted);
    } catch { alert("Error formatting JSON"); }
  }, [activeContent, activeFileNode, activeFileId, updateFileContentLocal]);

  const toggleFlatView = useCallback(() => {
    if (!activeContent || activeFileNode?.isReadonly) return;
    try {
      if (isFlatView) {
        const nested = unflattenJson(JSON.parse(activeContent));
        updateFileContentLocal(activeFileId, JSON.stringify(nested, null, 2));
      } else {
        const flat = flattenJson(JSON.parse(activeContent));
        updateFileContentLocal(activeFileId, JSON.stringify(flat, null, 2));
      }
      setIsFlatView(prev => !prev);
    } catch { /* ignore */ }
  }, [activeContent, activeFileNode, isFlatView, activeFileId, updateFileContentLocal]);

  const handleSearchSelect = useCallback((fileId: string, line: number) => {
    onFileSelectEnhanced(fileId);
    setActivePanel('explorer');
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.revealLineInCenter(line);
        editorRef.current.setPosition({ lineNumber: line, column: 1 });
        editorRef.current.focus();
      }
    }, 300);
  }, [onFileSelectEnhanced]);

  const handleInputSubmit = useCallback(async () => {
    if (!inputState || !inputValue.trim()) { setInputState(null); return; }
    try {
      if (inputState.mode === "create") {
        if (inputState.type === "file" && !inputState.parentId) { setInputState(null); setInputValue(""); return; }
        const parent = findNodeById(files, inputState.parentId);
        const name = inputState.type === "file" && !inputValue.toLowerCase().endsWith(".json") ? `${inputValue}.json` : inputValue;
        const newPath = inputState.parentId ? `${inputState.parentId}/${name}` : name;
        await fetch('/api/fs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: newPath, type: inputState.type, content: inputState.type === "file" ? (parent?.preset || "{\n  \n}") : undefined })
        });
        await refreshFiles();
        if (inputState.type === "file") onFileSelectEnhanced(newPath);
      } else if (inputState.mode === "rename" && inputState.nodeId) {
        const node = findNodeById(files, inputState.nodeId);
        if (node) {
          const basePath = inputState.nodeId.substring(0, inputState.nodeId.lastIndexOf('/'));
          const newPath = basePath ? `${basePath}/${inputValue}` : inputValue;
          await fetch('/api/fs', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'rename', oldPath: inputState.nodeId, newPath })
          });
          if (openFileIds.includes(inputState.nodeId)) closeTab(inputState.nodeId);
          await refreshFiles();
        }
      }
    } catch { console.error("Operation failed"); }
    setInputState(null);
    setInputValue("");
  }, [inputState, inputValue, files, openFileIds, closeTab, onFileSelectEnhanced, refreshFiles]);

  // Resize Handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const handleResize = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = e.clientX - 48;
      if (newWidth > 150 && newWidth < 600) setSidebarWidth(newWidth);
    };
    const handleResizeEnd = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
  }, []);

  const [isRootDragOver, setIsDragOverRoot] = useState(false);

  return (
    <div className="flex h-screen w-full bg-[#1e1e1e] text-[#cccccc] font-mono selection:bg-[#264f78] overflow-hidden">
      {/* Activity Bar */}
      <aside className="w-12 flex flex-col items-center py-4 gap-4 bg-[#333333] border-r border-[#2b2b2b] shrink-0">
        <div className={cn("p-2 cursor-pointer transition-colors", activePanel === 'explorer' ? "text-white" : "opacity-60 hover:opacity-100")} onClick={() => setActivePanel('explorer')} title="Explorer"><Files size={24} /></div>
        <div className={cn("p-2 cursor-pointer transition-colors", activePanel === 'search' ? "text-white" : "opacity-60 hover:opacity-100")} onClick={() => setActivePanel(p => p === 'search' ? 'explorer' : 'search')} title="Search"><Search size={24} /></div>
        <div className="mt-auto flex flex-col items-center gap-2">
          {isReadOnlyMode && <div className="p-2 text-yellow-500" title="ReadOnly Mode"><Lock size={20} /></div>}
          <div className="p-2 opacity-60 hover:opacity-100 cursor-pointer transition-colors" title="Shortcuts Help (Cmd+/)" onClick={toggleShortcuts}><HelpCircle size={24} /></div>
          <div className="p-2 opacity-60 hover:opacity-100 cursor-pointer transition-colors" onClick={() => setIsSettingsVisible(true)}><Settings size={24} /></div>
        </div>
      </aside>

      {/* Sidebar */}
      <aside 
        style={{ width: sidebarWidth }}
        className="flex flex-col bg-[#252526] border-r border-[#2b2b2b] shrink-0 relative select-none"
      >
        <div 
          className={cn(
            "px-4 py-3 flex items-center justify-between text-[11px] font-bold tracking-wider uppercase opacity-80 group font-mono shrink-0 transition-colors",
            isRootDragOver && "bg-[#094771] text-white opacity-100"
          )}
          onDragOver={(e) => {
            if (isReadOnlyMode) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setIsDragOverRoot(true);
          }}
          onDragLeave={() => setIsDragOverRoot(false)}
          onDrop={(e) => {
            if (isReadOnlyMode) return;
            setIsDragOverRoot(false);
            e.preventDefault();
            const sourceId = e.dataTransfer.getData("application/json-tree-node");
            if (sourceId && moveNode) {
              moveNode(sourceId, "");
            }
          }}
        >
          <span>{activePanel === 'search' ? 'Search' : 'Explorer'}</span>
          {activePanel === 'explorer' && !isReadOnlyMode && (
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setInputState({ parentId: "", type: "folder", mode: "create" }); setInputValue(""); }} title="New Folder"><FolderPlus size={14} className="hover:text-white" /></button>
            </div>
          )}
        </div>

        {collabSession && (
          <div className="px-4 py-2 border-b border-[#2b2b2b] space-y-1.5 shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-green-400 opacity-80">
              <Radio size={10} className="animate-pulse" />
              <span>Live — {collabSession.name}</span>
            </div>
            {collab.clients.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {collab.clients.map(c => (
                  <div key={c.clientId} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono" style={{ background: c.color + '22', border: `1px solid ${c.color}44`, color: c.color }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {activePanel === 'search' ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <SearchPanel onSelectFile={handleSearchSelect} />
          </div>
        ) : (
          <div 
            className={cn("flex-1 overflow-y-auto min-h-0 transition-colors", isRootDragOver && "bg-[#094771]/30")}
            onDragOver={(e) => {
              if (isReadOnlyMode) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setIsDragOverRoot(true);
            }}
            onDragLeave={() => setIsDragOverRoot(false)}
            onDrop={(e) => {
              if (isReadOnlyMode) return;
              setIsDragOverRoot(false);
              e.preventDefault();
              const sourceId = e.dataTransfer.getData("application/json-tree-node");
              if (sourceId && moveNode) {
                // Moving to root
                moveNode(sourceId, "");
              }
            }}
          >
            {sortNodes(files).map((node) => (
              <FileTreeItem
                key={node.id}
                node={node}
                depth={0}
                onToggle={toggleFolder}
                onAdd={(parentId, type) => { setInputState({ parentId, type, mode: "create" }); setInputValue(""); }}
                activeId={activeFileId}
                onSelect={onFileSelectEnhanced}
                onContextMenu={(e, id) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, nodeId: id, visible: true });
                }}
                inputState={inputState}
                inputValue={inputValue}
                setInputValue={setInputValue}
                onInputSubmit={handleInputSubmit}
                isReadOnlyMode={isReadOnlyMode}
                onMove={moveNode}
              />
            ))}
            {inputState?.mode === "create" && inputState.parentId === "" && (
              <div className="flex items-center py-0.5 px-3 font-mono">
                {inputState.type === "folder" ? <FolderPlus size={16} className="mr-2 text-blue-400" /> : <FilePlus size={16} className="mr-2 text-yellow-500" />}
                <input
                  autoFocus
                  placeholder={inputState.type === "folder" ? "folder name" : "file.json"}
                  className="flex-1 bg-[#3c3c3c] border border-[#007acc] outline-none px-1 text-[13px] text-white font-mono"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onBlur={handleInputSubmit}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") handleInputSubmit(); }}
                />
              </div>
            )}
          </div>
        )}

        {/* Sidebar Footer Stats */}
        <div className="p-3 border-t border-[#2b2b2b] bg-[#1e1e1e] flex flex-col gap-1.5 shrink-0 opacity-50 hover:opacity-100 transition-opacity">
           <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-1.5"><Info size={10} /><span>Workspace</span></div>
              <span className="text-blue-400">{workspaceStats.totalFiles} files</span>
           </div>
           <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="opacity-60">Total Size</span>
              <span>{formatBytes(workspaceStats.totalSize)}</span>
           </div>
        </div>

        {/* Resize Handle */}
        <div onMouseDown={handleResizeStart} className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#007acc]/50 transition-colors z-10" />
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
        {/* Tabs */}
        <div className="h-9 flex items-center bg-[#252526] overflow-x-auto scrollbar-hide shrink-0">
          {openFiles.map((file) => (
            <div 
              key={file.id}
              onClick={() => onFileSelectEnhanced(file.id)}
              className={cn(
                "flex h-full items-center px-3 border-r border-[#1e1e1e] text-[13px] cursor-pointer group transition-colors min-w-[120px] max-w-[200px]",
                activeFileId === file.id ? "bg-[#1e1e1e] text-white border-t border-t-[#007acc]" : "bg-[#2d2d2d] opacity-60 hover:opacity-100"
              )}
            >
              <FileJson size={14} className={cn("mr-2 shrink-0", file.isReadonly ? "text-blue-300" : "text-yellow-500")} />
              <span className="truncate flex-1">{file.name}</span>
              <button onClick={(e) => { e.stopPropagation(); closeTab(file.id); }} className="ml-2 p-0.5 hover:bg-[#454545] rounded opacity-0 group-hover:opacity-100"><X size={12} /></button>
            </div>
          ))}
        </div>

        {/* Breadcrumbs */}
        {activeFileNode && breadcrumbs && (
          <div className="h-8 flex items-center px-4 bg-[#1e1e1e] text-[12px] opacity-60 gap-1 shrink-0 border-b border-[#2b2b2b] overflow-x-auto scrollbar-hide">
            {breadcrumbs.map((part, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRight size={12} className="mx-0.5 shrink-0" />}
                <span 
                  onClick={() => {
                    const pathParts = breadcrumbs.slice(breadcrumbs.indexOf(activeFileNode.name) + 1, index + 1);
                    if (pathParts.length === 0 || !editorRef.current) return;
                    const model = editorRef.current.getModel();
                    const ast = parseTree(model.getValue());
                    if (!ast) return;
                    const node = findNodeAtLocation(ast, pathParts.map(p => p.startsWith('[') ? parseInt(p.slice(1, -1)) : p));
                    if (node) {
                      const pos = model.getPositionAt(node.offset);
                      editorRef.current.revealPositionInCenter(pos);
                      editorRef.current.setPosition(pos);
                      editorRef.current.focus();
                    }
                  }}
                  className={cn("whitespace-nowrap hover:text-white hover:opacity-100 cursor-pointer transition-all", index === breadcrumbs.length - 1 && "text-[#cccccc] opacity-100 font-bold")}
                >{part}</span>
              </React.Fragment>
            ))}
            {activeFileNode.isReadonly && <Lock size={12} className="ml-2 text-yellow-500" />}
          </div>
        )}

        {/* Editor Area */}
        {activeFileNode ? (
          <div className="flex-1 flex flex-col overflow-hidden relative group/editor">
            {!activeFileNode.isReadonly && (
              <div className="absolute top-4 right-8 flex items-center gap-3 opacity-0 group-hover/editor:opacity-100 transition-opacity z-50">
                <button onClick={() => setIsNotesVisible(!isNotesVisible)} className={cn("flex items-center justify-center w-9 h-9 bg-[#333333] border border-[#454545] hover:bg-[#444444] text-[#cccccc] hover:text-white rounded-sm transition-all shadow-xl", isNotesVisible && "bg-[#444444] border-[#007acc] text-white")} title="File Notes"><FileText size={18} /></button>
                <EditorActionsMenu
                  onInsertSnippet={() => {
                    setSnippetInsertCallback(() => (content: string) => {
                      if (editorRef.current) {
                        const selections = editorRef.current.getSelections();
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const edits = selections.map((sel: any) => ({ range: sel, text: content }));
                        editorRef.current.executeEdits("snippet-insert", edits);
                        editorRef.current.focus();
                      }
                    });
                    setIsSnippetPaletteOpen(true);
                  }}
                  onSaveSnippet={() => handleSaveSnippet(activeContent)}
                  onToggleCompare={() => setIsCompareVisible(!isCompareVisible)}
                  isCompareVisible={isCompareVisible}
                  onToggleFlatView={toggleFlatView}
                  isFlatView={isFlatView}
                  onOpenHistory={openHistory}
                  onFormatJson={formatJson}
                />
              </div>
            )}

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 overflow-hidden relative">
                <MonacoEditor
                  height="100%"
                  language="json"
                  theme="vs-dark"
                  value={activeContent}
                  onChange={(v) => {
                    updateFileContentLocal(activeFileId, v || "");
                    if (collabSession && collab.sendContentChange) collab.sendContentChange(activeFileId, v || "");
                  }}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor;
                    monacoRef.current = monaco;
                    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({ validate: true, allowComments: true, schemas: [], enableSchemaRequest: true });
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handleSave());
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyR, () => handleRenameTrigger(activeFileIdRef.current));
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => formatJson());
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => toggleShortcuts());
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    editor.onDidChangeCursorPosition((e: any) => {
                      if (collabSession && collab.sendCursorMove) collab.sendCursorMove(activeFileIdRef.current, e.position.lineNumber, e.position.column);
                      updateJsonPath(editor.getValue(), e.position.lineNumber, e.position.column);
                    });
                  }}
                  options={{ fontSize: settings.fontSize, tabSize: settings.tabSize, fontFamily: '"JetBrains Mono", monospace', minimap: { enabled: settings.minimap }, scrollBeyondLastLine: false, automaticLayout: true, padding: { top: 16 }, lineNumbers: settings.lineNumbers, renderLineHighlight: "all", readOnly: activeFileNode.isReadonly, stickyScroll: { enabled: false } }}
                />
              </div>

              {/* Notes Panel */}
              {isNotesVisible && (
                <div className="w-[350px] border-l border-[#2b2b2b] bg-[#252526] flex flex-col shrink-0 animate-in slide-in-from-right duration-300">
                  <div className="h-9 flex items-center justify-between px-4 bg-[#1e1e1e] border-b border-[#2b2b2b]">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-60"><FileText size={14} className="text-blue-400" /><span>File Notes</span></div>
                    <button onClick={() => setIsNotesVisible(false)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
                  </div>
                  <div className="flex-1 p-4 flex flex-col gap-4">
                    <textarea 
                      className="flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-3 text-[13px] text-[#cccccc] font-mono outline-none focus:border-[#007acc] resize-none scrollbar-thin" 
                      placeholder="Team notes... (Syncs in real-time)" 
                      value={activeNote} 
                      onChange={(e) => {
                        updateFileNoteLocal(activeFileId, e.target.value);
                        if (collabSession && collab.sendNoteChange) collab.sendNoteChange(activeFileId, e.target.value);
                      }} 
                      onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); } }} 
                    />
                    <div className="text-[10px] opacity-40 italic">Notes are shared with your team and saved when you press Cmd+S.</div>
                  </div>
                </div>
              )}

              {/* Comparison Panel */}
              {isCompareVisible && (
                <div className="w-[450px] border-l border-[#2b2b2b] bg-[#1e1e1e] flex flex-col shrink-0 animate-in slide-in-from-right duration-300">
                  <div className="h-9 flex items-center justify-between px-4 bg-[#252526] border-b border-[#1e1e1e]">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider opacity-60"><Columns2 size={14} /><span>Comparison Input</span></div>
                    <button onClick={() => setIsCompareVisible(false)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
                  </div>
                  <div className="flex-1 overflow-hidden relative flex flex-col">
                    <div className="flex-1">
                      <MonacoEditor height="100%" language="json" theme="vs-dark" value={compareContent} onChange={(v) => setCompareContent(v || "")} onMount={(editor) => { compareEditorRef.current = editor; }} options={{ fontSize: settings.fontSize - 1, tabSize: settings.tabSize, fontFamily: '"JetBrains Mono", monospace', minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true, padding: { top: 12 }, lineNumbers: settings.lineNumbers, renderLineHighlight: "all", stickyScroll: { enabled: false } }} />
                    </div>
                    <div className="h-1/3 border-t border-[#2b2b2b] flex flex-col bg-[#1e1e1e]">
                      <div className="px-4 py-2 border-b border-[#2b2b2b] flex items-center justify-between bg-[#252526]"><span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Analysis Results ({diffResults.length})</span></div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
                        {diffResults.length > 0 ? diffResults.map((res, i) => (
                          <div key={i} className="flex gap-3 items-start p-2.5 rounded bg-[#333333]/30 border border-[#454545]/50 group hover:border-[#007acc] transition-colors">
                            <AlertTriangle size={14} className={cn("mt-0.5 shrink-0", res.type === "missing" ? "text-yellow-500" : "text-red-400")} />
                            <div className="space-y-1 w-full">
                              <div className="flex justify-between items-start gap-4">
                                <div className="text-[11px] font-bold text-white opacity-80 break-all">{res.path}</div>
                                <div className="text-[10px] text-[#007acc] font-mono whitespace-nowrap opacity-80 shrink-0">{res.lineLeft && `L${res.lineLeft}`} {res.lineLeft && res.lineRight && '|'} {res.lineRight && `R${res.lineRight}`}</div>
                              </div>
                              <div className="text-[10px] text-[#cccccc] opacity-50 italic">{res.message}</div>
                            </div>
                          </div>
                        )) : <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-8"><Check size={32} className="text-green-500 opacity-20" /><p className="text-[11px] text-[#cccccc] opacity-40 px-6">No mismatches found.</p></div>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isSaving && (
              <div className="absolute bottom-6 right-8 flex items-center gap-2 bg-[#007acc] text-white px-4 py-2 rounded-full shadow-lg transition-all duration-300 transform scale-110 z-50">
                <Save size={16} /><span className="text-xs font-bold uppercase tracking-wider">Saved</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 font-mono">
            <div className="text-center font-mono">
              <FileJson size={64} className="mx-auto mb-4 opacity-10" />
              <p>Select a file to start editing JSON</p>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <footer className="h-6 bg-[#007acc] text-white flex items-center px-3 justify-between text-[12px] shrink-0 font-mono text-nowrap overflow-hidden">
          <div className="flex items-center gap-4 min-w-0">
            {isReadOnlyMode && <span className="text-yellow-300 font-bold uppercase text-[10px] shrink-0">Read Only</span>}
            {collabSession && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold shrink-0">
                <Radio size={10} className="animate-pulse text-green-300" />
                <span style={{ color: collabSession.color }}>{collabSession.name}</span>
                <span className="opacity-50">({collab.clients.length + 1} online)</span>
              </div>
            )}
            {jsonPath && <span className="text-[10px] opacity-70 hover:opacity-100 cursor-pointer truncate max-w-[300px]" title={`JSON path: ${jsonPath}`} onClick={() => navigator.clipboard.writeText(jsonPath)}>{jsonPath}</span>}
          </div>
          <div className="flex items-center gap-4 shrink-0">
             {activeFileNode?.size !== undefined && <div className="px-2 opacity-80 border-r border-white/20">{formatBytes(activeFileNode.size)}</div>}
             <div className="hover:bg-[#1f8ad2] px-1 cursor-pointer">UTF-8</div>
             <div className="hover:bg-[#1f8ad2] px-1 cursor-pointer text-[#f1c40f] font-bold uppercase">Json</div>
          </div>
        </footer>
      </main>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div className="fixed z-50 w-48 bg-[#252526] border border-[#454545] shadow-xl py-1 rounded-sm text-[13px] font-mono" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          {(() => {
            const node = findNodeById(files, contextMenu.nodeId);
            const isFolder = node?.type === "folder";
            const isReadonly = node?.isReadonly;
            return (
              <>
                {!isReadonly && !isReadOnlyMode && (
                  <>
                    {isFolder && <>
                      <ContextMenuItem icon={<FilePlus size={14} className="text-yellow-400" />} label="New File" onClick={() => { setInputState({ parentId: contextMenu.nodeId, type: "file", mode: "create" }); setInputValue(""); setContextMenu(prev => ({ ...prev, visible: false })); }} />
                      <ContextMenuItem icon={<FolderPlus size={14} className="text-blue-400" />} label="New Folder" onClick={() => { setInputState({ parentId: contextMenu.nodeId, type: "folder", mode: "create" }); setInputValue(""); setContextMenu(prev => ({ ...prev, visible: false })); }} />
                      <div className="my-1 border-t border-[#454545]" />
                    </>}
                    <ContextMenuItem icon={<Edit2 size={14} />} label="Rename" onClick={() => { handleRenameTrigger(contextMenu.nodeId); setContextMenu(prev => ({ ...prev, visible: false })); }} />
                    <ContextMenuItem icon={<Copy size={14} />} label="Duplicate" onClick={() => { duplicateNode(contextMenu.nodeId); setContextMenu(prev => ({ ...prev, visible: false })); }} />
                  </>
                )}
                {isFolder && <ContextMenuItem icon={<Share2 size={14} className="text-blue-400" />} label="Share Folder" onClick={() => { shareFolder(contextMenu.nodeId); setContextMenu(prev => ({ ...prev, visible: false })); }} />}
                {isFolder && !isReadOnlyMode && <ContextMenuItem icon={<Radio size={14} className="text-green-400" />} label="Share Live..." onClick={() => { const n = findNodeById(files, contextMenu.nodeId); if (n) { setShareLiveFolderId(n.id); setShareLiveFolderName(n.name); setIsShareLiveVisible(true); } setContextMenu(prev => ({ ...prev, visible: false })); }} />}
                {!isFolder && !isReadonly && !isReadOnlyMode && (
                  <>
                    <div className="my-1 border-t border-[#454545]" />
                    <ContextMenuItem icon={<CheckCircle size={14} className="text-green-400" />} label="Mark Completed" onClick={() => { setNodeStatus(contextMenu.nodeId, 'completed'); setContextMenu(prev => ({ ...prev, visible: false })); }} />
                    <ContextMenuItem icon={<Tag size={14} className="text-blue-400" />} label="Mark Dev-Ready" onClick={() => { setNodeStatus(contextMenu.nodeId, 'dev-ready'); setContextMenu(prev => ({ ...prev, visible: false })); }} />
                    <ContextMenuItem icon={<X size={14} className="text-[#cccccc]" />} label="Clear Status" onClick={() => { setNodeStatus(contextMenu.nodeId, ''); setContextMenu(prev => ({ ...prev, visible: false })); }} />
                  </>
                )}
                {!isReadonly && !isReadOnlyMode && (
                  <>
                    <div className="my-1 border-t border-[#454545]" />
                    <ContextMenuItem icon={<Trash2 size={14} className="text-red-400" />} label="Delete" danger onClick={() => { const node = findNodeById(files, contextMenu.nodeId); if (node) setDeleteConfirm({ isOpen: true, id: node.id, name: node.name }); setContextMenu(prev => ({ ...prev, visible: false })); }} />
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      <ConfirmDialog isOpen={deleteConfirm.isOpen} title="Confirm Deletion" message={`Are you sure you want to delete '${deleteConfirm.name}'?`} onCancel={() => setDeleteConfirm({ isOpen: false, id: "", name: "" })} onConfirm={() => deleteNode(deleteConfirm.id)} />

      {/* Shortcuts Help */}
      {isShortcutsVisible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm font-mono" onClick={toggleShortcuts}>
          <div className="w-[450px] bg-[#252526] border border-[#454545] shadow-2xl rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#2b2b2b] flex items-center justify-between bg-[#1e1e1e]"><div className="flex items-center gap-2 text-white font-bold tracking-tight"><Command size={18} className="text-[#007acc]" /><span>KEYBOARD SHORTCUTS</span></div><button onClick={toggleShortcuts} className="opacity-60 hover:opacity-100 transition-opacity"><X size={18} /></button></div>
            <div className="p-6 flex flex-col gap-4">
              <ShortcutRow label="Save File & Notes" keys={["Cmd", "S"]} />
              <ShortcutRow label="Format JSON" keys={["Cmd", "Shift", "F"]} />
              <ShortcutRow label="Quick Open" keys={["Cmd", "P"]} />
              <ShortcutRow label="Toggle Help" keys={["Cmd", "/"]} />
            </div>
          </div>
        </div>
      )}

      {/* Share Live Dialog */}
      {isShareLiveVisible && (
        <ShareLiveDialog folderId={shareLiveFolderId} folderName={shareLiveFolderName} onClose={() => setIsShareLiveVisible(false)} onSessionCreated={(roomId, token, clientId, name, color) => { setCollabSession({ roomId, token, clientId, name, color }); }} />
      )}

      {/* Join Collab Dialog */}
      {showJoinDialog && collabRoomId && (
        <JoinCollabDialog roomId={collabRoomId} onJoined={(token, clientId, name, color) => { setCollabSession({ roomId: collabRoomId, token, clientId, name, color }); setShowJoinDialog(false); }} onCancel={() => { setShowJoinDialog(false); window.history.replaceState({}, '', window.location.pathname); }} />
      )}

      {/* Palette Components */}
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} files={files} onSelect={onFileSelectEnhanced} />
      <SnippetPalette isOpen={isSnippetPaletteOpen} onClose={() => { setIsSnippetPaletteOpen(false); setSnippetInsertCallback(null); }} onSelect={(content) => { if (snippetInsertCallback) snippetInsertCallback(content); }} />
      <ShareFolderDialog isOpen={isShareVisible} onClose={() => setIsShareVisible(false)} shareUrl={shareUrl} />
      <HistoryDialog isOpen={isHistoryVisible} onClose={() => setIsHistoryVisible(false)} snapshots={historySnapshots} fileName={activeFileNode?.name || ""} onRestore={(content) => updateFileContentLocal(activeFileId, content)} />
      <SettingsDialog isOpen={isSettingsVisible} onClose={() => setIsSettingsVisible(false)} settings={settings} onUpdateSettings={updateSettings} />
    </div>
  );
}

// Export Optimized
const Home = dynamic(() => Promise.resolve(memo(Workspace)), { 
  ssr: false, 
  loading: () => <div className="h-screen w-full bg-[#1e1e1e] animate-pulse" /> 
});
export default Home;
