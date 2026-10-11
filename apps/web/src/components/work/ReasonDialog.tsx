'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Dictionary } from '@/i18n/dictionaries/en';

type ReasonDialogProps = {
  open: boolean;
  title: string;
  body: string;
  /** Ready-made reasons. "Another reason" is added after them. */
  reasons: readonly string[];
  confirmLabel: string;
  keepLabel: string;
  copy: Dictionary['work'];
  busy: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
};

const OTHER = 'other';

/**
 * Asks why an order is being declined or cancelled. The customer is shown the reason,
 * so one must be given.
 */
export function ReasonDialog({
  open,
  title,
  body,
  reasons,
  confirmLabel,
  keepLabel,
  copy,
  busy,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const otherId = useId();
  const [choice, setChoice] = useState(reasons[0] ?? OTHER);
  const [other, setOther] = useState('');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = (choice === OTHER ? other : choice).trim();
    if (reason.length < 3) {
      setInvalid(true);
      document.getElementById(otherId)?.focus();
      return;
    }
    onConfirm(reason);
  };

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <h2 id={titleId} className="display text-3xl">
          {title}
        </h2>
        <p className="mt-4 text-lg">{body}</p>

        <fieldset className="mt-6">
          <legend className="field-label">{copy.reason}</legend>
          <div className="mt-3 space-y-2.5">
            {[...reasons, OTHER].map((reason) => (
              <label key={reason} className="flex items-start gap-3 text-lg">
                <input
                  type="radio"
                  name={`${titleId}-reason`}
                  value={reason}
                  checked={choice === reason}
                  onChange={() => {
                    setChoice(reason);
                    setInvalid(false);
                  }}
                  className="mt-1.5 h-5 w-5 shrink-0 accent-soot"
                />
                <span>{reason === OTHER ? copy.otherReason : reason}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {choice === OTHER ? (
          <div className="mt-4">
            <label htmlFor={otherId} className="field-label">
              {copy.otherReasonLabel}
            </label>
            <input
              id={otherId}
              type="text"
              maxLength={140}
              value={other}
              onChange={(event) => {
                setOther(event.target.value);
                setInvalid(false);
              }}
              aria-invalid={invalid ? true : undefined}
              aria-describedby={invalid ? `${otherId}-error` : undefined}
              className="field-input"
            />
            {invalid ? (
              <p id={`${otherId}-error`} className="field-error">
                {copy.reasonError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <button type="submit" disabled={busy} className="btn btn-dark">
            {confirmLabel}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => dialog.current?.close()}
          >
            {keepLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
