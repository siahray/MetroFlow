"use client";

import { useEffect, useState } from "react";
import { listSOS } from "@/lib/sos-live";
import type { SOSRequest } from "@/lib/dispatch";

export function SOSLivePanel() {
  const [sos, setSos] = useState<SOSRequest[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listSOS();
        setSos(data);
      } catch {
        // ignore
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (sos.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
      <div className="mb-2 text-xs font-bold text-rose-700">LIVE SOS REQUESTS</div>
      <div className="space-y-1">
        {sos.slice(0, 3).map((s) => (
          <div key={s.sos_id} className="flex items-center justify-between text-xs text-rose-900">
            <span>
              #{s.sos_id} • {s.status} • {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
            </span>
            {s.note ? <span className="max-w-[200px] truncate">{s.note}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
