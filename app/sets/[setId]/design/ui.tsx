'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { CanvasState, CardRecord } from '@/lib/types/domain';
import { useEditorStore } from '@/lib/store/editorStore';
import { CardNavigator } from '@/components/CardNavigator';
import { AlignControls, ImageTool, LayerList, ShapeTool, TemplateControls, TextTool } from '@/components/DesignSidebar';
import { AdsSlot } from '@/components/AdsSlot';

const CanvasStage = dynamic(
  () => import('@/components/CanvasStage').then((module) => module.CanvasStage),
  { ssr: false }
);

type Props = {
  setId: string;
  setTitle: string;
  initialCards: CardRecord[];
};

const emptyCanvas: CanvasState = {
  width: 1024,
  height: 576,
  nodes: []
};

export function DesignClient({ setId, setTitle, initialCards }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [cards, setCards] = useState<CardRecord[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [templateName, setTemplateName] = useState('');
  const [textSettings, setTextSettings] = useState({ text: 'New text', fontSize: 32, fontWeight: '400', color: '#0f172a' });

  const currentCard = cards[currentIndex];
  const canvas = useEditorStore((state) => state.canvas);
  const setCanvas = useEditorStore((state) => state.setCanvas);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const setSelectedIds = useEditorStore((state) => state.setSelectedIds);
  const duplicateSelection = useEditorStore((state) => state.duplicateSelection);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const lastModifiedAt = useEditorStore((state) => state.lastModifiedAt);
  const markPersisted = useEditorStore((state) => state.markPersisted);

  useEffect(() => {
    if (!currentCard) {
      setCanvas(emptyCanvas, false);
      return;
    }

    setCanvas(currentCard.canvas_json, false);
  }, [currentCard, setCanvas]);

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

  const addCard = async () => {
    const orderIndex = cards.length;
    const { data } = await supabase
      .from('cards')
      .insert({ set_id: setId, title: `Card ${orderIndex + 1}`, canvas_json: emptyCanvas, order_index: orderIndex })
      .select('id,title,canvas_json,order_index,set_id')
      .single();

    if (data) {
      setCards((prev) => [...prev, data]);
      setCurrentIndex(orderIndex);
    }
  };

  const upsertNode = (node: CanvasState['nodes'][number]) => {
    setCanvas({ ...canvas, nodes: [...canvas.nodes, node] });
  };

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    const current = [...canvas.nodes];
    const index = current.findIndex((node) => node.id === id);
    if (index < 0) return;
    const nextIndex = direction === 'up' ? Math.min(current.length - 1, index + 1) : Math.max(0, index - 1);
    const [item] = current.splice(index, 1);
    current.splice(nextIndex, 0, item);
    setCanvas({ ...canvas, nodes: current });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Design View · {setTitle}</h1>
      <CardNavigator
        index={currentIndex}
        total={Math.max(cards.length, 1)}
        onPrevious={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
        onNext={() => setCurrentIndex((index) => Math.min(index + 1, cards.length - 1))}
        onAdd={addCard}
        onDuplicate={duplicateSelection}
        onDelete={deleteSelection}
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <TextTool
            text={textSettings.text}
            fontSize={textSettings.fontSize}
            fontWeight={textSettings.fontWeight}
            color={textSettings.color}
            onTextChange={(text) => setTextSettings((previous) => ({ ...previous, text }))}
            onFontSizeChange={(fontSize) => setTextSettings((previous) => ({ ...previous, fontSize }))}
            onFontWeightChange={(fontWeight) => setTextSettings((previous) => ({ ...previous, fontWeight }))}
            onColorChange={(color) => setTextSettings((previous) => ({ ...previous, color }))}
          />
          <ShapeTool
            onAddRect={() => upsertNode({ id: crypto.randomUUID(), type: 'rect', x: 80, y: 80, width: 180, height: 100 })}
            onAddCircle={() => upsertNode({ id: crypto.randomUUID(), type: 'circle', x: 120, y: 120, radius: 50 })}
            onAddLine={() => upsertNode({ id: crypto.randomUUID(), type: 'line', x: 150, y: 150, points: [0, 0, 140, 0] })}
          />
          <ImageTool
            onImageUrlSubmit={(src) =>
              upsertNode({ id: crypto.randomUUID(), type: 'image', x: 120, y: 120, width: 220, height: 140, src })
            }
          />
          <AlignControls onAlign={() => undefined} />
          <LayerList
            nodes={canvas.nodes}
            selectedIds={selectedIds}
            onSelect={(id) => setSelectedIds([id])}
            onMove={moveLayer}
            onToggleLock={(id) =>
              setCanvas({
                ...canvas,
                nodes: canvas.nodes.map((node) => (node.id === id ? { ...node, locked: !node.locked } : node))
              })
            }
            onToggleVisibility={(id) =>
              setCanvas({
                ...canvas,
                nodes: canvas.nodes.map((node) => (node.id === id ? { ...node, hidden: !node.hidden } : node))
              })
            }
          />
          <TemplateControls
            templateName={templateName}
            onTemplateNameChange={setTemplateName}
            onSaveTemplate={async () => {
              if (!templateName.trim()) return;
              await supabase.from('templates').insert({ name: templateName, canvas_json: canvas });
            }}
            onApplyTemplate={() => {
              // TODO: Fetch and apply selected template from DB picker.
            }}
          />
          <AdsSlot />
        </aside>
        <div className="space-y-2">
          <button
            className="focus-ring rounded-md bg-blue-600 px-3 py-2 text-sm text-white"
            onClick={() =>
              upsertNode({
                id: crypto.randomUUID(),
                type: 'text',
                x: 120,
                y: 120,
                text: textSettings.text,
                fontSize: textSettings.fontSize,
                fontWeight: textSettings.fontWeight,
                fill: textSettings.color
              })
            }
          >
            Add text
          </button>
          <CanvasStage
            canvas={canvas}
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
            onCanvasChange={(nextCanvas) => setCanvas(nextCanvas)}
          />
        </div>
      </div>
    </div>
  );
}
