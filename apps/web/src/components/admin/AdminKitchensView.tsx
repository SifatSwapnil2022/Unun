'use client';

import type { AdminKitchenDto, AdminKitchenUpdate } from '@unun/core/contracts';
import { useState } from 'react';
import { Switch } from '@/components/ui/Switch';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { api } from '@/lib/api';
import { formatNumber, plural } from '@/lib/format';

type AdminKitchensViewProps = {
  locale: Locale;
  initial: AdminKitchenDto[];
  /** People with the owner role, who can be put in charge of a kitchen. */
  owners: Array<{ id: number; name: string; phone: string }>;
  copy: Dictionary['admin']['kitchens'];
  work: Dictionary['work'];
};

/** Every kitchen, with who runs it and whether customers can see it. */
export function AdminKitchensView({
  locale,
  initial,
  owners,
  copy,
  work,
}: AdminKitchensViewProps) {
  const [kitchens, setKitchens] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const update = async (slug: string, change: AdminKitchenUpdate) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      setKitchens(await api.updateKitchen(slug, change));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const flagsOf = (kitchen: AdminKitchenDto) =>
    [kitchen.autopilot ? null : copy.byHand, kitchen.paused ? copy.paused : null].filter(
      (flag): flag is string => flag !== null,
    );

  return (
    <>
      <p className="text-lg font-semibold tabular-nums">
        {fill(plural(kitchens.length, copy.count), {
          count: formatNumber(kitchens.length, locale),
        })}
      </p>

      <div aria-live="polite">
        {failed ? <p className="field-error mt-3 text-base">{work.failed}</p> : null}
      </div>

      <ul className="mt-4 border-t border-soot/25">
        {kitchens.map((kitchen) => {
          const name = kitchen.name[locale];
          return (
            <li
              key={kitchen.slug}
              className="grid items-center gap-x-8 gap-y-3 border-b border-soot/25 py-4 md:grid-cols-[minmax(0,1fr)_16rem_auto]"
            >
              <div className={kitchen.active ? '' : 'text-soot/60'}>
                <p className="text-[1.2rem] font-semibold">{name}</p>
                <p className="text-base text-soot/75 tabular-nums">
                  {kitchen.area[locale]},{' '}
                  {fill(plural(kitchen.ordersThisWeek, copy.weekOrders), {
                    count: formatNumber(kitchen.ordersThisWeek, locale),
                  })}
                </p>
                {flagsOf(kitchen).length > 0 ? (
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    {flagsOf(kitchen).map((flag) => (
                      <span key={flag} className="chip bg-ash-deep text-soot">
                        {flag}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>

              <select
                aria-label={fill(copy.owner, { kitchen: name })}
                value={kitchen.owner?.id ?? ''}
                disabled={busy}
                onChange={(event) =>
                  void update(kitchen.slug, {
                    ownerId: event.target.value ? Number(event.target.value) : null,
                  })
                }
                className="field-input mt-0 py-2"
              >
                <option value="">{copy.noOwner}</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name || owner.phone}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-3 md:justify-end">
                <span className="text-base text-soot/75">
                  {kitchen.active ? copy.shown : copy.hidden}
                </span>
                <Switch
                  checked={kitchen.active}
                  disabled={busy}
                  label={fill(copy.visibility, { kitchen: name })}
                  onChange={(active) => void update(kitchen.slug, { active })}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
