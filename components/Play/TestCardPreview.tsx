'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Group, Image as KonvaImage } from 'react-konva';
import { AnswerType, CanvasNode, CanvasState } from '@/lib/types/domain';
import { normalizeCanvasState, toKonvaFill, toKonvaStroke } from '@/lib/utils/canvasAppearance';
import { clozeSchema } from '@/lib/utils/answerEvaluation';

type Props = {
  canvas: CanvasState;
  answerType?: AnswerType;
  schemaJson?: unknown;
};

const FALLBACK_CARD_WIDTH = 720;
const TEXT_RIGHT_PADDING = 16;
const CLOZE_TOKEN_REGEX = /{{\s*(blank|[1-9]\d*)\s*}}/gi;
const INLINE_BOLD_MARKER = '**';
const INLINE_ITALIC_MARKER = '_';

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9'
};

function toSuperscript(value: number): string {
  return String(value)
    .split('')
    .map((digit) => {
      if (digit === '0') return '⁰';
      if (digit === '1') return '¹';
      if (digit === '2') return '²';
      if (digit === '3') return '³';
      if (digit === '4') return '⁴';
      if (digit === '5') return '⁵';
      if (digit === '6') return '⁶';
      if (digit === '7') return '⁷';
      if (digit === '8') return '⁸';
      if (digit === '9') return '⁹';
      return SUPERSCRIPT_DIGITS[digit] ?? digit;
    })
    .join('');
}

function toClozePreviewText(template: string): string {
  let legacyBlankIndex = 1;
  return template.replace(CLOZE_TOKEN_REGEX, (_, token: string) => {
    const normalized = (token ?? '').toLowerCase();
    const placeholderId = normalized === 'blank' ? legacyBlankIndex++ : Number(normalized);
    if (!Number.isInteger(placeholderId) || placeholderId <= 0) {
      return '_______';
    }
    return `_______${toSuperscript(placeholderId)}`;
  });
}

function getTextFlowWidth(x: number, canvasWidth: number, fontSize: number): number {
  const minimumWidth = Math.max(96, Math.round(fontSize * 4));
  return Math.max(minimumWidth, canvasWidth - x - TEXT_RIGHT_PADDING);
}

