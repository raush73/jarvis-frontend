"use client";

import { useParams } from "next/navigation";
import OnboardingAdminInvestigation from "@/components/workforce/admin/surfaces/OnboardingAdminInvestigation";

export default function OnboardingAdminInvestigationPage() {
  const params = useParams<{ candidateId: string }>();
  const candidateId = params?.candidateId ?? "";

  return <OnboardingAdminInvestigation candidateId={candidateId} />;
}
