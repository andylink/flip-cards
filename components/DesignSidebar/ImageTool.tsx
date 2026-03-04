'use client';

import { Input } from '@/components/Common/Input';

type Props = {
  onImageUrlSubmit: (url: string) => void;
};

export function ImageTool({ onImageUrlSubmit }: Props) {
  return (
    <section className="space-y-2 rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="text-sm font-semibold">Image Tool</h3>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const url = data.get('url');
          if (typeof url === 'string' && url.length > 0) {
            onImageUrlSubmit(url);
            event.currentTarget.reset();
          }
        }}
      >
        <Input name="url" placeholder="https://example.com/image.png" aria-label="Image URL" />
        <button className="focus-ring w-full rounded-md bg-slate-200 px-3 py-2 text-sm dark:bg-slate-700" type="submit">
          Add image
        </button>
      </form>
      <p className="text-xs text-slate-500">TODO: Integrate signed upload flow for local files.</p>
    </section>
  );
}
