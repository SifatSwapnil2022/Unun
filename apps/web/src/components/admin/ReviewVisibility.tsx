'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';

type ReviewVisibilityProps = {
  reviewId: number;
  hidden: boolean;
  /** The button's words, and what it does for someone who cannot see the row. */
  label: string;
  describedAs: string;
  failedText: string;
};

/** Hides a rating from customers, or shows it again. */
export function ReviewVisibility({
  reviewId,
  hidden,
  label,
  describedAs,
  failedText,
}: ReviewVisibilityProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const change = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await api.moderateReview(reviewId, !hidden);
    } catch {
      setFailed(true);
    }
    router.refresh();
    setBusy(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        aria-label={describedAs}
        onClick={() => void change()}
        className="btn btn-outline px-5 py-2"
      >
        {label}
      </button>
      {failed ? (
        <p role="alert" className="field-error">
          {failedText}
        </p>
      ) : null}
    </>
  );
}
