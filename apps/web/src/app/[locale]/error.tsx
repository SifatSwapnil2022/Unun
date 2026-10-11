'use client';

import { useParams } from 'next/navigation';
import { Notice } from '@/components/ui/Notice';
import { defaultLocale, isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';

/** Shown when a page cannot load its data, which in practice means the API is down. */
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale && isLocale(params.locale) ? params.locale : defaultLocale;
  const { errors } = getDictionary(locale);

  return (
    <main id="main" className="min-h-svh bg-ash">
      <Notice
        title={errors.apiDownTitle}
        action={
          <button type="button" onClick={reset} className="btn btn-dark">
            {errors.retry}
          </button>
        }
      >
        {errors.apiDownBody}
      </Notice>
    </main>
  );
}
