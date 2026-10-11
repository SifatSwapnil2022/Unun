import { photo } from '@/lib/media';
import { toneClasses } from '@/lib/tones';
import { Photo } from './Photo';

type CoverProps = {
  /** Key of a photograph in the media library. */
  photoKey: string | null;
  /** The flat colour shown behind the photograph, or instead of it. */
  tone: string;
  /** Set large on the colour block when the photograph is missing. */
  title: string;
  /** Language of `title`, when it differs from the page. */
  titleLang?: string;
  /** Which corner the name sits in. The top, when something overlaps the bottom edge. */
  titleAt?: 'top' | 'bottom';
  sizes: string;
  className?: string;
  priority?: boolean;
};

/**
 * A kitchen's cover photograph. If the photograph is missing or cannot be loaded, the
 * cover is a flat colour block with the kitchen's name set large, never a hole.
 */
export function Cover({
  photoKey,
  tone,
  title,
  titleLang,
  titleAt = 'bottom',
  sizes,
  className = '',
  priority = false,
}: CoverProps) {
  const image = photo(photoKey);
  const name = (
    <span
      lang={titleLang}
      aria-hidden="true"
      className={`display absolute inset-x-5 text-[clamp(1.6rem,3.2vw,2.4rem)] sm:inset-x-6 ${titleAt === 'top' ? 'top-5 sm:top-6' : 'bottom-5 sm:bottom-6'}`}
    >
      {title}
    </span>
  );

  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] ${toneClasses(tone)} ${className}`}
    >
      {image ? (
        <Photo src={image.src} sizes={sizes} priority={priority} fallback={name} />
      ) : (
        name
      )}
    </div>
  );
}
