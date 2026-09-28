"use client";

import React from "react";
import { Icon } from "@/components/ui/Icon";

interface LeaveCallConfirmModalProps {
  isOpen: boolean;
  onConfirmLeave: () => void;
  onCancel: () => void;
}

export const LeaveCallConfirmModal: React.FC<LeaveCallConfirmModalProps> = ({
  isOpen,
  onConfirmLeave,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-call-title"
      className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-sm bg-[#161a23] border border-white/10 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center animate-in zoom-in-95 duration-150">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
          <Icon name="phone_disabled" size="md" />
        </div>

        <h3
          id="leave-call-title"
          className="text-lg font-bold text-white tracking-tight mb-2"
        >
          Leave call?
        </h3>

        <p className="text-xs sm:text-sm text-slate-300/80 mb-6 leading-relaxed">
          Leaving this page will immediately end your current ongoing call.
        </p>

        <div className="w-full flex items-center justify-center gap-3">
          <button
            onClick={onCancel}
            type="button"
            className="flex-1 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 text-xs sm:text-sm font-semibold text-slate-200 transition-all cursor-pointer"
          >
            Stay in call
          </button>
          <button
            onClick={onConfirmLeave}
            type="button"
            className="flex-1 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-xs sm:text-sm font-semibold text-white transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
          >
            Leave call
          </button>
        </div>
      </div>
    </div>
  );
};
