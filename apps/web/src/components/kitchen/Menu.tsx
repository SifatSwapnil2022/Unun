'use client';

import { ALLERGENS, allergensToAvoid, type Allergen, type Localized } from '@unun/core';
import type { MenuItemDto, MenuSectionDto } from '@unun/core/contracts';
import { useRef, useState } from 'react';
import { Stepper } from '@/components/bag/Stepper';
import { useBag } from '@/components/bag/useBag';
import { Photo } from '@/components/ui/Photo';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { quantityOf, type BagItem } from '@/lib/bag';
import { formatNumber, formatTaka, plural } from '@/lib/format';
import { useAvoiding } from '@/lib/hooks/useAvoiding';

type MenuProps = {
  locale: Locale;
  kitchen: { slug: string; name: Localized };
  sections: MenuSectionDto[];
  /** Addresses of the dish photographs, by the key each item carries. */
  photos: Record<string, string>;
  /** When false the menu can be read but nothing can be added. */
  canOrder: boolean;
  copy: Dictionary['kitchen'];
  bagCopy: Dictionary['bag'];
  allergenCopy: Dictionary['allergens'];
};

/** Joins labels into one line: "Vegetarian, spicy". */
function tagLine(labels: string[], locale: Locale): string {
  return labels
    .map((label, index) => (index === 0 ? label : label.toLocaleLowerCase(locale)))
    .join(', ');
}

