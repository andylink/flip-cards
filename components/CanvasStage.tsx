'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Line, Rect, Stage, Text, Circle, Image as KonvaImage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { CanvasNode, CanvasState } from '@/lib/types/domain';
import { snapToGrid } from '@/lib/utils/canvas';
import { toKonvaFill, toKonvaStroke } from '@/lib/utils/canvasAppearance';

const GRID = 8;

type CanvasTool = 'select' | 'move' | 'text' | 'rect' | 'circle' | 'line';

type TextDefaults = {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  color: string;
};

type ShapeDefaults = {
  fillEnabled: boolean;
  fillColor: string;
  fillOpacity: number;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
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
  shapeDefaults: ShapeDefaults;
  onSelectIds: (ids: string[]) => void;
  onCanvasChange: (canvas: CanvasState) => void;
};

type NodeBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getNodeBounds(node: CanvasNode): NodeBounds | null {
  if (node.hidden) return null;

  if (node.type === 'rect' || node.type === 'image' || node.type === 'group') {
    return {
      x: node.x,
      y: node.y,
      width: node.width ?? 180,
      height: node.height ?? 100
    };
  }

  if (node.type === 'circle') {
    const radius = node.radius ?? 50;
    return {
      x: node.x - radius,
      y: node.y - radius,
      width: radius * 2,
      height: radius * 2
    };
  }

  if (node.type === 'line') {
    const points = node.points ?? [0, 0, 120, 0];
    const pointXs: number[] = [];
    const pointYs: number[] = [];

    for (let index = 0; index < points.length - 1; index += 2) {
      pointXs.push(points[index]);
      pointYs.push(points[index + 1]);
    }

    const minX = Math.min(...pointXs);
    const minY = Math.min(...pointYs);
    const maxX = Math.max(...pointXs);
    const maxY = Math.max(...pointYs);
    const padding = 3;

    return {
      x: node.x + minX - padding,
      y: node.y + minY - padding,
      width: Math.max(1, maxX - minX + padding * 2),
      height: Math.max(1, maxY - minY + padding * 2)
    };
  }

  if (node.type === 'text') {
    const fontSize = node.fontSize ?? 24;
    const lines = (node.text ?? '').split('\n');
    const maxLineLength = lines.reduce((largest, line) => Math.max(largest, line.length), 0);
    return {
      x: node.x,
      y: node.y,
      width: Math.max(fontSize * 0.8, maxLineLength * fontSize * 0.6),
      height: Math.max(fontSize * 1.2, lines.length * fontSize * 1.2)
    };
  }

  return null;
}

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
    const fillProps = toKonvaFill(node, '#0f172a');
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
        {...fillProps}
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
    const fillProps = toKonvaFill(node, '#dbeafe');
    const strokeProps = toKonvaStroke(node, '#334155', 2);
    return (
      <Rect
        key={node.id}
        id={node.id}
        {...common}
        width={node.width ?? 180}
        height={node.height ?? 100}
        {...fillProps}
        {...strokeProps}
      />
    );
  }

  if (node.type === 'circle') {
    const fillProps = toKonvaFill(node, '#bbf7d0');
    const strokeProps = toKonvaStroke(node, '#334155', 2);
    return <Circle key={node.id} id={node.id} {...common} radius={node.radius ?? 50} {...fillProps} {...strokeProps} />;
  }

  if (node.type === 'line') {
    const strokeProps = toKonvaStroke(node, '#334155', 3);
    return (
      <Line
        key={node.id}
        id={node.id}
        {...common}
        points={node.points ?? [0, 0, 120, 0]}
        {...strokeProps}
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
  shapeDefaults,
  onSelectIds,
  onCanvasChange
}: Props) {
  const cardChromePadding = 16; // p-2 around Stage inside card frame
  const viewportPadding = 32; // p-4 around card frame in viewport area

  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const textEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const suppressNextBlurRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(canvas.width + viewportPadding + cardChromePadding);
  const [viewportHeight, setViewportHeight] = useState<number>(900);

  useEffect(() => {
    if (!viewportRef.current) return;
    const updateFromElement = () => {
      if (!viewportRef.current) return;
      const nextWidth = viewportRef.current.clientWidth;
      if (nextWidth > 0) {
        setViewportWidth(nextWidth);
      }
    };

    if (typeof ResizeObserver === 'undefined') {
      updateFromElement();
      window.addEventListener('resize', updateFromElement);
      return () => window.removeEventListener('resize', updateFromElement);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = entry.contentRect.width;
      if (nextWidth > 0) {
        setViewportWidth(nextWidth);
      }
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateHeight = () => setViewportHeight(window.innerHeight);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const effectiveViewportWidth = viewportWidth > 0 ? viewportWidth : canvas.width + viewportPadding + cardChromePadding;
  const availableWidth = Math.max(1, effectiveViewportWidth - viewportPadding - cardChromePadding);
  const availableHeight = Math.max(1, viewportHeight * 0.72 - viewportPadding - cardChromePadding);
  const scale = Math.min(1, availableWidth / canvas.width, availableHeight / canvas.height);
  const displayWidth = Math.max(1, Math.round(canvas.width * scale));
  const displayHeight = Math.max(1, Math.round(canvas.height * scale));

  const handleStagePointerDown = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = event.target.getStage();
    if (!stage) return;

    const parent = typeof event.target.getParent === 'function' ? event.target.getParent() : null;
    const className = typeof event.target.getClassName === 'function' ? event.target.getClassName() : '';
    const isBackgroundTarget = event.target === stage || parent === stage;
    const isTextTarget = className === 'Text';
    const creationTools: CanvasTool[] = ['text', 'rect', 'circle', 'line'];
    const isCreationTool = creationTools.includes(activeTool);

    if (!isBackgroundTarget && !isCreationTool) return;
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
        x: snapToGrid(pointer.x / scale, GRID),
        y: snapToGrid(pointer.y / scale, GRID),
        text: '',
        fontFamily: textDefaults.fontFamily,
        fontSize: textDefaults.fontSize,
        fontWeight: textDefaults.fontWeight,
        fill: {
          enabled: true,
          color: textDefaults.color,
          opacity: 1
        }
      };

      onCanvasChange({
        ...canvas,
        nodes: [...canvas.nodes, textNode]
      });
      onSelectIds([textId]);
      beginTextEdit(textNode, true);
      return;
    }

    if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line') {
      if (!isBackgroundTarget) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const baseX = snapToGrid(pointer.x / scale, GRID);
      const baseY = snapToGrid(pointer.y / scale, GRID);
      const shapeId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${activeTool}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const stroke = {
        enabled: shapeDefaults.strokeEnabled,
        color: shapeDefaults.strokeColor,
        width: shapeDefaults.strokeWidth,
        opacity: shapeDefaults.strokeOpacity
      };

      const nextNode: CanvasNode =
        activeTool === 'rect'
          ? {
              id: shapeId,
              type: 'rect',
              x: baseX,
              y: baseY,
              width: 180,
              height: 100,
              fill: {
                enabled: shapeDefaults.fillEnabled,
                color: shapeDefaults.fillColor,
                opacity: shapeDefaults.fillOpacity
              },
              stroke
            }
          : activeTool === 'circle'
          ? {
              id: shapeId,
              type: 'circle',
              x: baseX,
              y: baseY,
              radius: 56,
              fill: {
                enabled: shapeDefaults.fillEnabled,
                color: shapeDefaults.fillColor,
                opacity: shapeDefaults.fillOpacity
              },
              stroke
            }
          : {
              id: shapeId,
              type: 'line',
              x: baseX,
              y: baseY,
              points: [0, 0, 140, 0],
              stroke: {
                ...stroke,
                enabled: true
              }
            };

      onCanvasChange({
        ...canvas,
        nodes: [...canvas.nodes, nextNode]
      });
      onSelectIds([shapeId]);
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
      color: node.fill?.color ?? textDefaults.color,
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
        node.id === textEditor.nodeId && node.type === 'text'
          ? {
              ...node,
              text: textEditor.value,
              fontFamily: textEditor.fontFamily,
              fontSize: textEditor.fontSize,
              fontWeight: textEditor.fontWeight,
              fill: {
                enabled: true,
                color: textEditor.color,
                opacity: node.fill?.opacity ?? 1
              }
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
      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName;
      const isTypingTarget =
        targetTag === 'INPUT' ||
        targetTag === 'TEXTAREA' ||
        targetTag === 'SELECT' ||
        Boolean(target?.isContentEditable);

      if (isTypingTarget) return;

      if ((event.key === 'Delete' || event.key === 'Backspace') && activeTool === 'select') {
        if (selectedIds.length === 0) return;
        event.preventDefault();
        const selected = new Set(selectedIds);
        onCanvasChange({
          ...canvas,
          nodes: canvas.nodes.filter((node) => !selected.has(node.id))
        });
        onSelectIds([]);
        return;
      }

      if (textEditor || selectedIds.length === 0) return;

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
  }, [activeTool, canvas, onCanvasChange, onSelectIds, selectedIds, textEditor]);

  const selectionBounds = useMemo(
    () =>
      activeTool === 'select'
        ? canvas.nodes
            .filter((node) => selectedIds.includes(node.id) && node.id !== textEditor?.nodeId)
            .map((node) => ({ id: node.id, bounds: getNodeBounds(node) }))
            .filter((entry): entry is { id: string; bounds: NodeBounds } => Boolean(entry.bounds))
        : [],
    [activeTool, canvas.nodes, selectedIds, textEditor?.nodeId]
  );

  return (
    <div className="space-y-3">
      <div ref={viewportRef} className="w-full overflow-auto rounded-xl bg-slate-100 p-4">
        <div className="relative mx-auto inline-block rounded-[22px] border-2 border-black bg-white p-2 shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
        <Stage
          width={displayWidth}
          height={displayHeight}
          style={{
            cursor:
              activeTool === 'text'
                ? 'text'
                : activeTool === 'move'
                ? 'grab'
                : activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line'
                ? 'crosshair'
                : 'default'
          }}
          onMouseDown={handleStagePointerDown}
          onTouchStart={handleStagePointerDown}
        >
          <Layer scaleX={scale} scaleY={scale}>
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
            {selectionBounds.map(({ id, bounds }) => (
              <Rect
                key={`selection-${id}`}
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                fillEnabled={false}
                stroke="#2563eb"
                strokeWidth={1.5}
                dash={[6, 4]}
                listening={false}
              />
            ))}
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
                left: textEditor.x * scale,
                top: textEditor.y * scale,
                minWidth: Math.max(72, 120 * scale),
                zIndex: 20,
                fontFamily: textEditor.fontFamily,
                fontSize: Math.max(12, textEditor.fontSize * scale),
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
      </div>
      <p className="mt-2 text-xs text-slate-500">
        TODO: Add transformer, grouping, crop, alignment guides, and marquee multi-select.
      </p>
    </div>
  );
}