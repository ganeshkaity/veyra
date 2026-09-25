"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { BRAND } from "@/constants/brand";

export default function NotFound() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [attemptedPath, setAttemptedPath] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setAttemptedPath(window.location.pathname);
    }
  }, []);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center bg-[#F8FAFC] dark:bg-[#090E17] text-slate-800 dark:text-slate-100 overflow-hidden select-none transition-colors duration-300">
      {/* Background Animated Gradient Blobs & Subtle Grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Radial Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-blue-500/15 to-teal-400/15 dark:from-blue-600/20 dark:to-teal-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 -right-20 w-80 h-80 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-2xl" />
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-teal-500/10 dark:bg-teal-600/10 rounded-full blur-2xl" />

        {/* Minimal Grid Overlay */}
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
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-[#2563EB] to-[#14B8A6] bg-clip-text text-transparent">
                {BRAND.name}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-none">
              {BRAND.tagline}
            </p>
          </div>
        </Link>

        {/* Quick Theme Toggle */}
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

      {/* Central 404 Interactive Content */}
      <main className="relative z-10 w-full max-w-xl mx-auto px-6 py-8 flex flex-col items-center text-center">
        {/* Dynamic Animated Radar / Floating Signal Beacon */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Animated Concentric Ripple Waves */}
          <div className="absolute w-44 h-44 rounded-full border border-blue-500/20 dark:border-blue-400/20 animate-ping opacity-75" />
          <div className="absolute w-36 h-36 rounded-full border border-teal-500/25 dark:border-teal-400/25 animate-pulse" />
          <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-[#2563EB]/10 to-[#14B8A6]/10 blur-sm" />

          {/* Central Orbiting Beacon Badge */}
          <div className="relative w-24 h-24 rounded-3xl bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-blue-500/5 dark:shadow-teal-500/5 flex items-center justify-center animate-float-subtle">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#2563EB] to-[#14B8A6] flex items-center justify-center text-white shadow-md shadow-blue-500/25">
              <Icon name="explore_off" size="lg" className="animate-spin-slow" />
            </div>

            {/* Orbiting Satellite Dot */}
            <div className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-[#14B8A6] border-2 border-white dark:border-[#0F172A]" />
            </div>
          </div>
        </div>

        

        {/* Big Stylized Numeric 404 */}
        <h1 className="text-7xl sm:text-8xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-[#2563EB] via-indigo-500 to-[#14B8A6] mb-3 select-none drop-shadow-xs">
          404
        </h1>

        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-2">
          Lost in Conversation?
        </h2>

        {/* Subtitle Description */}
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed mb-4">
          The link you followed may be broken, misconfigured, or the page has been moved to another location.
        </p>

        {/* Display Attempted Path */}
        {attemptedPath && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-600 dark:text-slate-300 mb-6 max-w-sm truncate">
            <Icon name="link_off" size="xs" className="text-slate-400 flex-shrink-0" />
            <span className="truncate">{attemptedPath}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto mb-8">
          <Button
            size="md"
            variant="primary"
            onClick={() => router.push("/chat")}
            leftIcon={<Icon name="chat" size="sm" />}
            className="w-full sm:w-auto"
          >
            Back to Chats
          </Button>

          <Button
            size="md"
            variant="outline"
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/chat");
              }
            }}
            leftIcon={<Icon name="arrow_back" size="sm" />}
            className="w-full sm:w-auto"
          >
            Go Back
          </Button>
        </div>

        {/* Quick Route Shortcuts */}
        <div className="w-full max-w-md pt-5 border-t border-slate-200/70 dark:border-slate-800/80">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Quick Navigation Links
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { label: "Chats", path: "/chat", icon: "forum" },
              { label: "Settings", path: "/setting", icon: "settings" },
              { label: "Status", path: "/status", icon: "donut_large" },
              { label: "Groups", path: "/groups", icon: "groups" },
              { label: "Profile", path: "/profile", icon: "person" },
            ].map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => router.push(item.path)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-[#2563EB]/50 dark:hover:border-[#14B8A6]/50 hover:text-[#2563EB] dark:hover:text-[#14B8A6] transition-all shadow-2xs"
              >
                <Icon name={item.icon} size="xs" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
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
