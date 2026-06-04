import React, { memo } from "react";
import { ChevronRight, ChevronDown, FileJson, FolderPlus, FilePlus, Folder, FolderOpen, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileNode, InputState } from "@/types";
import { sortNodes } from "@/lib/tree-utils";

function FileTreeItemComponent({ 
  node, depth, onToggle, onAdd, activeId, onSelect, onContextMenu, inputState, inputValue, setInputValue, onInputSubmit, isReadOnlyMode, onMove
}: { 
  node: FileNode; depth: number; onToggle: (id: string) => void; onAdd: (parentId: string, type: "file" | "folder") => void;
  activeId: string; onSelect: (id: string) => void; onContextMenu: (e: React.MouseEvent, id: string) => void;
  inputState: InputState | null; inputValue: string; setInputValue: (v: string) => void; onInputSubmit: () => void; isReadOnlyMode: boolean;
  onMove?: (sourceId: string, targetParentId: string) => void;
}) {
  const isFolder = node.type === "folder";
  const isActive = activeId === node.id;
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    if (isReadOnlyMode || node.isReadonly) { e.preventDefault(); return; }
    e.dataTransfer.setData("application/json-tree-node", node.id);
    e.dataTransfer.effectAllowed = "move";
    
    // Create a ghost image or just let default happen
    const dragImg = new Image();
    dragImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(dragImg, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isReadOnlyMode) return;
    if (isFolder) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isReadOnlyMode) return;
    setIsDragOver(false);
    if (isFolder) {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("application/json-tree-node");
      if (sourceId && sourceId !== node.id && onMove) {
        onMove(sourceId, node.id);
      }
    }
  };

  return (
    <div className="flex flex-col">
      <div 
        className={cn(
          "flex items-center py-0.5 cursor-pointer hover:bg-[#2a2d2e] transition-colors group relative font-mono border-y border-transparent",
          isActive && !isFolder && "bg-[#37373d] text-white",
          isDragOver && "bg-[#094771] border-y-[#007acc]"
        )}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={() => isFolder ? onToggle(node.id) : onSelect(node.id)}
        onContextMenu={(e) => onContextMenu(e, node.id)}
        draggable={!isReadOnlyMode && !node.isReadonly}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isFolder ? (node.isOpen ? <ChevronDown size={16} className="mr-1 shrink-0" /> : <ChevronRight size={16} className="mr-1 shrink-0" />) : <div className="w-4 mr-1 shrink-0" />}
        {isFolder ? (node.isOpen ? <FolderOpen size={16} className="mr-2 text-blue-400 shrink-0" /> : <Folder size={16} className="mr-2 text-blue-400 shrink-0" />) : <FileJson size={16} className={cn("mr-2 shrink-0", node.isReadonly ? "text-blue-300" : "text-yellow-500")} />}

        {inputState?.nodeId === node.id && inputState.mode !== "create" ? (
          <input autoFocus className="flex-1 bg-[#3c3c3c] border border-[#007acc] outline-none px-1 text-[13px] text-white font-mono" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onBlur={onInputSubmit} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") onInputSubmit(); }} onClick={(e) => e.stopPropagation()} />
        ) : (
          <span className="text-[13px] truncate flex-1 flex items-center gap-2">
            {node.name}
            {node.status && (
              <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider", 
                node.status === 'completed' ? 'bg-green-600/30 text-green-400' :
                node.status === 'dev-ready' ? 'bg-blue-600/30 text-blue-400' :
                node.status === 'staging-ready' ? 'bg-yellow-600/30 text-yellow-400' :
                node.status === 'prod-ready' ? 'bg-purple-600/30 text-purple-400' : 'bg-[#454545] text-[#cccccc]'
              )}>
                {node.status}
              </span>
            )}
            {node.isReadonly && <Lock size={10} className="text-yellow-600" />}
          </span>
        )}

        {isFolder && !isReadOnlyMode && !node.isReadonly && (
          <div className="absolute right-2 flex gap-1 opacity-0 group-hover:opacity-100 bg-[#2a2d2e] px-1">
            <button onClick={(e) => { e.stopPropagation(); onAdd(node.id, "file"); }} title="New JSON File"><FilePlus size={12} className="hover:text-white" /></button>
            <button onClick={(e) => { e.stopPropagation(); onAdd(node.id, "folder"); }} title="New Folder"><FolderPlus size={12} className="hover:text-white" /></button>
          </div>
        )}
      </div>

      {inputState?.mode === "create" && inputState.parentId === node.id && (
        <div className="flex items-center py-0.5 pr-2 font-mono" style={{ paddingLeft: `${(depth + 1) * 12 + 12}px` }}>
          {inputState.type === "folder" ? <Folder size={16} className="mr-2 text-blue-400" /> : <FileJson size={16} className="mr-2 text-yellow-500" />}
          <input autoFocus placeholder={inputState.type === "file" ? "file.json" : "folder name"} className="flex-1 bg-[#3c3c3c] border border-[#007acc] outline-none px-1 text-[13px] text-white font-mono" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onBlur={onInputSubmit} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") onInputSubmit(); }} />
        </div>
      )}

      {isFolder && node.isOpen && node.children && (
        <div className="flex flex-col">
          {sortNodes(node.children).map((child) => (
            <FileTreeItem key={child.id} node={child} depth={depth + 1} onToggle={onToggle} onAdd={onAdd} activeId={activeId} onSelect={onSelect} onContextMenu={onContextMenu} inputState={inputState} inputValue={inputValue} setInputValue={setInputValue} onInputSubmit={onInputSubmit} isReadOnlyMode={isReadOnlyMode} onMove={onMove} />
          ))}
        </div>
      )}
    </div>
  );
}

export const FileTreeItem = memo(FileTreeItemComponent);
