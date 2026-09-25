"use client";

import React, { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

interface HelpSectionProps {
  onBack: () => void;
}

const FAQS = [
  {
    q: "How do Veyra @usernames work?",
    a: "Usernames must be 5–20 characters long and consist of lowercase letters, numbers, and underscores. Each username is unique and protected at the database level.",
  },
  {
    q: "How does Two-Step Verification protect me?",
    a: "When enabled, logins from new or unrecognized browsers require entering an instant 6-digit OTP code sent directly to your registered email address.",
  },
  {
    q: "What is the difference between SD and HD image quality?",
    a: "SD uses client-side smart compression targeting 300–500 KB to speed up transfers and conserve bandwidth while preserving visual clarity. HD uploads the original full-resolution photo.",
  },
  {
    q: "How does Veyra AI work?",
    a: "Veyra AI is your personal conversational companion powered by Google Gemini, capable of helping you brainstorm, answer questions, and draft messages.",
  },
];

export const HelpSection: React.FC<HelpSectionProps> = ({ onBack }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

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
          Help
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-5">
        {/* Contact Support Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-teal-500/10 to-transparent border border-blue-500/20 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-[#2563EB] dark:text-[#14B8A6]">
            <Icon name="support_agent" size="sm" />
            <h4 className="text-sm font-bold">Contact Veyra Support</h4>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Have questions, feedback, or need help? Reach out to our team anytime.
          </p>
          <div className="pt-1">
            <a
              href="mailto:support@veyra.app"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-[#2563EB] transition-colors"
            >
              <Icon name="mail" size="xs" />
              <span>Email Support (support@veyra.app)</span>
            </a>
          </div>
        </div>

        {/* FAQs Accordion */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Frequently Asked Questions
          </h4>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="p-3.5 px-4">
                <button
                  type="button"
                  onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                  className="w-full flex items-center justify-between text-left gap-2"
                >
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {faq.q}
                  </span>
                  <Icon
                    name={openIdx === idx ? "expand_less" : "expand_more"}
                    size="sm"
                    className="text-slate-400 flex-shrink-0"
                  />
                </button>
                {openIdx === idx && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed animate-in fade-in">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">System Status</span>
            <span className="font-semibold text-emerald-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Operational</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
