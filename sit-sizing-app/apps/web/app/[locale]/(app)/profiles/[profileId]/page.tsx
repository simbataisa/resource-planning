import { ProfileEditor } from '@/components/features/profiles/profile-editor';

export default async function ProfilePage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  return <ProfileEditor profileId={profileId} />;
}