function toKonvaTextStyle(fontWeight: string, fontStyle: 'normal' | 'italic'): 'normal' | 'bold' | 'italic' | 'bold italic' {
  const isBold = fontWeight !== '400';
  if (isBold && fontStyle === 'italic') return 'bold italic';
  if (isBold) return 'bold';
  if (fontStyle === 'italic') return 'italic';
  return 'normal';
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

function renderNode(
  node: CanvasNode,
  cardWidth: number,
  textTransform: (value: string) => string,
  imagesById: Record<string, HTMLImageElement | undefined>
) {
  if (node.hidden) return null;

  if (node.type === 'text') {
    const fillProps = toKonvaFill(node, '#0f172a');
    const fontSize = node.fontSize ?? 24;
    const flowWidth = getTextFlowWidth(node.x, cardWidth, fontSize);
    const transformedText = textTransform(node.text ?? '');
    const hasInlineMarkers = transformedText.includes(INLINE_BOLD_MARKER) || transformedText.includes(INLINE_ITALIC_MARKER);

    if (hasInlineMarkers) {
      const segments = parseInlineStyledText(transformedText);
      const chunks = buildStyledTextLayout(segments, flowWidth, node.fontFamily ?? 'Arial', fontSize);

      return (
        <Group key={node.id} x={node.x} y={node.y}>
          {chunks.map((chunk, index) => (
            <Text
              key={`${node.id}-chunk-${index}`}
              x={chunk.x}
              y={chunk.y}
              text={chunk.text}
              width={flowWidth}
              wrap="word"
              fontFamily={node.fontFamily ?? 'Arial'}
              fontSize={fontSize}
              align={node.textAlign ?? 'left'}
              fontStyle={toKonvaTextStyle(chunk.bold ? '700' : '400', chunk.italic ? 'italic' : 'normal')}
              {...fillProps}
            />
          ))}
        </Group>
      );
    }

    return (
      <Text
        key={node.id}
        x={node.x}
        y={node.y}
        text={transformedText}
        width={flowWidth}
        wrap="word"
        align={node.textAlign ?? 'left'}
        fontFamily={node.fontFamily ?? 'Arial'}
        fontSize={fontSize}
        fontStyle={toKonvaTextStyle(node.fontWeight ?? '400', node.fontStyle ?? 'normal')}
        {...fillProps}
      />
    );
  }

  if (node.type === 'rect') {
    const fillProps = toKonvaFill(node, '#dbeafe');
    const strokeProps = toKonvaStroke(node, '#334155', 2);
    return (
      <Rect
        key={node.id}
        x={node.x}
        y={node.y}
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
    return <Circle key={node.id} x={node.x} y={node.y} radius={node.radius ?? 50} {...fillProps} {...strokeProps} />;
  }

  if (node.type === 'line') {
    const strokeProps = toKonvaStroke(node, '#334155', 3);
    return <Line key={node.id} x={node.x} y={node.y} points={node.points ?? [0, 0, 120, 0]} {...strokeProps} />;
  }

  if (node.type === 'image') {
    const image = imagesById[node.id];
    const width = node.width ?? 200;
    const height = node.height ?? 120;

    if (image) {
      return <KonvaImage key={node.id} x={node.x} y={node.y} width={width} height={height} image={image} />;
    }

    // Show a visual placeholder until the image loads or if source is missing.
    return (
      <Rect
        key={node.id}
        x={node.x}
        y={node.y}
        width={width}
        height={height}
        stroke="#94a3b8"
        strokeWidth={2}
        dash={[8, 6]}
        fill="#f8fafc"
      />
    );
  }

  return null;
}

export function TestCardPreview({ canvas, answerType, schemaJson }: Props) {
  const normalizedCanvas = useMemo(() => normalizeCanvasState(canvas), [canvas]);
  const clozeTemplate = useMemo(() => {
    if (answerType !== 'cloze') return null;
    const parsed = clozeSchema.safeParse(schemaJson);
    return parsed.success ? parsed.data.template : null;
  }, [answerType, schemaJson]);
  const textTransform = useMemo(() => {
    if (!clozeTemplate) {
      return (value: string) => value;
    }

    return (value: string) => (value === clozeTemplate ? toClozePreviewText(value) : value);
  }, [clozeTemplate]);

  const cardWidth = normalizedCanvas.width || FALLBACK_CARD_WIDTH;
  const cardHeight = normalizedCanvas.height || Math.round(FALLBACK_CARD_WIDTH * 1.5);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(cardWidth);
  const [imagesById, setImagesById] = useState<Record<string, HTMLImageElement | undefined>>({});

  useEffect(() => {
    if (!viewportRef.current) return;
    const updateWidth = () => {
      if (!viewportRef.current) return;
      const next = viewportRef.current.clientWidth;
      if (next > 0) {
        setViewportWidth(next);
      }
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const imageNodes = normalizedCanvas.nodes.filter(
      (node): node is Extract<CanvasNode, { type: 'image' }> => node.type === 'image' && !!node.src
    );

    if (imageNodes.length === 0) {
      setImagesById({});
      return;
    }

    let cancelled = false;
    const nextImages: Record<string, HTMLImageElement | undefined> = {};

    imageNodes.forEach((node) => {
      const image = new window.Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (cancelled) return;
        setImagesById((previous) => ({ ...previous, [node.id]: image }));
      };
      image.onerror = () => {
        if (cancelled) return;
        setImagesById((previous) => ({ ...previous, [node.id]: undefined }));
      };
      image.src = node.src as string;
      nextImages[node.id] = undefined;
    });

    setImagesById(nextImages);

    return () => {
      cancelled = true;
    };
  }, [normalizedCanvas.nodes]);

  const scale = cardWidth > 0 ? Math.min(1, viewportWidth / cardWidth) : 1;
  const stageWidth = Math.max(1, Math.round(cardWidth * scale));
  const stageHeight = Math.max(1, Math.round(cardHeight * scale));

  return (
    <div className="w-full" ref={viewportRef}>
      <Stage width={stageWidth} height={stageHeight}>
        <Layer scaleX={scale} scaleY={scale}>
          <Rect x={0} y={0} width={cardWidth} height={cardHeight} fill={normalizedCanvas.backgroundColor ?? '#ffffff'} />
          {normalizedCanvas.nodes.map((node) => renderNode(node, cardWidth, textTransform, imagesById))}
        </Layer>
      </Stage>
    </div>
  );
}