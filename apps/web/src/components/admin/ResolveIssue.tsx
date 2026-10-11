'use client';

import { TAKA, type Paisa } from '@unun/core';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { api } from '@/lib/api';
import { formatTaka } from '@/lib/format';

type ResolveIssueProps = {
  locale: Locale;
  issueId: number;
  publicId: string;
  /** The most that can still go back to the customer. */
  refundable: Paisa;
  copy: Dictionary['admin']['issues'];
  work: Dictionary['work'];
};

type Mode = 'refund' | 'close';

/**
 * The two ways support staff answer a report: give money back, or close it. Either way
 * a reply to the customer must be written.
 */
export function ResolveIssue({
  locale,
  issueId,
  publicId,
  refundable,
  copy,
  work,
}: ResolveIssueProps) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const amountId = useId();
  const noteId = useId();

  const [mode, setMode] = useState<Mode | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [invalid, setInvalid] = useState<'amount' | 'note' | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (mode && !node.open) node.showModal();
    if (!mode && node.open) node.close();
  }, [mode]);

  const max = formatTaka(refundable, locale);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !mode) return;

    const taka = Number(amount);
    const refund = mode === 'refund' ? taka * TAKA : 0;
    if (
      mode === 'refund' &&
      (!Number.isInteger(taka) || taka < 1 || refund > refundable)
    ) {
      setInvalid('amount');
      document.getElementById(amountId)?.focus();
      return;
    }
    if (note.trim().length < 3) {
      setInvalid('note');
      document.getElementById(noteId)?.focus();
      return;
    }

    setBusy(true);
    setFailed(false);
    try {
      await api.resolveIssue(issueId, { refund, note: note.trim() });
    } catch {
      setFailed(true);
    }
    // Either way the list is read again: another admin may have answered first.
    setMode(null);
    router.refresh();
    setBusy(false);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {refundable > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode('refund')}
            className="btn btn-dark px-5 py-2"
          >
            {copy.refund}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode('close')}
          className="btn btn-outline px-5 py-2"
        >
          {copy.close}
        </button>
      </div>
      {failed ? (
        <p role="alert" className="field-error">
          {work.failed}
        </p>
      ) : null}

      <dialog
        ref={dialog}
        className="sheet"
        aria-labelledby={titleId}
        onClose={() => setMode(null)}
      >
        <form onSubmit={(event) => void submit(event)} noValidate>
          <h2 id={titleId} className="display text-3xl">
            {fill(mode === 'close' ? copy.dialog.closeTitle : copy.dialog.refundTitle, {
              id: publicId,
            })}
          </h2>
          <p className="mt-4 text-lg">
            {mode === 'close' ? copy.dialog.closeBody : copy.dialog.refundBody}
          </p>

          {mode === 'refund' ? (
            <div className="mt-6">
              <label htmlFor={amountId} className="field-label">
                {copy.dialog.amount}
              </label>
              <input
                id={amountId}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={amount}
                aria-invalid={invalid === 'amount' ? true : undefined}
                aria-describedby={`${amountId}-hint`}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setInvalid(null);
                }}
                className="field-input w-40 tabular-nums"
              />
              <p
                id={`${amountId}-hint`}
                className={invalid === 'amount' ? 'field-error' : 'field-hint'}
              >
                {fill(
                  invalid === 'amount' ? copy.dialog.amountError : copy.dialog.amountHint,
                  { max },
                )}
              </p>
            </div>
          ) : null}

          <div className="mt-5">
            <label htmlFor={noteId} className="field-label">
              {copy.dialog.note}
            </label>
            <textarea
              id={noteId}
              rows={3}
              maxLength={300}
              value={note}
              aria-invalid={invalid === 'note' ? true : undefined}
              aria-describedby={invalid === 'note' ? `${noteId}-error` : undefined}
              onChange={(event) => {
                setNote(event.target.value);
                setInvalid(null);
              }}
              className="field-input resize-y"
            />
            {invalid === 'note' ? (
              <p id={`${noteId}-error`} className="field-error">
                {copy.dialog.noteError}
              </p>
            ) : null}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
            <button type="submit" disabled={busy} className="btn btn-dark">
              {mode === 'close' ? copy.dialog.confirmClose : copy.dialog.confirmRefund}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => dialog.current?.close()}
            >
              {copy.dialog.cancel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
