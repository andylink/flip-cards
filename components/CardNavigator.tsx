'use client';

import { Button } from '@/components/Common/Button';

type Props = {
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function CardNavigator({ index, total, onPrevious, onNext, onAdd, onDuplicate, onDelete }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-700">
      <span className="mr-2 text-sm">
        Card {index + 1} / {total}
      </span>
      <Button onClick={onPrevious} disabled={index === 0} variant="secondary">
        Prev
      </Button>
      <Button onClick={onNext} disabled={index >= total - 1} variant="secondary">
        Next
      </Button>
      <Button onClick={onAdd}>Add</Button>
      <Button onClick={onDuplicate} variant="secondary">
        Duplicate
      </Button>
      <Button onClick={onDelete} variant="danger">
        Delete
      </Button>
    </div>
  );
}
