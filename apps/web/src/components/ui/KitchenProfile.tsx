import { photo } from '@/lib/media';
import { toneClasses } from '@/lib/tones';
import { Photo } from './Photo';

type KitchenProfileProps = {
  /** Key of a photograph in the media library. */
  photoKey: string | null;
  tone: string;
  /** The kitchen's name, in the language of the page. */
  name: string;
  locale: string;
  /** The rendered width in pixels, for choosing a file size. */
  size: number;
  /** Width, text size, ring width and ring colour. */
  className: string;
};

/** The first letter of a name, counted the way a reader counts: "জা" for "জাফরানি". */
function initialOf(name: string, locale: string): string {
  const [first] = new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(name);
  return first?.segment ?? '';
}

/**
 * A kitchen's profile picture: a round photograph of a dish it is known for. Without
 * the photograph it is the kitchen's initial on its colour.
 */
export function KitchenProfile({
  photoKey,
  tone,
  name,
  locale,
  size,
  className,
}: KitchenProfileProps) {
  const image = photo(photoKey);
  const initial = (
    <span className="display absolute inset-0 grid place-items-center leading-none">
      {initialOf(name, locale)}
    </span>
  );

  return (
    <span
      aria-hidden="true"
      className={`relative block aspect-square shrink-0 overflow-hidden rounded-full ${toneClasses(tone)} ${className}`}
    >
      {image ? <Photo src={image.src} sizes={`${size}px`} fallback={initial} /> : initial}
    </span>
  );
}
