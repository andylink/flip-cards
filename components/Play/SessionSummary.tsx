'use client';

import { Button } from '@/components/Common/Button';

type Props = {
  score: number;
  totalAnswered: number;
  correctCount: number;
  onRestart: () => void;
};

export function SessionSummary({ score, totalAnswered, correctCount, onRestart }: Props) {
  const accuracy = totalAnswered === 0 ? 0 : Math.round((correctCount / totalAnswered) * 100);

  return (
    <section className="space-y-3 rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">Session Complete</h2>
      <p>Score: {score}</p>
      <p>Accuracy: {accuracy}%</p>
      <Button onClick={onRestart}>Play Again</Button>
    </section>
  );
}
