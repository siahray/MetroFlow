"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { RescueTracking } from "@/components/rescue-tracking";
import { VehicleManagement } from "@/components/vehicle-management";
import { useToast } from "@/components/toast-provider";

export default function FleetPage() {
  const router = useRouter();
  const { show } = useToast();
  const [view, setView] = useState<"tracking" | "management">("tracking");

  return (
    <AppShell activeItem="fleet" title="Rescue Fleet & Mission Operations">
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setView("tracking")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            view === "tracking"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Mission Tracking
        </button>
        <button
          onClick={() => setView("management")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            view === "management"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Fleet Management
        </button>
      </div>

      {view === "tracking" ? (
        <RescueTracking onBack={() => router.push("/triage")} onAction={show} />
      ) : (
        <VehicleManagement />
      )}
    </AppShell>
  );
}
