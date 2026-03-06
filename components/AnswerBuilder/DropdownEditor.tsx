'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/Common/Input';
import { Button } from '@/components/Common/Button';

type DropdownQuestion = {
  prompt: string;
  optionsCsv: string;
  correctIndex: number;
};

type Props = {
  questions: DropdownQuestion[];
  onChange: (next: { questions: DropdownQuestion[] }) => void;
  savedOptionSets: Array<{ id: string; name: string }>;
  isLoadingSavedOptionSets: boolean;
  savedOptionSetsError: string | null;
  onRequestSaveOptionSet: (questionIndex: number) => void;
  onApplySavedOptionSet: (questionIndex: number, optionSetId: string) => void;
};

const createQuestion = (): DropdownQuestion => ({
  prompt: '',
  optionsCsv: '',
  correctIndex: -1
});

const parseOptions = (optionsCsv: string) =>
  optionsCsv
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeCorrectIndex = (correctIndex: number, optionsLength: number): number => {
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= optionsLength) {
    return -1;
  }

  return correctIndex;
};

export function DropdownEditor({
  questions,
  onChange,
  savedOptionSets,
  isLoadingSavedOptionSets,
  savedOptionSetsError,
  onRequestSaveOptionSet,
  onApplySavedOptionSet
}: Props) {
  const [selectedOptionSetByQuestion, setSelectedOptionSetByQuestion] = useState<Record<number, string>>({});

  useEffect(() => {
    setSelectedOptionSetByQuestion((previous) => {
      const next: Record<number, string> = {};
      questions.forEach((_, index) => {
        if (previous[index]) {
          next[index] = previous[index];
        }
      });
      return next;
    });
  }, [questions]);

  const updateQuestion = (index: number, nextQuestion: DropdownQuestion) => {
    const nextQuestions = [...questions];
    nextQuestions[index] = nextQuestion;
    onChange({ questions: nextQuestions });
  };

  return (
    <div className="space-y-3">
      {questions.map((question, index) => {
        const options = parseOptions(question.optionsCsv);
        const safeCorrectIndex = normalizeCorrectIndex(question.correctIndex, options.length);

        return (
          <div className="space-y-2 rounded border border-slate-200 p-2 dark:border-slate-700" key={index}>
            <Input
              value={question.prompt}
              onChange={(e) => updateQuestion(index, { ...question, prompt: e.target.value })}
              placeholder={`Question ${index + 1}`}
              aria-label={`Question ${index + 1}`}
            />
            <Input
              value={question.optionsCsv}
              onChange={(e) => {
                const nextOptions = parseOptions(e.target.value);
                updateQuestion(index, {
                  ...question,
                  optionsCsv: e.target.value,
                  correctIndex: normalizeCorrectIndex(question.correctIndex, nextOptions.length)
                });
              }}
              placeholder="Option 1, Option 2, Option 3"
              aria-label={`Question ${index + 1} options`}
            />
            {options.length > 0 ? (
              <select
                className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={safeCorrectIndex}
                onChange={(e) => {
                  updateQuestion(index, { ...question, correctIndex: Number(e.target.value) });
                }}
                aria-label={`Question ${index + 1} correct option`}
              >
                <option value={-1}>Select correct answer</option>
                {options.map((option, optionIndex) => (
                  <option key={`${option}-${optionIndex}`} value={optionIndex}>
                    {`Correct: ${option}`}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add comma-separated options to set the correct answer.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                className="focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={selectedOptionSetByQuestion[index] ?? ''}
                onChange={(event) => {
                  const optionSetId = event.target.value;
                  setSelectedOptionSetByQuestion((previous) => ({
                    ...previous,
                    [index]: optionSetId
                  }));
                }}
                aria-label={`Question ${index + 1} saved options`}
                disabled={savedOptionSets.length === 0 || isLoadingSavedOptionSets}
              >
                <option value="">
                  {savedOptionSets.length === 0 ? 'No saved option sets' : 'Choose saved option set'}
                </option>
                {savedOptionSets.map((optionSet) => (
                  <option key={optionSet.id} value={optionSet.id}>
                    {optionSet.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const selectedOptionSetId = selectedOptionSetByQuestion[index];
                  if (!selectedOptionSetId) return;
                  onApplySavedOptionSet(index, selectedOptionSetId);
                }}
                disabled={!selectedOptionSetByQuestion[index] || savedOptionSets.length === 0 || isLoadingSavedOptionSets}
              >
                Apply Saved
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onRequestSaveOptionSet(index)}
              disabled={options.length === 0}
            >
              Save Options for Reuse
            </Button>
            {isLoadingSavedOptionSets ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading saved option sets...</p>
            ) : null}
            {savedOptionSetsError ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">{savedOptionSetsError}</p>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const nextQuestions = questions.filter((_, questionIndex) => questionIndex !== index);
                onChange({ questions: nextQuestions });
              }}
            >
              Remove Question
            </Button>
          </div>
        );
      })}

      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange({ questions: [...questions, createQuestion()] })}
      >
        Add Question
      </Button>
    </div>
  );
}
