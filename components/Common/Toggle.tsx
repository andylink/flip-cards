import { InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
};

export function Toggle({ label, id, ...props }: Props) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm" htmlFor={id}>
      <span>{label}</span>
      <input
        className="focus-ring h-4 w-4 rounded border-slate-300"
        id={id}
        type="checkbox"
        {...props}
      />
    </label>
  );
}
