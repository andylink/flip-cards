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
  const maxCorrectIndex = Math.max(choices.length - 1, 0);
  const safeCorrectIndex = Math.min(correctIndex, maxCorrectIndex);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor="mcq-correct-choice">
          Correct answer
        </label>
        <select
          id="mcq-correct-choice"
          className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={safeCorrectIndex}
          onChange={(e) => onChange({ choices, correctIndex: Number(e.target.value), shuffle })}
          aria-label="MCQ correct choice"
        >
          {choices.map((choice, index) => (
            <option key={`correct-choice-${index}`} value={index}>
              {choice.trim() ? `Choice ${index + 1}: ${choice}` : `Choice ${index + 1}`}
            </option>
          ))}
        </select>
      </div>
      {choices.map((choice, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="min-w-16 text-xs font-medium text-slate-500 dark:text-slate-400">Choice {index + 1}</span>
          <Input
            value={choice}
            onChange={(e) => {
              const nextChoices = [...choices];
              nextChoices[index] = e.target.value;
              onChange({ choices: nextChoices, correctIndex: safeCorrectIndex, shuffle });
            }}
            placeholder={`Choice ${index + 1}`}
            aria-label={`Choice ${index + 1}`}
          />
          <button
            type="button"
            className="focus-ring rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => {
              if (choices.length <= 2) return;
              const nextChoices = choices.filter((_, choiceIndex) => choiceIndex !== index);
              const nextCorrectIndex =
                safeCorrectIndex > index
                  ? safeCorrectIndex - 1
                  : Math.min(safeCorrectIndex, Math.max(nextChoices.length - 1, 0));
              onChange({ choices: nextChoices, correctIndex: nextCorrectIndex, shuffle });
            }}
            disabled={choices.length <= 2}
            aria-label={`Remove choice ${index + 1}`}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="focus-ring rounded bg-slate-200 px-3 py-2 text-sm dark:bg-slate-700"
        onClick={() => onChange({ choices: [...choices, ''], correctIndex: safeCorrectIndex, shuffle })}
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
