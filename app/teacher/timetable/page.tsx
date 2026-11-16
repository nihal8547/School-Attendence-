import TimetableView from '@/components/TimetableView';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ class?: string; ok?: string; err?: string }> }) {
  return <TimetableView role="teacher" searchParams={await searchParams} />;
}
