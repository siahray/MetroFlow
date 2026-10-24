"use client";

import { LoginScreen } from "@/components/login-screen";
import { ToastProvider, useToast } from "@/components/toast-provider";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

function LoginPage() {
  const router = useRouter();
  const { show } = useToast();

  const signIn = useCallback(
    (userData?: any) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("metroflow_user", JSON.stringify(userData || null));
      }
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
