import { ActualsPage } from '@/components/features/actuals/actuals-page';

export default async function Page({
  params,
}: {
  params: Promise<{ estimateId: string; number: string }>;
}) {
  const { estimateId, number } = await params;
  return <ActualsPage estimateId={estimateId} number={Number(number) || 1} />;
}
