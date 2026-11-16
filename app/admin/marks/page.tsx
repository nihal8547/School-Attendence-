import MarksList from '@/components/MarksList';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ class?: string; ok?: string; err?: string }> }) {
  return <MarksList role="admin" searchParams={await searchParams} />;
}
