'use client';

import { Input } from '@/components/Common/Input';
import { clozeTokens } from '@/lib/utils/answerEvaluation';

type Props = {
  template: string;
  acceptedByBlank: string[];
  onChange: (next: { template: string; acceptedByBlank: string[] }) => void;
};

export function ClozeEditor({ template, acceptedByBlank, onChange }: Props) {
  const blanks = clozeTokens(template).length;

  return (
    <div className="space-y-2">
      <Input
        aria-label="Cloze template"
        value={template}
        onChange={(e) => onChange({ template: e.target.value, acceptedByBlank })}
        placeholder="Example: DNA is {{blank}}"
      />
      {Array.from({ length: blanks }).map((_, index) => (
        <Input
          key={index}
          aria-label={`Accepted answers blank ${index + 1}`}
          value={acceptedByBlank[index] ?? ''}
          onChange={(e) => {
            const next = [...acceptedByBlank];
            next[index] = e.target.value;
            onChange({ template, acceptedByBlank: next });
          }}
          placeholder={`Blank ${index + 1}: answer1,answer2`}
        />
      ))}
    </div>
  );
}
