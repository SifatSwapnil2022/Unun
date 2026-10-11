'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

/** Ends the session, then loads the home page afresh so nothing of it stays on screen. */
export function SignOutButton({ label, home }: { label: string; home: string }) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        api
          .signOut()
          .catch(() => {})
          .finally(() => window.location.assign(home));
      }}
      className="btn btn-outline"
    >
      {label}
    </button>
  );
}
