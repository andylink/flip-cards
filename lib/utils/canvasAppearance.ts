import { CanvasNode, CanvasState, FillStyle, StrokeStyle } from '@/lib/types/domain';

const DEFAULT_TEXT_FILL: FillStyle = {
  enabled: true,
  color: '#0f172a',
  opacity: 1
};

const DEFAULT_SHAPE_FILL: FillStyle = {
  enabled: true,
  color: '#dbeafe',
  opacity: 1
};

const DEFAULT_SHAPE_STROKE: StrokeStyle = {
  enabled: false,
  color: '#334155',
  width: 2,
  opacity: 1
};

const DEFAULT_LINE_STROKE: StrokeStyle = {
  enabled: true,
  color: '#334155',
  width: 3,
  opacity: 1
};

const clampOpacity = (value: unknown, fallback = 1): number => {
  const next = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(1, Math.max(0, next));
};

const normalizeFill = (value: unknown, fallback: FillStyle): FillStyle => {
  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }

  const candidate = value as Partial<FillStyle>;
  return {
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : fallback.enabled,
    color: typeof candidate.color === 'string' ? candidate.color : fallback.color,
    opacity: clampOpacity(candidate.opacity, fallback.opacity)
  };
};

const normalizeStroke = (value: unknown, fallback: StrokeStyle): StrokeStyle => {
  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }

  const candidate = value as Partial<StrokeStyle>;
  return {
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : fallback.enabled,
    color: typeof candidate.color === 'string' ? candidate.color : fallback.color,
    width: typeof candidate.width === 'number' && Number.isFinite(candidate.width) ? Math.max(0, candidate.width) : fallback.width,
    opacity: clampOpacity(candidate.opacity, fallback.opacity),
    dash: Array.isArray(candidate.dash) ? candidate.dash.filter((part): part is number => typeof part === 'number' && Number.isFinite(part) && part >= 0) : undefined
  };
};

const hexToRgba = (hex: string, opacity: number): string => {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const red = Number.parseInt(clean.slice(0, 2), 16);
  const green = Number.parseInt(clean.slice(2, 4), 16);
  const blue = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${clampOpacity(opacity)})`;
};

const legacyColor = (node: unknown, field: 'fill' | 'stroke'): string | null => {
  if (!node || typeof node !== 'object') return null;
  const value = (node as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : null;
};

export function normalizeCanvasNode(rawNode: CanvasNode): CanvasNode {
  if (rawNode.type === 'text') {
    const legacyFillValue = legacyColor(rawNode, 'fill');
    const nextFill = normalizeFill(rawNode.fill, {
      ...DEFAULT_TEXT_FILL,
      color: legacyFillValue ?? DEFAULT_TEXT_FILL.color
    });

    return {
      ...rawNode,
      fill: nextFill
    };
  }

  if (rawNode.type === 'rect' || rawNode.type === 'circle') {
    const legacyFillValue = legacyColor(rawNode, 'fill');
    const legacyStrokeValue = legacyColor(rawNode, 'stroke');

    const nextFill = normalizeFill((rawNode as { fill?: unknown }).fill, {
      ...DEFAULT_SHAPE_FILL,
      color: legacyFillValue ?? DEFAULT_SHAPE_FILL.color
    });
    const nextStroke = normalizeStroke((rawNode as { stroke?: unknown }).stroke, {
      ...DEFAULT_SHAPE_STROKE,
      color: legacyStrokeValue ?? DEFAULT_SHAPE_STROKE.color
    });

    return {
      ...rawNode,
      fill: nextFill,
      stroke: nextStroke
    };
  }

  if (rawNode.type === 'line') {
    const legacyStrokeValue = legacyColor(rawNode, 'stroke');
    return {
      ...rawNode,
      stroke: normalizeStroke(rawNode.stroke, {
        ...DEFAULT_LINE_STROKE,
        color: legacyStrokeValue ?? DEFAULT_LINE_STROKE.color
      })
    };
  }

  return rawNode;
}

export function normalizeCanvasState(canvas: CanvasState): CanvasState {
  return {
    ...canvas,
    nodes: (canvas.nodes ?? []).map((node) => normalizeCanvasNode(node))
  };
}

export function getNodeFillColor(node: CanvasNode, fallback: string): string {
  if (node.type === 'line' || node.type === 'image' || node.type === 'group') {
    return fallback;
  }

  return node.fill?.color ?? fallback;
}

export function toKonvaFill(node: CanvasNode, fallback: string): { fillEnabled: boolean; fill?: string } {
  if (node.type === 'line' || node.type === 'image' || node.type === 'group') {
    return { fillEnabled: false };
  }

  const fill = node.fill ?? { enabled: true, color: fallback, opacity: 1 };
  return {
    fillEnabled: fill.enabled,
    fill: fill.enabled ? hexToRgba(fill.color, fill.opacity) : undefined
  };
}

export function toKonvaStroke(node: CanvasNode, fallbackColor: string, fallbackWidth: number): {
  strokeEnabled: boolean;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
} {
  if (node.type !== 'rect' && node.type !== 'circle' && node.type !== 'line') {
    return { strokeEnabled: false };
  }

  const stroke =
    node.type === 'line'
      ? node.stroke ?? { ...DEFAULT_LINE_STROKE, color: fallbackColor, width: fallbackWidth }
      : node.stroke ?? { ...DEFAULT_SHAPE_STROKE, color: fallbackColor, width: fallbackWidth };

  return {
    strokeEnabled: stroke.enabled,
    stroke: stroke.enabled ? hexToRgba(stroke.color, stroke.opacity) : undefined,
    strokeWidth: stroke.enabled ? Math.max(0, stroke.width) : undefined,
    dash: stroke.enabled ? stroke.dash : undefined
  };
}

export const CanvasAppearanceDefaults = {
  textFill: DEFAULT_TEXT_FILL,
  shapeFill: DEFAULT_SHAPE_FILL,
  shapeStroke: DEFAULT_SHAPE_STROKE,
  lineStroke: DEFAULT_LINE_STROKE
};
