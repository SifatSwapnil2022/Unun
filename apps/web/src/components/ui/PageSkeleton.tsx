import { Logo } from '@/components/brand/Logo';

type PageSkeletonProps = {
  /** The shape of the page that is coming, so the wait looks like the arrival. */
  shape: 'list' | 'kitchen' | 'order' | 'workspace' | 'form';
  /** Read to people who cannot see the grey blocks. */
  label: string;
};

const block = 'skeleton rounded-2xl';
const line = 'skeleton h-4 rounded-full';
const THREE = [0, 1, 2];
const SIX = [0, 1, 2, 3, 4, 5];

function Card() {
  return (
    <li>
      <div className={`${block} aspect-[4/3]`} />
      <div className="mt-4 flex items-center gap-3.5">
        <div className="skeleton h-[3.75rem] w-[3.75rem] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className={`${line} h-6 w-2/3`} />
          <div className={`${line} mt-2.5 w-1/2`} />
        </div>
      </div>
      <div className={`${line} mt-4 w-3/5`} />
    </li>
  );
}

function Rows({ count }: { count: number[] }) {
  return (
    <ul className="mt-6 border-t border-soot/15">
      {count.map((index) => (
        <li key={index} className="flex gap-5 border-b border-soot/15 py-5">
          <div className="flex-1">
            <div className={`${line} h-5 w-1/2`} />
            <div className={`${line} mt-3 w-4/5`} />
            <div className={`${line} mt-2.5 w-1/4`} />
          </div>
          <div className={`${block} h-24 w-24 shrink-0`} />
        </li>
      ))}
    </ul>
  );
}

/**
 * What a page shows while its data is on the way: the header it will have, and grey
 * blocks where its content will be. The blocks have the page's own layout, so nothing
 * jumps when the content lands.
 */
export function PageSkeleton({ shape, label }: PageSkeletonProps) {
  const tall = shape === 'kitchen' || shape === 'order' || shape === 'workspace';

  return (
    <div role="status" aria-label={label} aria-busy="true">
      <div className="bg-soot text-ember">
        <div className="page-column site-header pb-6 sm:pb-7">
          <Logo className="h-10 w-auto opacity-60 sm:h-12" />
        </div>
        {tall ? (
          <div className="page-column pb-[clamp(2.5rem,6vw,4.5rem)]">
            {shape === 'kitchen' ? (
              <div className="skeleton-dark aspect-[16/10] w-full rounded-[1.75rem] sm:aspect-[5/2] lg:aspect-[3/1]" />
            ) : null}
            <div className="skeleton-dark mt-8 h-12 w-3/5 max-w-[28rem] rounded-2xl sm:h-16" />
            <div className="skeleton-dark mt-5 h-4 w-2/5 max-w-[18rem] rounded-full" />
          </div>
        ) : null}
      </div>

      <div className="min-h-[70vh] bg-ash">
        <div className="page-column py-[clamp(2.5rem,6vw,4.5rem)]">
          {shape === 'list' ? (
            <>
              <div className={`${block} h-12 w-3/4 max-w-[30rem]`} />
              <div className={`${block} mt-9 h-14 max-w-[44rem]`} />
              <ul className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {SIX.map((index) => (
                  <Card key={index} />
                ))}
              </ul>
            </>
          ) : null}

          {shape === 'kitchen' || shape === 'order' ? (
            <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div>
                <div className={`${block} h-9 w-1/3`} />
                <Rows count={THREE} />
              </div>
              <div className={`${block} hidden h-80 lg:block`} />
            </div>
          ) : null}

          {shape === 'workspace' ? (
            <>
              <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="border-t-[3px] border-soot/20 pt-3">
                    <div className={`${line} w-1/2`} />
                    <div className={`${block} mt-3 h-10 w-2/3`} />
                  </div>
                ))}
              </div>
              <Rows count={THREE} />
            </>
          ) : null}

          {shape === 'form' ? (
            <div className="max-w-[38rem]">
              <div className={`${block} h-12 w-1/2`} />
              {THREE.map((index) => (
                <div key={index} className="mt-8">
                  <div className={`${line} w-1/4`} />
                  <div className={`${block} mt-3 h-14`} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
