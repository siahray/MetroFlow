"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Dashboard } from "./dashboard";
import { LoginScreen } from "./login-screen";
import { ToastProvider, useToast } from "./toast-provider";

type Screen = "login" | "dashboard";

export function Portal() {
  return (
    <ToastProvider>
      <PortalScreens />
    </ToastProvider>
  );
}

function PortalScreens() {
  const [screen, setScreen] = useState<Screen>("login");
  const { show } = useToast();
  const transition = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signIn = useCallback(() => {
    show("Authenticated as Maria Santos (Lead Dispatcher)");

    // The toast is the only feedback while the dashboard mounts.
    transition.current = setTimeout(() => setScreen("dashboard"), 600);
  }, [show]);

  const signOut = useCallback(() => {
    setScreen("login");
    show("Signed out of the dispatch portal");
  }, [show]);

  useEffect(
    () => () => {
      if (transition.current) {
        clearTimeout(transition.current);
      }
    },
    [],
  );

  return screen === "login" ? <LoginScreen onSignIn={signIn} /> : <Dashboard onSignOut={signOut} />;
}
