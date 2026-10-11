import type { OfferDto } from '@unun/core/contracts';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { CopyCodeButton } from './CopyCodeButton';

type OffersProps = {
  locale: Locale;
  copy: Dictionary['offers'];
  offers: OfferDto[];
};

export function Offers({ locale, copy, offers }: OffersProps) {
  if (offers.length === 0) return null;

  return (
    <section
      id="offers"
      aria-labelledby="offers-heading"
      className="scroll-mt-6 bg-ember text-soot"
    >
      <div className="page-column py-[clamp(3.5rem,9vw,6.5rem)]">
        <h2 id="offers-heading" className="display text-section">
          {copy.heading}
        </h2>

        <ul className="mt-10 border-t-2 border-soot">
          {offers.map((offer) => (
            <li
              key={offer.code}
              className="grid gap-x-8 gap-y-4 border-b-2 border-soot py-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div>
                <h3 className="display text-[clamp(1.6rem,3.2vw,2.5rem)]">
                  {offer.title[locale]}
                </h3>
                <p className="mt-2 text-lg">
                  {offer.terms[locale]} {copy.paidBy[offer.paidBy]}
                </p>
              </div>
              <CopyCodeButton
                code={offer.code}
                copyLabel={copy.copy}
                copiedLabel={copy.copied}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
