'use client';

import type { AreaDto } from '@unun/core/contracts';
import Form from 'next/form';
import { useRouter } from 'next/navigation';
import { useId } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { rememberArea } from '@/lib/area';

type ListControlsProps = {
  locale: Locale;
  copy: Dictionary['list'];
  areas: AreaDto[];
  areaId: string | null;
  cuisineId: string | null;
  query: string;
  sort: string;
  /** True when a search was ranked by closeness, so that order can be offered. */
  byRelevance: boolean;
};

const SORTS = ['relevance', 'fastest', 'fee', 'record', 'rating'] as const;

/** Area, search and sort order for the kitchen list. */
export function ListControls({
  locale,
  copy,
  areas,
  areaId,
  cuisineId,
  query,
  sort,
  byRelevance,
}: ListControlsProps) {
  const router = useRouter();
  const areaField = useId();
  const searchField = useId();
  const sortField = useId();

  return (
    <div className="grid gap-x-5 gap-y-5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <div>
        <label htmlFor={areaField} className="field-label">
          {copy.areaLabel}
        </label>
        <select
          id={areaField}
          value={areaId ?? ''}
          onChange={(event) => {
            // The area is kept in a cookie, so the server renders the list for it.
            rememberArea(event.target.value || null);
            router.refresh();
          }}
          className="field-input"
        >
          <option value="">{copy.anyArea}</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name[locale]}
            </option>
          ))}
        </select>
      </div>

      <Form
        action={`/${locale}/kitchens`}
        className="grid gap-x-5 gap-y-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]"
      >
        {cuisineId ? <input type="hidden" name="cuisine" value={cuisineId} /> : null}

        <div>
          <label htmlFor={searchField} className="field-label">
            {copy.searchLabel}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id={searchField}
              type="search"
              name="q"
              defaultValue={query}
              maxLength={60}
              placeholder={copy.searchPlaceholder}
              className="field-input mt-0 min-w-0 flex-1"
            />
            <button type="submit" className="btn btn-dark shrink-0">
              {copy.searchSubmit}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor={sortField} className="field-label">
            {copy.sortLabel}
          </label>
          {/*
            The order is not part of the search form: a new search starts again from the
            closest match, whatever order the last one was shown in.
          */}
          <select
            id={sortField}
            key={sort}
            defaultValue={sort}
            onChange={(event) => {
              const next = new URLSearchParams();
              if (cuisineId) next.set('cuisine', cuisineId);
              if (query) next.set('q', query);
              next.set('sort', event.target.value);
              router.push(`/${locale}/kitchens?${next.toString()}`);
            }}
            className="field-input"
          >
            {SORTS.filter((value) => value !== 'relevance' || byRelevance).map(
              (value) => (
                <option key={value} value={value}>
                  {copy.sort[value]}
                </option>
              ),
            )}
          </select>
        </div>
      </Form>
    </div>
  );
}
