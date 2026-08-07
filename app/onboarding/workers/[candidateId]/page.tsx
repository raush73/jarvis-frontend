"use client";

import { useParams } from "next/navigation";
import OnboardingAdminWorkerWorkspace from "@/components/workforce/admin/surfaces/OnboardingAdminWorkerWorkspace";

export default function OnboardingAdminWorkerPage() {
  const params = useParams<{ candidateId: string }>();
  const candidateId = params?.candidateId ?? "";

  return <OnboardingAdminWorkerWorkspace candidateId={candidateId} />;
}
