'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Image as KonvaImage } from 'react-konva';
import { CanvasNode, CanvasState } from '@/lib/types/domain';
import { normalizeCanvasState, toKonvaFill, toKonvaStroke } from '@/lib/utils/canvasAppearance';

type Props = {
  canvas: CanvasState;
};

const FALLBACK_CARD_WIDTH = 720;

function renderNode(node: CanvasNode, imagesById: Record<string, HTMLImageElement | undefined>) {
  if (node.hidden) return null;

  if (node.type === 'text') {
    const fillProps = toKonvaFill(node, '#0f172a');
    return (
      <Text
        key={node.id}
        x={node.x}
        y={node.y}
        text={node.text ?? ''}
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

export function TestCardPreview({ canvas }: Props) {
  const normalizedCanvas = useMemo(() => normalizeCanvasState(canvas), [canvas]);
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
          {normalizedCanvas.nodes.map((node) => renderNode(node, imagesById))}
        </Layer>
      </Stage>
    </div>
  );
}