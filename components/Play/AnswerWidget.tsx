'use client';

import { useMemo, useState } from 'react';
import { AnswerType } from '@/lib/types/domain';
import { clozePlaceholderIds, clozeSchema, dropdownSchema, mcqSchema } from '@/lib/utils/answerEvaluation';
import { Input } from '@/components/Common/Input';
import { Button } from '@/components/Common/Button';

const CLOZE_TOKEN_REGEX = /{{\s*(blank|[1-9]\d*)\s*}}/gi;

type Props = {
  answerType: AnswerType;
  schemaJson: unknown;
  onSubmit: (responseJson: unknown) => void;
};

export function AnswerWidget({ answerType, schemaJson, onSubmit }: Props) {
  const [freeForm, setFreeForm] = useState('');
  const [mcqSelected, setMcqSelected] = useState(0);
  const [clozeValues, setClozeValues] = useState<string[]>([]);
  const [dropdownValues, setDropdownValues] = useState<number[]>([]);

  const content = useMemo(() => {
    if (answerType === 'mcq') {
      const parsed = mcqSchema.parse(schemaJson);
      return (
        <div className="space-y-2">
          {parsed.choices.map((choice, index) => (
            <label className="flex items-center gap-2" key={choice}>
              <input
                className="focus-ring"
                type="radio"
                checked={mcqSelected === index}
                onChange={() => setMcqSelected(index)}
                name="mcq"
              />
              <span>{choice}</span>
            </label>
          ))}
          <Button onClick={() => onSubmit({ selectedIndex: mcqSelected })}>Submit</Button>
        </div>
      );
    }

    if (answerType === 'cloze') {
      const parsed = clozeSchema.parse(schemaJson);
      const placeholderIds = clozePlaceholderIds(parsed.template);
      const placeholderToInputIndex = new Map<number, number>(
        placeholderIds.map((placeholderId, index) => [placeholderId, index])
      );
      const parts: Array<{ type: 'text'; value: string } | { type: 'blank'; inputIndex: number; placeholderId: number }> = [];
      let cursor = 0;
      let legacyPlaceholderId = 1;

      for (const match of parsed.template.matchAll(CLOZE_TOKEN_REGEX)) {
        const token = match[0] ?? '';
        const tokenIndex = match.index ?? 0;
        const rawPlaceholder = (match[1] ?? '').toLowerCase();
        const placeholderId = rawPlaceholder === 'blank' ? legacyPlaceholderId++ : Number(rawPlaceholder);
        if (tokenIndex > cursor) {
          parts.push({ type: 'text', value: parsed.template.slice(cursor, tokenIndex) });
        }

        const inputIndex = placeholderToInputIndex.get(placeholderId);
        if (inputIndex !== undefined) {
          parts.push({ type: 'blank', inputIndex, placeholderId });
        } else {
          parts.push({ type: 'text', value: token });
        }

        cursor = tokenIndex + token.length;
      }

      if (cursor < parsed.template.length) {
        parts.push({ type: 'text', value: parsed.template.slice(cursor) });
      }

      return (
        <div className="space-y-2">
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-7 dark:border-slate-700 dark:bg-slate-950">
            {parts.length === 0 ? parsed.template : null}
            {parts.map((part, index) =>
              part.type === 'text' ? (
                <span key={`text-${index}`}>{part.value}</span>
              ) : (
                <span className="mx-1 inline-block align-baseline" key={`blank-${part.placeholderId}-${index}`}>
                  <span className="font-medium tracking-wide">_______</span>
                  <sup className="ml-0.5 text-[10px] text-slate-500 dark:text-slate-400">{part.placeholderId}</sup>
                </span>
              )
            )}
          </p>
          <div className="space-y-2">
            {placeholderIds.map((placeholderId, index) => (
              <div className="space-y-1" key={`cloze-input-${placeholderId}`}>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Blank {placeholderId}</p>
                <Input
                  value={clozeValues[index] ?? ''}
                  onChange={(e) => {
                    const next = [...clozeValues];
                    next[index] = e.target.value;
                    setClozeValues(next);
                  }}
                  placeholder={`Enter answer for blank ${placeholderId}`}
                />
              </div>
            ))}
          </div>
          <Button onClick={() => onSubmit({ values: clozeValues })}>Submit</Button>
        </div>
      );
    }

    if (answerType === 'dropdown') {
      const parsed = dropdownSchema.parse(schemaJson);
      const selectedIndices = parsed.questions.map((_, index) => dropdownValues[index] ?? 0);

      return (
        <div className="space-y-2">
          {parsed.questions.map((question, index) => (
            <div className="space-y-1" key={`${question.prompt}-${index}`}>
              <p className="text-sm font-medium">{question.prompt || `Question ${index + 1}`}</p>
              <select
                className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={selectedIndices[index]}
                onChange={(e) => {
                  const next = [...dropdownValues];
                  next[index] = Number(e.target.value);
                  setDropdownValues(next);
                }}
              >
                {question.options.map((option, optionIndex) => (
                  <option key={`${option}-${optionIndex}`} value={optionIndex}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <Button onClick={() => onSubmit({ indices: selectedIndices })}>Submit</Button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Input value={freeForm} onChange={(e) => setFreeForm(e.target.value)} placeholder="Type your answer" />
        <Button onClick={() => onSubmit({ value: freeForm })}>Submit</Button>
      </div>
    );
  }, [answerType, schemaJson, freeForm, mcqSelected, clozeValues, dropdownValues, onSubmit]);

  return <section aria-live="polite">{content}</section>;
}
