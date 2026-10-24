"use client";

import { CheckSquare, LogOut, Map, Radar, Shield, Truck, Waves } from "lucide-react";

import { cn } from "@/lib/cn";

export type NavItem = "triage" | "radar" | "sensors" | "fleet";

const NAV_ITEMS = [
  { id: "triage" as NavItem, label: "Triage & Verification", icon: CheckSquare },
  { id: "radar" as NavItem, label: "Dispatch Radar", icon: Radar },
  { id: "sensors" as NavItem, label: "Live Map & Hazards", icon: Map },
  { id: "fleet" as NavItem, label: "Rescue Units & Fleet", icon: Truck },
] as const;

type SidebarProps = {
  activeItem?: string;
  queueCount: number;
  onSignOut: () => void;
  onNavigate: (id: string, label: string) => void;
};

export function Sidebar({
  activeItem = "triage",
  queueCount,
  onSignOut,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="flex w-64 flex-shrink-0 select-none flex-col justify-between border-r border-slate-800 bg-slate-900 text-slate-300">
      <div>
        {/* App Logo Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white shadow-md shadow-sky-500/20">
            <Waves className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base leading-none font-bold text-white">MetroFlow</div>
            <div className="mt-1 text-[10px] font-semibold tracking-wider text-sky-400 uppercase">
              LGU Operations
            </div>
          </div>
        </div>

        {/* Alert Status Banner */}
        <div className="mx-3 my-3 flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            <span className="text-xs font-semibold text-amber-300">Status: Level 2 Alert</span>
          </div>
          <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
            14 SOS
          </span>
        </div>

        {/* Nav Links */}
        <nav className="space-y-1 px-2 text-xs font-medium">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeItem;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id, item.label)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-sky-600 font-semibold text-white shadow-sm"
                    : "text-slate-400 hover:bg-slate-800/70 hover:text-white",
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-white" : "text-slate-400")} />
                <span>{item.label}</span>
                {item.id === "triage" ? (
                  <span className="ml-auto rounded bg-sky-400/30 px-1.5 py-0.5 font-mono text-[10px] text-white">
                    {queueCount}
                  </span>
                ) : item.id === "radar" ? (
                  <span className="ml-auto h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                ) : item.id === "fleet" ? (
                  <span className="ml-auto text-[10px] font-mono text-emerald-400">3 Active</span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Station / Officer Profile Box */}
      <div className="m-3 space-y-1 rounded-lg border border-slate-800 bg-slate-800/40 p-3 text-[11px] text-slate-400">
        <div className="flex items-center justify-between font-semibold text-slate-300">
          <span>MDRRMC PASIG</span>
          <Shield className="h-3.5 w-3.5 text-sky-400" />
        </div>
        <p className="font-medium text-slate-300">Maria Santos (Lead)</p>
        <p className="font-mono text-[10px] text-slate-500">Station 4 • Dispatch Officer</p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-2 flex w-full items-center gap-1.5 border-t border-slate-800 pt-2 text-left text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
        >
          <LogOut className="h-3 w-3" />
          <span>Sign out portal</span>
        </button>
      </div>
    </aside>
  );
}
