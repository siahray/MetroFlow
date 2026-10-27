"use client";

import { ArrowRight, Eye, EyeOff, Lock, ShieldAlert, ShieldCheck, User, Waves } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useToast } from "./toast-provider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function LoginScreen({ onSignIn }: { onSignIn: (user?: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { show } = useToast();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: username, password }),
      });
      if (!res.ok) {
        throw new Error("Invalid credentials");
      }
      const data = await res.json();
      setIsSubmitting(false);
      const user = data.user || data;
      if (user.role !== "LGU_DISPATCHER" && user.role !== "SUPER_ADMIN") {
        setError("Only authorized admin accounts can access this system");
        return;
      }
      onSignIn(user);
    } catch (e) {
      setIsSubmitting(false);
      setError("Invalid credentials");
      show("Authentication failed");
    }
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between bg-slate-100 p-4 md:p-6 select-none">
      <div className="flex flex-col items-center justify-between gap-2 border-b border-slate-200/80 pb-3 text-xs font-medium text-slate-500 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-ping rounded-full bg-emerald-500" />
          <span className="font-semibold tracking-wider text-slate-700 uppercase">
            MDRRMC Operational Grid
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-mono text-slate-500">NODE PH-NCR-04</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-slate-600 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>SSL 256-Bit Encrypted</span>
          </span>
          <span className="font-mono text-slate-400">v4.8.2-rc</span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        <div className="relative w-full max-w-md space-y-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-sky-500 via-sky-600 to-indigo-600" />

          <div className="space-y-2 text-center">
            <div className="mb-1 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-sky-600 shadow-sm">
              <Waves className="h-6 w-6 text-sky-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">MetroFlow Portal</h1>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              LGU Dispatch & Triage System
            </p>
            <p className="text-xs text-slate-400">
              Sign in to access operational dispatch controls
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label
                htmlFor="username"
                className="mb-1 block text-xs font-semibold text-slate-600 uppercase"
              >
                Email / Username
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="h-4 w-4" />
                </span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pr-3 pl-9 text-sm transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                  placeholder="Enter your authorized account"
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-600 uppercase"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() =>
                    show("Please contact CDMO System Admin (+63 2 8888-FLOW) to reset credentials.")
                  }
                  className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pr-10 pl-9 text-sm transition-all focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((current) => !current)}
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs">
              <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Remember session for 12 hours</span>
              </label>
            </div>

            {/* Approved primary color: slate-900 (not navy-950) */}
            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-slate-900/10 transition-all duration-200 hover:bg-slate-800 hover:shadow-lg disabled:opacity-50"
            >
              <span>{isSubmitting ? "Authenticating..." : "Sign in to Dispatch Operations"}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>

          <div className="space-y-2 border-t border-slate-100 pt-4 text-center">
            <span className="inline-block text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Official Service
            </span>
            <div className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <ShieldAlert className="h-4 w-4 text-sky-600" />
              <span className="font-medium">Authorized LGU & MDRRMC Personnel Only</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1 py-2 text-center text-xs text-slate-500">
        <p>Pasig-Marikina River Basin Disaster Risk Reduction Network</p>
        <p className="text-slate-400">
          Need operational support? Contact CDMO Ops at{" "}
          <span className="font-mono text-slate-600">+63 (2) 8888-FLOW</span>
        </p>
      </div>
    </div>
  );
}
