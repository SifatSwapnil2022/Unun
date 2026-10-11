'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ReasonDialog } from '@/components/work/ReasonDialog';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { fill } from '@/i18n/get-dictionary';
import { api } from '@/lib/api';

type CancelOrderButtonProps = {
  publicId: string;
  copy: Dictionary['admin']['orders'];
  work: Dictionary['work'];
};

/** Lets support staff stop an order that has not been delivered, with a reason. */
export function CancelOrderButton({ publicId, copy, work }: CancelOrderButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const cancel = async (reason: string) => {
    setOpen(false);
    setBusy(true);
    setFailed(false);
    try {
      await api.cancelOrder(publicId, reason);
    } catch {
      setFailed(true);
    }
    // Either way the list is read again: the order may have finished in the meantime.
    router.refresh();
    setBusy(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        className="text-base font-semibold underline underline-offset-4 hover:text-clay"
      >
        {copy.cancel}
      </button>
      {failed ? (
        <span role="alert" className="text-base font-semibold text-clay">
          {work.failed}
        </span>
      ) : null}

      <ReasonDialog
        open={open}
        title={fill(copy.cancelDialog.title, { id: publicId })}
        body={copy.cancelDialog.body}
        reasons={copy.cancelDialog.reasons}
        confirmLabel={copy.cancelDialog.confirm}
        keepLabel={copy.cancelDialog.keep}
        copy={work}
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={(reason) => void cancel(reason)}
      />
    </>
  );
}
