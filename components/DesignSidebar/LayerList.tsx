'use client';

import { CanvasNode } from '@/lib/types/domain';
import { Button } from '@/components/Common/Button';

type Props = {
  nodes: CanvasNode[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onToggleLock: (id: string) => void;
  onToggleVisibility: (id: string) => void;
};

export function LayerList({ nodes, selectedIds, onSelect, onMove, onToggleLock, onToggleVisibility }: Props) {
  return (
    <section className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="text-sm font-semibold">Layers</h3>
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {nodes
          .map((node, index) => ({ node, index }))
          .reverse()
          .map(({ node, index }) => {
            const selected = selectedIds.includes(node.id);
            return (
              <li key={node.id} className="flex items-center gap-1">
                <button
                  className={`focus-ring flex-1 rounded px-2 py-1 text-left text-xs ${selected ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}
                  onClick={() => onSelect(node.id)}
                >
                  {index}. {node.type}
                </button>
                <Button variant="ghost" onClick={() => onMove(node.id, 'up')}>
                  ↑
                </Button>
                <Button variant="ghost" onClick={() => onMove(node.id, 'down')}>
                  ↓
                </Button>
                <Button variant="ghost" onClick={() => onToggleLock(node.id)}>
                  {node.locked ? '🔒' : '🔓'}
                </Button>
                <Button variant="ghost" onClick={() => onToggleVisibility(node.id)}>
                  {node.hidden ? '🙈' : '👁️'}
                </Button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
