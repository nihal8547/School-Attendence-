import HolidaysView from '@/components/HolidaysView';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  return <HolidaysView role="admin" searchParams={await searchParams} />;
}
