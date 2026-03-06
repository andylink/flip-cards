'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text, Circle, Transformer, Image as KonvaImage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { CanvasNode, CanvasState } from '@/lib/types/domain';
import { snapToGrid } from '@/lib/utils/canvas';
import { toKonvaFill, toKonvaStroke } from '@/lib/utils/canvasAppearance';

const GRID = 8;

type CanvasTool = 'select' | 'move' | 'text' | 'rect' | 'circle' | 'line' | 'icon' | 'image';

type ImageNode = Extract<CanvasNode, { type: 'image' }>;

type TextDefaults = {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
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
  formattedValue: string;
  x: number;
  y: number;
  width: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
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
  textFormatRequest?: { id: number; format: 'bold' | 'italic' } | null;
  onTextFormatRequestHandled?: (requestId: number, handled: boolean) => void;
};

type NodeBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HitCycleState = {
  x: number;
  y: number;
  hitIds: string[];
};

const TEXT_RIGHT_PADDING = 16;

const INLINE_BOLD_MARKER = '**';
const INLINE_ITALIC_MARKER = '_';

function stripInlineFormatMarkers(value: string): string {
  return value.replace(/\*\*|_/g, '');
}

function parseInlineStyledText(value: string): { text: string; bold: boolean; italic: boolean }[] {
  const segments: { text: string; bold: boolean; italic: boolean }[] = [];
  let index = 0;
  let bold = false;
  let italic = false;
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    segments.push({ text: buffer, bold, italic });
    buffer = '';
  };

  while (index < value.length) {
    if (value.startsWith(INLINE_BOLD_MARKER, index)) {
      flush();
      bold = !bold;
      index += INLINE_BOLD_MARKER.length;
      continue;
    }

    if (value[index] === INLINE_ITALIC_MARKER) {
      flush();
      italic = !italic;
      index += 1;
      continue;
    }

    buffer += value[index];
    index += 1;
  }

  flush();

  return segments.length > 0 ? segments : [{ text: '', bold: false, italic: false }];
}

function buildPlainToFormattedMap(formattedValue: string): number[] {
  const map: number[] = [0];
  let formattedIndex = 0;
  let plainIndex = 0;

  while (formattedIndex < formattedValue.length) {
    if (formattedValue.startsWith(INLINE_BOLD_MARKER, formattedIndex)) {
      formattedIndex += INLINE_BOLD_MARKER.length;
      continue;
    }

    if (formattedValue[formattedIndex] === INLINE_ITALIC_MARKER) {
      formattedIndex += 1;
      continue;
    }

    formattedIndex += 1;
    plainIndex += 1;
    map[plainIndex] = formattedIndex;
  }

  if (map[plainIndex] === undefined) {
    map[plainIndex] = formattedIndex;
  }

  return map;
}

