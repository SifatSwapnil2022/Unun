/**
 * The flat colour blocks of the design system. The API stores a tone by name; this is
 * the only place that turns a name into colours.
 */
const TONES = {
  turmeric: 'bg-turmeric text-soot',
  clay: 'bg-clay text-ash',
  leaf: 'bg-leaf text-ash',
  ash: 'bg-ash-deep text-soot',
  soot: 'bg-soot text-ash',
  ember: 'bg-ember text-soot',
} as const;

export function toneClasses(tone: string): string {
  return tone in TONES ? TONES[tone as keyof typeof TONES] : TONES.ash;
}
