'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { AnswerType, CanvasNode, CanvasState, CardRecord } from '@/lib/types/domain';
import { useEditorStore } from '@/lib/store/editorStore';
import { CardNavigator } from '@/components/CardNavigator';
import { ClozeEditor, DropdownEditor, FreeFormEditor, MCQEditor } from '@/components/AnswerBuilder';
import { Select } from '@/components/Common/Select';
import { Button } from '@/components/Common/Button';
import { Input } from '@/components/Common/Input';
import { clozeSchema, dropdownSchema, freeFormSchema, mcqSchema } from '@/lib/utils/answerEvaluation';
import { CANVAS_MIN_HEIGHT, CANVAS_MIN_WIDTH, clampPortraitCanvasSize } from '@/lib/utils/canvas';
import { CanvasAppearanceDefaults, getNodeFillColor, normalizeCanvasState } from '@/lib/utils/canvasAppearance';

const CanvasStage = dynamic(
  () => import('@/components/CanvasStage').then((module) => module.CanvasStage),
  { ssr: false }
);

type Props = {
  setId: string;
  setTitle: string;
  initialCards: Array<
    CardRecord & {
      answers?: Array<{ id: string; type: AnswerType; schema_json: unknown }>;
    }
  >;
};

type CanvasTool = 'select' | 'move' | 'text' | 'rect' | 'circle' | 'line';

const MOBILE_SAFE_CANVAS_MAX_WIDTH = 720;
const MOBILE_SAFE_CANVAS_MAX_HEIGHT = 1200;
const DEFAULT_PORTRAIT_CANVAS = { width: 720, height: 1080 };
const DEFAULT_CANVAS_BACKGROUND = '#ffffff';

const emptyCanvas: CanvasState = {
  width: DEFAULT_PORTRAIT_CANVAS.width,
  height: DEFAULT_PORTRAIT_CANVAS.height,
  backgroundColor: DEFAULT_CANVAS_BACKGROUND,
  nodes: []
};

const createCanvas = (width: number, height: number): CanvasState => ({
  width,
  height,
  backgroundColor: DEFAULT_CANVAS_BACKGROUND,
  nodes: []
});

const DEFAULT_CANVAS_MAX_WIDTH = 1600;
const DEFAULT_CANVAS_MAX_HEIGHT = 1000;

const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const FONT_OPTIONS = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
  { value: 'Courier New', label: 'Courier New' }
];

const FONT_SIZE_OPTIONS = [16, 20, 24, 28, 32, 40, 48, 56];
const COLOR_SWATCHES = ['#000000', '#1d4ed8', '#059669', '#ea580c', '#be123c', '#7c3aed', '#334155', '#ffffff'];
const STROKE_WIDTH_OPTIONS = [0, 1, 2, 3, 4, 6, 8, 12];

type ShapeSettings = {
  fillEnabled: boolean;
  fillColor: string;
  fillOpacity: number;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
};

type NodeBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CanvasAlignment =
  | 'left'
  | 'h-center'
  | 'right'
  | 'top'
  | 'v-center'
  | 'bottom';

const getNodeBounds = (node: CanvasNode): NodeBounds | null => {
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
};

type FreeformEditorState = {
  accepted: string;
  regex: string;
  trim: boolean;
  caseSensitive: boolean;
};

type McqEditorState = {
  choices: string[];
  correctIndex: number;
  shuffle: boolean;
};

type ClozeEditorState = {
  template: string;
  acceptedByBlank: string[];
};

type DropdownEditorState = {
  template: string;
  blanks: Array<{ optionsCsv: string; correctIndex: number }>;
};

type AnswerDraft = {
  freeform: FreeformEditorState;
  mcq: McqEditorState;
  cloze: ClozeEditorState;
  dropdown: DropdownEditorState;
};

const createDefaultDraft = (): AnswerDraft => ({
  freeform: {
    accepted: '',
    regex: '',
    trim: true,
    caseSensitive: false
  },
  mcq: {
    choices: ['', ''],
    correctIndex: 0,
    shuffle: false
  },
  cloze: {
    template: '',
    acceptedByBlank: []
  },
  dropdown: {
    template: '',
    blanks: []
  }
});

