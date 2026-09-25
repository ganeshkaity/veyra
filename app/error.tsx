"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/constants/brand";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.error("Unhandled Application Error:", error);
  }, [error]);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center bg-[#F8FAFC] dark:bg-[#090E17] text-slate-800 dark:text-slate-100 overflow-hidden select-none transition-colors duration-300">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-rose-500/10 via-blue-500/10 to-teal-400/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link
          href="/chat"
          className="flex items-center gap-2.5 group transition-transform active:scale-95"
        >
          <div className="w-10 h-10 flex items-center justify-center transition-colors">
            <Image
              src="/assets/favicon.png"
              alt={BRAND.name}
              width={28}
              height={28}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-[#2563EB] to-[#14B8A6] bg-clip-text text-transparent">
              {BRAND.name}
            </span>
            <p className="text-[10px] text-slate-400 font-medium leading-none">
              {BRAND.tagline}
            </p>
          </div>
        </Link>

        {mounted && (
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="flex items-center gap-2 px-3.5 py-2.5 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs font-medium cursor-pointer"
          >
            <Icon
              name={theme === "dark" ? "light_mode" : "dark_mode"}
              size="sm"
              className={theme === "dark" ? "text-[#14B8A6]" : "text-[#2563EB]"}
            />
          </button>
        )}
      </header>

      {/* Main Error Content */}
      <main className="relative z-10 w-full max-w-xl mx-auto px-6 py-8 flex flex-col items-center text-center">
        {/* Dynamic Warning Icon Badge */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute w-36 h-36 rounded-full border border-rose-500/20 animate-pulse" />
          <div className="relative w-24 h-24 rounded-3xl bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 shadow-xl flex items-center justify-center animate-float-subtle">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-[#2563EB] flex items-center justify-center text-white shadow-md shadow-rose-500/20">
              <Icon name="error_outline" size="lg" />
            </div>
          </div>
        </div>

        {/* Minimal Error Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 text-xs font-semibold tracking-wide uppercase mb-3">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          Application Error
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mb-2">
          Something unexpected happened
        </h1>

        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
          We encountered an error while loading this screen. Don't worry, your chats and data remain secure.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
          <Button
            size="md"
            variant="primary"
            onClick={() => reset()}
            leftIcon={<Icon name="refresh" size="sm" />}
            className="w-full sm:w-auto"
          >
            Try Again
          </Button>

          <Button
            size="md"
            variant="outline"
            onClick={() => router.push("/chat")}
            leftIcon={<Icon name="chat" size="sm" />}
            className="w-full sm:w-auto"
          >
            Go to Chats
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-6 text-xs text-slate-400">
        <p>
          © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
