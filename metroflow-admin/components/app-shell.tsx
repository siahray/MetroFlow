"use client";

import { ChevronRight, Keyboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { OfflineBanner } from "./error-notice";
import { Sidebar, type NavItem } from "./sidebar";
import { listReports } from "@/lib/reports";
import { listSOS } from "@/lib/sos-live";
import { listVehicles } from "@/lib/dispatch";
import {
  clearSessionUser,
  getSessionUser,
  startSessionWatch,
  subscribeToSession,
} from "@/lib/session";

type AppShellProps = {
  activeItem: NavItem;
  title: string;
  children: ReactNode;
};

/** P3-1: power-user shortcuts. `go` paths are portal routes; `focus` targets a DOM id. */
const SHORTCUTS: { keys: string; label: string; go?: string; focus?: string }[] = [
  { keys: "Ctrl K", label: "Focus incident search", focus: "incident-search" },
  { keys: "Ctrl T", label: "Go to triage", go: "/triage" },
  { keys: "Ctrl R", label: "Go to dispatch radar", go: "/radar" },
  { keys: "Ctrl H", label: "Go to hazards", go: "/hazards" },
  { keys: "Ctrl F", label: "Go to fleet", go: "/fleet" },
  { keys: "Ctrl M", label: "Go to moderation", go: "/moderation" },
  { keys: "Ctrl U", label: "Go to users", go: "/users" },
  { keys: "Ctrl E", label: "Go to export", go: "/export" },
  { keys: "?", label: "Show this shortcut list" },
];

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm animate-modal-in rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-900">Keyboard shortcuts</h2>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.keys} className="flex items-center justify-between text-xs">
              <span className="text-slate-600">{shortcut.label}</span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                {shortcut.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // P3-1: global shortcuts. Navigation uses Ctrl/Cmd so plain typing is unaffected.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod && event.key !== "?") return;
      if (isTypingTarget(event.target) && !mod) return;

      const key = event.key.toLowerCase();
      if (mod && !event.shiftKey && !event.altKey) {
        const letter = key;
        const match = SHORTCUTS.find(
          (s) => s.go && s.keys.replace(/^Ctrl /, "").toLowerCase() === letter,
        );
        if (match?.go) {
          event.preventDefault();
          router.push(match.go);
          return;
        }
        if (letter === "k") {
          event.preventDefault();
          document.getElementById("incident-search")?.focus();
          return;
        }
      }
      if (!mod && key === "?") {
        event.preventDefault();
        setShortcutsOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // The portal has no server-side session, so the shell reads the browser cache
  // through useSyncExternalStore instead of copying it into state from an effect.
  const user = useSyncExternalStore(subscribeToSession, getSessionUser, () => null);
  const [queueCount, setQueueCount] = useState(0);
  const [fleetCount, setFleetCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);

  // Read the store instead of the rendered value: during hydration the server
  // snapshot is `null`, so trusting `user` here signs a valid session out on
  // every refresh, before the browser cache is read.
  useEffect(() => {
    if (getSessionUser() === null) router.replace("/login");
  }, [user, router]);

  // Sign out after 15 minutes without operator input.
  useEffect(() => startSessionWatch(), []);

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
            <span className="text-slate-500">Operations HQ</span>
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
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white">
                {officerInitials}
              </div>
              <div>
                <div className="leading-tight font-semibold text-slate-800">{officerName}</div>
                <div className="text-[10px] text-slate-500">{officerRole}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        {!online && <OfflineBanner />}
        <main className="flex-1 animate-fade-in space-y-6 overflow-y-auto p-6">{children}</main>
      </div>

      {shortcutsOpen ? <ShortcutHelp onClose={() => setShortcutsOpen(false)} /> : null}
    </div>
  );
}
