'use client';

import { matchArea } from '@unun/core';
import type { AreaDto } from '@unun/core/contracts';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { rememberArea } from '@/lib/area';

type AddressFormProps = {
  locale: Locale;
  copy: Dictionary['hero'];
  areas: AreaDto[];
};

export function AddressForm({ locale, copy, areas }: AddressFormProps) {
  const router = useRouter();
  const inputId = useId();
  const messageId = useId();
  const [query, setQuery] = useState('');
  const [notFound, setNotFound] = useState(false);

  const searchable = useMemo(
    () =>
      areas.map((area) => ({
        id: area.id,
        names: [area.name.en, area.name.bn, ...area.aliases],
      })),
    [areas],
  );

  const go = (areaId: string | null) => {
    if (areaId) rememberArea(areaId);
    router.push(`/${locale}/kitchens`);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // With no area list (the API is down) the kitchens page explains the problem.
    if (areas.length === 0) return go(null);

    const area = matchArea(query, searchable);
    if (area) go(area.id);
    else setNotFound(true);
  };

  return (
    <form onSubmit={onSubmit} className="mt-9 max-w-[34rem]" noValidate>
      <label htmlFor={inputId} className="block text-base font-medium text-ash">
        {copy.addressLabel}
      </label>

      <div className="mt-3 flex items-stretch rounded-full bg-ash p-1.5 focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-turmeric">
        <input
          id={inputId}
          type="text"
          name="area"
          autoComplete="address-level2"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setNotFound(false);
          }}
          placeholder={copy.addressPlaceholder}
          aria-invalid={notFound}
          aria-describedby={notFound ? messageId : undefined}
          className="min-w-0 flex-1 rounded-full bg-transparent px-5 py-3 text-lg text-soot placeholder:text-soot/55 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-ember px-6 py-3 text-lg font-semibold text-soot transition-colors hover:bg-turmeric focus-visible:outline-offset-1"
        >
          {copy.submit}
        </button>
      </div>

      {notFound ? (
        <div id={messageId} role="alert" className="mt-4 text-base text-ash">
          <p>{copy.unknownArea}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {areas.map((area) => (
              <li key={area.id}>
                <button
                  type="button"
                  onClick={() => go(area.id)}
                  className="rounded-full border border-ash/40 px-4 py-2 text-ash transition-colors hover:border-turmeric hover:text-turmeric"
                >
                  {area.name[locale]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
