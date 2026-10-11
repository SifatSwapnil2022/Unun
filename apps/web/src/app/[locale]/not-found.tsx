'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Notice } from '@/components/ui/Notice';
import { defaultLocale, isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';

/** Shown for an unknown kitchen, an unknown order link, or any address that is not a page. */
export default function NotFound() {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale && isLocale(params.locale) ? params.locale : defaultLocale;
  const { errors } = getDictionary(locale);

  return (
    <main id="main" className="min-h-svh bg-ash">
      <Notice
        title={errors.notFoundTitle}
        action={
          <Link href={`/${locale}`} className="btn btn-dark">
            {errors.home}
          </Link>
        }
      >
        {errors.notFoundBody}
      </Notice>
    </main>
  );
}
