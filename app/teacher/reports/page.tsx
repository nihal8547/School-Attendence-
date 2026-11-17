import ReportsView from '@/components/ReportsView';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string; class?: string; from?: string; to?: string }> }) {
  return <ReportsView role="teacher" searchParams={await searchParams} />;
}
