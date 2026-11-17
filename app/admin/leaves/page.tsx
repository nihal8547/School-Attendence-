import LeavesView from '@/components/LeavesView';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ class?: string; ok?: string; err?: string }> }) {
  return <LeavesView role="admin" searchParams={await searchParams} />;
}
