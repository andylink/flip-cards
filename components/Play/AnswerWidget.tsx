'use client';

import { useMemo, useState } from 'react';
import { AnswerType } from '@/lib/types/domain';
import { clozeSchema, dropdownSchema, mcqSchema } from '@/lib/utils/answerEvaluation';
import { Input } from '@/components/Common/Input';
import { Button } from '@/components/Common/Button';

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
      return (
        <div className="space-y-2">
          {parsed.blanks.map((_, index) => (
            <Input
              key={index}
              value={clozeValues[index] ?? ''}
              onChange={(e) => {
                const next = [...clozeValues];
                next[index] = e.target.value;
                setClozeValues(next);
              }}
              placeholder={`Blank ${index + 1}`}
            />
          ))}
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