function applyPlainTextEditToFormatted(
  previousPlainValue: string,
  nextPlainValue: string,
  previousFormattedValue: string
): string {
  if (previousPlainValue === nextPlainValue) {
    return previousFormattedValue;
  }

  let prefixLength = 0;
  const maxPrefix = Math.min(previousPlainValue.length, nextPlainValue.length);
  while (prefixLength < maxPrefix && previousPlainValue[prefixLength] === nextPlainValue[prefixLength]) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  const maxSuffix = Math.min(previousPlainValue.length - prefixLength, nextPlainValue.length - prefixLength);
  while (
    suffixLength < maxSuffix &&
    previousPlainValue[previousPlainValue.length - 1 - suffixLength] ===
      nextPlainValue[nextPlainValue.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const previousMiddleStart = prefixLength;
  const previousMiddleEnd = previousPlainValue.length - suffixLength;
  const nextMiddle = nextPlainValue.slice(prefixLength, nextPlainValue.length - suffixLength);
  const plainToFormattedMap = buildPlainToFormattedMap(previousFormattedValue);
  const formattedMiddleStart = plainToFormattedMap[previousMiddleStart] ?? 0;
  const formattedMiddleEnd = plainToFormattedMap[previousMiddleEnd] ?? previousFormattedValue.length;

  return (
    previousFormattedValue.slice(0, formattedMiddleStart) +
    nextMiddle +
    previousFormattedValue.slice(formattedMiddleEnd)
  );
}

function buildStyledTextLayout(
  segments: { text: string; bold: boolean; italic: boolean }[],
  flowWidth: number,
  fontFamily: string,
  fontSize: number
): Array<{ text: string; bold: boolean; italic: boolean; x: number; y: number }> {
  const chunks: Array<{ text: string; bold: boolean; italic: boolean; x: number; y: number }> = [];
  const measurementContext =
    typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;

  let line = 0;
  let lineWidth = 0;
  let chunkText = '';
  let chunkX = 0;
  let chunkY = 0;
  let chunkBold = false;
  let chunkItalic = false;

  const measureTextWidth = (text: string, bold: boolean, italic: boolean): number => {
    if (!measurementContext) {
      return text.length * Math.max(1, fontSize * 0.58);
    }

    const styleParts: string[] = [];
    if (italic) styleParts.push('italic');
    if (bold) styleParts.push('700');
    styleParts.push(`${fontSize}px`);
    styleParts.push(fontFamily);
    measurementContext.font = styleParts.join(' ');
    return measurementContext.measureText(text).width;
  };

  const flushChunk = () => {
    if (!chunkText) return;
    chunks.push({
      text: chunkText,
      bold: chunkBold,
      italic: chunkItalic,
      x: chunkX,
      y: chunkY
    });
    chunkText = '';
  };

  const beginChunk = (bold: boolean, italic: boolean) => {
    chunkX = lineWidth;
    chunkY = line * fontSize * 1.2;
    chunkBold = bold;
    chunkItalic = italic;
  };

  segments.forEach((segment) => {
    for (const char of segment.text) {
      if (char === '\n') {
        flushChunk();
        line += 1;
        lineWidth = 0;
        continue;
      }

      const charWidth = measureTextWidth(char, segment.bold, segment.italic);

      if (lineWidth > 0 && lineWidth + charWidth > flowWidth) {
        flushChunk();
        line += 1;
        lineWidth = 0;
      }

      if (!chunkText) {
        beginChunk(segment.bold, segment.italic);
      }

      if (segment.bold !== chunkBold || segment.italic !== chunkItalic || chunkY !== line * fontSize * 1.2) {
        flushChunk();
        beginChunk(segment.bold, segment.italic);
      }

      chunkText += char;
      lineWidth += charWidth;
    }
  });

  flushChunk();

  return chunks;
}

function toKonvaTextStyle(fontWeight: string, fontStyle: 'normal' | 'italic'): 'normal' | 'bold' | 'italic' | 'bold italic' {
  const isBold = fontWeight !== '400';
  if (isBold && fontStyle === 'italic') return 'bold italic';
  if (isBold) return 'bold';
  if (fontStyle === 'italic') return 'italic';
  return 'normal';
}

function getTextFlowWidth(node: Extract<CanvasNode, { type: 'text' }>, canvasWidth: number): number {
  const x = node.x;
  const fontSize = node.fontSize ?? 24;
  const minimumWidth = Math.max(96, Math.round(fontSize * 4));
  const fallbackWidth = Math.max(minimumWidth, canvasWidth - x - TEXT_RIGHT_PADDING);
  if (typeof node.width !== 'number' || !Number.isFinite(node.width)) {
    return fallbackWidth;
  }

  return Math.max(minimumWidth, node.width);
}

function getTextBoundsSize(node: Extract<CanvasNode, { type: 'text' }>, canvasWidth: number): { width: number; height: number } {
  const fontSize = node.fontSize ?? 24;
  const flowWidth = getTextFlowWidth(node, canvasWidth);
  const averageCharacterWidth = Math.max(1, fontSize * 0.58);
  const charactersPerLine = Math.max(1, Math.floor(flowWidth / averageCharacterWidth));
  const explicitLines = stripInlineFormatMarkers(node.text ?? '').split('\n');
  const wrappedLineCount = explicitLines.reduce((count, line) => {
    return count + Math.max(1, Math.ceil(line.length / charactersPerLine));
  }, 0);

  return {
    width: flowWidth,
    height: Math.max(fontSize * 1.2, wrappedLineCount * fontSize * 1.2)
  };
}

function getNodeBounds(node: CanvasNode, canvasWidth: number): NodeBounds | null {
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
    const boundsSize = getTextBoundsSize(node, canvasWidth);
    return {
      x: node.x,
      y: node.y,
      width: boundsSize.width,
      height: boundsSize.height
    };
  }

  return null;
}

function CanvasImageNode({
  node,
  common,
  onResize
}: {
  node: ImageNode;
  common: {
    x: number;
    y: number;
    draggable: boolean;
    onClick: (event: { evt: MouseEvent }) => void;
    onDragEnd: (event: { target: { x: () => number; y: () => number } }) => void;
  };
  onResize: (nodeId: string, nextNode: CanvasNode) => void;
}) {
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!node.src) {
      setImageElement(null);
      return;
    }

    const image = new window.Image();
    image.onload = () => setImageElement(image);
    image.onerror = () => setImageElement(null);
    image.src = node.src;
  }, [node.src]);

  return (
    <KonvaImage
      key={node.id}
      id={node.id}
      {...common}
      image={imageElement ?? undefined}
      width={node.width ?? 200}
      height={node.height ?? 120}
      onTransformEnd={(event: any) => {
        const target = event.target;
        const nextWidth = Math.max(8, Math.round((node.width ?? 200) * target.scaleX()));
        const nextHeight = Math.max(8, Math.round((node.height ?? 120) * target.scaleY()));
        target.scaleX(1);
        target.scaleY(1);
        onResize(node.id, {
          ...node,
          x: snapToGrid(target.x(), GRID),
          y: snapToGrid(target.y(), GRID),
          width: snapToGrid(nextWidth, GRID),
          height: snapToGrid(nextHeight, GRID)
        });
      }}
    />
  );
}

