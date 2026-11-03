"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { OfflineBanner } from "./error-notice";
import { Sidebar, type NavItem } from "./sidebar";
import { listReports } from "@/lib/reports";
import { listSOS } from "@/lib/sos-live";
import { listVehicles } from "@/lib/dispatch";
import { clearSessionUser, getSessionUser, subscribeToSession } from "@/lib/session";

type AppShellProps = {
  activeItem: NavItem;
  title: string;
  children: ReactNode;
};

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function AppShell({ activeItem, title, children }: AppShellProps) {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const router = useRouter();
  // The portal has no server-side session, so the shell reads the browser cache
  // through useSyncExternalStore instead of copying it into state from an effect.
  const user = useSyncExternalStore(subscribeToSession, getSessionUser, () => null);
  const [queueCount, setQueueCount] = useState(0);
  const [fleetCount, setFleetCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  useEffect(() => {
    const load = async () => {
      try {
        const [sos, vehicles, reports] = await Promise.all([
          listSOS().catch(() => []),
          listVehicles().catch(() => []),
          listReports().catch(() => []),
        ]);
        setQueueCount(sos.length);
        setFleetCount(vehicles.length);
        setReportCount(reports.length);
      } catch {
        // keep fallback
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = () => {
    clearSessionUser();
    router.push("/login");
  };

  const officerName = user?.name || user?.email || "Signed in";
  const officerRole = user?.role === "SUPER_ADMIN" ? "Super Admin" : "Dispatcher";
  const officerInitials =
    officerName
      .split(" ")
      .filter(Boolean)
      .map((w: string) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "DO";

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 text-slate-800 select-none">
      <Sidebar
        activeItem={activeItem}
        queueCount={queueCount}
        reportCount={reportCount}
        user={user}
        fleetCount={fleetCount}
        onSignOut={handleSignOut}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Operations Header */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 z-20">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400">Operations HQ</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="font-semibold text-slate-800">{title}</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />
              <span>Active SOS: {queueCount}</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {officerInitials}
              </div>
              <div>
                <div className="leading-tight font-semibold text-slate-800">{officerName}</div>
                <div className="text-[10px] text-slate-400">{officerRole}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        {!online && <OfflineBanner />}
        <main className="flex-1 space-y-6 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
