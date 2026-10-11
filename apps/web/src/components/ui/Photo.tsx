'use client';

import Image, { type ImageLoader } from 'next/image';
import { useState, type ReactNode } from 'react';

const UNSPLASH = 'https://images.unsplash.com/';

/** Nothing on the site is drawn wider than this, so no larger file is ever requested. */
const WIDEST = 1600;

/*
 * Unsplash resizes and re-encodes pictures on its own servers, so a photograph that
 * lives there is requested at the width the page needs and never passes through ours.
 */
const unsplashLoader: ImageLoader = ({ src, width, quality }) =>
  `${src}?auto=format&fit=max&w=${Math.min(width, WIDEST)}&q=${quality ?? 70}`;

type PhotoProps = {
  /** A path under /media, or the address of a photograph on Unsplash. */
  src: string;
  /** Empty when the photograph only decorates text that already names the thing. */
  alt?: string;
  sizes: string;
  priority?: boolean;
  /** Shown if the photograph cannot be loaded. */
  fallback?: ReactNode;
};

/**
 * A photograph that fills its parent, which must be positioned and have a size. If the
 * file cannot be loaded the fallback takes its place, so a picture that has moved never
 * leaves a broken image on the page.
 */
export function Photo({
  src,
  alt = '',
  sizes,
  priority = false,
  fallback = null,
}: PhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return fallback;

  return (
    <Image
      // A photograph can fail before React has attached its error handler.
      ref={(node) => {
        if (node?.complete && node.naturalWidth === 0) setFailedSrc(src);
      }}
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      loader={src.startsWith(UNSPLASH) ? unsplashLoader : undefined}
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className="object-cover"
    />
  );
}
