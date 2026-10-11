'use client';

import type { OrderStatus } from '@unun/core';
import type {
  KitchenAdvance,
  KitchenSettings,
  PartnerBoard,
  PartnerKitchenDto,
  WorkOrderDto,
} from '@unun/core/contracts';
import { useRouter } from 'next/navigation';
import { useCallback, useId, useState } from 'react';
import { RatingMark, Stars } from '@/components/ui/Stars';
import { Switch } from '@/components/ui/Switch';
import { ReasonDialog } from '@/components/work/ReasonDialog';
import { Ticket } from '@/components/work/Ticket';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { api } from '@/lib/api';
import { formatDay, formatNumber, formatTaka, plural } from '@/lib/format';
import { usePolling } from '@/lib/hooks/usePolling';

type PartnerBoardViewProps = {
  locale: Locale;
  initial: PartnerBoard;
  /** Every kitchen the owner runs. With more than one, a menu chooses between them. */
  kitchens: PartnerKitchenDto[];
  copy: Dictionary['partner'];
  work: Dictionary['work'];
  status: Dictionary['status'];
  payment: Dictionary['payment'];
  ratingCopy: Dictionary['rating'];
};

type Column = 'new' | 'kitchen' | 'out';

const COLUMN_OF: Partial<Record<OrderStatus, Column>> = {
  placed: 'new',
  accepted: 'kitchen',
  cooking: 'kitchen',
  ready: 'out',
  picked_up: 'out',
};

const COLUMNS: Column[] = ['new', 'kitchen', 'out'];

/** The step the kitchen takes next, for the states where it is the kitchen's move. */
const NEXT_STEP: Partial<Record<OrderStatus, KitchenAdvance['to']>> = {
  placed: 'accepted',
  accepted: 'cooking',
  cooking: 'ready',
};

