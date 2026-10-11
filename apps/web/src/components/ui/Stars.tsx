import type { RatingSummary } from '@unun/core/contracts';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { formatNumber, formatRating, plural } from '@/lib/format';

const FIVE = [1, 2, 3, 4, 5];

type StarProps = {
  filled: boolean;
  /** Use on dark grounds, where the dark outline would vanish. */
  onDark?: boolean;
  className?: string;
};

/**
 * One star, drawn for this project: a flat turmeric shape with the same dark outline
 * the buttons have. An empty star keeps the outline and loses the fill.
 */
export function Star({ filled, onDark = false, className = 'h-5 w-5' }: StarProps) {
  const outline = onDark ? 'var(--color-turmeric)' : 'var(--color-soot)';
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path
        d="M12 2.6l2.9 6.2 6.7.8-5 4.6 1.4 6.7L12 17.5l-6 3.4 1.4-6.7-5-4.6 6.7-.8z"
        fill={filled ? 'var(--color-turmeric)' : 'none'}
        stroke={outline}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type StarsProps = {
  stars: number;
  /** What the row says to someone who cannot see it: "4 stars". */
  label: string;
  onDark?: boolean;
  className?: string;
};

/** A row of five stars for one rating. */
export function Stars({ stars, label, onDark, className }: StarsProps) {
  return (
    <span role="img" aria-label={label} className="inline-flex gap-0.5 align-middle">
      {FIVE.map((position) => (
        <Star
          key={position}
          filled={position <= stars}
          onDark={onDark}
          className={className}
        />
      ))}
    </span>
  );
}

type RatingMarkProps = {
  rating: RatingSummary;
  locale: Locale;
  copy: Dictionary['rating'];
  onDark?: boolean;
  /** The size of the average. The count beside it stays small. */
  className?: string;
};

/** A kitchen's rating in one line: a star, the average, and how many ratings made it. */
export function RatingMark({
  rating,
  locale,
  copy,
  onDark = false,
  className = 'text-base',
}: RatingMarkProps) {
  const quiet = onDark ? 'text-ash/70' : 'text-soot/70';
  if (rating.average === null) {
    return <span className={`${className} ${quiet}`}>{copy.none}</span>;
  }

  const count = fill(plural(rating.count, copy.count), {
    count: formatNumber(rating.count, locale),
  });
  const average = formatRating(rating.average, locale);

  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${className}`}>
      <Star filled onDark={onDark} className="h-[1.05em] w-[1.05em]" />
      <span className="font-semibold">
        <span className="sr-only">{fill(copy.outOfFive, { average })}</span>
        <span aria-hidden="true">{average}</span>
      </span>
      <span className={quiet}>{count}</span>
    </span>
  );
}
