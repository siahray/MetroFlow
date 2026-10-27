"use client";

import { LoginScreen } from "@/components/login-screen";
import { ToastProvider, useToast } from "@/components/toast-provider";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { storeSessionUser, type SessionUser } from "@/lib/session";

function LoginPage() {
  const router = useRouter();
  const { show } = useToast();

  const signIn = useCallback(
    (userData?: SessionUser, token?: string) => {
      storeSessionUser(userData ?? null, token ?? null);
      const name = userData?.name || "";
      show(name ? `Authenticated as ${name} (Lead Dispatcher)` : "Authenticated");
      setTimeout(() => router.push("/triage"), 300);
    },
    [show, router],
  );

  return <LoginScreen onSignIn={signIn} />;
}

export default function Page() {
  return (
    <ToastProvider>
      <LoginPage />
    </ToastProvider>
  );
}
