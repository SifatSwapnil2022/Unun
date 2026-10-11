import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Checkout } from '@/components/checkout/Checkout';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeaderBar } from '@/components/layout/SiteHeader';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { api } from '@/lib/api';
import { readArea } from '@/lib/area.server';
import { currentUser, serverApi } from '@/lib/session.server';

type CheckoutPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).checkout.title } : {};
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dictionary = getDictionary(locale);
  const [areas, areaId, user, paymentOptions] = await Promise.all([
    api.areas(),
    readArea(),
    currentUser(),
    // If the list cannot be read, cash still works.
    api.paymentOptions().catch(() => [{ method: 'cash' as const, sandbox: false }]),
  ]);
  // Checkout works without saved addresses, so failing to load them is not fatal.
  const addresses = user ? await (await serverApi()).addresses().catch(() => []) : [];

  return (
    <>
      <SiteHeaderBar locale={locale} copy={dictionary.nav} />

      <main id="main" className="bg-ash">
        <div className="page-column pt-[clamp(2.5rem,6vw,4.5rem)] pb-[clamp(3.5rem,9vw,6.5rem)]">
          <Checkout
            locale={locale}
            areas={areas}
            initialAreaId={areaId ?? null}
            user={user}
            addresses={addresses}
            paymentOptions={paymentOptions}
            signInLabel={dictionary.nav.signIn}
            copy={dictionary.checkout}
            pricingCopy={dictionary.pricing}
            suggestCopy={{
              heading: dictionary.bag.goesWith,
              add: dictionary.kitchen.add,
              addItem: dictionary.kitchen.addItem,
            }}
          />
        </div>
      </main>

      <SiteFooter locale={locale} copy={dictionary.footer} nav={dictionary.nav} />
    </>
  );
}