export function Menu({
  locale,
  kitchen,
  sections,
  photos,
  canOrder,
  copy,
  bagCopy,
  allergenCopy,
}: MenuProps) {
  const { bag, add, replaceWith, change } = useBag();
  const { avoiding, toggle, clear } = useAvoiding();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<BagItem | null>(null);
  /** Sections whose hidden dishes the customer asked to see anyway. */
  const [revealed, setRevealed] = useState<number[]>([]);

  const namesOf = (allergens: readonly Allergen[]) =>
    allergens
      .map((allergen) => allergenCopy[allergen].toLocaleLowerCase(locale))
      .join(', ');

  const inThisKitchen = bag.kitchen?.slug === kitchen.slug;

  const addToBag = (item: MenuItemDto) => {
    const bagItem: BagItem = { itemId: item.id, name: item.name, unitPrice: item.price };
    if (add(kitchen, bagItem)) return;

    // The bag holds another kitchen's food. Ask before emptying it.
    setPending(bagItem);
    dialog.current?.showModal();
  };

  return (
    <div>
      <nav
        aria-label={copy.menuNav}
        className="sticky top-0 z-20 -mx-[clamp(1.25rem,4vw,3rem)] pt-[env(safe-area-inset-top)] border-b border-soot/20 bg-ash px-[clamp(1.25rem,4vw,3rem)] lg:mx-0 lg:px-0"
      >
        <ul className="flex gap-2 overflow-x-auto py-3">
          {sections.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#menu-${section.id}`}
                className="block rounded-full border-2 border-soot px-4 py-1.5 text-base font-semibold whitespace-nowrap transition-colors hover:bg-soot hover:text-ash"
              >
                {section.name[locale]}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <details className="group mt-6 border-b border-soot/25 pb-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            {avoiding.length === 0
              ? copy.avoid.summary
              : fill(copy.avoid.summaryActive, { list: namesOf(avoiding) })}
          </span>
          {/* A plus that turns into a minus when the list is open. */}
          <span
            aria-hidden="true"
            className="relative h-4 w-4 shrink-0 before:absolute before:top-1/2 before:left-0 before:h-0.5 before:w-full before:-translate-y-1/2 before:bg-soot after:absolute after:top-0 after:left-1/2 after:h-full after:w-0.5 after:-translate-x-1/2 after:bg-soot group-open:after:hidden"
          />
        </summary>

        <fieldset className="mt-4">
          <legend className="text-base text-soot/75">{copy.avoid.legend}</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {ALLERGENS.map((allergen) => {
              const on = avoiding.includes(allergen);
              return (
                <button
                  key={allergen}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(allergen)}
                  className={`rounded-full border-2 border-soot px-4 py-1.5 text-base font-semibold transition-colors ${
                    on ? 'bg-soot text-ash' : 'hover:bg-ash-deep'
                  }`}
                >
                  {allergenCopy[allergen]}
                </button>
              );
            })}
          </div>
        </fieldset>
        {avoiding.length > 0 ? (
          <button
            type="button"
            onClick={clear}
            className="mt-4 text-base font-semibold underline underline-offset-4"
          >
            {copy.avoid.clear}
          </button>
        ) : null}
        <p className="mt-4 max-w-[62ch] text-sm text-soot/75">{copy.avoid.note}</p>
      </details>

      {sections.map((section) => {
        const flagged = section.items.filter(
          (item) => allergensToAvoid(item.allergens, avoiding).length > 0,
        );
        const showing = revealed.includes(section.id);
        const shown = showing
          ? section.items
          : section.items.filter((item) => !flagged.includes(item));
        // What the hidden dishes of this section contain, of the things being avoided.
        const reasons = allergensToAvoid(
          flagged.flatMap((item) => item.allergens),
          avoiding,
        );

        return (
          <section
            key={section.id}
            id={`menu-${section.id}`}
            aria-labelledby={`menu-${section.id}-heading`}
            className="scroll-mt-20 pt-10"
          >
            <h2
              id={`menu-${section.id}-heading`}
              className="display text-[clamp(1.6rem,3vw,2.2rem)]"
            >
              {section.name[locale]}
            </h2>

            {flagged.length > 0 ? (
              <p className="mt-2 text-base text-soot/75">
                {fill(plural(flagged.length, copy.avoid.hidden), {
                  count: formatNumber(flagged.length, locale),
                  list: namesOf(reasons),
                })}{' '}
                <button
                  type="button"
                  aria-expanded={showing}
                  onClick={() =>
                    setRevealed((sections) =>
                      showing
                        ? sections.filter((id) => id !== section.id)
                        : [...sections, section.id],
                    )
                  }
                  className="font-semibold text-soot underline underline-offset-4"
                >
                  {showing ? copy.avoid.hide : copy.avoid.show}
                </button>
              </p>
            ) : null}

            <ul className="mt-3 border-t border-soot/25">
              {shown.map((item) => {
                const clash = allergensToAvoid(item.allergens, avoiding);
                const quantity = inThisKitchen ? quantityOf(bag, item.id) : 0;
                const image = item.photo ? photos[item.photo] : undefined;
                const name = item.name[locale];
                const description = item.description[locale];
                const orderable = canOrder && item.available;

                return (
                  <li
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 border-b border-soot/25 py-5"
                  >
                    <div>
                      {item.popular ? (
                        <p className="mb-2 w-fit rounded-full bg-turmeric px-3 py-0.5 text-sm font-semibold">
                          {copy.popular}
                        </p>
                      ) : null}
                      <h3 className="text-[1.2rem] leading-snug font-semibold">{name}</h3>
                      {description ? (
                        <p className="mt-1 max-w-[52ch] text-base text-soot/75">
                          {description}
                        </p>
                      ) : null}
                      {item.tags.length > 0 ? (
                        <p className="mt-1 text-sm text-soot/70">
                          {tagLine(
                            item.tags.map((tag) => copy.tags[tag]),
                            locale,
                          )}
                        </p>
                      ) : null}
                      {item.allergens.length > 0 ? (
                        <p
                          className={`mt-1 text-sm ${
                            clash.length > 0 ? 'font-semibold text-clay' : 'text-soot/70'
                          }`}
                        >
                          {fill(copy.contains, { list: namesOf(item.allergens) })}
                        </p>
                      ) : null}
                      <p className="mt-2 text-lg font-semibold tabular-nums">
                        {formatTaka(item.price, locale)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end justify-between gap-3">
                      {image ? (
                        <span className="relative block h-24 w-24 overflow-hidden rounded-2xl bg-ash-deep sm:h-28 sm:w-28">
                          <Photo src={image} sizes="112px" />
                        </span>
                      ) : (
                        <span />
                      )}

                      {!item.available ? (
                        <p className="text-sm font-semibold text-clay">
                          {copy.unavailable}
                        </p>
                      ) : quantity > 0 ? (
                        <Stepper
                          value={formatNumber(quantity, locale)}
                          quantity={quantity}
                          onChange={(next) => change(item.id, next)}
                          decreaseLabel={fill(copy.decrease, { item: name })}
                          increaseLabel={fill(copy.increase, { item: name })}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={!orderable}
                          aria-label={fill(copy.addItem, { item: name })}
                          onClick={() => addToBag(item)}
                          className="btn btn-outline px-5 py-2"
                        >
                          {copy.add}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <dialog
        ref={dialog}
        className="sheet"
        aria-labelledby="replace-bag-title"
        onClose={() => setPending(null)}
      >
        <h2 id="replace-bag-title" className="display text-3xl">
          {bagCopy.replaceTitle}
        </h2>
        <p className="mt-4 text-lg">
          {fill(bagCopy.replaceBody, { current: bag.kitchen?.name[locale] ?? '' })}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (pending) replaceWith(kitchen, pending);
              dialog.current?.close();
            }}
          >
            {bagCopy.replaceConfirm}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => dialog.current?.close()}
          >
            {bagCopy.replaceCancel}
          </button>
        </div>
      </dialog>
    </div>
  );
}
