import HomeworkView from '@/components/HomeworkView';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ class?: string; ok?: string; err?: string }> }) {
  return <HomeworkView role="teacher" searchParams={await searchParams} />;
}
