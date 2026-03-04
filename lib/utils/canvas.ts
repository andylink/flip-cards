import { CanvasNode, CanvasState } from '@/lib/types/domain';

export function serializeCanvas(canvas: CanvasState): string {
  return JSON.stringify(canvas);
}

export function deserializeCanvas(raw: string): CanvasState {
  const parsed = JSON.parse(raw) as CanvasState;
  return {
    width: parsed.width,
    height: parsed.height,
    nodes: parsed.nodes ?? []
  };
}

export function nudgeNodes(nodes: CanvasNode[], ids: string[], deltaX: number, deltaY: number): CanvasNode[] {
  const selected = new Set(ids);
  return nodes.map((node) =>
    selected.has(node.id)
      ? {
          ...node,
          x: node.x + deltaX,
          y: node.y + deltaY
        }
      : node
  );
}

export function duplicateNodes(nodes: CanvasNode[], ids: string[]): CanvasNode[] {
  const selected = new Set(ids);
  const duplicates = nodes
    .filter((node) => selected.has(node.id))
    .map((node) => ({ ...node, id: `${node.id}-copy-${crypto.randomUUID()}`, x: node.x + 12, y: node.y + 12 }));
  return [...nodes, ...duplicates];
}

export function snapToGrid(value: number, grid = 8): number {
  return Math.round(value / grid) * grid;
}
