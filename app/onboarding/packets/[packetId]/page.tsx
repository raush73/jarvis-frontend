"use client";

import { useParams } from "next/navigation";
import OnboardingAdminPacketWorkspace from "@/components/workforce/admin/surfaces/OnboardingAdminPacketWorkspace";

export default function OnboardingAdminPacketPage() {
  const params = useParams<{ packetId: string }>();
  const packetId = params?.packetId ?? "";

  return <OnboardingAdminPacketWorkspace packetId={packetId} />;
}
