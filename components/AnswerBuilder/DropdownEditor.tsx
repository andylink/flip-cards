'use client';

import { Input } from '@/components/Common/Input';
import { clozeTokens } from '@/lib/utils/answerEvaluation';

type Blank = {
  optionsCsv: string;
  correctIndex: number;
};

type Props = {
  template: string;
  blanks: Blank[];
  onChange: (next: { template: string; blanks: Blank[] }) => void;
};

export function DropdownEditor({ template, blanks, onChange }: Props) {
  const blankCount = clozeTokens(template).length;

  return (
    <div className="space-y-2">
      <Input
        value={template}
        onChange={(e) => onChange({ template: e.target.value, blanks })}
        placeholder="The planet is {{blank}}"
      />
      {Array.from({ length: blankCount }).map((_, index) => {
        const blank = blanks[index] ?? { optionsCsv: '', correctIndex: 0 };
        return (
          <div className="rounded border border-slate-200 p-2 dark:border-slate-700" key={index}>
            <Input
              value={blank.optionsCsv}
              onChange={(e) => {
                const next = [...blanks];
                next[index] = { ...blank, optionsCsv: e.target.value };
                onChange({ template, blanks: next });
              }}
              placeholder="option1,option2,option3"
            />
            <Input
              type="number"
              min={0}
              value={blank.correctIndex}
              onChange={(e) => {
                const next = [...blanks];
                next[index] = { ...blank, correctIndex: Number(e.target.value) };
                onChange({ template, blanks: next });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
