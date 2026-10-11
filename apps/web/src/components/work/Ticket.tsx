import type { WorkOrderDto } from '@unun/core/contracts';
import type { ReactNode } from 'react';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { formatClock, formatDay, formatNumber, formatTaka } from '@/lib/format';

type TicketProps = {
  order: WorkOrderDto;
  locale: Locale;
  copy: Dictionary['work'];
  statusLabel: string;
  /** How the order is paid for: "Cash on delivery", "Paid". */
  paymentLabel: string;
  /** What the viewer can do with the order, or a line about who has it. */
  children?: ReactNode;
};

/**
 * An order on a paper ticket, as a kitchen prints it: what to cook, for when, and any
 * note from the customer. Like the receipt, it is set in the mono typeface.
 */
export function Ticket({
  order,
  locale,
  copy,
  statusLabel,
  paymentLabel,
  children,
}: TicketProps) {
  const finished = order.status === 'delivered' || order.status === 'cancelled';

  return (
    <article className="ticket">
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-lg font-medium">{order.publicId}</h3>
        <StatusChip status={order.status} label={statusLabel} />
      </header>

      <p className="mt-1 text-sm text-soot/75 tabular-nums">
        {fill(copy.placedAt, { time: formatClock(order.placedAt, locale) })}
        {/* A finished order may be days old, so it carries its date as well. */}
        {finished ? `, ${formatDay(order.placedAt, locale)}` : null}
        {finished ? null : (
          <>
            <br />
            {fill(copy.due, { time: formatClock(order.promisedTo, locale) })}
          </>
        )}
      </p>

      <ul className="ticket-rule mt-3 space-y-1 pt-3 font-mono text-base">
        {order.lines.map((line) => (
          <li key={line.name.en}>
            {formatNumber(line.quantity, locale)} × {line.name[locale]}
          </li>
        ))}
      </ul>

      {order.deliverTo.note ? (
        <p className="ticket-rule mt-3 pt-3 text-base">
          <span className="block text-sm text-soot/75">{copy.note}</span>
          {order.deliverTo.note}
        </p>
      ) : null}

      <p className="ticket-rule mt-3 pt-3 text-base font-semibold tabular-nums">
        {fill(copy.foodTotal, { amount: formatTaka(order.itemsTotal, locale) })}
        <span className="ml-3 text-sm font-normal text-soot/70">
          {paymentLabel}
          {order.handledBy === 'autopilot'
            ? `, ${copy.autopilot.toLocaleLowerCase(locale)}`
            : ''}
        </span>
      </p>

      {order.status === 'cancelled' && order.cancelReason ? (
        <p className="mt-2 text-base text-clay">{order.cancelReason}</p>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}
