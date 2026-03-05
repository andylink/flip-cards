'use client';

import { useEffect, useRef, useState } from 'react';
import { Layer, Line, Rect, Stage, Text, Circle, Image as KonvaImage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { CanvasNode, CanvasState } from '@/lib/types/domain';
import { snapToGrid } from '@/lib/utils/canvas';

const GRID = 8;

type CanvasTool = 'select' | 'move' | 'text';

type TextDefaults = {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
};

type TextEditorState = {
  nodeId: string;
  value: string;
  x: number;
  y: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  isNew: boolean;
};

type Props = {
  canvas: CanvasState;
  selectedIds: string[];
  activeTool: CanvasTool;
  textDefaults: TextDefaults;
  onSelectIds: (ids: string[]) => void;
  onCanvasChange: (canvas: CanvasState) => void;
};

function drawNode(
  node: CanvasNode,
  selectedIds: string[],
  activeTool: CanvasTool,
  editingNodeId: string | null,
  onSelectIds: (ids: string[]) => void,
  onStartTextEdit: (node: CanvasNode) => void,
  onMove: (id: string, x: number, y: number) => void
) {
  if (node.hidden) return null;

  const common = {
    x: node.x,
    y: node.y,
    draggable: activeTool === 'move' && !node.locked,
    onClick: (event: { evt: MouseEvent }) => {
      if (activeTool === 'text' && node.type !== 'text') {
        return;
      }
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
        id={node.id} // ensure hit testing & background checks are consistent
        {...common}
        visible={editingNodeId !== node.id}
        draggable={activeTool === 'move' && !node.locked && editingNodeId !== node.id}
        text={node.text ?? ''}
        fontFamily={node.fontFamily ?? 'Arial'}
        fontSize={node.fontSize ?? 24}
        fontStyle={node.fontWeight === '700' ? 'bold' : 'normal'}
        fill={node.fill ?? '#0f172a'}
        onClick={(event: any) => {
          // prevent bubbling to Stage so edit isn’t interrupted by selection/background handlers
          event.cancelBubble = true;
          // keep selection predictable
          const additive = event.evt.shiftKey;
          onSelectIds(additive ? [node.id, ...selectedIds] : [node.id]);
          if (activeTool === 'text' && !event.evt.shiftKey) {
            onStartTextEdit(node);
          }
        }}
        onTap={() => {
          if (activeTool === 'text') {
            onStartTextEdit(node);
          }
        }}
      />
    );
  }

  if (node.type === 'rect') {
    return (
      <Rect
        key={node.id}
        id={node.id}
        {...common}
        width={node.width ?? 180}
        height={node.height ?? 100}
        fill={node.fill ?? '#dbeafe'}
      />
    );
  }

  if (node.type === 'circle') {
    return <Circle key={node.id} id={node.id} {...common} radius={node.radius ?? 50} fill={node.fill ?? '#bbf7d0'} />;
  }

  if (node.type === 'line') {
    return (
      <Line
        key={node.id}
        id={node.id}
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
        id={node.id}
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

export function CanvasStage({
  canvas,
  selectedIds,
  activeTool,
  textDefaults,
  onSelectIds,
  onCanvasChange
}: Props) {
  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const textEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const suppressNextBlurRef = useRef(false);

  const handleStagePointerDown = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = event.target.getStage();
    if (!stage) return;

    const parent = typeof event.target.getParent === 'function' ? event.target.getParent() : null;
    const className = typeof event.target.getClassName === 'function' ? event.target.getClassName() : '';
    const isBackgroundTarget = event.target === stage || parent === stage;
    const isTextTarget = className === 'Text';

    if (!isBackgroundTarget && activeTool !== 'text') return;
    if (activeTool === 'text' && isTextTarget) return;

    if (textEditor) {
      commitTextEdit(true);
    }

    if (activeTool === 'text') {
      const pointer = stage.getPointerPosition();
      if (!pointer) return; // nothing to do if konva hasn't set pointer yet

      const textId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `text-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const textNode: CanvasNode = {
        id: textId,
        type: 'text',
        x: snapToGrid(pointer.x, GRID),
        y: snapToGrid(pointer.y, GRID),
        text: '',
        fontFamily: textDefaults.fontFamily,
        fontSize: textDefaults.fontSize,
        fontWeight: textDefaults.fontWeight,
        fill: textDefaults.color
      };

      onCanvasChange({
        ...canvas,
        nodes: [...canvas.nodes, textNode]
      });
      onSelectIds([textId]);
      beginTextEdit(textNode, true);
      return;
    }

    onSelectIds([]);
  };

  const beginTextEdit = (node: CanvasNode, isNew = false) => {
    if (node.type !== 'text') return;

    setTextEditor({
      nodeId: node.id,
      value: node.text ?? '',
      x: node.x,
      y: node.y,
      fontFamily: node.fontFamily ?? textDefaults.fontFamily,
      fontSize: node.fontSize ?? textDefaults.fontSize,
      fontWeight: node.fontWeight ?? textDefaults.fontWeight,
      color: node.fill ?? textDefaults.color,
      isNew
    });

    if (isNew) {
      // A text node created during stage mousedown can receive an immediate blur from the same click cycle.
      suppressNextBlurRef.current = true;
    }
  };

  const commitTextEdit = (discardEmpty: boolean) => {
    if (!textEditor) return;

    const normalized = textEditor.value.trim();
    if (discardEmpty && normalized === '') {
      onCanvasChange({
        ...canvas,
        nodes: canvas.nodes.filter((node) => node.id !== textEditor.nodeId)
      });
      onSelectIds([]);
      setTextEditor(null);
      return;
    }

    onCanvasChange({
      ...canvas,
      nodes: canvas.nodes.map((node) =>
        node.id === textEditor.nodeId
          ? {
              ...node,
              text: textEditor.value,
              fontFamily: textEditor.fontFamily,
              fontSize: textEditor.fontSize,
              fontWeight: textEditor.fontWeight,
              fill: textEditor.color
            }
          : node
      )
    });
    setTextEditor(null);
  };

  useEffect(() => {
    if (!textEditorRef.current) return;
    const input = textEditorRef.current;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [textEditor?.nodeId]);

  useEffect(() => {
    if (!textEditorRef.current) return;
    const input = textEditorRef.current;
    input.style.height = 'auto';
    input.style.height = `${Math.max(input.scrollHeight, (textEditor?.fontSize ?? 24) + 10)}px`;
  }, [textEditor?.value, textEditor?.fontSize]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (textEditor) return;

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
  }, [canvas, selectedIds, onCanvasChange, textEditor]);

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="relative inline-block">
        <Stage
          width={canvas.width}
          height={canvas.height}
          style={{ cursor: activeTool === 'text' ? 'text' : activeTool === 'move' ? 'grab' : 'default' }}
          onMouseDown={handleStagePointerDown}
          onTouchStart={handleStagePointerDown}
        >
          <Layer>
            {canvas.nodes.map((node) =>
              drawNode(
                node,
                selectedIds,
                activeTool,
                textEditor?.nodeId ?? null,
                onSelectIds,
                beginTextEdit,
                (id, x, y) => {
                  onCanvasChange({
                    ...canvas,
                    nodes: canvas.nodes.map((candidate) =>
                      candidate.id === id ? { ...candidate, x, y } : candidate
                    )
                  });
                }
              )
            )}
          </Layer>
        </Stage>
        {textEditor ? (
          <textarea
            ref={textEditorRef}
            value={textEditor.value}
            onChange={(event) =>
              setTextEditor((current) => (current ? { ...current, value: event.target.value } : current))
            }
            onBlur={() => {
              if (suppressNextBlurRef.current) {
                suppressNextBlurRef.current = false;
                requestAnimationFrame(() => {
                  textEditorRef.current?.focus();
                });
                return;
              }
              commitTextEdit(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                commitTextEdit(textEditor.isNew);
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                commitTextEdit(true);
              }
            }}
            className="absolute resize-none overflow-hidden border border-blue-300 bg-white/95 px-1 py-0.5 text-slate-900 shadow-sm focus:outline-none"
            style={{
              left: textEditor.x,
              top: textEditor.y,
              minWidth: 120,
              zIndex: 20,
              fontFamily: textEditor.fontFamily,
              fontSize: textEditor.fontSize,
              lineHeight: 1.2,
              fontWeight:
                textEditor.fontWeight === '700'
                  ? 700
                  : textEditor.fontWeight === '600'
                  ? 600
                  : 400,
              color: textEditor.color
            }}
          />
        ) : null}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        TODO: Add transformer, grouping, crop, alignment guides, and marquee multi-select.
      </p>
    </div>
  );
}