export function PartnerBoardView({
  locale,
  initial,
  kitchens,
  copy,
  work,
  status,
  payment,
  ratingCopy,
}: PartnerBoardViewProps) {
  const router = useRouter();
  const kitchenField = useId();
  const slug = initial.kitchen.slug;

  const load = useCallback(() => api.partnerBoard(slug), [slug]);
  const { data: board, refresh, stale } = usePolling(load, initial);

  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [declining, setDeclining] = useState<WorkOrderDto | null>(null);

  /** Runs one change, then reads the board again whether or not it went through. */
  const act = async (key: string, change: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(key);
    setFailed(false);
    try {
      await change();
    } catch {
      setFailed(true);
    }
    await refresh();
    setBusy(null);
  };

  const change = (settings: KitchenSettings) =>
    act('settings', () => api.updateKitchenSettings(slug, settings));

  const { kitchen } = board;
  const accepting = kitchen.paused
    ? copy.accepting.off
    : kitchen.isOpen
      ? copy.accepting.on
      : copy.accepting.closed;

  const actionsFor = (order: WorkOrderDto) => {
    if (order.handledBy === 'autopilot') {
      return <p className="text-base text-soot/75">{copy.movesItself}</p>;
    }

    const next = NEXT_STEP[order.status];
    if (next) {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void act(order.publicId, () => api.kitchenAdvance(order.publicId, next))
            }
            className="btn btn-primary px-5 py-2"
          >
            {copy.actions[next]}
          </button>
          {order.status === 'placed' ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setDeclining(order)}
              className="btn btn-outline px-5 py-2"
            >
              {copy.actions.decline}
            </button>
          ) : null}
          {order.rider ? (
            <p className="w-full text-base text-soot/75">
              {fill(copy.riderComing, { name: order.rider.name })}
            </p>
          ) : null}
        </div>
      );
    }

    const riderLine = !order.rider
      ? copy.riderNeeded
      : fill(order.status === 'picked_up' ? copy.riderHas : copy.riderComing, {
          name: order.rider.name,
        });
    return <p className="text-base text-soot/75">{riderLine}</p>;
  };

  return (
    <>
      <div className="grid gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          {kitchens.length > 1 ? (
            <div className="mb-5 max-w-[20rem]">
              <label htmlFor={kitchenField} className="field-label">
                {copy.kitchenLabel}
              </label>
              <select
                id={kitchenField}
                value={slug}
                onChange={(event) =>
                  router.push(`/${locale}/partner?kitchen=${event.target.value}`)
                }
                className="field-input"
              >
                {kitchens.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.name[locale]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <p className="display text-[clamp(1.6rem,3vw,2.2rem)]">
            {kitchen.name[locale]}
          </p>
          <p className="mt-1 text-base text-soot/75">{kitchen.area[locale]}</p>
          <p className="mt-4 text-lg tabular-nums">
            {fill(plural(board.today.orders, copy.today.orders), {
              count: formatNumber(board.today.orders, locale),
            })}
            <br />
            {fill(copy.today.sales, { amount: formatTaka(board.today.sales, locale) })}
          </p>
          <p className="mt-3">
            <a href="#partner-reviews" className="hover:text-clay">
              <span className="sr-only">{copy.rating}: </span>
              <RatingMark
                rating={board.rating}
                locale={locale}
                copy={ratingCopy}
                className="text-lg"
              />
            </a>
          </p>
        </div>

        <ul className="border-t border-soot/25">
          <li className="flex items-start justify-between gap-6 border-b border-soot/25 py-4">
            <div>
              <p className="text-lg font-semibold">{copy.autopilot.label}</p>
              <p className="mt-0.5 max-w-[48ch] text-base text-soot/75">
                {kitchen.autopilot ? copy.autopilot.on : copy.autopilot.off}
              </p>
            </div>
            <Switch
              checked={kitchen.autopilot}
              disabled={busy !== null}
              label={copy.autopilot.label}
              onChange={(autopilot) => void change({ autopilot })}
            />
          </li>
          <li className="flex items-start justify-between gap-6 border-b border-soot/25 py-4">
            <div>
              <p className="text-lg font-semibold">{copy.accepting.label}</p>
              <p className="mt-0.5 max-w-[48ch] text-base text-soot/75">{accepting}</p>
            </div>
            <Switch
              checked={!kitchen.paused}
              disabled={busy !== null}
              label={copy.accepting.label}
              onChange={(taking) => void change({ paused: !taking })}
            />
          </li>
        </ul>
      </div>

      <div aria-live="polite">
        {stale ? (
          <p role="alert" className="field-error mt-6 text-base">
            {work.connectionLost}
          </p>
        ) : null}
        {failed ? <p className="field-error mt-6 text-base">{work.failed}</p> : null}
      </div>

      <div className="mt-10 grid gap-x-6 gap-y-10 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const orders = board.active.filter(
            (order) => COLUMN_OF[order.status] === column,
          );
          return (
            <section key={column} aria-labelledby={`column-${column}`}>
              <h2
                id={`column-${column}`}
                className="flex items-baseline justify-between border-b-[3px] border-soot pb-2"
              >
                <span className="display text-2xl">{copy.columns[column]}</span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatNumber(orders.length, locale)}
                </span>
              </h2>

              {orders.length === 0 ? (
                <p className="mt-4 text-base text-soot/70">{copy.empty[column]}</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {orders.map((order) => (
                    <li key={order.publicId}>
                      <Ticket
                        order={order}
                        locale={locale}
                        copy={work}
                        statusLabel={status[order.status]}
                        paymentLabel={payment.state[order.payment.state]}
                      >
                        {actionsFor(order)}
                      </Ticket>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <section aria-labelledby="partner-recent" className="mt-16">
        <h2 id="partner-recent" className="display text-[clamp(1.6rem,3vw,2.2rem)]">
          {copy.recent}
        </h2>
        {board.recent.length === 0 ? (
          <p className="mt-4 text-lg">{copy.noRecent}</p>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {board.recent.map((order) => (
              <li key={order.publicId}>
                <Ticket
                  order={order}
                  locale={locale}
                  copy={work}
                  statusLabel={status[order.status]}
                  paymentLabel={payment.state[order.payment.state]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="partner-reviews" className="mt-16">
        <h2
          id="partner-reviews"
          className="display scroll-mt-6 text-[clamp(1.6rem,3vw,2.2rem)]"
        >
          {copy.reviews}
        </h2>
        {board.reviews.length === 0 ? (
          <p className="mt-4 text-lg">{copy.noReviews}</p>
        ) : (
          <ul className="mt-5 max-w-[44rem] border-t border-soot/25">
            {board.reviews.map((review) => (
              <li
                key={review.id}
                className="grid gap-x-6 gap-y-1 border-b border-soot/25 py-4 sm:grid-cols-[auto_minmax(0,1fr)]"
              >
                <Stars
                  stars={review.stars}
                  label={fill(plural(review.stars, ratingCopy.stars), {
                    count: formatNumber(review.stars, locale),
                  })}
                />
                <div>
                  <p className={`text-lg ${review.comment ? '' : 'text-soot/60'}`}>
                    {review.comment ?? copy.noComment}
                  </p>
                  <p className="mt-0.5 text-base text-soot/75">
                    {review.author}, {formatDay(review.at, locale)}
                    {review.dishes.length > 0
                      ? `. ${review.dishes.map((dish) => dish[locale]).join(', ')}`
                      : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReasonDialog
        open={declining !== null}
        title={fill(copy.decline.title, { id: declining?.publicId ?? '' })}
        body={copy.decline.body}
        reasons={copy.decline.reasons}
        confirmLabel={copy.decline.confirm}
        keepLabel={copy.decline.keep}
        copy={work}
        busy={busy !== null}
        onClose={() => setDeclining(null)}
        onConfirm={(reason) => {
          const order = declining;
          setDeclining(null);
          if (order) {
            void act(order.publicId, () => api.declineOrder(order.publicId, reason));
          }
        }}
      />
    </>
  );
}
