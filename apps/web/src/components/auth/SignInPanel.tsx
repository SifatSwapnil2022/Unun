'use client';

import { LOGIN_CODE_LENGTH, firstName, normaliseMobile } from '@unun/core';
import type { DemoAccountDto, UserDto } from '@unun/core/contracts';
import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { ApiRequestError, api } from '@/lib/api';
import { formatNumber, plural } from '@/lib/format';
import { HOME_BY_ROLE } from '@/lib/roles';

type SignInPanelProps = {
  locale: Locale;
  copy: Dictionary['auth'];
  roles: Dictionary['roles'];
  /** Where to go after signing in. Null sends each role to its own start page. */
  next: string | null;
  /** The visitor, if they are signed in already. */
  user: UserDto | null;
  /** Seeded accounts open to anyone. Empty unless the API runs in demo mode. */
  demoAccounts: DemoAccountDto[];
};

type Step = { name: 'phone' } | { name: 'code'; phone: string; demo: boolean };

export function SignInPanel({
  locale,
  copy,
  roles,
  next,
  user,
  demoAccounts,
}: SignInPanelProps) {
  const phoneId = useId();
  const codeId = useId();
  const [step, setStep] = useState<Step>({ name: 'phone' });
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const homeOf = (signedIn: UserDto) =>
    next ?? `/${locale}/${HOME_BY_ROLE[signedIn.role]}`;

  /** A full page load, so every part of the site sees the new session at once. */
  const enter = (signedIn: UserDto) => window.location.assign(homeOf(signedIn));

  const describe = (failure: unknown): string => {
    if (!(failure instanceof ApiRequestError)) return copy.errors.generic;
    switch (failure.code) {
      case 'invalid_phone':
        return copy.errors.phone;
      case 'invalid_code': {
        const left = (failure.details as { attemptsLeft?: number } | undefined)
          ?.attemptsLeft;
        return left !== undefined && left > 0
          ? fill(plural(left, copy.errors.triesLeft), {
              count: formatNumber(left, locale),
            })
          : copy.errors.code;
      }
      case 'rate_limited':
        return copy.errors.rateLimited;
      default:
        return copy.errors.generic;
    }
  };

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (failure) {
      setError(describe(failure));
      setBusy(false);
    }
  };

  const sendCode = (toPhone: string) =>
    run(async () => {
      const sent = await api.requestCode(toPhone);
      setStep({ name: 'code', phone: toPhone, demo: sent.demoCode !== null });
      setCode(sent.demoCode ?? '');
      setBusy(false);
    });

  const verify = (ofPhone: string, withCode: string) =>
    run(async () => {
      const session = await api.verifyCode(ofPhone, withCode);
      if (session.user) enter(session.user);
    });

  /** One click on a demo account: ask for its code and use it straight away. */
  const signInAsDemo = (account: DemoAccountDto) =>
    run(async () => {
      const sent = await api.requestCode(account.phone);
      if (sent.demoCode === null) {
        setStep({ name: 'code', phone: account.phone, demo: false });
        setBusy(false);
        return;
      }
      const session = await api.verifyCode(account.phone, sent.demoCode);
      if (session.user) enter(session.user);
    });

  const onPhoneSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const mobile = normaliseMobile(phone);
    if (!mobile) {
      setError(copy.errors.phone);
      document.getElementById(phoneId)?.focus();
      return;
    }
    void sendCode(mobile);
  };

  const onCodeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step.name === 'code') void verify(step.phone, code);
  };

  return (
    <div className="grid gap-x-20 gap-y-16 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
      <div>
        <h1 className="display text-section">{copy.title}</h1>

        {user ? (
          <p className="mt-6 rounded-[1.25rem] bg-paper p-5 text-lg">
            {fill(copy.already, { name: user.name || user.phone })}{' '}
            <Link
              href={homeOf(user)}
              className="font-semibold underline underline-offset-4"
            >
              {copy.continue}
            </Link>
          </p>
        ) : null}

        {step.name === 'phone' ? (
          <form onSubmit={onPhoneSubmit} noValidate className="mt-6">
            <p className="max-w-[40ch] text-lg">{copy.body}</p>

            <div className="mt-7">
              <label htmlFor={phoneId} className="field-label">
                {copy.phone}
              </label>
              <input
                id={phoneId}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                maxLength={24}
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setError(null);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${phoneId}-note`}
                className="field-input"
              />
              <p
                id={`${phoneId}-note`}
                role={error ? 'alert' : undefined}
                className={error ? 'field-error' : 'field-hint'}
              >
                {error ?? copy.phoneHint}
              </p>
            </div>

            <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full">
              {busy ? copy.sending : copy.sendCode}
            </button>
          </form>
        ) : (
          <form onSubmit={onCodeSubmit} noValidate className="mt-6">
            <h2 className="display text-[clamp(1.5rem,2.6vw,2rem)]">{copy.codeTitle}</h2>
            <p className="mt-3 max-w-[40ch] text-lg">
              {fill(copy.codeBody, { phone: step.phone })}
            </p>

            <div className="mt-7">
              <label htmlFor={codeId} className="field-label">
                {copy.code}
              </label>
              <input
                id={codeId}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={LOGIN_CODE_LENGTH + 6}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setError(null);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error || step.demo ? `${codeId}-note` : undefined}
                className="field-input font-mono text-2xl tracking-[0.3em]"
              />
              {error || step.demo ? (
                <p
                  id={`${codeId}-note`}
                  role={error ? 'alert' : undefined}
                  className={error ? 'field-error' : 'field-hint'}
                >
                  {error ?? copy.demoCode}
                </p>
              ) : null}
            </div>

            <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full">
              {busy ? copy.signingIn : copy.signIn}
            </button>

            <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-base">
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendCode(step.phone)}
                className="font-semibold underline underline-offset-4"
              >
                {copy.resend}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep({ name: 'phone' });
                  setCode('');
                  setError(null);
                }}
                className="font-semibold underline underline-offset-4"
              >
                {copy.changeNumber}
              </button>
            </p>
          </form>
        )}
      </div>

      {demoAccounts.length > 0 ? (
        <section aria-labelledby="demo-accounts">
          <h2 id="demo-accounts" className="display text-[clamp(1.6rem,3vw,2.2rem)]">
            {copy.demo.title}
          </h2>
          <p className="mt-3 max-w-[52ch] text-lg">{copy.demo.body}</p>

          <ul className="mt-7 border-t border-soot/25">
            {demoAccounts.map((account) => (
              <li
                key={account.phone}
                className="grid items-center gap-x-6 gap-y-3 border-b border-soot/25 py-5 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div>
                  <p className="text-base font-semibold text-clay">
                    {roles[account.role]}
                  </p>
                  <p className="mt-1 text-[1.2rem] font-semibold">{account.name}</p>
                  <p className="mt-1 text-base text-soot/75">
                    {fill(copy.demo.about[account.role], {
                      kitchen: account.kitchen?.[locale] ?? '',
                    })}
                  </p>
                  <p className="mt-1 font-mono text-sm text-soot/70">{account.phone}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void signInAsDemo(account)}
                  className="btn btn-outline w-fit px-5 py-2"
                >
                  {fill(copy.demo.use, { name: firstName(account.name) })}
                </button>
              </li>
            ))}
          </ul>

          <h3 className="mt-10 text-lg font-semibold">{copy.demo.loopTitle}</h3>
          <ol className="mt-3 max-w-[60ch] list-decimal space-y-1.5 pl-6 text-base text-soot/85">
            {copy.demo.loop.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
