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
import { Modal } from '@/components/Common/Modal';
import { clozePlaceholderIds, clozeSchema, dropdownSchema, freeFormSchema, mcqSchema } from '@/lib/utils/answerEvaluation';
import { CANVAS_MIN_HEIGHT, CANVAS_MIN_WIDTH, clampPortraitCanvasSize } from '@/lib/utils/canvas';
import { CanvasAppearanceDefaults, getNodeFillColor, normalizeCanvasState } from '@/lib/utils/canvasAppearance';
import { z } from 'zod';

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
const COMMON_COLOR_SWATCHES = [
  '#000000',
  '#ffffff',
  '#334155',
  '#64748b',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899'
];
const STROKE_WIDTH_OPTIONS = [0, 1, 2, 3, 4, 6, 8, 12];
const TEXT_RIGHT_PADDING = 16;

type ColorModalTarget = 'fill' | 'stroke' | 'background' | null;

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

type SavedAssetRecord = {
  id: string;
  name: string;
  node_json: CanvasNode;
  created_at: string;
};

const createNodeId = (prefix = 'node'): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const cloneCanvasNode = (node: CanvasNode): CanvasNode => JSON.parse(JSON.stringify(node));

const getNodeBounds = (node: CanvasNode, canvasWidth: number): NodeBounds | null => {
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
    const minimumWidth = Math.max(96, Math.round(fontSize * 4));
    const flowWidth = Math.max(minimumWidth, canvasWidth - node.x - TEXT_RIGHT_PADDING);
    const averageCharacterWidth = Math.max(1, fontSize * 0.58);
    const charactersPerLine = Math.max(1, Math.floor(flowWidth / averageCharacterWidth));
    const explicitLines = (node.text ?? '').split('\n');
    const wrappedLineCount = explicitLines.reduce((count, line) => {
      return count + Math.max(1, Math.ceil(line.length / charactersPerLine));
    }, 0);
    return {
      x: node.x,
      y: node.y,
      width: flowWidth,
      height: Math.max(fontSize * 1.2, wrappedLineCount * fontSize * 1.2)
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
  sourceNodeId: string | null;
};

type DropdownEditorState = {
  questions: Array<{ prompt: string; optionsCsv: string; correctIndex: number }>;
};

const dropdownEditorSchema = z
  .object({
    questions: z.array(
      z.object({
        prompt: z.string().default(''),
        options: z.array(z.string()).default([]),
        correctIndex: z.number().int().min(0).default(0)
      })
    )
  })
  .or(
    z
      .object({
        template: z.string(),
        blanks: z.array(
          z.object({
            options: z.array(z.string()).default([]),
            correctIndex: z.number().int().min(0).default(0)
          })
        )
      })
      .transform((legacy) => ({
        questions: legacy.blanks.map((blank, index) => ({
          prompt: `Question ${index + 1}`,
          options: blank.options,
          correctIndex: blank.correctIndex
        }))
      }))
  );

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
    acceptedByBlank: [],
    sourceNodeId: null
  },
  dropdown: {
    questions: []
  }
});

