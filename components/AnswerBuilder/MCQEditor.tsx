'use client';

import { Input } from '@/components/Common/Input';
import { Toggle } from '@/components/Common/Toggle';

type Props = {
  choices: string[];
  correctIndex: number;
  shuffle: boolean;
  onChange: (next: { choices: string[]; correctIndex: number; shuffle: boolean }) => void;
};

export function MCQEditor({ choices, correctIndex, shuffle, onChange }: Props) {
  return (
    <div className="space-y-2">
      {choices.map((choice, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="radio"
            className="focus-ring"
            checked={correctIndex === index}
            onChange={() => onChange({ choices, correctIndex: index, shuffle })}
            aria-label={`Correct choice ${index + 1}`}
          />
          <Input
            value={choice}
            onChange={(e) => {
              const nextChoices = [...choices];
              nextChoices[index] = e.target.value;
              onChange({ choices: nextChoices, correctIndex, shuffle });
            }}
          />
        </div>
      ))}
      <button
        className="focus-ring rounded bg-slate-200 px-3 py-2 text-sm dark:bg-slate-700"
        onClick={() => onChange({ choices: [...choices, ''], correctIndex, shuffle })}
      >
        Add Choice
      </button>
      <Toggle
        id="shuffle-toggle"
        label="Shuffle choices"
        checked={shuffle}
        onChange={(e) => onChange({ choices, correctIndex, shuffle: e.target.checked })}
      />
    </div>
  );
}
