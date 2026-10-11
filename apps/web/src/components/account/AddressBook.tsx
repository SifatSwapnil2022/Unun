'use client';

import type { AddressDto, AreaDto } from '@unun/core/contracts';
import { useId, useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { api, errorCode } from '@/lib/api';

type AddressBookProps = {
  locale: Locale;
  initial: AddressDto[];
  areas: AreaDto[];
  copy: Dictionary['account'];
};

type Field = 'label' | 'area' | 'line';

/** Saved delivery addresses: the list, and a form that adds to it. */
export function AddressBook({ locale, initial, areas, copy }: AddressBookProps) {
  const ids = { label: useId(), area: useId(), line: useId() };
  const [addresses, setAddresses] = useState(initial);
  const [label, setLabel] = useState('');
  const [areaId, setAreaId] = useState('');
  const [line, setLine] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = (error: unknown) =>
    errorCode(error) === 'limit_reached' ? copy.addressLimit : copy.errors.generic;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const found: Partial<Record<Field, string>> = {};
    if (label.trim().length < 1) found.label = copy.errors.label;
    if (!areaId) found.area = copy.errors.area;
    if (line.trim().length < 5) found.line = copy.errors.line;
    setErrors(found);

    const firstInvalid = (['label', 'area', 'line'] as const).find(
      (field) => found[field],
    );
    if (firstInvalid) {
      document.getElementById(ids[firstInvalid])?.focus();
      return;
    }

    setBusy(true);
    setFailure(null);
    try {
      setAddresses(
        await api.addAddress({ label: label.trim(), area: areaId, line: line.trim() }),
      );
      setLabel('');
      setAreaId('');
      setLine('');
    } catch (error) {
      setFailure(describe(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (address: AddressDto) => {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      setAddresses(await api.removeAddress(address.id));
    } catch (error) {
      setFailure(describe(error));
    } finally {
      setBusy(false);
    }
  };

  const invalid = (field: Field) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${ids[field]}-error` : undefined,
  });

  const errorFor = (field: Field) =>
    errors[field] ? (
      <p id={`${ids[field]}-error`} className="field-error">
        {errors[field]}
      </p>
    ) : null;

  const clear = (field: Field) =>
    setErrors((current) => {
      if (!current[field]) return current;
      const rest = { ...current };
      delete rest[field];
      return rest;
    });

  return (
    <div className="grid gap-x-14 gap-y-10 lg:grid-cols-2">
      <div>
        {addresses.length === 0 ? (
          <p className="max-w-[40ch] text-lg">{copy.noAddresses}</p>
        ) : (
          <ul className="border-t border-soot/25">
            {addresses.map((address) => (
              <li
                key={address.id}
                className="flex items-start justify-between gap-5 border-b border-soot/25 py-4"
              >
                <div className="min-w-0">
                  <p className="text-[1.2rem] font-semibold">{address.label}</p>
                  <p className="mt-0.5 text-base text-soot/80">
                    {address.line}, {address.area.name[locale]}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={fill(copy.removeNamed, { label: address.label })}
                  onClick={() => void remove(address)}
                  className="shrink-0 text-base font-semibold underline underline-offset-4 hover:text-clay"
                >
                  {copy.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={onSubmit} noValidate className="max-w-[26rem]">
        <h3 className="text-[1.2rem] font-semibold">{copy.addAddress}</h3>

        <div className="mt-4">
          <label htmlFor={ids.label} className="field-label">
            {copy.label}
          </label>
          <input
            id={ids.label}
            type="text"
            maxLength={24}
            value={label}
            placeholder={copy.labelPlaceholder}
            onChange={(event) => {
              setLabel(event.target.value);
              clear('label');
            }}
            className="field-input"
            {...invalid('label')}
          />
          {errorFor('label')}
        </div>

        <div className="mt-4">
          <label htmlFor={ids.area} className="field-label">
            {copy.area}
          </label>
          <select
            id={ids.area}
            value={areaId}
            onChange={(event) => {
              setAreaId(event.target.value);
              clear('area');
            }}
            className="field-input"
            {...invalid('area')}
          >
            <option value="" disabled>
              {copy.chooseArea}
            </option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name[locale]}
              </option>
            ))}
          </select>
          {errorFor('area')}
        </div>

        <div className="mt-4">
          <label htmlFor={ids.line} className="field-label">
            {copy.line}
          </label>
          <input
            id={ids.line}
            type="text"
            autoComplete="street-address"
            maxLength={200}
            value={line}
            placeholder={copy.linePlaceholder}
            onChange={(event) => {
              setLine(event.target.value);
              clear('line');
            }}
            className="field-input"
            {...invalid('line')}
          />
          {errorFor('line')}
        </div>

        <div aria-live="polite">
          {failure ? <p className="field-error mt-4 text-base">{failure}</p> : null}
        </div>

        <button type="submit" disabled={busy} className="btn btn-dark mt-6">
          {busy ? copy.saving : copy.saveAddress}
        </button>
      </form>
    </div>
  );
}
