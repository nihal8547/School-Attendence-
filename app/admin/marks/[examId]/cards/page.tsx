import { notFound } from 'next/navigation';
import ReportCardsPrint from '@/components/ReportCardsPrint';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: Promise<{ examId: string }>; searchParams: Promise<{ student?: string }> }) {
  const examId = Number((await params).examId);
  if (!Number.isInteger(examId) || examId < 1) notFound();
  const st = Number((await searchParams).student) || undefined;
  return <ReportCardsPrint role="admin" examId={examId} studentId={st} />;
}
