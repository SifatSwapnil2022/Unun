'use client';

import type { RiderAdvance, RiderBoard, WorkOrderDto } from '@unun/core/contracts';
import type { LatLng } from '@unun/core';
import { useState } from 'react';
import { DeliveryMapLazy } from '@/components/map/DeliveryMapLazy';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { api, errorCode } from '@/lib/api';
import { formatClock, formatNumber, formatTaka } from '@/lib/format';
import { usePolling } from '@/lib/hooks/usePolling';
import { useShareLocation } from '@/lib/hooks/useShareLocation';

type RiderBoardViewProps = {
  locale: Locale;
  initial: RiderBoard;
  copy: Dictionary['rider'];
  work: Dictionary['work'];
  status: Dictionary['status'];
  mapCopy: Dictionary['order']['map'];
};

/** Defined once, outside the component, so the polling timer is not restarted. */
const loadBoard = () => api.riderBoard();

const heading = 'display text-[clamp(1.6rem,3vw,2.2rem)]';

/** An address with its area, unless the address already names the area. */
const withArea = (address: string, area: string) =>
  address.includes(area) ? address : `${address}, ${area}`;

export function RiderBoardView({
  locale,
  initial,
  copy,
  work,
  status,
  mapCopy,
}: RiderBoardViewProps) {
  const { data: board, refresh, stale } = usePolling(loadBoard, initial);
  // The phone reports its position for as long as the rider has a delivery.
  const position = useShareLocation(board.active !== null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /** Runs one change, then reads the board again whether or not it went through. */
  const act = async (change: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await change();
    } catch (error) {
      const code = errorCode(error);
      setProblem(
        code === 'already_taken'
          ? copy.taken
          : code === 'limit_reached'
            ? copy.busy
            : work.failed,
      );
    }
    await refresh();
    setBusy(false);
  };

  const route = (order: WorkOrderDto) =>
    fill(copy.route, {
      from: order.kitchen.area[locale],
      to: order.deliverTo.area[locale],
    });

  const { active, today } = board;
  const figures = [
    { term: copy.today.deliveries, value: formatNumber(today.deliveries, locale) },
    { term: copy.today.earned, value: formatTaka(today.earned, locale) },
    { term: copy.today.cash, value: formatTaka(today.cashCollected, locale) },
  ];

  return (
    <div className="mx-auto max-w-[44rem]">
      <dl aria-label={copy.today.label} className="grid grid-cols-3 gap-x-5">
        {figures.map((figure) => (
          <div key={figure.term} className="border-t-[3px] border-soot pt-3">
            <dt className="text-base text-soot/75">{figure.term}</dt>
            <dd className="display mt-1 text-[clamp(1.6rem,5vw,2.4rem)] tabular-nums">
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>

      <div aria-live="polite">
        {stale ? (
          <p role="alert" className="field-error mt-6 text-base">
            {work.connectionLost}
          </p>
        ) : null}
        {problem ? <p className="field-error mt-6 text-base">{problem}</p> : null}
      </div>

      <section aria-labelledby="rider-active" className="mt-12">
        <h2 id="rider-active" className={heading}>
          {copy.active}
        </h2>
        {active ? (
          <ActiveDelivery
            order={active}
            locale={locale}
            copy={copy}
            work={work}
            statusLabel={status[active.status]}
            mapCopy={mapCopy}
            position={position}
            busy={busy}
            onAdvance={(to) => void act(() => api.riderAdvance(active.publicId, to))}
          />
        ) : (
          <p className="mt-4 text-lg">{copy.free}</p>
        )}
      </section>

      <section aria-labelledby="rider-available" className="mt-14">
        <h2 id="rider-available" className={heading}>
          {copy.available}
        </h2>
        {board.available.length === 0 ? (
          <p className="mt-4 max-w-[52ch] text-lg">{copy.noneAvailable}</p>
        ) : (
          <ul className="mt-5 space-y-4">
            {board.available.map((order) => (
              <li key={order.publicId} className="ticket">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[1.2rem] font-semibold">{route(order)}</h3>
                  <StatusChip status={order.status} label={status[order.status]} />
                </div>
                <p className="mt-1 text-base text-soot/80">
                  {order.kitchen.name[locale]},{' '}
                  {withArea(order.kitchen.address[locale], order.kitchen.area[locale])}
                </p>
                <p className="mt-0.5 text-sm text-soot/75 tabular-nums">
                  {fill(work.due, { time: formatClock(order.promisedTo, locale) })}
                </p>
                <div className="ticket-rule mt-3 flex flex-wrap items-center justify-between gap-3 pt-3">
                  <p className="text-lg font-semibold tabular-nums">
                    {fill(copy.earn, { amount: formatTaka(order.riderPay, locale) })}
                  </p>
                  <button
                    type="button"
                    disabled={busy || active !== null}
                    onClick={() => void act(() => api.claimDelivery(order.publicId))}
                    className="btn btn-primary px-5 py-2"
                  >
                    {copy.take}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {active && board.available.length > 0 ? (
          <p className="mt-3 text-base text-soot/75">{copy.busy}</p>
        ) : null}
      </section>

      <section aria-labelledby="rider-recent" className="mt-14">
        <h2 id="rider-recent" className={heading}>
          {copy.recent}
        </h2>
        {board.recent.length === 0 ? (
          <p className="mt-4 text-lg">{copy.noRecent}</p>
        ) : (
          <ul className="mt-5 border-t border-soot/25">
            {board.recent.map((order) => (
              <li
                key={order.publicId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1 border-b border-soot/25 py-3.5"
              >
                <p className="text-lg font-semibold">{route(order)}</p>
                <StatusChip status={order.status} label={status[order.status]} />
                <p className="font-mono text-sm text-soot/75">{order.publicId}</p>
                <p className="text-right text-base tabular-nums">
                  {order.status === 'delivered'
                    ? formatTaka(order.riderPay, locale)
                    : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type ActiveDeliveryProps = {
  order: WorkOrderDto;
  locale: Locale;
  copy: Dictionary['rider'];
  work: Dictionary['work'];
  statusLabel: string;
  mapCopy: Dictionary['order']['map'];
  /** Where this phone is, when it has said. */
  position: LatLng | null;
  busy: boolean;
  onAdvance: (to: RiderAdvance['to']) => void;
};

/** The delivery the rider is on: where to collect it, where to take it, what to collect. */
function ActiveDelivery({
  order,
  locale,
  copy,
  work,
  statusLabel,
  mapCopy,
  position,
  busy,
  onAdvance,
}: ActiveDeliveryProps) {
  const kitchen = order.kitchen.name[locale];
  const stepLine =
    order.status === 'picked_up'
      ? fill(copy.step.picked_up, { name: order.customer.name })
      : fill(order.status === 'ready' ? copy.step.ready : copy.step.cooking, {
          kitchen,
        });

  const next: RiderAdvance['to'] | null =
    order.status === 'ready'
      ? 'picked_up'
      : order.status === 'picked_up'
        ? 'delivered'
        : null;

  return (
    <article className="ticket mt-5 sm:p-7">
      <header className="flex items-start justify-between gap-3">
        <p className="font-mono text-lg font-medium">{order.publicId}</p>
        <StatusChip status={order.status} label={statusLabel} />
      </header>

      <p className="display mt-3 text-[clamp(1.5rem,4vw,2rem)]">{stepLine}</p>
      <p className="mt-2 text-sm text-soot/75 tabular-nums">
        {fill(work.due, { time: formatClock(order.promisedTo, locale) })}
      </p>

      <div className="mt-5">
        <DeliveryMapLazy
          label={mapCopy.label}
          kitchen={{ position: order.map.kitchen, label: kitchen }}
          destination={{
            position: order.map.destination,
            label: order.deliverTo.area[locale],
          }}
          rider={position ? { position, label: mapCopy.you } : null}
        />
        <p className="mt-2 text-sm text-soot/70">
          {position ? copy.sharing.on : copy.sharing.off}
        </p>
      </div>

      <dl className="ticket-rule mt-5 grid gap-x-8 gap-y-5 pt-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-soot/75">{copy.pickUp}</dt>
          <dd className="mt-1 text-lg font-semibold">{kitchen}</dd>
          <dd className="text-base">
            {withArea(order.kitchen.address[locale], order.kitchen.area[locale])}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-soot/75">{copy.dropOff}</dt>
          <dd className="mt-1 text-lg font-semibold">{order.customer.name}</dd>
          <dd className="text-base">
            {withArea(order.deliverTo.address, order.deliverTo.area[locale])}
          </dd>
          {order.deliverTo.note ? (
            <dd className="mt-1 text-base text-soot/80">{order.deliverTo.note}</dd>
          ) : null}
          <dd className="mt-2">
            <a
              href={`tel:${order.customer.phone}`}
              className="text-base font-semibold underline underline-offset-4"
            >
              {fill(copy.call, {
                name: order.customer.name,
                phone: order.customer.phone,
              })}
            </a>
          </dd>
        </div>
      </dl>

      <ul className="ticket-rule mt-5 space-y-1 pt-5 font-mono text-base">
        {order.lines.map((line) => (
          <li key={line.name.en}>
            {formatNumber(line.quantity, locale)} × {line.name[locale]}
          </li>
        ))}
      </ul>

      <div className="ticket-rule mt-5 pt-5">
        <p className="display text-[clamp(1.5rem,4vw,2rem)] tabular-nums">
          {order.collect > 0
            ? fill(copy.collect, { amount: formatTaka(order.collect, locale) })
            : copy.collectNothing}
        </p>
        <p className="mt-1 text-base text-soot/80 tabular-nums">
          {fill(copy.earn, { amount: formatTaka(order.riderPay, locale) })}
        </p>

        {next ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAdvance(next)}
            className="btn btn-primary mt-5 w-full py-4 text-lg"
          >
            {copy.actions[next]}
          </button>
        ) : (
          <p className="mt-5 text-base text-soot/80">{copy.waitingKitchen}</p>
        )}
      </div>
    </article>
  );
}
