import { MAX_QUANTITY } from '@/lib/bag';

type StepperProps = {
  /** The quantity, already written in the page's digits. */
  value: string;
  quantity: number;
  onChange: (quantity: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  size?: 'regular' | 'small';
};

/** Minus, the count, plus. The minus removes the item when the count is one. */
export function Stepper({
  value,
  quantity,
  onChange,
  decreaseLabel,
  increaseLabel,
  size = 'regular',
}: StepperProps) {
  const button =
    size === 'regular'
      ? 'h-11 w-11 text-2xl leading-none'
      : 'h-8 w-8 text-xl leading-none';

  return (
    <div className="flex w-fit items-center rounded-full bg-soot font-sans text-ash">
      <button
        type="button"
        aria-label={decreaseLabel}
        onClick={() => onChange(quantity - 1)}
        className={`${button} rounded-full hover:text-turmeric focus-visible:outline-turmeric`}
      >
        −
      </button>
      <span
        aria-live="polite"
        className={`text-center font-semibold tabular-nums ${
          size === 'regular' ? 'min-w-7 text-lg' : 'min-w-6 text-base'
        }`}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={quantity >= MAX_QUANTITY}
        onClick={() => onChange(quantity + 1)}
        className={`${button} rounded-full hover:text-turmeric focus-visible:outline-turmeric disabled:opacity-40`}
      >
        +
      </button>
    </div>
  );
}
