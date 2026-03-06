'use client';

import { Input } from '@/components/Common/Input';
import {
  clozePlaceholders,
  hydrateClozeAcceptedByBlank,
  remapClozeAcceptedByPlaceholder
} from '@/lib/utils/answerEvaluation';

type Props = {
  template: string;
  acceptedByBlank: string[];
  onChange: (next: { template: string; acceptedByBlank: string[] }) => void;
  templateLocked?: boolean;
};

export function ClozeEditor({ template, acceptedByBlank, onChange, templateLocked = false }: Props) {
  const placeholders = clozePlaceholders(template);
  const hydratedAcceptedByBlank = hydrateClozeAcceptedByBlank(template, acceptedByBlank);

  return (
    <div className="space-y-2">
      <Input
        aria-label="Cloze template"
        value={template}
        onChange={(e) =>
          onChange({
            template: e.target.value,
            acceptedByBlank: remapClozeAcceptedByPlaceholder(template, e.target.value, hydratedAcceptedByBlank)
          })
        }
        placeholder="Example: DNA is {{double helix}}"
        disabled={templateLocked}
      />
      <p className="text-xs text-slate-500">
        Use placeholders like {`{{mitochondria}}`} or {`{{double helix}}`} in the prompt text.
      </p>
      {placeholders.map((placeholder, index) => (
        <Input
          key={`${placeholder.start}-${placeholder.end}-${index}`}
          aria-label={`Accepted answers blank ${index + 1}`}
          value={hydratedAcceptedByBlank[index] ?? ''}
          onChange={(e) => {
            const next = [...hydratedAcceptedByBlank];
            next[index] = e.target.value;
            onChange({ template, acceptedByBlank: next });
          }}
          placeholder={`Blank ${index + 1} (from {{${placeholder.value}}}): answer1,answer2`}
        />
      ))}
    </div>
  );
}
