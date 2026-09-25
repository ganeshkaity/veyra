"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { usePwa } from "@/components/providers/PwaProvider";

export const InstallAppModal: React.FC = () => {
  const { isInstallModalOpen, closeInstallModal, isInstallable, installApp, isInstalled, platform } = usePwa();
  const [activeTab, setActiveTab] = useState<"desktop" | "android" | "ios">(
    platform === "android" ? "android" : platform === "ios" ? "ios" : "desktop"
  );

  if (!isInstallModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeInstallModal}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#0F172A] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-6 animate-in zoom-in-95 duration-150 select-none text-slate-800 dark:text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 p-0.5 shadow-md flex items-center justify-center flex-shrink-0">
              <div className="w-full h-full rounded-[14px] bg-white dark:bg-[#0B1120] flex items-center justify-center overflow-hidden p-1.5">
                <Image
                  src="/icons/icon-192x192.png"
                  alt="Veyra Logo"
                  width={36}
                  height={36}
                  className="object-contain"
                />
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Install Veyra
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fast, secure native desktop & mobile experience
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeInstallModal}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        {/* Platform Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-2xl my-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("desktop")}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "desktop"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-teal-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            <Icon name="laptop_mac" size="xs" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("android")}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "android"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-teal-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            <Icon name="phone_android" size="xs" />
            <span>Android</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ios")}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "ios"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-teal-400 shadow-xs"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            <Icon name="phone_iphone" size="xs" />
            <span>iOS</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-3.5 py-1 text-xs">
          {activeTab === "desktop" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-teal-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Click the Install icon in your address bar
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Look for the <span className="font-bold">Install</span> computer icon on the right side of Chrome or Edge URL bar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-teal-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Or use the browser menu
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Click browser menu <span className="font-bold">(⋮)</span> &gt; <span className="font-bold">Save and share</span> &gt; <span className="font-bold">Install Veyra</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "android" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Open Chrome browser menu
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Tap the three dots <span className="font-bold">(⋮)</span> in the top-right corner.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Tap &quot;Install app&quot; or &quot;Add to Home screen&quot;
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Confirm the prompt. Veyra will install with a native app icon and launch in full-screen TWA standalone mode.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-700 dark:text-amber-300">
                <p className="font-semibold flex items-center gap-1.5 mb-1">
                  <Icon name="info" size="xs" /> Testing over local Wi-Fi?
                </p>
                <p>
                  Android Chrome requires HTTPS or localhost to trigger the native WebAPK install dialog. Run <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[10px]">adb reverse tcp:3000 tcp:3000</code> and open <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-[10px]">http://localhost:3000</code> on your phone.
                </p>
              </div>
            </div>
          )}

          {activeTab === "ios" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-teal-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Tap the Share button in Safari
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Tap the square icon with the upward arrow at the bottom of Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-teal-400 flex items-center justify-center font-bold text-[11px] flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Select &quot;Add to Home Screen&quot;
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Scroll down and tap <span className="font-bold">&quot;Add to Home Screen&quot;</span>, then tap <span className="font-bold">&quot;Add&quot;</span>.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Benefits Badges */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 py-3 border-t border-slate-100 dark:border-slate-800 mt-3">
          <span className="flex items-center gap-1">
            <Icon name="offline_pin" size="xs" className="text-emerald-500" /> Offline cache
          </span>
          <span className="flex items-center gap-1">
            <Icon name="bolt" size="xs" className="text-amber-500" /> Fast loading
          </span>
          <span className="flex items-center gap-1">
            <Icon name="fullscreen" size="xs" className="text-blue-500" /> Fullscreen TWA
          </span>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          {isInstalled ? (
            <div className="w-full py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs font-bold flex items-center justify-center gap-2">
              <Icon name="check_circle" size="xs" />
              <span>Veyra is Already Installed</span>
            </div>
          ) : isInstallable ? (
            <button
              type="button"
              onClick={async () => {
                await installApp();
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white rounded-2xl text-xs font-bold transition shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Icon name="download" size="xs" />
              <span>Install Veyra Now</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={closeInstallModal}
              className="w-full py-2.5 px-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-xs font-bold transition hover:opacity-90 flex items-center justify-center cursor-pointer"
            >
              Got It
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
