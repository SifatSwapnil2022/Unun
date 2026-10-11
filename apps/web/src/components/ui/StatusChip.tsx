import type { OrderStatus } from '@unun/core';

const TONE: Record<OrderStatus, string> = {
  placed: 'bg-turmeric text-soot',
  accepted: 'bg-ash-deep text-soot',
  cooking: 'bg-ember text-soot',
  ready: 'bg-leaf text-ash',
  picked_up: 'bg-soot text-ash',
  delivered: 'border border-soot/40 text-soot',
  cancelled: 'bg-clay text-ash',
};

/** An order's state as a small coloured label. */
export function StatusChip({ status, label }: { status: OrderStatus; label: string }) {
  return <span className={`chip ${TONE[status]}`}>{label}</span>;
}
