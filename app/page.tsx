"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

export default function SplashPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/chat");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-app)]">
        <div className="relative w-24 h-24 mb-4 animate-pulse">
          <Image
            src="/assets/main_logo.png"
            alt="Veyra Logo"
            width={96}
            height={96}
            priority
            className="w-full h-full object-contain"
          />
        </div>
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-between p-6 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-blue-50/40 dark:from-[#090E17] dark:via-[#0F172A] dark:to-[#0B1528]">
      {/* Header bar with Theme Toggle */}
      <header className="w-full max-w-5xl flex items-center justify-between py-4 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm flex items-center justify-center">
            <Image
              src="/assets/main_logo.png"
              alt="Veyra"
              width={36}
              height={36}
              className="object-contain"
            />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-slate-100">
            Veyra
          </span>
        </div>

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} size="sm" />
        </button>
      </header>

      {/* Decorative gradient glow orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-blue-500/15 via-teal-400/15 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Center Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center max-w-xl z-10 py-12 px-4">
        {/* Animated Brand Logo Container */}
        <div className="relative mb-8 group">
          <div className="absolute -inset-4 bg-gradient-to-r from-[#2563EB] to-[#14B8A6] rounded-3xl opacity-20 blur-xl group-hover:opacity-30 transition duration-500" />
          <div className="relative w-36 h-36 md:w-44 md:h-44 p-4 rounded-3xl bg-white/90 dark:bg-slate-900/90 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 backdrop-blur-xl flex items-center justify-center transform transition duration-500 hover:scale-105">
            <Image
              src="/assets/main_logo.png"
              alt="Veyra Brand Logo"
              width={160}
              height={160}
              priority
              className="object-contain"
            />
          </div>
        </div>

        {/* Title and Tagline */}
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-3">
          Veyra
        </h1>
        <p className="text-lg md:text-xl font-medium text-transparent bg-clip-text bg-gradient-to-r from-[#2563EB] to-[#14B8A6] mb-6">
          "Har Baat, Apno Ke Saath."
        </p>

        <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-10 leading-relaxed">
          Stay seamlessly connected with the people who matter most. Fast, secure, and intuitive messaging for your everyday conversations.
        </p>

        {/* Call to action */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link href="/auth" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto min-w-[200px] shadow-lg shadow-blue-500/25 text-base font-semibold"
              rightIcon={<Icon name="arrow_forward" size="sm" />}
            >
              Get Started
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 dark:text-slate-500 gap-2 border-t border-slate-200/50 dark:border-slate-800/50 z-10">
        <p>© {new Date().getFullYear()} Veyra. All rights reserved.</p>
        <p>Private & Secure Messaging</p>
      </footer>
    </div>
  );
}
