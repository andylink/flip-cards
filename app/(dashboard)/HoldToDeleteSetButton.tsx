'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type HoldToDeleteSetButtonProps = {
  setId: string;
};

const HOLD_MS = 5000;
const ARM_TIMEOUT_MS = 10000;

export function HoldToDeleteSetButton({ setId }: HoldToDeleteSetButtonProps) {
  const router = useRouter();
  const rafRef = useRef<number>();
  const holdStartedAtRef = useRef<number | null>(null);
  const armTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [progress, setProgress] = useState(0);
  const [isArmed, setIsArmed] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearArmTimeout = () => {
    if (armTimeoutRef.current) {
      clearTimeout(armTimeoutRef.current);
      armTimeoutRef.current = null;
    }
  };

  const scheduleAutoDisarm = () => {
    clearArmTimeout();
    armTimeoutRef.current = setTimeout(() => {
      setIsArmed(false);
      setProgress(0);
      setIsHolding(false);
      holdStartedAtRef.current = null;
    }, ARM_TIMEOUT_MS);
  };

  useEffect(() => {
    return () => {
      clearArmTimeout();

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const resetHold = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }

    holdStartedAtRef.current = null;
    setIsHolding(false);
    setProgress(0);
  };

  const deleteSet = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/sets/${setId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Failed to delete set');
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete set');
      setIsDeleting(false);
    }
  };

  const startHold = () => {
    if (isDeleting || isHolding || !isArmed) {
      return;
    }

    clearArmTimeout();
    setErrorMessage(null);
    setIsHolding(true);
    holdStartedAtRef.current = performance.now();

    const tick = (now: number) => {
      const start = holdStartedAtRef.current;
      if (start === null) {
        return;
      }

      const elapsedMs = now - start;
      const nextProgress = Math.min(elapsedMs / HOLD_MS, 1);
      setProgress(nextProgress);

      if (nextProgress >= 1) {
        resetHold();
        void deleteSet();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const stopHold = () => {
    if (!isHolding || isDeleting) {
      return;
    }

    resetHold();
    if (isArmed) {
      scheduleAutoDisarm();
    }
  };

  const armDelete = () => {
    if (isDeleting || isArmed) {
      return;
    }

    setErrorMessage(null);
    setIsArmed(true);
    scheduleAutoDisarm();
  };

  const buttonLabel = isDeleting
    ? 'Deleting...'
    : isHolding
      ? `Keep holding... ${Math.ceil((1 - progress) * 5)}s`
      : isArmed
        ? 'Click and hold for 5s'
        : 'Delete';

  return (
    <div className="space-y-1">
      <button
        className="focus-ring relative overflow-hidden rounded bg-rose-600 px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isDeleting}
        onClick={armDelete}
        onPointerCancel={stopHold}
        onPointerDown={startHold}
        onPointerLeave={stopHold}
        onPointerUp={stopHold}
        type="button"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-rose-800/40 transition-[width] duration-100"
          style={{ width: `${progress * 100}%` }}
        />
        <span className="relative z-10">{buttonLabel}</span>
      </button>
      {errorMessage ? <p className="text-xs text-rose-600">{errorMessage}</p> : null}
    </div>
  );
}
