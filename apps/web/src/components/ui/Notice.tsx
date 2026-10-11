import type { ReactNode } from 'react';

type NoticeProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

/** A full-width message for the cases where a page has nothing else to show. */
export function Notice({ title, children, action }: NoticeProps) {
  return (
    <section className="bg-ash">
      <div className="page-column py-[clamp(3.5rem,9vw,6.5rem)]">
        <h1 className="display text-section max-w-[18ch]">{title}</h1>
        <p className="mt-5 max-w-[52ch] text-xl">{children}</p>
        {action ? <div className="mt-8">{action}</div> : null}
      </div>
    </section>
  );
}
