import SyllabusView from '@/components/SyllabusView';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ class?: string; ok?: string; err?: string }> }) {
  return <SyllabusView role="admin" searchParams={await searchParams} />;
}
