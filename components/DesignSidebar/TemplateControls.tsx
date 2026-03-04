'use client';

import { Input } from '@/components/Common/Input';
import { Button } from '@/components/Common/Button';

type Props = {
  templateName: string;
  onTemplateNameChange: (value: string) => void;
  onSaveTemplate: () => void;
  onApplyTemplate: () => void;
};

export function TemplateControls({
  templateName,
  onTemplateNameChange,
  onSaveTemplate,
  onApplyTemplate
}: Props) {
  return (
    <section className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="text-sm font-semibold">Templates</h3>
      <Input
        placeholder="Template name"
        value={templateName}
        onChange={(e) => onTemplateNameChange(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onSaveTemplate}>Save</Button>
        <Button variant="secondary" onClick={onApplyTemplate}>
          Apply
        </Button>
      </div>
      <p className="text-xs text-slate-500">TODO: Replace with searchable template picker from Supabase.</p>
    </section>
  );
}
