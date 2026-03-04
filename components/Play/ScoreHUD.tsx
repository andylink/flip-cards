'use client';

type Props = {
  score: number;
  streak: number;
  answered: number;
  total: number;
};

export function ScoreHUD({ score, streak, answered, total }: Props) {
  return (
    <div className="flex flex-wrap gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
      <span>Score: {score}</span>
      <span>Streak: {streak}</span>
      <span>
        Progress: {answered}/{total}
      </span>
    </div>
  );
}
