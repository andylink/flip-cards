import { CanvasNode, CanvasState } from '@/lib/types/domain';

export const CANVAS_MIN_WIDTH = 320;
export const CANVAS_MIN_HEIGHT = 240;

type CanvasSize = {
  width: number;
  height: number;
};

type CanvasSizeBounds = {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
};

export function clampCanvasSize(size: CanvasSize, bounds: CanvasSizeBounds = {}): CanvasSize {
  const minWidth = bounds.minWidth ?? CANVAS_MIN_WIDTH;
  const minHeight = bounds.minHeight ?? CANVAS_MIN_HEIGHT;
  const maxWidth = Math.max(minWidth, bounds.maxWidth ?? Number.POSITIVE_INFINITY);
  const maxHeight = Math.max(minHeight, bounds.maxHeight ?? Number.POSITIVE_INFINITY);

  return {
    width: Math.min(maxWidth, Math.max(minWidth, Math.round(size.width))),
    height: Math.min(maxHeight, Math.max(minHeight, Math.round(size.height)))
  };
}

export function clampPortraitCanvasSize(size: CanvasSize, bounds: CanvasSizeBounds = {}): CanvasSize {
  const minWidth = bounds.minWidth ?? CANVAS_MIN_WIDTH;
  const minHeight = Math.max(minWidth, bounds.minHeight ?? CANVAS_MIN_HEIGHT);
  const maxWidth = Math.max(minWidth, bounds.maxWidth ?? Number.POSITIVE_INFINITY);
  const maxHeight = Math.max(minHeight, bounds.maxHeight ?? Number.POSITIVE_INFINITY);

  let width = Math.min(maxWidth, Math.max(minWidth, Math.round(size.width)));
  let height = Math.min(maxHeight, Math.max(minHeight, Math.round(size.height)));

  if (height < width) {
    height = Math.min(maxHeight, width);
  }

  if (height < width) {
    width = Math.max(minWidth, Math.min(maxWidth, height));
  }

  return {
    width,
    height
  };
}

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
