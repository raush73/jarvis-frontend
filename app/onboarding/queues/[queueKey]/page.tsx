"use client";

import { useParams } from "next/navigation";
import OnboardingAdminQueueView from "@/components/workforce/admin/surfaces/OnboardingAdminQueueView";

export default function OnboardingAdminQueuePage() {
  const params = useParams<{ queueKey: string }>();
  const queueKey = params?.queueKey ?? "";

  return <OnboardingAdminQueueView queueKey={queueKey} />;
}
