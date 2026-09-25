"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";

interface AboutSectionProps {
  onBack: () => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ onBack }) => {
  const [legalModal, setLegalModal] = useState<{
    title: string;
    content: string;
  } | null>(null);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0B1120]">
      {/* Top Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800">
        <button
          onClick={onBack}
          className="p-1 rounded-xl text-[#2563EB] dark:text-[#14B8A6] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-sm font-semibold transition-colors"
        >
          <Icon name="arrow_back_ios" size="xs" />
          <span>Settings</span>
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1 text-center pr-12">
          About
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-6">
        {/* Brand Banner Card */}
        <div className="flex flex-col items-center text-center p-6 rounded-3xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg p-2 bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700">
            <Image
              src="/assets/main_logo.png"
              alt="Veyra"
              width={72}
              height={72}
              className="object-contain"
            />
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Veyra
            </h3>
            <p className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#2563EB] to-[#14B8A6] mt-0.5">
              "Har Baat, Apno Ke Saath."
            </p>
            <span className="inline-block text-[11px] font-mono px-2.5 py-0.5 mt-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
              Version 1.0.0 (Production Stable)
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed pt-1">
            A fast, private, and modern messaging application built on real Firebase Realtime Database and Firestore architecture.
          </p>
        </div>

        {/* Legal & Policies */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
          <button
            type="button"
            onClick={() =>
              setLegalModal({
                title: "Terms of Service",
                content:
                  "By using Veyra, you agree to respect community guidelines, maintain account security, and refrain from transmitting unlawful content. Your data is protected under modern encryption standards.",
              })
            }
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Terms of Service
            </span>
            <Icon name="chevron_right" size="sm" className="text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() =>
              setLegalModal({
                title: "Privacy Policy",
                content:
                  "Veyra values your privacy. We store user profile data and messages in secure Firebase Firestore databases with strict security rules. Images and attachments are hosted securely without third-party tracking.",
              })
            }
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Privacy Policy
            </span>
            <Icon name="chevron_right" size="sm" className="text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() =>
              setLegalModal({
                title: "Open Source Licenses",
                content:
                  "Veyra is built using Next.js, React, Tailwind CSS, Firebase Client SDK, Material Symbols, and Lucide. All libraries belong to their respective authors under MIT and Apache-2.0 licenses.",
              })
            }
            className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Open Source Licenses
            </span>
            <Icon name="chevron_right" size="sm" className="text-slate-400" />
          </button>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-400 space-y-1">
          <p>© 2026 Veyra Inc. All rights reserved.</p>
          <p>Built with Google Antigravity & DeepMind Advanced Agentic Coding.</p>
        </div>
      </div>

      {/* Legal Dialog */}
      <Modal
        isOpen={!!legalModal}
        onClose={() => setLegalModal(null)}
        title={legalModal?.title || ""}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {legalModal?.content}
          </p>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setLegalModal(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
