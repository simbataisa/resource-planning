import { EstimateList } from '@/components/features/estimates/estimate-list';

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <EstimateList projectId={projectId} />;
}
