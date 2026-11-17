import AccountView from '@/components/AccountView';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  return <AccountView role="admin" searchParams={await searchParams} />;
}
