import { FileNode } from "@/types";

export function findNodeById(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function getPathToNode(nodes: FileNode[], id: string, path: string[] = []): string[] | null {
  for (const node of nodes) {
    const newPath = [...path, node.name];
    if (node.id === id) return newPath;
    if (node.children) {
      const foundPath = getPathToNode(node.children, id, newPath);
      if (foundPath) return foundPath;
    }
  }
  return null;
}

export function findFirstFile(n: FileNode): string | null {
  if (n.type === "file") return n.id;
  if (n.children) {
    for (const c of n.children) {
      const f = findFirstFile(c);
      if (f) return f;
    }
  }
  return null;
}

export function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });
}
