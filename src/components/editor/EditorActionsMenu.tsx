"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  MoreVertical, 
  Plus, 
  Save, 
  Columns2, 
  Layers, 
  History, 
  Code,
  X,
  LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorActionsMenuProps {
  onInsertSnippet: () => void;
  onSaveSnippet: () => void;
  onToggleCompare: () => void;
  isCompareVisible: boolean;
  onToggleFlatView: () => void;
  isFlatView: boolean;
  onOpenHistory: () => void;
  onFormatJson: () => void;
}

interface MenuItemProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeClassName?: string;
  iconColor?: string;
  onClose: () => void;
}

const MenuItem = ({ 
  icon: Icon, 
  label, 
  onClick, 
  active = false,
  activeClassName = "bg-[#007acc] text-white",
  iconColor = "text-[#cccccc]",
  onClose
}: MenuItemProps) => (
  <button
    onClick={() => {
      onClick();
      onClose();
    }}
    className={cn(
      "flex w-full items-center gap-3 px-4 py-2.5 text-[11px] font-mono transition-colors hover:bg-[#3c3c3c] text-left",
      active ? activeClassName : "text-[#cccccc] hover:text-white"
    )}
  >
    <Icon size={14} className={cn(active ? "text-white" : iconColor)} />
    <span className="font-bold tracking-wider uppercase">{label}</span>
  </button>
);

export function EditorActionsMenu({
  onInsertSnippet,
  onSaveSnippet,
  onToggleCompare,
  isCompareVisible,
  onToggleFlatView,
  isFlatView,
  onOpenHistory,
  onFormatJson,
}: EditorActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleClose = () => setIsOpen(false);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-center w-9 h-9 bg-[#333333] border border-[#454545] hover:bg-[#444444] text-[#cccccc] hover:text-white rounded-sm transition-all shadow-xl",
          isOpen && "bg-[#444444] border-[#007acc]"
        )}
        title="Editor Actions"
      >
        {isOpen ? <X size={18} /> : <MoreVertical size={18} />}
      </button>

      {isOpen && (
        <div className="absolute top-0 right-full mr-3 w-56 bg-[#252526] border border-[#454545] shadow-2xl rounded-sm py-2 z-[60] animate-in fade-in slide-in-from-right-2 duration-150">
          <MenuItem 
            icon={Plus} 
            label="Insert Snippet" 
            onClick={onInsertSnippet} 
            iconColor="text-green-400"
            onClose={handleClose}
          />
          <MenuItem 
            icon={Save} 
            label="Save Snippet" 
            onClick={onSaveSnippet} 
            iconColor="text-yellow-400"
            onClose={handleClose}
          />
          <div className="my-1 border-t border-[#333333]" />
          <MenuItem 
            icon={Columns2} 
            label={isCompareVisible ? "Hide Comparison" : "Compare JSON"} 
            onClick={onToggleCompare} 
            active={isCompareVisible}
            onClose={handleClose}
          />
          <MenuItem 
            icon={Layers} 
            label={isFlatView ? "Unflatten JSON" : "Flatten JSON"} 
            onClick={onToggleFlatView} 
            active={isFlatView}
            activeClassName="bg-purple-600/30 text-purple-300"
            iconColor="text-purple-400"
            onClose={handleClose}
          />
          <div className="my-1 border-t border-[#333333]" />
          <MenuItem 
            icon={History} 
            label="Save History" 
            onClick={onOpenHistory} 
            iconColor="text-orange-400"
            onClose={handleClose}
          />
          <MenuItem 
            icon={Code} 
            label="Format JSON" 
            onClick={onFormatJson} 
            iconColor="text-blue-400"
            onClose={handleClose}
          />
        </div>
      )}
    </div>
  );
}
