import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSOS, getSOSLog, type IncidentLogItem, type SOSRequest } from './api';
import { SOSUpdateModal } from './components/SOSUpdateModal';
import { loadCache, saveCache } from './offline';
import { sosPhase } from './sosStatus';

/** Once an incident reaches one of these states, polling its status is pointless. */
const FINAL_SOS_STATUSES = new Set(['RESOLVED', 'REJECTED']);

/** Persisted so the active SOS survives navigating away and back, or reopening the app. */
const ACTIVE_SOS_KEY = 'active_sos';
type PersistedSOS = { sosId: number; lastSeenStatus: string };

type SOSTrackerValue = {
  /** The driver's own open incident (FSD-FR-074) — null once resolved or dismissed. */
  activeSOS: SOSRequest | null;
  sosLog: IncidentLogItem[];
  /** Call right after a successful `createSOS` to start tracking it. */
  track: (sos: SOSRequest) => void;
  /** Manual "Check Status" refresh. */
  refresh: () => Promise<void>;
  /** Open the update modal on demand (the "View Updates" button). */
  showUpdates: () => void;
  /** The driver explicitly returns home; a rejected incident stays until then. */
  clearActive: () => void;
};

const SOSTrackerContext = createContext<SOSTrackerValue | null>(null);

export function useSOSTracker(): SOSTrackerValue {
  const ctx = useContext(SOSTrackerContext);
  if (!ctx) throw new Error('useSOSTracker must be used within SOSTrackerProvider');
  return ctx;
}

/**
 * Tracks the driver's own open SOS app-wide (mounted once at the root layout,
 * not per-screen) so the dispatch-update modal pops up on a status change no
 * matter which tab the driver is on, not only while the SOS screen itself is
 * focused.
 */
export function SOSTrackerProvider({ children }: { children: React.ReactNode }) {
  const [activeSOS, setActiveSOS] = useState<SOSRequest | null>(null);
  const [sosLog, setSosLog] = useState<IncidentLogItem[]>([]);
  // Kept separate so the completion notice can still show the finished
  // incident after `activeSOS` is cleared and the screen resets.
  const [modalSOS, setModalSOS] = useState<SOSRequest | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // The status the driver last actually saw, so a change -- whether noticed by
  // the poll below or on resuming the app -- can pop the update modal instead
  // of silently overwriting what was last shown.
  const lastSeenStatus = useRef<string | null>(null);

  async function refreshLog(sosId: number) {
    try {
      setSosLog(await getSOSLog(sosId));
    } catch {
      // Keep the last known log; the next refresh retries.
    }
  }

  function applyUpdated(updated: SOSRequest, { announce }: { announce: boolean }) {
    setActiveSOS(updated);
    const changed = updated.status !== lastSeenStatus.current;
    lastSeenStatus.current = updated.status;
    if (sosPhase(updated.status) === 'completed') {
      // Rescue is over: the SOS screen returns to its empty form. The modal
      // keeps this incident so the driver still sees "You are all clear".
      setActiveSOS(null);
      lastSeenStatus.current = null;
      void saveCache(ACTIVE_SOS_KEY, null);
    } else {
      const toSave: PersistedSOS = { sosId: updated.sos_id, lastSeenStatus: updated.status };
      void saveCache(ACTIVE_SOS_KEY, toSave);
    }
    if (changed) {
      setModalSOS(updated);
      void refreshLog(updated.sos_id);
      if (announce) setModalVisible(true);
    }
  }

  // Resume an SOS still open from a previous app session, as soon as the app
  // starts -- not just when the driver happens to revisit the SOS screen.
  useEffect(() => {
    (async () => {
      const saved = await loadCache<PersistedSOS>(ACTIVE_SOS_KEY);
      if (!saved) return;
      lastSeenStatus.current = saved.lastSeenStatus;
      try {
        const updated = await getSOS(saved.sosId);
        applyUpdated(updated, { announce: true });
        if (updated.status === saved.lastSeenStatus) await refreshLog(saved.sosId);
      } catch {
        // Could not resume (deleted, offline) -- stay with no active SOS.
      }
    })();
    // Runs once at app start: this is resuming prior state, not reacting to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The SOS change feed is dispatcher-only, so a driver polls its own submission
  // until the dispatcher's decision arrives (FSD-FR-074).
  const trackedSOSId = activeSOS?.sos_id ?? null;
  const trackedSOSFinal = activeSOS ? FINAL_SOS_STATUSES.has(activeSOS.status.toUpperCase()) : true;

  useEffect(() => {
    if (trackedSOSId === null || trackedSOSFinal) return;
    const timer = setInterval(() => {
      getSOS(trackedSOSId)
        .then((updated) => applyUpdated(updated, { announce: true }))
        .catch(() => {
          // Keep the last known status; the next poll or manual refresh retries.
        });
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedSOSId, trackedSOSFinal]);

  function track(sos: SOSRequest) {
    setActiveSOS(sos);
    setModalSOS(sos);
    lastSeenStatus.current = sos.status;
    void saveCache(ACTIVE_SOS_KEY, { sosId: sos.sos_id, lastSeenStatus: sos.status } satisfies PersistedSOS);
    void refreshLog(sos.sos_id);
  }

  async function refresh() {
    if (!activeSOS) return;
    try {
      const updated = await getSOS(activeSOS.sos_id);
      applyUpdated(updated, { announce: true });
    } catch {
      // Status refresh failure is non-critical; keep showing last known status.
    }
  }

  function showUpdates() {
    setModalVisible(true);
  }

  function clearActive() {
    setActiveSOS(null);
    setModalSOS(null);
    setSosLog([]);
    lastSeenStatus.current = null;
    void saveCache(ACTIVE_SOS_KEY, null);
  }

  return (
    <SOSTrackerContext.Provider value={{ activeSOS, sosLog, track, refresh, showUpdates, clearActive }}>
      {children}
      <SOSUpdateModal
        visible={modalVisible}
        sos={modalSOS}
        onClose={() => setModalVisible(false)}
      />
    </SOSTrackerContext.Provider>
  );
}
