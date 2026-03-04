export type Visibility = 'private' | 'unlisted' | 'public';

export type AnswerType = 'freeform' | 'mcq' | 'cloze' | 'dropdown' | 'multiselect';

export interface CanvasNode {
  id: string;
  type: 'text' | 'rect' | 'circle' | 'line' | 'image' | 'group';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  text?: string;
  src?: string;
  fontSize?: number;
  fontWeight?: string;
  fill?: string;
  stroke?: string;
  rotation?: number;
  locked?: boolean;
  hidden?: boolean;
  children?: CanvasNode[];
}

export interface CanvasState {
  width: number;
  height: number;
  nodes: CanvasNode[];
}

export interface CardRecord {
  id: string;
  set_id: string;
  title: string;
  canvas_json: CanvasState;
  order_index: number;
}
