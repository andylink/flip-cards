'use client';

import { Input } from '@/components/Common/Input';
import { Toggle } from '@/components/Common/Toggle';

type Props = {
  accepted: string;
  regex: string;
  trim: boolean;
  caseSensitive: boolean;
  onChange: (next: { accepted: string; regex: string; trim: boolean; caseSensitive: boolean }) => void;
};

export function FreeFormEditor({ accepted, regex, trim, caseSensitive, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Input
        aria-label="Accepted answers"
        placeholder="answer1,answer2"
        value={accepted}
        onChange={(e) => onChange({ accepted: e.target.value, regex, trim, caseSensitive })}
      />
      <Input
        aria-label="Optional regex"
        placeholder="optional regex"
        value={regex}
        onChange={(e) => onChange({ accepted, regex: e.target.value, trim, caseSensitive })}
      />
      <Toggle
        id="trim-toggle"
        label="Trim whitespace"
        checked={trim}
        onChange={(e) => onChange({ accepted, regex, trim: e.target.checked, caseSensitive })}
      />
      <Toggle
        id="case-toggle"
        label="Case sensitive"
        checked={caseSensitive}
        onChange={(e) => onChange({ accepted, regex, trim, caseSensitive: e.target.checked })}
      />
    </div>
  );
}
