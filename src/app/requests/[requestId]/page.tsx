import { AppShell } from "@/components/quotebook/app-shell";
import { RequestDetail } from "@/components/quotebook/request-detail";

/**
 * The request workspace.
 *
 * Every panel below is driven by a live Convex subscription, so this page is a
 * thin server shell: it only resolves the id from the route and hands it to the
 * client tree, which then updates itself as discovery and replies land.
 */
export default async function RequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return (
    <AppShell>
      <RequestDetail requestId={requestId} />
    </AppShell>
  );
}
