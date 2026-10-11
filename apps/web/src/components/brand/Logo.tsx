type LogoProps = {
  /** `word` is the full "unun" line. `mark` is the first "un", used where space is tight. */
  variant?: 'word' | 'mark';
  /** Draw the line on first paint. Use once per page, in the header. */
  draw?: boolean;
  className?: string;
  title?: string;
};

/*
 * The logo is one unbroken stroke. In "unun" each u and n share a stem,
 * so the whole word can be written without lifting the pen.
 * Geometry: stems 90 units apart, arcs of radius 45, stroke 26, round ends.
 */
const WORD_PATH =
  'M20 13V122a45 45 0 0 0 90 0V58a45 45 0 0 1 90 0V122a45 45 0 0 0 90 0V58a45 45 0 0 1 90 0V167';
const MARK_PATH = 'M20 13V122a45 45 0 0 0 90 0V58a45 45 0 0 1 90 0V167';

export function Logo({
  variant = 'word',
  draw = false,
  className,
  title = 'Unun',
}: LogoProps) {
  const isWord = variant === 'word';

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={isWord ? '0 0 400 180' : '0 0 220 180'}
      className={className}
      fill="none"
    >
      <path
        className="logo-line"
        data-draw={draw}
        d={isWord ? WORD_PATH : MARK_PATH}
        pathLength={1}
        stroke="currentColor"
        strokeWidth={26}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
