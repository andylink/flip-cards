'use client';

type CanvasLike = {
  nodes: Array<{ type: string; text?: string }>;
};

export function PromptPanel({ canvas }: { canvas: CanvasLike }) {
  const firstText = canvas.nodes.find((node) => node.type === 'text')?.text ?? 'Prompt unavailable';
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-2 text-lg font-semibold">Prompt</h2>
      <p>{firstText}</p>
    </section>
  );
}
