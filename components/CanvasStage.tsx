'use client';

import { useEffect } from 'react';
import { Layer, Line, Rect, Stage, Text, Circle, Image as KonvaImage } from 'react-konva';
import { CanvasNode, CanvasState } from '@/lib/types/domain';
import { snapToGrid } from '@/lib/utils/canvas';

const GRID = 8;

type Props = {
  canvas: CanvasState;
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onCanvasChange: (canvas: CanvasState) => void;
};

function drawNode(
  node: CanvasNode,
  selectedIds: string[],
  onSelectIds: (ids: string[]) => void,
  onMove: (id: string, x: number, y: number) => void
) {
  if (node.hidden) return null;

  const common = {
    x: node.x,
    y: node.y,
    draggable: !node.locked,
    onClick: (event: { evt: MouseEvent }) => {
      const additive = event.evt.shiftKey;
      onSelectIds(additive ? [...new Set([...selectedIds, node.id])] : [node.id]);
    },
    onDragEnd: (event: { target: { x: () => number; y: () => number } }) =>
      onMove(node.id, snapToGrid(event.target.x(), GRID), snapToGrid(event.target.y(), GRID))
  };

  if (node.type === 'text') {
    return (
      <Text
        key={node.id}
        {...common}
        text={node.text ?? ''}
        fontSize={node.fontSize ?? 24}
        fontStyle={node.fontWeight === '700' ? 'bold' : 'normal'}
        fill={node.fill ?? '#0f172a'}
      />
    );
  }

  if (node.type === 'rect') {
    return (
      <Rect
        key={node.id}
        {...common}
        width={node.width ?? 180}
        height={node.height ?? 100}
        fill={node.fill ?? '#dbeafe'}
      />
    );
  }

  if (node.type === 'circle') {
    return <Circle key={node.id} {...common} radius={node.radius ?? 50} fill={node.fill ?? '#bbf7d0'} />;
  }

  if (node.type === 'line') {
    return (
      <Line
        key={node.id}
        {...common}
        points={node.points ?? [0, 0, 120, 0]}
        stroke={node.stroke ?? '#334155'}
        strokeWidth={3}
      />
    );
  }

  if (node.type === 'image') {
    return (
      <KonvaImage
        key={node.id}
        {...common}
        image={undefined}
        width={node.width ?? 200}
        height={node.height ?? 120}
        // TODO: Resolve image assets through signed URL + useImage hook.
      />
    );
  }

  return null;
}

export function CanvasStage({ canvas, selectedIds, onSelectIds, onCanvasChange }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 10 : 1;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;

      const delta =
        event.key === 'ArrowUp'
          ? [0, -step]
          : event.key === 'ArrowDown'
            ? [0, step]
            : event.key === 'ArrowLeft'
              ? [-step, 0]
              : [step, 0];

      onCanvasChange({
        ...canvas,
        nodes: canvas.nodes.map((node) =>
          selectedIds.includes(node.id)
            ? {
                ...node,
                x: node.x + delta[0],
                y: node.y + delta[1]
              }
            : node
        )
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canvas, selectedIds, onCanvasChange]);

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
      <Stage
        width={canvas.width}
        height={canvas.height}
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) {
            onSelectIds([]);
          }
        }}
      >
        <Layer>
          {Array.from({ length: Math.floor(canvas.width / GRID) }).map((_, i) => (
            <Line key={`v-${i}`} points={[i * GRID, 0, i * GRID, canvas.height]} stroke="#e2e8f0" strokeWidth={0.5} />
          ))}
          {Array.from({ length: Math.floor(canvas.height / GRID) }).map((_, i) => (
            <Line key={`h-${i}`} points={[0, i * GRID, canvas.width, i * GRID]} stroke="#e2e8f0" strokeWidth={0.5} />
          ))}
        </Layer>
        <Layer>
          {canvas.nodes.map((node) =>
            drawNode(node, selectedIds, onSelectIds, (id, x, y) => {
              onCanvasChange({
                ...canvas,
                nodes: canvas.nodes.map((candidate) => (candidate.id === id ? { ...candidate, x, y } : candidate))
              });
            })
          )}
        </Layer>
      </Stage>
      <p className="mt-2 text-xs text-slate-500">TODO: Add transformer, grouping, crop, alignment guides, and marquee multi-select.</p>
    </div>
  );
}
