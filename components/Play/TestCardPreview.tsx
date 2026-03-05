'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Image as KonvaImage } from 'react-konva';
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

function renderNode(
  node: CanvasNode,
  cardWidth: number,
  textTransform: (value: string) => string,
  imagesById: Record<string, HTMLImageElement | undefined>
) {
  if (node.hidden) return null;

  if (node.type === 'text') {
    const fillProps = toKonvaFill(node, '#0f172a');
    const flowWidth = getTextFlowWidth(node.x, cardWidth, node.fontSize ?? 24);
    return (
      <Text
        key={node.id}
        x={node.x}
        y={node.y}
        text={textTransform(node.text ?? '')}
        width={flowWidth}
        wrap="word"
        fontFamily={node.fontFamily ?? 'Arial'}
        fontSize={node.fontSize ?? 24}
        fontStyle={node.fontWeight === '700' ? 'bold' : 'normal'}
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