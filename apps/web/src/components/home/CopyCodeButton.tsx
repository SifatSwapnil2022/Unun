'use client';

import { useEffect, useState } from 'react';

type CopyCodeButtonProps = {
  code: string;
  copyLabel: string;
  copiedLabel: string;
};

const CONFIRMATION_MS = 2000;

export function CopyCodeButton({ code, copyLabel, copiedLabel }: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard access was refused. The code is printed on the button, so it can still be typed.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="group flex w-fit items-center gap-4 rounded-full border-2 border-soot py-2 pr-5 pl-2 text-left transition-colors hover:bg-soot hover:text-ash"
    >
      <span className="rounded-full bg-soot px-4 py-2 font-mono text-lg font-medium tracking-wide text-ash group-hover:bg-ash group-hover:text-soot">
        {code}
      </span>
      <span aria-live="polite" className="min-w-[7.5ch] text-base font-semibold">
        {copied ? copiedLabel : copyLabel}
      </span>
    </button>
  );
}
