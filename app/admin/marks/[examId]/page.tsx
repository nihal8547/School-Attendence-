import { notFound } from 'next/navigation';
import ExamSheet from '@/components/ExamSheet';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const examId = Number((await params).examId);
  if (!Number.isInteger(examId) || examId < 1) notFound();
  return <ExamSheet role="admin" examId={examId} searchParams={await searchParams} />;
}
