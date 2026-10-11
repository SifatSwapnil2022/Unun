'use client';

import {
  COMMENT_MAX_LENGTH,
  ISSUE_DETAIL_MAX_LENGTH,
  ISSUE_DETAIL_MIN_LENGTH,
  ISSUE_KINDS,
  type IssueKind,
} from '@unun/core';
import type { IssueDto, OrderDto } from '@unun/core/contracts';
import { useId, useState, type FormEvent } from 'react';
import { Star, Stars } from '@/components/ui/Stars';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { api } from '@/lib/api';
import { formatNumber, formatTaka, plural } from '@/lib/format';

type OrderFeedbackProps = {
  locale: Locale;
  order: OrderDto;
  copy: Dictionary['order'];
  ratingCopy: Dictionary['rating'];
  /** Both forms answer with the order as it stands afterwards. */
  onChange: (order: OrderDto) => void;
};

const FIVE = [1, 2, 3, 4, 5];
const heading = 'display text-[clamp(1.5rem,2.6vw,2rem)]';

/** After the food arrives: rate the kitchen, or say that something went wrong. */
export function OrderFeedback({
  locale,
  order,
  copy,
  ratingCopy,
  onChange,
}: OrderFeedbackProps) {
  const starsLabel = (stars: number) =>
    fill(plural(stars, ratingCopy.stars), { count: formatNumber(stars, locale) });

  const hasRating = order.rating !== null || order.canRate;
  const hasProblem = order.issues.length > 0 || order.canReport;
  if (!hasRating && !hasProblem) return null;

  return (
    <div className="mt-10 space-y-10 border-t border-soot/25 pt-9">
      {order.rating ? (
        <section aria-labelledby="rated-heading">
          <h2 id="rated-heading" className={heading}>
            {fill(copy.rate.thanks, { stars: formatNumber(order.rating.stars, locale) })}
          </h2>
          <p className="mt-3">
            <Stars
              stars={order.rating.stars}
              label={starsLabel(order.rating.stars)}
              className="h-7 w-7"
            />
          </p>
          {order.rating.comment ? (
            <p className="mt-3 max-w-[52ch] text-lg">{order.rating.comment}</p>
          ) : null}
        </section>
      ) : order.canRate ? (
        <RatingForm
          locale={locale}
          order={order}
          copy={copy.rate}
          starsLabel={starsLabel}
          onChange={onChange}
        />
      ) : null}

      {hasProblem ? (
        <section aria-label={copy.problem.heading}>
          {order.issues.length > 0 ? (
            <ul className="space-y-6">
              {order.issues.map((issue) => (
                <IssueStatus
                  key={issue.id}
                  issue={issue}
                  locale={locale}
                  copy={copy.problem}
                />
              ))}
            </ul>
          ) : null}
          {order.canReport ? (
            <ProblemForm
              order={order}
              copy={copy.problem}
              spaced={order.issues.length > 0}
              onChange={onChange}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

type RatingFormProps = {
  locale: Locale;
  order: OrderDto;
  copy: Dictionary['order']['rate'];
  starsLabel: (stars: number) => string;
  onChange: (order: OrderDto) => void;
};

function RatingForm({ locale, order, copy, starsLabel, onChange }: RatingFormProps) {
  const name = useId();
  const commentId = useId();
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'choose' | 'failed'>('idle');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === 'sending') return;
    if (stars === 0) {
      setState('choose');
      return;
    }
    setState('sending');
    try {
      onChange(
        await api.rateOrder(order.token, { stars, comment: comment.trim() || undefined }),
      );
    } catch {
      setState('failed');
    }
  };

  const lit = hovered || stars;

  return (
    <section aria-labelledby={`${name}-heading`}>
      <h2 id={`${name}-heading`} className={heading}>
        {copy.heading}
      </h2>
      <p className="mt-2 max-w-[52ch] text-base text-soot/75">
        {fill(copy.body, { kitchen: order.kitchen.name[locale] })}
      </p>

      <form onSubmit={(event) => void submit(event)} noValidate className="mt-5">
        <fieldset>
          <legend className="sr-only">{copy.starsLabel}</legend>
          <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
            {FIVE.map((value) => (
              <label
                key={value}
                onMouseEnter={() => setHovered(value)}
                className="cursor-pointer rounded-lg p-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-soot"
              >
                <input
                  type="radio"
                  name={name}
                  value={value}
                  checked={stars === value}
                  onChange={() => {
                    setStars(value);
                    setState('idle');
                  }}
                  className="sr-only"
                />
                <Star filled={value <= lit} className="h-10 w-10" />
                <span className="sr-only">{starsLabel(value)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor={commentId} className="field-label mt-5 block">
          {copy.comment}
        </label>
        <textarea
          id={commentId}
          rows={3}
          maxLength={COMMENT_MAX_LENGTH}
          value={comment}
          placeholder={copy.commentPlaceholder}
          onChange={(event) => setComment(event.target.value)}
          className="field-input max-w-[32rem] resize-y"
        />

        <div aria-live="polite">
          {state === 'choose' ? <p className="field-error">{copy.choose}</p> : null}
          {state === 'failed' ? <p className="field-error">{copy.error}</p> : null}
        </div>

        <button
          type="submit"
          disabled={state === 'sending'}
          className="btn btn-dark mt-5"
        >
          {state === 'sending' ? copy.sending : copy.send}
        </button>
      </form>
    </section>
  );
}

type IssueStatusProps = {
  issue: IssueDto;
  locale: Locale;
  copy: Dictionary['order']['problem'];
};

function IssueStatus({ issue, locale, copy }: IssueStatusProps) {
  const outcome =
    issue.status === 'refunded'
      ? fill(copy.status.refunded, { amount: formatTaka(issue.refund, locale) })
      : copy.status[issue.status];

  return (
    <li>
      <p className="text-lg font-semibold">
        {fill(copy.reported, { kind: copy.kinds[issue.kind].toLocaleLowerCase(locale) })}
      </p>
      <p className="mt-1 max-w-[52ch] text-base text-soot/75">{issue.detail}</p>
      <p
        className={`mt-2 max-w-[52ch] text-lg ${
          issue.status === 'refunded' ? 'font-semibold text-leaf' : ''
        }`}
      >
        {outcome}
      </p>
      {issue.note ? (
        <p className="mt-1 max-w-[52ch] text-base">
          {fill(copy.reply, { note: issue.note })}
        </p>
      ) : null}
    </li>
  );
}

type ProblemFormProps = {
  order: OrderDto;
  copy: Dictionary['order']['problem'];
  /** True when the form follows a list of earlier reports. */
  spaced: boolean;
  onChange: (order: OrderDto) => void;
};

function ProblemForm({ order, copy, spaced, onChange }: ProblemFormProps) {
  const name = useId();
  const detailId = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<IssueKind>(ISSUE_KINDS[0]);
  const [detail, setDetail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'short' | 'failed'>('idle');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === 'sending') return;
    if (detail.trim().length < ISSUE_DETAIL_MIN_LENGTH) {
      setState('short');
      document.getElementById(detailId)?.focus();
      return;
    }
    setState('sending');
    try {
      onChange(await api.reportIssue(order.token, { kind, detail: detail.trim() }));
      setOpen(false);
      setDetail('');
      setState('idle');
    } catch {
      setState('failed');
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-lg font-semibold underline underline-offset-4 ${spaced ? 'mt-7' : ''}`}
      >
        {copy.open}
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className={spaced ? 'mt-8' : ''}
    >
      <fieldset>
        <legend className={heading}>{copy.heading}</legend>
        <div className="mt-4 space-y-2.5">
          {ISSUE_KINDS.map((value) => (
            <label key={value} className="flex items-start gap-3 text-lg">
              <input
                type="radio"
                name={name}
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="mt-1.5 h-5 w-5 shrink-0 accent-soot"
              />
              <span>{copy.kinds[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor={detailId} className="field-label mt-6 block">
        {copy.detail}
      </label>
      <textarea
        id={detailId}
        rows={4}
        maxLength={ISSUE_DETAIL_MAX_LENGTH}
        value={detail}
        aria-invalid={state === 'short' ? true : undefined}
        aria-describedby={`${detailId}-hint`}
        onChange={(event) => {
          setDetail(event.target.value);
          if (state !== 'sending') setState('idle');
        }}
        className="field-input max-w-[32rem] resize-y"
      />
      <p id={`${detailId}-hint`} className="field-hint">
        {copy.detailHint}
      </p>

      <div aria-live="polite">
        {state === 'short' ? <p className="field-error">{copy.detailError}</p> : null}
        {state === 'failed' ? <p className="field-error">{copy.error}</p> : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" disabled={state === 'sending'} className="btn btn-dark">
          {state === 'sending' ? copy.sending : copy.send}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-outline">
          {copy.cancel}
        </button>
      </div>
    </form>
  );
}
