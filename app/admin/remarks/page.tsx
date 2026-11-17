import RemarksView from '@/components/RemarksView';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ class?: string; ok?: string; err?: string }> }) {
  return <RemarksView role="admin" searchParams={await searchParams} />;
}
