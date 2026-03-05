'use client';

import { Input } from '@/components/Common/Input';
import { clozePlaceholderIds } from '@/lib/utils/answerEvaluation';

type Props = {
  template: string;
  acceptedByBlank: string[];
  onChange: (next: { template: string; acceptedByBlank: string[] }) => void;
  templateLocked?: boolean;
};

const remapAcceptedByPlaceholder = (
  previousTemplate: string,
  nextTemplate: string,
  previousAcceptedByBlank: string[]
) => {
  const previousIds = clozePlaceholderIds(previousTemplate);
  const nextIds = clozePlaceholderIds(nextTemplate);
  const previousById = new Map<number, string>();

  previousIds.forEach((id, index) => {
    previousById.set(id, previousAcceptedByBlank[index] ?? '');
  });

  return nextIds.map((id) => previousById.get(id) ?? '');
};

export function ClozeEditor({ template, acceptedByBlank, onChange, templateLocked = false }: Props) {
  const placeholderIds = clozePlaceholderIds(template);

  return (
    <div className="space-y-2">
      <Input
        aria-label="Cloze template"
        value={template}
        onChange={(e) =>
          onChange({
            template: e.target.value,
            acceptedByBlank: remapAcceptedByPlaceholder(template, e.target.value, acceptedByBlank)
          })
        }
        placeholder="Example: DNA is {{1}}"
        disabled={templateLocked}
      />
      <p className="text-xs text-slate-500">Use placeholders like {`{{1}}`}, {`{{2}}`} in the prompt text.</p>
      {placeholderIds.map((placeholderId, index) => (
        <Input
          key={placeholderId}
          aria-label={`Accepted answers blank ${placeholderId}`}
          value={acceptedByBlank[index] ?? ''}
          onChange={(e) => {
            const next = [...acceptedByBlank];
            next[index] = e.target.value;
            onChange({ template, acceptedByBlank: next });
          }}
          placeholder={`Blank ${placeholderId}: answer1,answer2`}
        />
      ))}
    </div>
  );
}
