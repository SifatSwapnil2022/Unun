'use client';

import type { UserDto } from '@unun/core/contracts';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { api } from '@/lib/api';

type ProfileFormProps = {
  user: UserDto;
  copy: Dictionary['account'];
};

/** The signed-in person's name. Their number is how they sign in, so it is only shown. */
export function ProfileForm({ user, copy }: ProfileFormProps) {
  const router = useRouter();
  const nameId = useId();
  const [name, setName] = useState(user.name);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError(copy.errors.name);
      document.getElementById(nameId)?.focus();
      return;
    }

    setState('saving');
    setError(null);
    try {
      await api.updateName(name.trim());
      setState('saved');
      // The header greets the person by name, so it is rendered again.
      router.refresh();
    } catch {
      setError(copy.errors.generic);
      setState('idle');
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-[26rem]">
      {user.name ? null : <p className="mb-5 text-lg">{copy.namePrompt}</p>}

      <label htmlFor={nameId} className="field-label">
        {copy.name}
      </label>
      <input
        id={nameId}
        type="text"
        autoComplete="name"
        maxLength={60}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
          setState('idle');
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${nameId}-error` : undefined}
        className="field-input"
      />
      {error ? (
        <p id={`${nameId}-error`} role="alert" className="field-error">
          {error}
        </p>
      ) : null}

      <p className="field-label mt-5">{copy.phone}</p>
      <p className="mt-1 font-mono text-lg">{user.phone}</p>
      <p className="field-hint">{copy.phoneHint}</p>

      <div className="mt-6 flex items-center gap-4">
        <button type="submit" disabled={state === 'saving'} className="btn btn-dark">
          {state === 'saving' ? copy.saving : copy.saveName}
        </button>
        <span aria-live="polite" className="text-base font-semibold text-leaf">
          {state === 'saved' ? copy.saved : ''}
        </span>
      </div>
    </form>
  );
}