const remapAcceptedByPlaceholder = (
  previousTemplate: string,
  nextTemplate: string,
  previousAcceptedByBlank: string[]
): string[] => {
  const previousIds = clozePlaceholderIds(previousTemplate);
  const nextIds = clozePlaceholderIds(nextTemplate);
  const acceptedById = new Map<number, string>();

  previousIds.forEach((id, index) => {
    acceptedById.set(id, previousAcceptedByBlank[index] ?? '');
  });

  return nextIds.map((id) => acceptedById.get(id) ?? '');
};

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
        acceptedByBlank: parsed.data.blanks.map((blank) => blank.accepted.join(',')),
        sourceNodeId: null
      };
    }
    return base;
  }

  if (type === 'dropdown') {
    const parsed = dropdownEditorSchema.safeParse(schemaJson);
    if (parsed.success) {
      base.dropdown = {
        questions: parsed.data.questions.map((question) => ({
          prompt: question.prompt,
          optionsCsv: question.options.join(','),
          correctIndex: question.correctIndex
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
      questions: draft.dropdown.questions
        .filter((question) => question !== undefined)
        .map((question) => ({
          prompt: question.prompt,
          options: question.optionsCsv
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          correctIndex: question.correctIndex
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
  const [editableSetTitle, setEditableSetTitle] = useState(setTitle);
  const [setTitleDraft, setSetTitleDraft] = useState(setTitle);
  const [isEditingSetTitle, setIsEditingSetTitle] = useState(false);
  const [isSavingSetTitle, setIsSavingSetTitle] = useState(false);
  const [setTitleError, setSetTitleError] = useState<string | null>(null);
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
  const [activeColorModal, setActiveColorModal] = useState<ColorModalTarget>(null);
  const [savedAssets, setSavedAssets] = useState<SavedAssetRecord[]>([]);
  const [selectedSavedAssetId, setSelectedSavedAssetId] = useState('');
  const [isLoadingSavedAssets, setIsLoadingSavedAssets] = useState(false);
  const [savedAssetsError, setSavedAssetsError] = useState<string | null>(null);
  const [isSaveAssetModalOpen, setIsSaveAssetModalOpen] = useState(false);
  const [assetNameDraft, setAssetNameDraft] = useState('');
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [saveAssetError, setSaveAssetError] = useState<string | null>(null);

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
    setEditableSetTitle(setTitle);
    if (!isEditingSetTitle) {
      setSetTitleDraft(setTitle);
    }
  }, [isEditingSetTitle, setTitle]);

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
  }, [currentCard?.id]);

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

  useEffect(() => {
    let isMounted = true;

    const loadSavedAssets = async () => {
      setIsLoadingSavedAssets(true);
      setSavedAssetsError(null);

      const { data, error } = await supabase
        .from('set_assets')
        .select('id,name,node_json,created_at')
        .eq('set_id', setId)
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        setSavedAssets([]);
        setSelectedSavedAssetId('');
        setSavedAssetsError(error.message);
        setIsLoadingSavedAssets(false);
        return;
      }

      const nextAssets = (data ?? []).flatMap((asset) => {
        const node = asset.node_json as CanvasNode | null;
        if (!node || typeof node !== 'object' || !('type' in node)) {
          return [] as SavedAssetRecord[];
        }

        return [
          {
            id: asset.id,
            name: asset.name,
            node_json: node,
            created_at: asset.created_at
          }
        ];
      });

      setSavedAssets(nextAssets);
      setSelectedSavedAssetId((current) =>
        current && nextAssets.some((asset) => asset.id === current)
          ? current
          : nextAssets[0]?.id ?? ''
      );
      setIsLoadingSavedAssets(false);
    };

    void loadSavedAssets();

    return () => {
      isMounted = false;
    };
  }, [setId, supabase]);

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

  const duplicateCurrentCard = async () => {
    if (!currentCard) return;

    const orderIndex = cards.length;
    const duplicatedCanvas = normalizeCanvasState(currentCard.canvas_json);
    const duplicateTitle = currentCard.title ? `${currentCard.title} Copy` : `Card ${orderIndex + 1}`;

    const { data: duplicatedCard } = await supabase
      .from('cards')
      .insert({
        set_id: setId,
        title: duplicateTitle,
        canvas_json: duplicatedCanvas,
        order_index: orderIndex
      })
      .select('id,title,canvas_json,order_index,set_id')
      .single();

    if (!duplicatedCard) return;

    const existingAnswer = currentCard.answers?.[0];
    let duplicatedAnswer: { id: string; type: AnswerType; schema_json: unknown } | null = null;

    if (existingAnswer) {
      const { data: answerData } = await supabase
        .from('answers')
        .insert({
          card_id: duplicatedCard.id,
          type: existingAnswer.type,
          schema_json: existingAnswer.schema_json
        })
        .select('id,type,schema_json')
        .single();

      duplicatedAnswer = answerData ?? null;
    }

    setCards((prev) => [
      ...prev,
      {
        ...duplicatedCard,
        answers: duplicatedAnswer ? [duplicatedAnswer] : []
      }
    ]);
    setCurrentIndex(orderIndex);
  };

  const deleteCurrentCard = async () => {
    if (!currentCard) return;

    const deletingCardId = currentCard.id;
    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', deletingCardId)
      .eq('set_id', setId);

    if (error) return;

    const nextCards = cards.filter((card) => card.id !== deletingCardId);
    setCards(nextCards);
    setCurrentIndex((index) => (nextCards.length === 0 ? 0 : Math.min(index, nextCards.length - 1)));
    setSelectedIds([]);
  };

  const selectedSingleNode = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return canvas.nodes.find((node) => node.id === selectedIds[0]) ?? null;
  }, [canvas.nodes, selectedIds]);

  const openSaveAssetModal = () => {
    if (!selectedSingleNode) return;
    setAssetNameDraft(selectedSingleNode.type === 'text' ? 'Text Asset' : `${selectedSingleNode.type} Asset`);
    setSaveAssetError(null);
    setIsSaveAssetModalOpen(true);
  };

  const closeSaveAssetModal = () => {
    if (isSavingAsset) return;
    setIsSaveAssetModalOpen(false);
    setSaveAssetError(null);
  };

  const saveSelectedAsset = async () => {
    if (!selectedSingleNode) {
      setSaveAssetError('Select one element before saving an asset.');
      return;
    }

    const trimmedName = assetNameDraft.trim();
    if (!trimmedName) {
      setSaveAssetError('Asset name is required.');
      return;
    }

    setIsSavingAsset(true);
    setSaveAssetError(null);

    const { data, error } = await supabase
      .from('set_assets')
      .insert({
        set_id: setId,
        name: trimmedName,
        node_json: selectedSingleNode
      })
      .select('id,name,node_json,created_at')
      .single();

    setIsSavingAsset(false);

    if (error || !data) {
      setSaveAssetError(error?.message ?? 'Unable to save asset.');
      return;
    }

    const savedNode = data.node_json as CanvasNode;
    const nextAsset: SavedAssetRecord = {
      id: data.id,
      name: data.name,
      node_json: savedNode,
      created_at: data.created_at
    };

    setSavedAssets((prev) => [nextAsset, ...prev]);
    setSelectedSavedAssetId(nextAsset.id);
    setIsSaveAssetModalOpen(false);
    setAssetNameDraft('');
    setSaveAssetError(null);
  };

  const addSelectedSavedAssetToCanvas = () => {
    const selectedAsset = savedAssets.find((asset) => asset.id === selectedSavedAssetId);
    if (!selectedAsset) return;

    const insertionX = 48 + (canvas.nodes.length % 5) * 12;
    const insertionY = 48 + (canvas.nodes.length % 5) * 12;
    const nextNode = cloneCanvasNode(selectedAsset.node_json);
    const nextNodeId = createNodeId('asset');

    nextNode.id = nextNodeId;
    nextNode.x = insertionX;
    nextNode.y = insertionY;
    nextNode.hidden = false;

    setCanvas({
      ...canvas,
      nodes: [...canvas.nodes, nextNode]
    });
    setSelectedIds([nextNodeId]);
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
  const isShapeToolActive = activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line';
  const hasSelectedShapeNode = canvas.nodes.some(
    (node) => selectedIds.includes(node.id) && (node.type === 'rect' || node.type === 'circle' || node.type === 'line')
  );
  const showShapeAppearanceControls = isShapeToolActive || hasSelectedShapeNode;

  const textNodes = useMemo(
    () => canvas.nodes.filter((node): node is Extract<CanvasNode, { type: 'text' }> => node.type === 'text'),
    [canvas.nodes]
  );

  const selectedTextNode = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    const candidate = canvas.nodes.find((node) => node.id === selectedIds[0]);
    return candidate?.type === 'text' ? candidate : null;
  }, [canvas.nodes, selectedIds]);

  const clozeSourceNode = useMemo(() => {
    if (!answerDraft.cloze.sourceNodeId) return null;
    const candidate = canvas.nodes.find((node) => node.id === answerDraft.cloze.sourceNodeId);
    return candidate?.type === 'text' ? candidate : null;
  }, [answerDraft.cloze.sourceNodeId, canvas.nodes]);

  useEffect(() => {
    if (answerType !== 'cloze') return;
    if (!answerDraft.cloze.sourceNodeId) return;

    const sourceNode = canvas.nodes.find((node) => node.id === answerDraft.cloze.sourceNodeId);
    if (!sourceNode || sourceNode.type !== 'text') {
      setAnswerDraft((prev) => ({
        ...prev,
        cloze: {
          ...prev.cloze,
          sourceNodeId: null
        }
      }));
      return;
    }

    const nextTemplate = sourceNode.text ?? '';
    if (nextTemplate === answerDraft.cloze.template) return;

    setAnswerDraft((prev) => ({
      ...prev,
      cloze: {
        ...prev.cloze,
        template: nextTemplate,
        acceptedByBlank: remapAcceptedByPlaceholder(prev.cloze.template, nextTemplate, prev.cloze.acceptedByBlank)
      }
    }));
    setAnswerLastModifiedAt(Date.now());
  }, [answerDraft.cloze.sourceNodeId, answerDraft.cloze.template, answerType, canvas.nodes]);

  const linkClozeTemplateToSelectedText = () => {
    if (!selectedTextNode) return;
    const nextTemplate = selectedTextNode.text ?? '';

    setAnswerDraft((prev) => ({
      ...prev,
      cloze: {
        ...prev.cloze,
        sourceNodeId: selectedTextNode.id,
        template: nextTemplate,
        acceptedByBlank: remapAcceptedByPlaceholder(prev.cloze.template, nextTemplate, prev.cloze.acceptedByBlank)
      }
    }));
    setAnswerLastModifiedAt(Date.now());
  };

  const unlinkClozeTemplate = () => {
    if (!answerDraft.cloze.sourceNodeId) return;
    setAnswerDraft((prev) => ({
      ...prev,
      cloze: {
        ...prev.cloze,
        sourceNodeId: null
      }
    }));
  };

  const alignSelectedToCanvas = (alignment: CanvasAlignment) => {
    const selected = new Set(selectedIds);
    if (selected.size === 0) return;

    let hasChanges = false;
    const nextNodes = canvas.nodes.map((node) => {
      if (!selected.has(node.id) || node.locked) return node;

      const bounds = getNodeBounds(node, canvas.width);
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

  const getModalState = () => {
    if (activeColorModal === 'fill') {
      return {
        title: 'Pick Fill Color',
        value: selectedPrimaryFillColor,
        onChange: handleFillColorChange
      };
    }

    if (activeColorModal === 'stroke') {
      return {
        title: 'Pick Stroke Color',
        value: shapeSettings.strokeColor,
        onChange: handleStrokeColorChange
      };
    }

    if (activeColorModal === 'background') {
      return {
        title: 'Pick Card Background',
        value: canvas.backgroundColor ?? DEFAULT_CANVAS_BACKGROUND,
        onChange: setCanvasBackgroundColor
      };
    }

    return null;
  };

  const colorModalState = getModalState();

  const cancelSetTitleEdit = () => {
    setIsEditingSetTitle(false);
    setSetTitleDraft(editableSetTitle);
    setSetTitleError(null);
  };

  const persistSetTitle = async () => {
    const trimmedTitle = setTitleDraft.trim();

    if (!trimmedTitle) {
      setSetTitleError('Set title cannot be empty.');
      return;
    }

    if (trimmedTitle === editableSetTitle) {
      setIsEditingSetTitle(false);
      setSetTitleError(null);
      return;
    }

    setIsSavingSetTitle(true);
    setSetTitleError(null);

    const { data, error } = await supabase
      .from('sets')
      .update({ title: trimmedTitle })
      .eq('id', setId)
      .select('title')
      .single();

    setIsSavingSetTitle(false);

    if (error) {
      setSetTitleError(error.message);
      return;
    }

    const nextTitle = data?.title ?? trimmedTitle;
    setEditableSetTitle(nextTitle);
    setSetTitleDraft(nextTitle);
    setIsEditingSetTitle(false);
    setSetTitleError(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {!isEditingSetTitle ? (
          <button
            type="button"
            className="group focus-ring inline-flex flex-col items-start gap-1 rounded-md px-1 py-1 text-left"
            onClick={() => {
              setIsEditingSetTitle(true);
              setSetTitleError(null);
            }}
            aria-label="Rename set title"
            title="Click to rename set"
          >
            <h1 className="text-2xl font-semibold group-hover:underline group-focus-visible:underline">{editableSetTitle}</h1>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 transition group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 20h4l10.5-10.5a1.4 1.4 0 0 0 0-2L16.5 5.5a1.4 1.4 0 0 0-2 0L4 16v4z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Click title to rename
            </span>
          </button>
        ) : (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="set-title-input">
              Design View title
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="set-title-input"
                value={setTitleDraft}
                onChange={(event) => {
                  setSetTitleDraft(event.target.value);
                  if (setTitleError) setSetTitleError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void persistSetTitle();
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelSetTitleEdit();
                  }
                }}
                aria-label="Set title"
                autoFocus
                disabled={isSavingSetTitle}
              />
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={() => void persistSetTitle()} disabled={isSavingSetTitle}>
                  {isSavingSetTitle ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="secondary" onClick={cancelSetTitleEdit} disabled={isSavingSetTitle}>
                  Cancel
                </Button>
              </div>
            </div>
            {setTitleError ? <p className="text-sm text-rose-600 dark:text-rose-400">{setTitleError}</p> : null}
          </div>
        )}
      </div>
      <CardNavigator
        index={currentIndex}
        total={Math.max(cards.length, 1)}
        onPrevious={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
        onNext={() => setCurrentIndex((index) => Math.min(index + 1, cards.length - 1))}
        onAdd={addCard}
        onDuplicate={duplicateCurrentCard}
        onDelete={deleteCurrentCard}
      />
      
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_420px]">
        <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
           <div className="mb-3 space-y-2 rounded-md border border-slate-200 p-2 dark:border-slate-700">
               
                <button
                  type="button"
                  className="focus-ring inline-flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  onClick={() => setActiveColorModal('background')}
                  aria-label="Open card background color picker"
                >
                  <span>Card background color</span>
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 rounded border border-slate-300 dark:border-slate-500"
                    style={{ backgroundColor: canvas.backgroundColor ?? DEFAULT_CANVAS_BACKGROUND }}
                  />
                </button>
             
              </div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
            <Button
              variant={activeTool === 'select' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('select')}
              aria-label="Select tool"
              title="Select"
              className="h-9 w-full px-0 py-0"
            >
              <span className="flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 3l14 9-6 1 3 7-3 1-3-7-5 4V3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Button>
            <Button
              variant={activeTool === 'move' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('move')}
              aria-label="Move tool"
              title="Move"
              className="h-9 w-full px-0 py-0"
            >
              <span className="flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m12 3 3 3m-3-3-3 3M12 21l3-3m-3 3-3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Button>
            <Button
              variant={activeTool === 'text' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('text')}
              aria-label="Text tool"
              title="Text"
              className="h-9 w-full px-0 py-0"
            >
              <span className="flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 6h16M12 6v12M8 18h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Button>
            <Button
              variant={activeTool === 'rect' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('rect')}
              aria-label="Rectangle tool"
              title="Rectangle"
              className="h-9 w-full px-0 py-0"
            >
              <span className="flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="5" y="6" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="2" />
                </svg>
              </span>
            </Button>
            <Button
              variant={activeTool === 'circle' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('circle')}
              aria-label="Circle tool"
              title="Circle"
              className="h-9 w-full px-0 py-0"
            >
              <span className="flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" />
                </svg>
              </span>
            </Button>
            <Button
              variant={activeTool === 'line' ? 'primary' : 'secondary'}
              onClick={() => setActiveTool('line')}
              aria-label="Line tool"
              title="Line"
              className="h-9 w-full px-0 py-0"
            >
              <span className="flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 18 19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </Button>
            </div>
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
              <button
                type="button"
                className="focus-ring inline-flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => setActiveColorModal('fill')}
                aria-label="Open fill color picker"
              >
                <span>Fill color</span>
                <span
                  aria-hidden="true"
                  className="h-5 w-5 rounded border border-slate-300 dark:border-slate-500"
                  style={{ backgroundColor: selectedPrimaryFillColor }}
                />
              </button>
              {showShapeAppearanceControls ? (
                <>
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
                  <button
                    type="button"
                    className="focus-ring inline-flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    onClick={() => setActiveColorModal('stroke')}
                    aria-label="Open stroke color picker"
                  >
                    <span>Stroke color</span>
                    <span
                      aria-hidden="true"
                      className="h-5 w-5 rounded border border-slate-300 dark:border-slate-500"
                      style={{ backgroundColor: shapeSettings.strokeColor }}
                    />
                  </button>
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
                </>
              ) : null}
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
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={openSaveAssetModal}
                  disabled={!selectedSingleNode}
                >
                  Save Selected as Asset
                </Button>
                <Button variant="danger" className="w-full" onClick={deleteSelection} disabled={selectedIds.length === 0}>
                  Delete Selected
                </Button>
              </div>
            ) : null}
            <div className="space-y-2 rounded-md border border-slate-200 p-2 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved assets</p>
              <Select
                value={selectedSavedAssetId}
                onChange={(event) => setSelectedSavedAssetId(event.target.value)}
                aria-label="Saved assets"
                disabled={isLoadingSavedAssets || savedAssets.length === 0}
              >
                {savedAssets.length === 0 ? (
                  <option value="">No saved assets</option>
                ) : (
                  savedAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))
                )}
              </Select>
              <Button
                variant="secondary"
                className="w-full"
                onClick={addSelectedSavedAssetToCanvas}
                disabled={savedAssets.length === 0 || !selectedSavedAssetId}
              >
                Add Saved Asset
              </Button>
              {isLoadingSavedAssets ? <p className="text-xs text-slate-500">Loading assets...</p> : null}
              {savedAssetsError ? <p className="text-xs text-rose-600 dark:text-rose-400">{savedAssetsError}</p> : null}
            </div>
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
              Limits: {CANVAS_MIN_WIDTH}-{Math.min(canvasBounds.maxWidth, MOBILE_SAFE_CANVAS_MAX_WIDTH)}px wide and{' '}
              {Math.max(CANVAS_MIN_HEIGHT, CANVAS_MIN_WIDTH)}-{Math.min(canvasBounds.maxHeight, MOBILE_SAFE_CANVAS_MAX_HEIGHT)}px tall.
            </p>
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
              <div className="space-y-2">
                <div className="space-y-2 rounded-md border border-slate-200 p-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <p>Write placeholders in your card text as {`{{1}}`}, {`{{2}}`} and link that text node here.</p>
                  <p>Selected text nodes: {textNodes.length}</p>
                  {clozeSourceNode ? (
                    <p className="rounded bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      Linked node text: {(clozeSourceNode.text ?? '').slice(0, 120) || '(empty text node)'}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={linkClozeTemplateToSelectedText}
                      disabled={!selectedTextNode}
                    >
                      Link Selected Text
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={unlinkClozeTemplate}
                      disabled={!answerDraft.cloze.sourceNodeId}
                    >
                      Unlink
                    </Button>
                  </div>
                </div>
                <ClozeEditor
                  template={answerDraft.cloze.template}
                  acceptedByBlank={answerDraft.cloze.acceptedByBlank}
                  templateLocked={Boolean(answerDraft.cloze.sourceNodeId)}
                  onChange={(next) => {
                    setAnswerDraft((prev) => ({
                      ...prev,
                      cloze: {
                        ...next,
                        sourceNodeId: prev.cloze.sourceNodeId
                      }
                    }));
                    setAnswerLastModifiedAt(Date.now());
                  }}
                />
              </div>
            ) : null}
            {answerType === 'dropdown' ? (
              <DropdownEditor
                questions={answerDraft.dropdown.questions}
                onChange={(next) => {
                  setAnswerDraft((prev) => ({ ...prev, dropdown: next }));
                  setAnswerLastModifiedAt(Date.now());
                }}
              />
            ) : null}
          </section>
        </aside>
      </div>
      <Modal
        open={Boolean(colorModalState)}
        title={colorModalState?.title ?? 'Pick Color'}
        onClose={() => setActiveColorModal(null)}
      >
        {colorModalState ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={colorModalState.value}
                onChange={(event) => colorModalState.onChange(event.target.value)}
                aria-label="Color picker"
                className="h-10 w-20 cursor-pointer p-1"
              />
              <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {colorModalState.value}
              </code>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Common colors</p>
              <div className="grid grid-cols-6 gap-2">
                {COMMON_COLOR_SWATCHES.map((color) => (
                  <button
                    key={`${activeColorModal}-${color}`}
                    type="button"
                    aria-label={`Select color ${color}`}
                    title={color}
                    onClick={() => colorModalState.onChange(color)}
                    className="h-8 rounded border border-slate-300 transition hover:scale-[1.03] dark:border-slate-600"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setActiveColorModal(null)}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        open={isSaveAssetModalOpen}
        title="Save Asset"
        onClose={closeSaveAssetModal}
      >
        <div className="space-y-3">
          <Input
            value={assetNameDraft}
            onChange={(event) => {
              setAssetNameDraft(event.target.value);
              if (saveAssetError) setSaveAssetError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void saveSelectedAsset();
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                closeSaveAssetModal();
              }
            }}
            placeholder="Asset name"
            aria-label="Asset name"
            autoFocus
            disabled={isSavingAsset}
          />
          {saveAssetError ? <p className="text-sm text-rose-600 dark:text-rose-400">{saveAssetError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeSaveAssetModal} disabled={isSavingAsset}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void saveSelectedAsset()} disabled={isSavingAsset}>
              {isSavingAsset ? 'Saving...' : 'Save asset'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
