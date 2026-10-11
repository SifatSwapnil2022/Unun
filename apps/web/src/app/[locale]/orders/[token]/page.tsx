import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { OrderTracker } from '@/components/order/OrderTracker';
import { isLocale } from '@/i18n/config';
import { fill, getDictionary } from '@/i18n/get-dictionary';
import { ApiRequestError, api } from '@/lib/api';

type OrderPageProps = {
  params: Promise<{ locale: string; token: string }>;
};

async function loadOrder(token: string) {
  try {
    return await api.order(token);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'not_found') notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { locale, token } = await params;
  if (!isLocale(locale)) return {};

  const order = await api.order(token).catch(() => null);
  return {
    title: order
      ? fill(getDictionary(locale).order.title, { id: order.publicId })
      : undefined,
    // The link is a key to the order. Keep it out of search engines.
    robots: { index: false, follow: false },
  };
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const order = await loadOrder(token);

  return (
    <>
      <div className="bg-soot text-ash">
        <SiteHeader locale={locale} copy={dictionary.nav} />
      </div>

      <main id="main">
        <OrderTracker
          locale={locale}
          initial={order}
          copy={dictionary.order}
          pricingCopy={dictionary.pricing}
          methods={dictionary.payment.methods}
          ratingCopy={dictionary.rating}
        />
      </main>

      <SiteFooter locale={locale} copy={dictionary.footer} nav={dictionary.nav} />
    </>
  );
}
