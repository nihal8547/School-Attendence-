import AnnouncementsView from '@/components/AnnouncementsView';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  return <AnnouncementsView role="admin" searchParams={await searchParams} />;
}
