import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SiteHeaderBar } from '@/components/layout/SiteHeader';
import { SandboxPay } from '@/components/pay/SandboxPay';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { ApiRequestError, api } from '@/lib/api';

type PayPageProps = {
  params: Promise<{ locale: string; token: string }>;
};

export async function generateMetadata({ params }: PayPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale)
    ? {
        title: getDictionary(locale).pay.title,
        // The address is a key to the payment. Keep it out of search engines.
        robots: { index: false, follow: false },
      }
    : {};
}

async function loadPayment(token: string) {
  try {
    return await api.payment(token);
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'not_found') notFound();
    throw error;
  }
}

/** The test gateway's payment page. A real gateway has its own page, elsewhere. */
export default async function PayPage({ params }: PayPageProps) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const payment = await loadPayment(token);

  // Only the test gateway is paid here. Anything else has nothing to do on this page.
  if (payment.provider !== 'sandbox')
    redirect(`/${locale}/orders/${payment.order.token}`);

  return (
    <>
      <SiteHeaderBar locale={locale} copy={dictionary.nav} />
      <main id="main" className="min-h-[70vh] bg-ash">
        <div className="page-column py-[clamp(2.5rem,7vw,5rem)]">
          <SandboxPay
            locale={locale}
            initial={payment}
            copy={dictionary.pay}
            methods={dictionary.payment.methods}
          />
        </div>
      </main>
    </>
  );
}
