import { PageSkeleton } from '@/components/ui/PageSkeleton';

/** Shown while this page's data is being fetched. */
export default function Loading() {
  return <PageSkeleton shape="workspace" label="Loading. লোড হচ্ছে।" />;
}
