export type FileNode = {
  id: string; // The relative path
  name: string;
  type: "file" | "folder";
  isOpen?: boolean;
  content?: string; // used for read-only mode only
  preset?: string;
  isReadonly?: boolean;
  children?: FileNode[];
  status?: string; // Added for upcoming status badge feature
};

export type ContextMenuState = {
  x: number;
  y: number;
  nodeId: string;
  visible: boolean;
};

export type InputState = {
  parentId: string; // "" for root
  type: "file" | "folder";
  mode: "create" | "rename" | "preset";
  nodeId?: string;
  initialValue?: string;
};

export type DiffResult = {
  path: string;
  type: "missing" | "type_mismatch" | "value_mismatch";
  message: string;
  lineLeft?: number;
  lineRight?: number;
};

export type WorkspaceStats = {
  totalFiles: number;
  totalSize: number;
};

export type AppSettings = {
  fontSize: number;
  tabSize: number;
  autoSave: boolean;
  formatOnSave: boolean;
  minimap: boolean;
  lineNumbers: "on" | "off" | "relative";
};
