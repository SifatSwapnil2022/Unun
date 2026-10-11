const TEN = Array.from({ length: 10 }, (_, index) => index);

type OnTimeRecordProps = {
  count: number;
  label: string;
  /** Use on dark grounds, where the leaf green would not show. */
  onDark?: boolean;
};

/** Ten marks, one per recent order: filled when that order arrived inside the window. */
export function OnTimeRecord({ count, label, onDark = false }: OnTimeRecordProps) {
  const filled = onDark ? 'bg-turmeric' : 'bg-leaf';
  const empty = onDark ? 'border border-turmeric/60' : 'border border-leaf/60';

  return (
    <p
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-base ${
        onDark ? 'text-ash' : 'text-leaf'
      }`}
    >
      <span aria-hidden="true" className="flex gap-1">
        {TEN.map((index) => (
          <span
            key={index}
            className={`h-2.5 w-2.5 rounded-full ${index < count ? filled : empty}`}
          />
        ))}
      </span>
      <span>{label}</span>
    </p>
  );
}