const toEditorDraft = (type: AnswerType, schemaJson: unknown): AnswerDraft => {
  const base = createDefaultDraft();

  if (type === 'freeform') {
    const parsed = freeFormSchema.safeParse(schemaJson);
    if (parsed.success) {
      base.freeform = {
        accepted: parsed.data.accepted.join(','),
        regex: parsed.data.regex ?? '',
        trim: parsed.data.trim,
        caseSensitive: parsed.data.caseSensitive
      };
    }
    return base;
  }

  if (type === 'mcq') {
    const parsed = mcqSchema.safeParse(schemaJson);
    if (parsed.success) {
      base.mcq = {
        choices: parsed.data.choices,
        correctIndex: parsed.data.correctIndex,
        shuffle: parsed.data.shuffle
      };
    }
    return base;
  }

  if (type === 'cloze') {
    const parsed = clozeSchema.safeParse(schemaJson);
    if (parsed.success) {
      base.cloze = {
        template: parsed.data.template,
        acceptedByBlank: parsed.data.blanks.map((blank) => blank.accepted.join(','))
      };
    }
    return base;
  }

  if (type === 'dropdown') {
    const parsed = dropdownSchema.safeParse(schemaJson);
    if (parsed.success) {
      base.dropdown = {
        template: parsed.data.template,
        blanks: parsed.data.blanks.map((blank) => ({
          optionsCsv: blank.options.join(','),
          correctIndex: blank.correctIndex
        }))
      };
    }
  }

  return base;
};

const toPersistedSchema = (type: AnswerType, draft: AnswerDraft): unknown => {
  if (type === 'mcq') {
    return {
      choices: draft.mcq.choices,
      correctIndex: draft.mcq.correctIndex,
      shuffle: draft.mcq.shuffle
    };
  }

  if (type === 'cloze') {
    return {
      template: draft.cloze.template,
      blanks: draft.cloze.acceptedByBlank
        .filter((value) => value !== undefined)
        .map((accepted) => ({
          accepted: accepted
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        }))
    };
  }

  if (type === 'dropdown') {
    return {
      template: draft.dropdown.template,
      blanks: draft.dropdown.blanks
        .filter((blank) => blank !== undefined)
        .map((blank) => ({
          options: blank.optionsCsv
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          correctIndex: blank.correctIndex
        }))
    };
  }

  return {
    accepted: draft.freeform.accepted
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    regex: draft.freeform.regex,
    trim: draft.freeform.trim,
    caseSensitive: draft.freeform.caseSensitive
  };
};

