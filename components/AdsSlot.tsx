'use client';

import clsx from 'clsx';
import { useSessionStore } from '@/lib/store/sessionStore';

type Props = {
  label?: string;
  className?: string;
};

export function AdsSlot({ label = 'Ad', className }: Props) {
  const adFree = useSessionStore((state) => state.adFree);
  const enabled = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';

  if (!enabled || adFree) return null;

  return (
    <div
      className={clsx(
        'hidden min-h-[90px] w-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-100 text-xs text-slate-600 sm:flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
        className
      )}
      aria-label="Advertisement"
      role="complementary"
    >
      {label} slot ({process.env.NEXT_PUBLIC_ADS_SLOT_ID ?? 'unset'})
    </div>
  );
}
