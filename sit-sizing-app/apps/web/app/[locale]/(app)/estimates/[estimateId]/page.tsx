import { EstimateEditor } from '@/components/features/estimate-editor/estimate-editor';

export default async function EstimatePage({
  params,
}: {
  params: Promise<{ estimateId: string }>;
}) {
  const { estimateId } = await params;
  return <EstimateEditor estimateId={estimateId} />;
}
