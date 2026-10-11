'use client';

import { ALLERGENS, TAKA, type Allergen } from '@unun/core';
import {
  MAX_ITEM_PRICE,
  MIN_ITEM_PRICE,
  type ItemUpdate,
  type MenuItemDto,
  type PartnerMenu,
} from '@unun/core/contracts';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Switch } from '@/components/ui/Switch';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';

type PartnerMenuViewProps = {
  locale: Locale;
  initial: PartnerMenu;
  copy: Dictionary['partner']['menu'];
  work: Dictionary['work'];
  allergenCopy: Dictionary['allergens'];
};

/**
 * The owner's menu: take a dish off when it runs out, change what it costs, or correct
 * what it contains.
 */
export function PartnerMenuView({
  locale,
  initial,
  copy,
  work,
  allergenCopy,
}: PartnerMenuViewProps) {
  const [menu, setMenu] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  /** The dish whose price was saved last, so "Saved" can be shown beside it. */
  const [savedItem, setSavedItem] = useState<number | null>(null);
  /** The dish whose allergens are being edited. */
  const [editing, setEditing] = useState<MenuItemDto | null>(null);

  const update = async (item: MenuItemDto, change: ItemUpdate): Promise<boolean> => {
    if (busy !== null) return false;
    setBusy(item.id);
    setFailed(false);
    setSavedItem(null);
    try {
      setMenu(await api.updateItem(item.id, change));
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-[52rem]">
      <p className="max-w-[60ch] text-lg">{copy.body}</p>

      <div aria-live="polite">
        {failed ? <p className="field-error mt-5 text-base">{work.failed}</p> : null}
      </div>

      {menu.sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`section-${section.id}`}
          className="mt-10"
        >
          <h2
            id={`section-${section.id}`}
            className="display text-[clamp(1.5rem,2.6vw,2rem)]"
          >
            {section.name[locale]}
          </h2>
          <ul className="mt-3 border-t border-soot/25">
            {section.items.map((item) => (
              <li
                key={item.id}
                className="grid items-center gap-x-6 gap-y-3 border-b border-soot/25 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              >
                <div className={item.available ? '' : 'text-soot/55'}>
                  <p className="text-[1.15rem] font-semibold">{item.name[locale]}</p>
                  <p className="text-sm">{item.available ? copy.onMenu : copy.offMenu}</p>
                  <p className="mt-1 text-sm">
                    {item.allergens.length === 0
                      ? copy.noAllergens
                      : fill(copy.contains, {
                          list: item.allergens
                            .map((allergen) =>
                              allergenCopy[allergen].toLocaleLowerCase(locale),
                            )
                            .join(', '),
                        })}
                    .{' '}
                    <button
                      type="button"
                      disabled={busy !== null}
                      aria-label={fill(copy.editAllergensFor, {
                        item: item.name[locale],
                      })}
                      onClick={() => setEditing(item)}
                      className="font-semibold text-soot underline underline-offset-4"
                    >
                      {copy.editAllergens}
                    </button>
                  </p>
                </div>

                <PriceForm
                  key={item.price}
                  item={item}
                  locale={locale}
                  copy={copy}
                  disabled={busy !== null}
                  saved={savedItem === item.id}
                  onSave={async (price) => {
                    if (await update(item, { price })) setSavedItem(item.id);
                  }}
                />

                <Switch
                  checked={item.available}
                  disabled={busy !== null}
                  label={fill(copy.availability, { item: item.name[locale] })}
                  onChange={(available) => void update(item, { available })}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <AllergenDialog
        key={editing?.id ?? 'closed'}
        item={editing}
        locale={locale}
        copy={copy.allergenDialog}
        allergenCopy={allergenCopy}
        onClose={() => setEditing(null)}
        onSave={(allergens) => {
          const item = editing;
          setEditing(null);
          if (item) void update(item, { allergens });
        }}
      />
    </div>
  );
}

type AllergenDialogProps = {
  /** The dish being edited, or null while the dialog is closed. */
  item: MenuItemDto | null;
  locale: Locale;
  copy: Dictionary['partner']['menu']['allergenDialog'];
  allergenCopy: Dictionary['allergens'];
  onSave: (allergens: Allergen[]) => void;
  onClose: () => void;
};

function AllergenDialog({
  item,
  locale,
  copy,
  allergenCopy,
  onSave,
  onClose,
}: AllergenDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [chosen, setChosen] = useState<Allergen[]>(item?.allergens ?? []);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (item && !node.open) node.showModal();
    if (!item && node.open) node.close();
  }, [item]);

  return (
    <dialog ref={dialog} className="sheet" aria-labelledby={titleId} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(chosen);
        }}
      >
        <h2 id={titleId} className="display text-3xl">
          {fill(copy.title, { item: item?.name[locale] ?? '' })}
        </h2>
        <p className="mt-4 text-lg">{copy.body}</p>

        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2.5">
          {ALLERGENS.map((allergen) => (
            <label key={allergen} className="flex items-center gap-3 text-lg">
              <input
                type="checkbox"
                checked={chosen.includes(allergen)}
                onChange={(event) =>
                  setChosen((now) =>
                    event.target.checked
                      ? [...now, allergen]
                      : now.filter((entry) => entry !== allergen),
                  )
                }
                className="h-5 w-5 shrink-0 accent-soot"
              />
              <span>{allergenCopy[allergen]}</span>
            </label>
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <button type="submit" className="btn btn-dark">
            {copy.save}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => dialog.current?.close()}
          >
            {copy.cancel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

type PriceFormProps = {
  item: MenuItemDto;
  locale: Locale;
  copy: Dictionary['partner']['menu'];
  disabled: boolean;
  saved: boolean;
  onSave: (price: number) => void;
};

function PriceForm({ item, locale, copy, disabled, saved, onSave }: PriceFormProps) {
  const [text, setText] = useState(String(item.price / TAKA));
  const [invalid, setInvalid] = useState(false);
  const errorId = `price-${item.id}-error`;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const taka = Number(text);
    const price = taka * TAKA;
    if (!Number.isInteger(taka) || price < MIN_ITEM_PRICE || price > MAX_ITEM_PRICE) {
      setInvalid(true);
      return;
    }
    if (price !== item.price) onSave(price);
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-lg font-semibold">
          ৳
        </span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={text}
          aria-label={fill(copy.price, { item: item.name[locale] })}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setInvalid(false);
          }}
          className="field-input mt-0 w-24 px-3 py-2 tabular-nums"
        />
        <button type="submit" disabled={disabled} className="btn btn-outline px-4 py-2">
          {copy.save}
        </button>
        <span aria-live="polite" className="w-12 text-sm font-semibold text-leaf">
          {saved ? copy.saved : ''}
        </span>
      </div>
      {invalid ? (
        <p id={errorId} className="field-error">
          {fill(copy.priceError, {
            min: formatNumber(MIN_ITEM_PRICE / TAKA, locale),
            max: formatNumber(MAX_ITEM_PRICE / TAKA, locale),
          })}
        </p>
      ) : null}
    </form>
  );
}
