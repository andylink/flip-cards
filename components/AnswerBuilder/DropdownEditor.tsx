'use client';

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
};

const createQuestion = (): DropdownQuestion => ({
  prompt: '',
  optionsCsv: '',
  correctIndex: 0
});

const parseOptions = (optionsCsv: string) =>
  optionsCsv
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export function DropdownEditor({ questions, onChange }: Props) {
  const updateQuestion = (index: number, nextQuestion: DropdownQuestion) => {
    const nextQuestions = [...questions];
    nextQuestions[index] = nextQuestion;
    onChange({ questions: nextQuestions });
  };

  return (
    <div className="space-y-3">
      {questions.map((question, index) => {
        const options = parseOptions(question.optionsCsv);
        const maxCorrectIndex = Math.max(options.length - 1, 0);
        const safeCorrectIndex = Math.min(question.correctIndex, maxCorrectIndex);

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
                  correctIndex: Math.min(question.correctIndex, Math.max(nextOptions.length - 1, 0))
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
