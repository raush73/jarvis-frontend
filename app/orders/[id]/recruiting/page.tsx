import { redirect } from 'next/navigation';

/**
 * Recruiting Route (Deprecated)
 * 
 * This route has been renamed to /vetting.
 * Redirects automatically to preserve existing links/bookmarks.
 */
export default function RecruitingPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/orders/${params.id}/vetting`);
}
