"use client";

import React from "react";
import { X, Settings, Monitor, Type, Save, FileJson } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSettings } from "@/types";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
}

export function SettingsDialog({
  isOpen,
  onClose,
  settings,
  onUpdateSettings
}: SettingsDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-md font-mono" onClick={onClose}>
      <div className="w-[500px] bg-[#252526] border border-[#454545] shadow-2xl rounded-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-[#2b2b2b] flex items-center justify-between bg-[#1e1e1e]">
          <div className="flex items-center gap-3 text-white font-bold tracking-tight text-[15px]">
            <Settings size={20} className="text-[#007acc]" />
            <span>APP SETTINGS</span>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 p-1 hover:bg-[#333333] rounded-lg transition-opacity">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          {/* Editor Group */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#007acc] opacity-80">
              <Type size={14} />
              <span>Editor Appearance</span>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[12px] text-[#cccccc] opacity-60">Font Size (px)</label>
                <input 
                  type="number" 
                  value={settings.fontSize} 
                  onChange={e => onUpdateSettings({ fontSize: parseInt(e.target.value) || 12 })}
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-[13px] text-white focus:border-[#007acc] outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[12px] text-[#cccccc] opacity-60">Tab Size</label>
                <select 
                  value={settings.tabSize} 
                  onChange={e => onUpdateSettings({ tabSize: parseInt(e.target.value) })}
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-[13px] text-white focus:border-[#007acc] outline-none transition-colors appearance-none cursor-pointer"
                >
                  <option value={2}>2 Spaces</option>
                  <option value={4}>4 Spaces</option>
                  <option value={8}>8 Spaces</option>
                </select>
              </div>
            </div>
          </section>

          {/* Behavior Group */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#007acc] opacity-80">
              <Save size={14} />
              <span>Behavior</span>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg cursor-pointer hover:border-[#454545] transition-all">
                <div className="space-y-0.5">
                  <span className="text-[13px] text-white">Auto Save</span>
                  <p className="text-[11px] text-[#cccccc] opacity-40 italic">Save changes automatically to local cache</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.autoSave} 
                  onChange={e => onUpdateSettings({ autoSave: e.target.checked })}
                  className="w-4 h-4 accent-[#007acc]"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg cursor-pointer hover:border-[#454545] transition-all">
                <div className="space-y-0.5">
                  <span className="text-[13px] text-white">Format on Save</span>
                  <p className="text-[11px] text-[#cccccc] opacity-40 italic">Pretty print JSON when saving</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={settings.formatOnSave} 
                  onChange={e => onUpdateSettings({ formatOnSave: e.target.checked })}
                  className="w-4 h-4 accent-[#007acc]"
                />
              </label>
            </div>
          </section>

          {/* View Group */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#007acc] opacity-80">
              <Monitor size={14} />
              <span>View Options</span>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg cursor-pointer hover:border-[#454545] transition-all">
                <span className="text-[13px] text-white">Show Minimap</span>
                <input 
                  type="checkbox" 
                  checked={settings.minimap} 
                  onChange={e => onUpdateSettings({ minimap: e.target.checked })}
                  className="w-4 h-4 accent-[#007acc]"
                />
              </label>

              <div className="flex items-center justify-between p-3 bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg">
                <span className="text-[13px] text-white">Line Numbers</span>
                <div className="flex bg-[#333333] p-1 rounded-md">
                  {(["on", "off", "relative"] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => onUpdateSettings({ lineNumbers: mode })}
                      className={cn(
                        "px-3 py-1 rounded text-[11px] font-bold uppercase transition-all",
                        settings.lineNumbers === mode ? "bg-[#007acc] text-white" : "text-[#cccccc] opacity-50 hover:opacity-100"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="px-8 py-4 bg-[#1e1e1e]/50 border-t border-[#2b2b2b] flex justify-between items-center">
           <div className="flex items-center gap-2 text-[10px] text-[#cccccc] opacity-30 italic">
              <FileJson size={12} />
              <span>Settings are saved to browser local storage</span>
           </div>
           <button 
             onClick={onClose}
             className="px-6 py-2 bg-[#007acc] hover:bg-[#0062a3] text-white rounded-md text-[11px] font-bold uppercase tracking-wider transition-all shadow-lg active:scale-95"
           >
             Close
           </button>
        </div>
      </div>
    </div>
  );
}