function drawNode(
  node: CanvasNode,
  canvasWidth: number,
  activeTool: CanvasTool,
  editingNodeId: string | null,
  onSelectFromClick: (event: { evt: MouseEvent; target: any }, fallbackNodeId: string) => string[],
  onStartTextEdit: (node: CanvasNode) => void,
  onMove: (id: string, x: number, y: number) => void,
  onResize: (nodeId: string, nextNode: CanvasNode) => void
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
      onSelectFromClick(event as { evt: MouseEvent; target: any }, node.id);
    },
    onDragEnd: (event: { target: { x: () => number; y: () => number } }) =>
      onMove(node.id, snapToGrid(event.target.x(), GRID), snapToGrid(event.target.y(), GRID))
  };

  if (node.type === 'text') {
    const fillProps = toKonvaFill(node, '#0f172a');
    const fontSize = node.fontSize ?? 24;
    const textBounds = getTextBoundsSize(node, canvasWidth);
    const flowWidth = textBounds.width;
    const minimumWidth = Math.max(96, Math.round(fontSize * 4));
    const rawText = node.text ?? '';
    const hasInlineMarkers = rawText.includes(INLINE_BOLD_MARKER) || rawText.includes(INLINE_ITALIC_MARKER);

    const textClickHandler = (event: any) => {
      // prevent bubbling to Stage so edit isn’t interrupted by selection/background handlers
      event.cancelBubble = true;
      const nextSelection = onSelectFromClick(event as { evt: MouseEvent; target: any }, node.id);
      if (activeTool === 'text' && !event.evt.shiftKey && nextSelection[0] === node.id) {
        onStartTextEdit(node);
      }
    };

    const handleTextTransformEnd = (event: any) => {
      const target = event.target;
      const nextWidth = Math.max(minimumWidth, Math.round(flowWidth * Math.abs(target.scaleX())));
      target.scaleX(1);
      target.scaleY(1);

      onResize(node.id, {
        ...node,
        x: snapToGrid(target.x(), GRID),
        y: snapToGrid(target.y(), GRID),
        width: snapToGrid(nextWidth, GRID)
      });
    };

    if (hasInlineMarkers) {
      const segments = parseInlineStyledText(rawText);
      const chunks = buildStyledTextLayout(segments, flowWidth, node.fontFamily ?? 'Arial', fontSize);

      return (
        <Group
          key={node.id}
          id={node.id}
          {...common}
          visible={editingNodeId !== node.id}
          draggable={activeTool === 'move' && !node.locked && editingNodeId !== node.id}
          onClick={textClickHandler}
          onTap={() => {
            if (activeTool === 'text') {
              onStartTextEdit(node);
            }
          }}
          onTransformEnd={handleTextTransformEnd}
        >
          {chunks.map((chunk, index) => (
            <Text
              key={`${node.id}-chunk-${index}`}
              x={chunk.x}
              y={chunk.y}
              text={chunk.text}
              fontFamily={node.fontFamily ?? 'Arial'}
              fontSize={fontSize}
              fontStyle={toKonvaTextStyle(chunk.bold ? '700' : '400', chunk.italic ? 'italic' : 'normal')}
              align={node.textAlign ?? 'left'}
              {...fillProps}
            />
          ))}
        </Group>
      );
    }

    return (
      <Text
        key={node.id}
        id={node.id} // ensure hit testing & background checks are consistent
        {...common}
        visible={editingNodeId !== node.id}
        draggable={activeTool === 'move' && !node.locked && editingNodeId !== node.id}
        text={node.text ?? ''}
        width={flowWidth}
        wrap="word"
        align={node.textAlign ?? 'left'}
        fontFamily={node.fontFamily ?? 'Arial'}
        fontSize={node.fontSize ?? 24}
        fontStyle={toKonvaTextStyle(node.fontWeight ?? '400', node.fontStyle ?? 'normal')}
        {...fillProps}
        onClick={textClickHandler}
        onTap={() => {
          if (activeTool === 'text') {
            onStartTextEdit(node);
          }
        }}
        onTransformEnd={handleTextTransformEnd}
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
        onTransformEnd={(event: any) => {
          const target = event.target;
          const nextWidth = Math.max(8, Math.round((node.width ?? 180) * target.scaleX()));
          const nextHeight = Math.max(8, Math.round((node.height ?? 100) * target.scaleY()));
          target.scaleX(1);
          target.scaleY(1);
          onResize(node.id, {
            ...node,
            x: snapToGrid(target.x(), GRID),
            y: snapToGrid(target.y(), GRID),
            width: snapToGrid(nextWidth, GRID),
            height: snapToGrid(nextHeight, GRID)
          });
        }}
      />
    );
  }

  if (node.type === 'circle') {
    const fillProps = toKonvaFill(node, '#bbf7d0');
    const strokeProps = toKonvaStroke(node, '#334155', 2);
    return (
      <Circle
        key={node.id}
        id={node.id}
        {...common}
        radius={node.radius ?? 50}
        {...fillProps}
        {...strokeProps}
        onTransformEnd={(event: any) => {
          const target = event.target;
          const scaleX = target.scaleX();
          const scaleY = target.scaleY();
          const nextRadius = Math.max(8, Math.round((node.radius ?? 50) * Math.max(scaleX, scaleY)));
          target.scaleX(1);
          target.scaleY(1);
          onResize(node.id, {
            ...node,
            x: snapToGrid(target.x(), GRID),
            y: snapToGrid(target.y(), GRID),
            radius: snapToGrid(nextRadius, GRID)
          });
        }}
      />
    );
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
        onTransformEnd={(event: any) => {
          const target = event.target;
          const scaleX = target.scaleX();
          const scaleY = target.scaleY();
          const sourcePoints = node.points ?? [0, 0, 120, 0];
          const nextPoints = sourcePoints.map((value, index) =>
            index % 2 === 0 ? Math.round(value * scaleX) : Math.round(value * scaleY)
          );

          target.scaleX(1);
          target.scaleY(1);
          onResize(node.id, {
            ...node,
            x: snapToGrid(target.x(), GRID),
            y: snapToGrid(target.y(), GRID),
            points: nextPoints
          });
        }}
      />
    );
  }

  if (node.type === 'image') {
    return <CanvasImageNode key={node.id} node={node} common={common} onResize={onResize} />;
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
  onCanvasChange,
  textFormatRequest,
  onTextFormatRequestHandled
}: Props) {
  const cardChromePadding = 16; // p-2 around Stage inside card frame
  const viewportPadding = 32; // p-4 around card frame in viewport area

  const [textEditor, setTextEditor] = useState<TextEditorState | null>(null);
  const [shiftPressed, setShiftPressed] = useState(false);
  const textEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const suppressNextBlurRef = useRef(false);
  const processedTextFormatRequestIdRef = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const hitCycleRef = useRef<HitCycleState | null>(null);
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setShiftPressed(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setShiftPressed(false);
      }
    };
    const onWindowBlur = () => setShiftPressed(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
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

      const nextX = snapToGrid(pointer.x / scale, GRID);
      const nextY = snapToGrid(pointer.y / scale, GRID);
      const nextFontSize = textDefaults.fontSize;
      const minimumWidth = Math.max(96, Math.round(nextFontSize * 4));
      const defaultWidth = Math.max(minimumWidth, canvas.width - nextX - TEXT_RIGHT_PADDING);

      const textNode: CanvasNode = {
        id: textId,
        type: 'text',
        x: nextX,
        y: nextY,
        width: defaultWidth,
        text: '',
        fontFamily: textDefaults.fontFamily,
        fontSize: nextFontSize,
        fontWeight: textDefaults.fontWeight,
        fontStyle: textDefaults.fontStyle,
        textAlign: textDefaults.textAlign,
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
    hitCycleRef.current = null;
  };

  const resolveHitNodeIds = (event: { target: any }): { hitIds: string[]; pointer: { x: number; y: number } | null } => {
    const stage = event.target?.getStage?.();
    const pointer = stage?.getPointerPosition?.() ?? null;
    if (!stage || !pointer || typeof stage.getAllIntersections !== 'function') {
      return { hitIds: [], pointer };
    }

    const intersections = stage.getAllIntersections(pointer) as any[];
    if (intersections.length === 0) {
      return { hitIds: [], pointer };
    }

    const nodeIds = new Set(canvas.nodes.map((node) => node.id));
    const zIndexById = new Map(canvas.nodes.map((node, index) => [node.id, index]));
    const hitIdSet = new Set<string>();

    intersections.forEach((intersection) => {
      let current = intersection;
      while (current) {
        const id = typeof current.id === 'function' ? current.id() : '';
        if (id && nodeIds.has(id)) {
          hitIdSet.add(id);
          break;
        }
        current = typeof current.getParent === 'function' ? current.getParent() : null;
      }
    });

    const hitIds = Array.from(hitIdSet).sort((a, b) => (zIndexById.get(b) ?? -1) - (zIndexById.get(a) ?? -1));
    return { hitIds, pointer };
  };

  const resolveNodeSelectionFromClick = (event: { evt: MouseEvent; target: any }, fallbackNodeId: string): string[] => {
    if (event.evt.shiftKey) {
      const nextSelection = [...new Set([...selectedIds, fallbackNodeId])];
      onSelectIds(nextSelection);
      hitCycleRef.current = null;
      return nextSelection;
    }

    const { hitIds, pointer } = resolveHitNodeIds(event);
    const stack = hitIds.length > 0 ? hitIds : [fallbackNodeId];
    const previous = hitCycleRef.current;
    const sameStack =
      previous &&
      previous.hitIds.length === stack.length &&
      previous.hitIds.every((id, index) => id === stack[index]);
    const samePosition =
      previous &&
      pointer &&
      Math.abs(previous.x - pointer.x) <= 4 &&
      Math.abs(previous.y - pointer.y) <= 4;

    let nextId = stack[0] ?? fallbackNodeId;

    // Repeated clicks at the same point rotate through overlapping nodes.
    if (sameStack && samePosition && selectedIds.length === 1) {
      const currentIndex = stack.indexOf(selectedIds[0]);
      if (currentIndex >= 0) {
        nextId = stack[(currentIndex + 1) % stack.length] ?? nextId;
      }
    }

    onSelectIds([nextId]);
    if (pointer) {
      hitCycleRef.current = { x: pointer.x, y: pointer.y, hitIds: stack };
    } else {
      hitCycleRef.current = null;
    }

    return [nextId];
  };

  const beginTextEdit = (node: CanvasNode, isNew = false) => {
    if (node.type !== 'text') return;

    const flowWidth = getTextFlowWidth(node, canvas.width);

    setTextEditor({
      nodeId: node.id,
      value: stripInlineFormatMarkers(node.text ?? ''),
      formattedValue: node.text ?? '',
      x: node.x,
      y: node.y,
      width: flowWidth,
      fontFamily: node.fontFamily ?? textDefaults.fontFamily,
      fontSize: node.fontSize ?? textDefaults.fontSize,
      fontWeight: node.fontWeight ?? textDefaults.fontWeight,
      fontStyle: node.fontStyle ?? textDefaults.fontStyle,
      textAlign: node.textAlign ?? textDefaults.textAlign,
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

    const normalized = stripInlineFormatMarkers(textEditor.formattedValue).trim();
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
              text: textEditor.formattedValue,
              width: textEditor.width,
              fontFamily: textEditor.fontFamily,
              fontSize: textEditor.fontSize,
              fontWeight: textEditor.fontWeight,
              fontStyle: textEditor.fontStyle,
              textAlign: textEditor.textAlign,
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

  const applyInlineFormatToSelection = (format: 'bold' | 'italic'): boolean => {
    if (!textEditor || !textEditorRef.current) return false;

    const input = textEditorRef.current;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? 0;
    if (selectionEnd <= selectionStart) {
      return false;
    }

    const marker = format === 'bold' ? INLINE_BOLD_MARKER : INLINE_ITALIC_MARKER;
    const currentValue = textEditor.formattedValue;
    const map = buildPlainToFormattedMap(currentValue);
    const formattedSelectionStart = map[selectionStart] ?? 0;
    const formattedSelectionEnd = map[selectionEnd] ?? currentValue.length;
    const canUnwrap =
      formattedSelectionStart >= marker.length &&
      currentValue.slice(formattedSelectionStart - marker.length, formattedSelectionStart) === marker &&
      currentValue.slice(formattedSelectionEnd, formattedSelectionEnd + marker.length) === marker;

    let nextValue = currentValue;

    if (canUnwrap) {
      nextValue =
        currentValue.slice(0, formattedSelectionStart - marker.length) +
        currentValue.slice(formattedSelectionStart, formattedSelectionEnd) +
        currentValue.slice(formattedSelectionEnd + marker.length);
    } else {
      nextValue =
        currentValue.slice(0, formattedSelectionStart) +
        marker +
        currentValue.slice(formattedSelectionStart, formattedSelectionEnd) +
        marker +
        currentValue.slice(formattedSelectionEnd);
    }

    const nextPlain = stripInlineFormatMarkers(nextValue);

    setTextEditor((current) =>
      current && current.nodeId === textEditor.nodeId
        ? { ...current, value: nextPlain, formattedValue: nextValue }
        : current
    );

    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(selectionStart, selectionEnd);
    });

    return true;
  };

  useEffect(() => {
    if (!textFormatRequest) return;
    if (processedTextFormatRequestIdRef.current === textFormatRequest.id) return;

    processedTextFormatRequestIdRef.current = textFormatRequest.id;
    const handled = applyInlineFormatToSelection(textFormatRequest.format);
    onTextFormatRequestHandled?.(textFormatRequest.id, handled);
  }, [onTextFormatRequestHandled, textFormatRequest, textEditor]);

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
    if (!textEditor) return;

    const activeNode = canvas.nodes.find((node) => node.id === textEditor.nodeId);
    if (!activeNode || activeNode.type !== 'text') return;

    setTextEditor((current) => {
      if (!current || current.nodeId !== activeNode.id) return current;

      const nextEditor = {
        ...current,
        width: getTextFlowWidth(activeNode, canvas.width),
        fontFamily: activeNode.fontFamily ?? textDefaults.fontFamily,
        fontSize: activeNode.fontSize ?? textDefaults.fontSize,
        fontWeight: activeNode.fontWeight ?? textDefaults.fontWeight,
        fontStyle: activeNode.fontStyle ?? textDefaults.fontStyle,
        textAlign: activeNode.textAlign ?? textDefaults.textAlign,
        color: activeNode.fill?.color ?? textDefaults.color
      };

      if (
        nextEditor.width === current.width &&
        nextEditor.fontFamily === current.fontFamily &&
        nextEditor.fontSize === current.fontSize &&
        nextEditor.fontWeight === current.fontWeight &&
        nextEditor.fontStyle === current.fontStyle &&
        nextEditor.textAlign === current.textAlign &&
        nextEditor.color === current.color
      ) {
        return current;
      }

      return nextEditor;
    });
  }, [canvas.nodes, canvas.width, textDefaults, textEditor]);

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
            .map((node) => ({ id: node.id, bounds: getNodeBounds(node, canvas.width) }))
            .filter((entry): entry is { id: string; bounds: NodeBounds } => Boolean(entry.bounds))
        : [],
    [activeTool, canvas.nodes, canvas.width, selectedIds, textEditor?.nodeId]
  );

  const textEditorFlowWidth = textEditor?.width ?? 0;

  const selectedTransformNode = useMemo(() => {
    if (activeTool !== 'select' || selectedIds.length !== 1) return null;
    const selectedNode = canvas.nodes.find((node) => node.id === selectedIds[0]);
    if (!selectedNode) return null;
    if (
      selectedNode.type !== 'text' &&
      selectedNode.type !== 'rect' &&
      selectedNode.type !== 'circle' &&
      selectedNode.type !== 'line' &&
      selectedNode.type !== 'image'
    ) {
      return null;
    }
    return selectedNode;
  }, [activeTool, canvas.nodes, selectedIds]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const layer = layerRef.current;
    if (!transformer || !layer) return;
    if (typeof transformer.nodes !== 'function' || typeof layer.findOne !== 'function') return;
    if (typeof layer.batchDraw !== 'function') return;

    if (!selectedTransformNode) {
      transformer.nodes([]);
      layer.batchDraw();
      return;
    }

    const selectedKonvaNode = layer.findOne(`#${selectedTransformNode.id}`);
    if (!selectedKonvaNode) {
      transformer.nodes([]);
      layer.batchDraw();
      return;
    }

    transformer.nodes([selectedKonvaNode]);
    layer.batchDraw();
  }, [selectedTransformNode, shiftPressed]);

  return (
    <div className="space-y-3">
      <div
        ref={viewportRef}
        className="flex w-full items-start justify-center overflow-auto rounded-xl bg-slate-100 p-4"
        style={{ minHeight: Math.max(displayHeight + 16, Math.round(viewportHeight * 0.72)) }}
      >
        <div
          className="relative mx-auto inline-block rounded-[22px] p-2 shadow-[0_12px_30px_rgba(15,23,42,0.18)]"
          style={{ backgroundColor: canvas.backgroundColor ?? '#ffffff' }}
        >
        <Stage
          width={displayWidth}
          height={displayHeight}
          style={{
            backgroundColor: canvas.backgroundColor ?? '#ffffff',
            cursor:
              activeTool === 'text'
                ? 'text'
                : activeTool === 'move'
                ? 'grab'
                : activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line'
                ? 'crosshair'
                    : activeTool === 'icon' || activeTool === 'image'
                    ? 'copy'
                : 'default'
          }}
          onMouseDown={handleStagePointerDown}
          onTouchStart={handleStagePointerDown}
        >
          <Layer ref={layerRef} scaleX={scale} scaleY={scale}>
            <Rect
              x={0}
              y={0}
              width={canvas.width}
              height={canvas.height}
              fill={canvas.backgroundColor ?? '#ffffff'}
              listening={false}
            />
            {canvas.nodes.map((node) =>
              drawNode(
                node,
                canvas.width,
                activeTool,
                textEditor?.nodeId ?? null,
                resolveNodeSelectionFromClick,
                beginTextEdit,
                (id, x, y) => {
                  onCanvasChange({
                    ...canvas,
                    nodes: canvas.nodes.map((candidate) =>
                      candidate.id === id ? { ...candidate, x, y } : candidate
                    )
                  });
                },
                (nodeId, nextNode) => {
                  onCanvasChange({
                    ...canvas,
                    nodes: canvas.nodes.map((candidate) =>
                      candidate.id === nodeId ? nextNode : candidate
                    )
                  });
                }
              )
            )}
            {selectedTransformNode ? (
              <Transformer
                ref={transformerRef}
                rotateEnabled={false}
                keepRatio={selectedTransformNode.type === 'circle' || selectedTransformNode.type === 'image' || shiftPressed}
                flipEnabled={false}
                enabledAnchors={
                  selectedTransformNode.type === 'text'
                    ? ['middle-left', 'middle-right']
                    : undefined
                }
                boundBoxFunc={(oldBox: any, newBox: any) => {
                  const minTextWidth = 96;
                  const minSize = selectedTransformNode.type === 'text' ? minTextWidth : 8;
                  if (Math.abs(newBox.width) < minSize || Math.abs(newBox.height) < 8) {
                    return oldBox;
                  }
                  return newBox;
                }}
              />
            ) : null}
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
              onChange={(event) => {
                const nextPlainValue = event.target.value;
                setTextEditor((current) => {
                  if (!current) return current;

                  const nextFormattedValue = applyPlainTextEditToFormatted(
                    current.value,
                    nextPlainValue,
                    current.formattedValue
                  );

                  return {
                    ...current,
                    value: nextPlainValue,
                    formattedValue: nextFormattedValue
                  };
                });
              }}
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
                if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
                  event.preventDefault();
                  applyInlineFormatToSelection('bold');
                  return;
                }

                if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
                  event.preventDefault();
                  applyInlineFormatToSelection('italic');
                  return;
                }

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
                width: Math.max(72, textEditorFlowWidth * scale),
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
                fontStyle: textEditor.fontStyle,
                textAlign: textEditor.textAlign,
                color: textEditor.color
              }}
            />
          ) : null}
        </div>
      </div>
     
    </div>
  );
}