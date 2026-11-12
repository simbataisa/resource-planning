import { VersionComparePage } from '@/components/features/versions/version-compare';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ estimateId: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { estimateId } = await params;
  const q = await searchParams;
  return <VersionComparePage estimateId={estimateId} a={Number(q.a) || 1} b={Number(q.b) || 1} />;
}
