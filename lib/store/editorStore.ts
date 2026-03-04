import { create } from 'zustand';
import { CanvasState } from '@/lib/types/domain';

const MAX_HISTORY = 100;

const defaultCanvas: CanvasState = {
  width: 1024,
  height: 576,
  nodes: []
};

type EditorStore = {
  canvas: CanvasState;
  selectedIds: string[];
  history: CanvasState[];
  future: CanvasState[];
  lastModifiedAt: number | null;
  setCanvas: (nextCanvas: CanvasState, trackHistory?: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  applyTemplate: (templateCanvas: CanvasState) => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  markPersisted: () => void;
};

const clone = (canvas: CanvasState): CanvasState => JSON.parse(JSON.stringify(canvas));

export const useEditorStore = create<EditorStore>((set, get) => ({
  canvas: defaultCanvas,
  selectedIds: [],
  history: [],
  future: [],
  lastModifiedAt: null,
  setCanvas: (nextCanvas, trackHistory = true) =>
    set((state) => ({
      canvas: clone(nextCanvas),
      history: trackHistory
        ? [...state.history, clone(state.canvas)].slice(-MAX_HISTORY)
        : state.history,
      future: trackHistory ? [] : state.future,
      lastModifiedAt: Date.now()
    })),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  undo: () => {
    const { history, canvas, future } = get();
    const previous = history.at(-1);
    if (!previous) return;

    set({
      canvas: clone(previous),
      history: history.slice(0, -1),
      future: [clone(canvas), ...future]
    });
  },
  redo: () => {
    const { future, canvas, history } = get();
    const next = future.at(0);
    if (!next) return;

    set({
      canvas: clone(next),
      future: future.slice(1),
      history: [...history, clone(canvas)].slice(-MAX_HISTORY)
    });
  },
  applyTemplate: (templateCanvas) => {
    get().setCanvas(templateCanvas, true);
  },
  duplicateSelection: () => {
    const state = get();
    const selected = new Set(state.selectedIds);
    const duplicates = state.canvas.nodes
      .filter((node) => selected.has(node.id))
      .map((node) => ({ ...node, id: crypto.randomUUID(), x: node.x + 16, y: node.y + 16 }));

    if (duplicates.length === 0) return;

    get().setCanvas({
      ...state.canvas,
      nodes: [...state.canvas.nodes, ...duplicates]
    });
    set({ selectedIds: duplicates.map((d) => d.id) });
  },
  deleteSelection: () => {
    const state = get();
    const selected = new Set(state.selectedIds);
    if (selected.size === 0) return;

    get().setCanvas({
      ...state.canvas,
      nodes: state.canvas.nodes.filter((node) => !selected.has(node.id))
    });
    set({ selectedIds: [] });
  },
  markPersisted: () => set({ lastModifiedAt: null })
}));
