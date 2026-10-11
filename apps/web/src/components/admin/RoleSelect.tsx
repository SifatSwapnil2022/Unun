'use client';

import { USER_ROLES, type UserRole } from '@unun/core';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { api } from '@/lib/api';

type RoleSelectProps = {
  userId: number;
  role: UserRole;
  /** What the menu is for, read out by screen readers. */
  label: string;
  roles: Dictionary['roles'];
  failedLabel: string;
};

/** Gives a person another role. The list is read again afterwards. */
export function RoleSelect({ userId, role, label, roles, failedLabel }: RoleSelectProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const change = async (next: UserRole) => {
    setBusy(true);
    setFailed(false);
    try {
      await api.changeRole(userId, next);
    } catch {
      setFailed(true);
    }
    router.refresh();
    setBusy(false);
  };

  return (
    <div>
      <select
        aria-label={label}
        value={role}
        disabled={busy}
        onChange={(event) => void change(event.target.value as UserRole)}
        className="field-input mt-0 py-2"
      >
        {USER_ROLES.map((option) => (
          <option key={option} value={option}>
            {roles[option]}
          </option>
        ))}
      </select>
      {failed ? (
        <p role="alert" className="field-error">
          {failedLabel}
        </p>
      ) : null}
    </div>
  );
}
