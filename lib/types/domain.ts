export type Visibility = 'private' | 'unlisted' | 'public';

export type AnswerType = 'freeform' | 'mcq' | 'cloze' | 'dropdown' | 'multiselect';

export type FillStyle = {
  enabled: boolean;
  color: string;
  opacity: number;
};

export type StrokeStyle = {
  enabled: boolean;
  color: string;
  width: number;
  opacity: number;
  dash?: number[];
};

type CanvasNodeBase = {
  id: string;
  x: number;
  y: number;
  rotation?: number;
  locked?: boolean;
  hidden?: boolean;
};

export type TextNode = CanvasNodeBase & {
  type: 'text';
  text?: string;
  width?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  fill?: FillStyle;
  // Compatibility with older serialized canvases.
  legacyFill?: string;
};

export type RectNode = CanvasNodeBase & {
  type: 'rect';
  width?: number;
  height?: number;
  fill?: FillStyle;
  stroke?: StrokeStyle;
  // Compatibility with older serialized canvases.
  legacyFill?: string;
  legacyStroke?: string;
};

export type CircleNode = CanvasNodeBase & {
  type: 'circle';
  radius?: number;
  fill?: FillStyle;
  stroke?: StrokeStyle;
  // Compatibility with older serialized canvases.
  legacyFill?: string;
  legacyStroke?: string;
};

export type LineNode = CanvasNodeBase & {
  type: 'line';
  points?: number[];
  stroke?: StrokeStyle;
  // Compatibility with older serialized canvases.
  legacyStroke?: string;
};

export type ImageNode = CanvasNodeBase & {
  type: 'image';
  width?: number;
  height?: number;
  src?: string;
  assetPath?: string;
  assetMimeType?: string;
  assetFileName?: string;
  // Optional icon metadata for editable vector icons serialized as SVG data URLs.
  iconName?: string;
  iconColor?: string;
  iconStrokeWidth?: number;
  iconStrokeOpacity?: number;
};

export type GroupNode = CanvasNodeBase & {
  type: 'group';
  width?: number;
  height?: number;
  children?: CanvasNode[];
};

export type CanvasNode = TextNode | RectNode | CircleNode | LineNode | ImageNode | GroupNode;

export interface CanvasState {
  width: number;
  height: number;
  backgroundColor?: string;
  nodes: CanvasNode[];
}

export interface CardRecord {
  id: string;
  set_id: string;
  title: string;
  canvas_json: CanvasState;
  order_index: number;
}
