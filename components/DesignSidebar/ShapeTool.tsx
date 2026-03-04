'use client';

import { Button } from '@/components/Common/Button';

type Props = {
  onAddRect: () => void;
  onAddCircle: () => void;
  onAddLine: () => void;
};

export function ShapeTool({ onAddRect, onAddCircle, onAddLine }: Props) {
  return (
    <section className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="text-sm font-semibold">Shape Tool</h3>
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={onAddRect} variant="secondary">
          Rect
        </Button>
        <Button onClick={onAddCircle} variant="secondary">
          Circle
        </Button>
        <Button onClick={onAddLine} variant="secondary">
          Line
        </Button>
      </div>
    </section>
  );
}
