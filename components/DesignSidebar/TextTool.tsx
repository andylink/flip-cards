'use client';

import { Input } from '@/components/Common/Input';
import { Select } from '@/components/Common/Select';

type Props = {
  text: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  onTextChange: (value: string) => void;
  onFontSizeChange: (value: number) => void;
  onFontWeightChange: (value: string) => void;
  onColorChange: (value: string) => void;
};

export function TextTool(props: Props) {
  return (
    <section className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="text-sm font-semibold">Text Tool</h3>
      <Input aria-label="Text content" value={props.text} onChange={(e) => props.onTextChange(e.target.value)} />
      <Input
        aria-label="Font size"
        type="number"
        min={8}
        max={140}
        value={props.fontSize}
        onChange={(e) => props.onFontSizeChange(Number(e.target.value))}
      />
      <Select value={props.fontWeight} onChange={(e) => props.onFontWeightChange(e.target.value)}>
        <option value="400">Regular</option>
        <option value="600">Semi Bold</option>
        <option value="700">Bold</option>
      </Select>
      <Input type="color" value={props.color} onChange={(e) => props.onColorChange(e.target.value)} />
    </section>
  );
}
