"use client";

import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { RescueTracking } from "@/components/rescue-tracking";
import { useToast } from "@/components/toast-provider";

export default function FleetPage() {
  const router = useRouter();
  const { show } = useToast();

  return (
    <AppShell activeItem="fleet" title="Rescue Fleet & Mission Operations">
      <RescueTracking onBack={() => router.push("/triage")} onAction={show} />
    </AppShell>
  );
}
