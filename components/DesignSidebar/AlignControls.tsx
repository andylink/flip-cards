'use client';

import { Button } from '@/components/Common/Button';

type Props = {
  onAlign: (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
};

export function AlignControls({ onAlign }: Props) {
  return (
    <section className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="text-sm font-semibold">Align</h3>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={() => onAlign('left')}>
          Left
        </Button>
        <Button variant="secondary" onClick={() => onAlign('center')}>
          Center
        </Button>
        <Button variant="secondary" onClick={() => onAlign('right')}>
          Right
        </Button>
        <Button variant="secondary" onClick={() => onAlign('top')}>
          Top
        </Button>
        <Button variant="secondary" onClick={() => onAlign('middle')}>
          Middle
        </Button>
        <Button variant="secondary" onClick={() => onAlign('bottom')}>
          Bottom
        </Button>
      </div>
    </section>
  );
}