export function DesignClient({ setId, setTitle, initialCards }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [cards, setCards] = useState<Props['initialCards']>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<CanvasTool>('select');
  const [canvasBounds, setCanvasBounds] = useState({ maxWidth: DEFAULT_CANVAS_MAX_WIDTH, maxHeight: DEFAULT_CANVAS_MAX_HEIGHT });
  const [textSettings, setTextSettings] = useState({
    fontFamily: 'Arial',
    fontSize: 32,
    fontWeight: '400',
    color: CanvasAppearanceDefaults.textFill.color
  });
  const [shapeSettings, setShapeSettings] = useState<ShapeSettings>({
    fillEnabled: CanvasAppearanceDefaults.shapeFill.enabled,
    fillColor: CanvasAppearanceDefaults.shapeFill.color,
    fillOpacity: CanvasAppearanceDefaults.shapeFill.opacity,
    strokeEnabled: CanvasAppearanceDefaults.shapeStroke.enabled,
    strokeColor: CanvasAppearanceDefaults.shapeStroke.color,
    strokeWidth: CanvasAppearanceDefaults.shapeStroke.width,
    strokeOpacity: CanvasAppearanceDefaults.shapeStroke.opacity
  });
  const [answerType, setAnswerType] = useState<AnswerType>('freeform');
  const [answerDraft, setAnswerDraft] = useState<AnswerDraft>(createDefaultDraft());
  const [answerLastModifiedAt, setAnswerLastModifiedAt] = useState<number | null>(null);

  const currentCard = cards[currentIndex];
  const canvas = useEditorStore((state) => state.canvas);
  const setCanvas = useEditorStore((state) => state.setCanvas);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const duplicateSelection = useEditorStore((state) => state.duplicateSelection);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const lastModifiedAt = useEditorStore((state) => state.lastModifiedAt);
  const markPersisted = useEditorStore((state) => state.markPersisted);

  const getViewportCanvasBounds = () => {
    if (typeof window === 'undefined') {
      return { maxWidth: DEFAULT_CANVAS_MAX_WIDTH, maxHeight: DEFAULT_CANVAS_MAX_HEIGHT };
    }

    return {
      maxWidth: Math.max(CANVAS_MIN_WIDTH, Math.floor(window.innerWidth - 96)),
      maxHeight: Math.max(CANVAS_MIN_HEIGHT, Math.floor(window.innerHeight - 220))
    };
  };

  const normalizeCanvasSize = (size: { width: number; height: number }) =>
    clampPortraitCanvasSize(size, {
      minWidth: CANVAS_MIN_WIDTH,
      minHeight: Math.max(CANVAS_MIN_HEIGHT, CANVAS_MIN_WIDTH),
      maxWidth: Math.min(canvasBounds.maxWidth, MOBILE_SAFE_CANVAS_MAX_WIDTH),
      maxHeight: Math.min(canvasBounds.maxHeight, MOBILE_SAFE_CANVAS_MAX_HEIGHT)
    });

  useEffect(() => {
    const updateBounds = () => setCanvasBounds(getViewportCanvasBounds());
    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, []);

  useEffect(() => {
    const normalizedEmpty = normalizeCanvasSize(DEFAULT_PORTRAIT_CANVAS);

    if (!currentCard) {
      setCanvas(
        {
          ...emptyCanvas,
          width: normalizedEmpty.width,
          height: normalizedEmpty.height
        },
        false
      );
      return;
    }

    const normalized = normalizeCanvasSize({
      width: currentCard.canvas_json.width,
      height: currentCard.canvas_json.height
    });

    const normalizedCanvas = normalizeCanvasState(currentCard.canvas_json);

    setCanvas(
      {
        ...normalizedCanvas,
        width: normalized.width,
        height: normalized.height
      },
      false
    );
  }, [canvasBounds.maxHeight, canvasBounds.maxWidth, currentCard, setCanvas]);

  useEffect(() => {
    if (!currentCard) {
      setAnswerType('freeform');
      setAnswerDraft(createDefaultDraft());
      setAnswerLastModifiedAt(null);
      return;
    }

    const existing = currentCard.answers?.[0];
    const nextType = existing?.type ?? 'freeform';
    setAnswerType(nextType);
    setAnswerDraft(existing ? toEditorDraft(nextType, existing.schema_json) : createDefaultDraft());
    setAnswerLastModifiedAt(null);
  }, [currentCard]);

  useEffect(() => {
    if (!currentCard || !lastModifiedAt) return;

    const timeout = setTimeout(async () => {
      const { error } = await supabase
        .from('cards')
        .update({ canvas_json: canvas })
        .eq('id', currentCard.id)
        .eq('set_id', setId);

      if (!error) {
        setCards((prev) => prev.map((card) => (card.id === currentCard.id ? { ...card, canvas_json: canvas } : card)));
        markPersisted();
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [canvas, currentCard, lastModifiedAt, markPersisted, setId, supabase]);

  useEffect(() => {
    if (!currentCard || !answerLastModifiedAt) return;

    const schemaJson = toPersistedSchema(answerType, answerDraft);
    const existingAnswer = currentCard.answers?.[0];

    const timeout = setTimeout(async () => {
      if (existingAnswer) {
        const { data, error } = await supabase
          .from('answers')
          .update({ type: answerType, schema_json: schemaJson })
          .eq('id', existingAnswer.id)
          .select('id,type,schema_json')
          .single();

        if (!error && data) {
          setCards((prev) =>
            prev.map((card) => (card.id === currentCard.id ? { ...card, answers: [data] } : card))
          );
          setAnswerLastModifiedAt(null);
        }

        return;
      }

      const { data, error } = await supabase
        .from('answers')
        .insert({ card_id: currentCard.id, type: answerType, schema_json: schemaJson })
        .select('id,type,schema_json')
        .single();

      if (!error && data) {
        setCards((prev) =>
          prev.map((card) => (card.id === currentCard.id ? { ...card, answers: [data] } : card))
        );
        setAnswerLastModifiedAt(null);
      }
    }, 1200);

    return () => clearTimeout(timeout);
  }, [answerDraft, answerLastModifiedAt, answerType, currentCard, supabase]);

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

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        if (selectedIds.length === 0) return;
        event.preventDefault();
        duplicateSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [duplicateSelection, selectedIds]);

  const addCard = async () => {
    const orderIndex = cards.length;
    const normalizedDefault = normalizeCanvasSize(DEFAULT_PORTRAIT_CANVAS);
    const baseCanvas = createCanvas(normalizedDefault.width, normalizedDefault.height);
    const { data } = await supabase
      .from('cards')
      .insert({ set_id: setId, title: `Card ${orderIndex + 1}`, canvas_json: baseCanvas, order_index: orderIndex })
      .select('id,title,canvas_json,order_index,set_id')
      .single();

    if (data) {
      setCards((prev) => [...prev, data]);
      setCurrentIndex(orderIndex);
    }
  };

  const updateSelectedTextNodes = (
    updates: Partial<Pick<Extract<CanvasNode, { type: 'text' }>, 'fontFamily' | 'fontSize' | 'fontWeight' | 'fill'>>
  ) => {
    const selected = new Set(selectedIds);
    if (selected.size === 0) return;

    let hasChanges = false;
    const nextNodes = canvas.nodes.map((node) => {
      if (!selected.has(node.id) || node.type !== 'text') return node;
      hasChanges = true;
      return { ...node, ...updates };
    });

    if (hasChanges) {
      setCanvas({ ...canvas, nodes: nextNodes });
    }
  };

  const applyAppearanceToSelectedNodes = (updates: {
    fill?: Partial<{ enabled: boolean; color: string; opacity: number }>;
    stroke?: Partial<{ enabled: boolean; color: string; width: number; opacity: number }>;
  }) => {
    const selected = new Set(selectedIds);
    if (selected.size === 0) return;

    let hasChanges = false;
    const nextNodes = canvas.nodes.map((node) => {
      if (!selected.has(node.id) || node.locked) return node;

      if (node.type === 'text') {
        if (!updates.fill) return node;
        hasChanges = true;
        return {
          ...node,
          fill: {
            enabled: updates.fill.enabled ?? node.fill?.enabled ?? true,
            color: updates.fill.color ?? node.fill?.color ?? textSettings.color,
            opacity: updates.fill.opacity ?? node.fill?.opacity ?? 1
          }
        };
      }

      if (node.type === 'rect' || node.type === 'circle') {
        hasChanges = true;
        return {
          ...node,
          fill: updates.fill
            ? {
                enabled: updates.fill.enabled ?? node.fill?.enabled ?? shapeSettings.fillEnabled,
                color: updates.fill.color ?? node.fill?.color ?? shapeSettings.fillColor,
                opacity: updates.fill.opacity ?? node.fill?.opacity ?? shapeSettings.fillOpacity
              }
            : node.fill,
          stroke: updates.stroke
            ? {
                enabled: updates.stroke.enabled ?? node.stroke?.enabled ?? shapeSettings.strokeEnabled,
                color: updates.stroke.color ?? node.stroke?.color ?? shapeSettings.strokeColor,
                width: updates.stroke.width ?? node.stroke?.width ?? shapeSettings.strokeWidth,
                opacity: updates.stroke.opacity ?? node.stroke?.opacity ?? shapeSettings.strokeOpacity,
                dash: node.stroke?.dash
              }
            : node.stroke
        };
      }

      if (node.type === 'line') {
        if (!updates.stroke) return node;
        hasChanges = true;
        return {
          ...node,
          stroke: {
            enabled: updates.stroke.enabled ?? node.stroke?.enabled ?? true,
            color: updates.stroke.color ?? node.stroke?.color ?? shapeSettings.strokeColor,
            width: updates.stroke.width ?? node.stroke?.width ?? 3,
            opacity: updates.stroke.opacity ?? node.stroke?.opacity ?? 1,
            dash: node.stroke?.dash
          }
        };
      }

      return node;
    });

    if (hasChanges) {
      setCanvas({ ...canvas, nodes: nextNodes });
    }
  };

  const handleFillColorChange = (color: string) => {
    setTextSettings((previous) => ({ ...previous, color }));
    setShapeSettings((previous) => ({ ...previous, fillColor: color }));
    applyAppearanceToSelectedNodes({ fill: { color } });
  };

  const handleStrokeColorChange = (color: string) => {
    setShapeSettings((previous) => ({ ...previous, strokeColor: color }));
    applyAppearanceToSelectedNodes({ stroke: { color } });
  };

  const handleFillEnabledChange = (enabled: boolean) => {
    setShapeSettings((previous) => ({ ...previous, fillEnabled: enabled }));
    applyAppearanceToSelectedNodes({ fill: { enabled } });
  };

  const handleStrokeEnabledChange = (enabled: boolean) => {
    setShapeSettings((previous) => ({ ...previous, strokeEnabled: enabled }));
    applyAppearanceToSelectedNodes({ stroke: { enabled } });
  };

  const handleFillOpacityChange = (value: number) => {
    const opacity = Math.max(0, Math.min(1, value));
    setShapeSettings((previous) => ({ ...previous, fillOpacity: opacity }));
    applyAppearanceToSelectedNodes({ fill: { opacity } });
  };

  const handleStrokeOpacityChange = (value: number) => {
    const opacity = Math.max(0, Math.min(1, value));
    setShapeSettings((previous) => ({ ...previous, strokeOpacity: opacity }));
    applyAppearanceToSelectedNodes({ stroke: { opacity } });
  };

  const handleStrokeWidthChange = (value: number) => {
    const width = Math.max(0, value);
    setShapeSettings((previous) => ({ ...previous, strokeWidth: width }));
    applyAppearanceToSelectedNodes({ stroke: { width } });
  };

  const selectedPrimaryNode = canvas.nodes.find((node) => selectedIds.includes(node.id));
  const selectedPrimaryFillColor = selectedPrimaryNode
    ? getNodeFillColor(selectedPrimaryNode, textSettings.color)
    : textSettings.color;

  const alignSelectedToCanvas = (alignment: CanvasAlignment) => {
    const selected = new Set(selectedIds);
    if (selected.size === 0) return;

    let hasChanges = false;
    const nextNodes = canvas.nodes.map((node) => {
      if (!selected.has(node.id) || node.locked) return node;

      const bounds = getNodeBounds(node);
      if (!bounds) return node;

      let deltaX = 0;
      let deltaY = 0;

      if (alignment === 'left') {
        deltaX = -bounds.x;
      } else if (alignment === 'h-center') {
        deltaX = canvas.width / 2 - (bounds.x + bounds.width / 2);
      } else if (alignment === 'right') {
        deltaX = canvas.width - (bounds.x + bounds.width);
      } else if (alignment === 'top') {
        deltaY = -bounds.y;
      } else if (alignment === 'v-center') {
        deltaY = canvas.height / 2 - (bounds.y + bounds.height / 2);
      } else if (alignment === 'bottom') {
        deltaY = canvas.height - (bounds.y + bounds.height);
      }

      if (deltaX === 0 && deltaY === 0) return node;
      hasChanges = true;
      return {
        ...node,
        x: node.x + deltaX,
        y: node.y + deltaY
      };
    });

    if (hasChanges) {
      setCanvas({ ...canvas, nodes: nextNodes });
    }
  };

  const setCanvasBackgroundColor = (backgroundColor: string) => {
    if (canvas.backgroundColor === backgroundColor) return;
    setCanvas({ ...canvas, backgroundColor });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold">Design View · {setTitle}</h1>
        <p className="mt-1 text-sm text-slate-500">Build premium cards with a true design workflow: direct editing, structured layers, and precise positioning.</p>
      </div>
      <CardNavigator
        index={currentIndex}
        total={Math.max(cards.length, 1)}
        onPrevious={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
        onNext={() => setCurrentIndex((index) => Math.min(index + 1, cards.length - 1))}
        onAdd={addCard}
        onDuplicate={duplicateSelection}
        onDelete={deleteSelection}
        canDelete={selectedIds.length > 0}
      />
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_420px]">
        <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-3">
            <Button
              variant={activeTool === 'select' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('select')}
              aria-label="Select tool"
              className="w-full"
            >
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 3l14 9-6 1 3 7-3 1-3-7-5 4V3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Select
              </span>
            </Button>
            <Button
              variant={activeTool === 'move' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('move')}
              aria-label="Move tool"
              className="w-full"
            >
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m12 3 3 3m-3-3-3 3M12 21l3-3m-3 3-3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Move
              </span>
            </Button>
            <Button
              variant={activeTool === 'text' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('text')}
              aria-label="Text tool"
              className="w-full"
            >
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 6h16M12 6v12M8 18h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Text
              </span>
            </Button>
            <Button
              variant={activeTool === 'rect' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('rect')}
              aria-label="Rectangle tool"
              className="w-full"
            >
              Rectangle
            </Button>
            <Button
              variant={activeTool === 'circle' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('circle')}
              aria-label="Circle tool"
              className="w-full"
            >
              Circle
            </Button>
            <Button
              variant={activeTool === 'line' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('line')}
              aria-label="Line tool"
              className="w-full"
            >
              Line
            </Button>
            {activeTool === 'text' ? (
              <div className="space-y-2 rounded-md border border-slate-200 p-2 dark:border-slate-700">
                <Select
                  value={textSettings.fontFamily}
                  onChange={(event) => {
                    const fontFamily = event.target.value;
                    setTextSettings((previous) => ({ ...previous, fontFamily }));
                    updateSelectedTextNodes({ fontFamily });
                  }}
                  aria-label="Font family"
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={String(textSettings.fontSize)}
                  onChange={(event) => {
                    const fontSize = parseNumber(event.target.value, textSettings.fontSize);
                    setTextSettings((previous) => ({ ...previous, fontSize }));
                    updateSelectedTextNodes({ fontSize });
                  }}
                  aria-label="Font size"
                >
                  {FONT_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="space-y-2 rounded-md border border-slate-200 p-2 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Appearance</p>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={selectedPrimaryFillColor}
                  onChange={(event) => handleFillColorChange(event.target.value)}
                  aria-label="Fill color"
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <span className="text-xs text-slate-500">Fill color for selected nodes and new text/shapes.</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_SWATCHES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Select fill color ${color}`}
                    title={color}
                    onClick={() => handleFillColorChange(color)}
                    className="h-7 w-full rounded border border-slate-300 transition hover:scale-[1.03] dark:border-slate-600"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <label className="flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                Fill enabled
                <input
                  type="checkbox"
                  checked={shapeSettings.fillEnabled}
                  onChange={(event) => handleFillEnabledChange(event.target.checked)}
                />
              </label>
              <label className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <span>Fill opacity ({Math.round(shapeSettings.fillOpacity * 100)}%)</span>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(shapeSettings.fillOpacity * 100)}
                  onChange={(event) => handleFillOpacityChange(parseNumber(event.target.value, 100) / 100)}
                />
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={shapeSettings.strokeColor}
                  onChange={(event) => handleStrokeColorChange(event.target.value)}
                  aria-label="Stroke color"
                  className="h-10 w-16 cursor-pointer p-1"
                />
                <span className="text-xs text-slate-500">Stroke color for selected shape nodes.</span>
              </div>
              <label className="flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                Stroke enabled
                <input
                  type="checkbox"
                  checked={shapeSettings.strokeEnabled}
                  onChange={(event) => handleStrokeEnabledChange(event.target.checked)}
                />
              </label>
              <label className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <span>Stroke width</span>
                <Select
                  value={String(shapeSettings.strokeWidth)}
                  onChange={(event) => handleStrokeWidthChange(parseNumber(event.target.value, shapeSettings.strokeWidth))}
                >
                  {STROKE_WIDTH_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <span>Stroke opacity ({Math.round(shapeSettings.strokeOpacity * 100)}%)</span>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(shapeSettings.strokeOpacity * 100)}
                  onChange={(event) => handleStrokeOpacityChange(parseNumber(event.target.value, 100) / 100)}
                />
              </label>
            </div>
            {activeTool === 'select' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-700">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => alignSelectedToCanvas('left')}
                    disabled={selectedIds.length === 0}
                    aria-label="Align left to canvas"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 4v16M8 8h12M8 12h9M8 16h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => alignSelectedToCanvas('h-center')}
                    disabled={selectedIds.length === 0}
                    aria-label="Align horizontal center to canvas"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 4v16M4 8h7M13 8h7M6 12h12M4 16h7M13 16h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => alignSelectedToCanvas('right')}
                    disabled={selectedIds.length === 0}
                    aria-label="Align right to canvas"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 4v16M4 8h12M7 12h9M4 16h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => alignSelectedToCanvas('top')}
                    disabled={selectedIds.length === 0}
                    aria-label="Align top to canvas"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 4h16M8 8v12M12 8v9M16 8v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => alignSelectedToCanvas('v-center')}
                    disabled={selectedIds.length === 0}
                    aria-label="Align vertical center to canvas"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 12h16M8 4v7M8 13v7M12 6v12M16 4v7M16 13v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => alignSelectedToCanvas('bottom')}
                    disabled={selectedIds.length === 0}
                    aria-label="Align bottom to canvas"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 20h16M8 4v12M12 7v9M16 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={duplicateSelection}
                  disabled={selectedIds.length === 0}
                >
                  Duplicate Selected
                </Button>
                <Button variant="danger" className="w-full" onClick={deleteSelection} disabled={selectedIds.length === 0}>
                  Delete Selected
                </Button>
              </div>
            ) : null}
          </div>
        </aside>
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:px-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            Active tool: <span className="font-semibold uppercase">{activeTool}</span>
          </div>
          <CanvasStage
            canvas={canvas}
            selectedIds={selectedIds}
            activeTool={activeTool}
            textDefaults={textSettings}
            shapeDefaults={shapeSettings}
            onSelectIds={setSelectedIds}
            onCanvasChange={(nextCanvas) => setCanvas(nextCanvas)}
          />
        </section>
        <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <section className="space-y-2 rounded-md border border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Canvas Sizing</h3>
            <p>The canvas is now auto-sized for portrait layouts and scaled responsively to the current viewport.</p>
            <p>
              Limits: {CANVAS_MIN_WIDTH}-{Math.min(canvasBounds.maxWidth, MOBILE_SAFE_CANVAS_MAX_WIDTH)}px wide and
              {` `}
              {Math.max(CANVAS_MIN_HEIGHT, CANVAS_MIN_WIDTH)}-{Math.min(canvasBounds.maxHeight, MOBILE_SAFE_CANVAS_MAX_HEIGHT)}px tall.
            </p>
          </section>

          <section className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
            <h3 className="text-sm font-semibold">Card Background</h3>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={canvas.backgroundColor ?? DEFAULT_CANVAS_BACKGROUND}
                onChange={(event) => setCanvasBackgroundColor(event.target.value)}
                aria-label="Canvas background color"
                className="h-10 w-16 cursor-pointer p-1"
              />
              <span className="text-xs text-slate-500">Applies to this card only.</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_SWATCHES.map((color) => (
                <button
                  key={`canvas-bg-${color}`}
                  type="button"
                  aria-label={`Set canvas background ${color}`}
                  title={color}
                  onClick={() => setCanvasBackgroundColor(color)}
                  className="h-7 w-full rounded border border-slate-300 transition hover:scale-[1.03] dark:border-slate-600"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </section>

          <section className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
            <h2 className="text-sm font-semibold">Answer Builder</h2>
            <Select
              value={answerType}
              onChange={(event) => {
                setAnswerType(event.target.value as AnswerType);
                setAnswerLastModifiedAt(Date.now());
              }}
            >
              <option value="freeform">Freeform</option>
              <option value="mcq">MCQ</option>
              <option value="cloze">Cloze</option>
              <option value="dropdown">Dropdown</option>
            </Select>
            {answerType === 'freeform' ? (
              <FreeFormEditor
                accepted={answerDraft.freeform.accepted}
                regex={answerDraft.freeform.regex}
                trim={answerDraft.freeform.trim}
                caseSensitive={answerDraft.freeform.caseSensitive}
                onChange={(next) => {
                  setAnswerDraft((prev) => ({ ...prev, freeform: next }));
                  setAnswerLastModifiedAt(Date.now());
                }}
              />
            ) : null}
            {answerType === 'mcq' ? (
              <MCQEditor
                choices={answerDraft.mcq.choices}
                correctIndex={answerDraft.mcq.correctIndex}
                shuffle={answerDraft.mcq.shuffle}
                onChange={(next) => {
                  setAnswerDraft((prev) => ({ ...prev, mcq: next }));
                  setAnswerLastModifiedAt(Date.now());
                }}
              />
            ) : null}
            {answerType === 'cloze' ? (
              <ClozeEditor
                template={answerDraft.cloze.template}
                acceptedByBlank={answerDraft.cloze.acceptedByBlank}
                onChange={(next) => {
                  setAnswerDraft((prev) => ({ ...prev, cloze: next }));
                  setAnswerLastModifiedAt(Date.now());
                }}
              />
            ) : null}
            {answerType === 'dropdown' ? (
              <DropdownEditor
                template={answerDraft.dropdown.template}
                blanks={answerDraft.dropdown.blanks}
                onChange={(next) => {
                  setAnswerDraft((prev) => ({ ...prev, dropdown: next }));
                  setAnswerLastModifiedAt(Date.now());
                }}
              />
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
