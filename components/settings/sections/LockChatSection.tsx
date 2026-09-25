"use client";

import React, { useState } from "react";
import { UserProfile } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  setChatLockPasskey,
  disableChatLock,
  verifyPasskey,
} from "@/lib/firestore/chatLockAndListService";

interface LockChatSectionProps {
  currentUser: UserProfile;
  onBack: () => void;
}

export const LockChatSection: React.FC<LockChatSectionProps> = ({
  currentUser,
  onBack,
}) => {
  const { refreshProfile } = useAuth();

  const isEnabled = Boolean(currentUser.lockedChatEnabled && currentUser.lockedChatPasskey);

  // Setup / Change Passkey form state
  const [isSettingUp, setIsSettingUp] = useState(!isEnabled);
  const [isChangingPasskey, setIsChangingPasskey] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  // Inputs
  const [oldPasskey, setOldPasskey] = useState("");
  const [newPasskey, setNewPasskey] = useState("");
  const [confirmPasskey, setConfirmPasskey] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleToggleEnable = () => {
    setErrorMsg(null);
    if (isEnabled) {
      setIsDisabling(true);
      setIsChangingPasskey(false);
      setIsSettingUp(false);
    } else {
      setIsSettingUp(true);
      setNewPasskey("");
      setConfirmPasskey("");
    }
  };

  // Submit new passkey (initial setup)
  const handleSaveInitialPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = newPasskey.trim();
    if (!trimmed) {
      setErrorMsg("Please enter a passkey.");
      return;
    }
    if (trimmed !== confirmPasskey.trim()) {
      setErrorMsg("Passkeys do not match. Please verify.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await setChatLockPasskey(currentUser.uid, trimmed);
      if (res.success) {
        await refreshProfile();
        setIsSettingUp(false);
        setNewPasskey("");
        setConfirmPasskey("");
        showToast("Chat Lock enabled! Type your passkey in search to view locked chats. 🔒");
      } else {
        setErrorMsg(res.error || "Failed to set passkey.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving passkey.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit changed passkey
  const handleChangePasskeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!verifyPasskey(currentUser, oldPasskey)) {
      setErrorMsg("Current passkey is incorrect.");
      return;
    }

    const trimmed = newPasskey.trim();
    if (!trimmed) {
      setErrorMsg("Please enter a new passkey.");
      return;
    }
    if (trimmed !== confirmPasskey.trim()) {
      setErrorMsg("New passkeys do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await setChatLockPasskey(currentUser.uid, trimmed);
      if (res.success) {
        await refreshProfile();
        setIsChangingPasskey(false);
        setOldPasskey("");
        setNewPasskey("");
        setConfirmPasskey("");
        showToast("Passkey changed successfully! 🔑");
      } else {
        setErrorMsg(res.error || "Failed to update passkey.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error changing passkey.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm disable chat lock
  const handleConfirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!verifyPasskey(currentUser, oldPasskey)) {
      setErrorMsg("Incorrect passkey. Cannot turn off Chat Lock.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await disableChatLock(currentUser.uid);
      if (res.success) {
        await refreshProfile();
        setIsDisabling(false);
        setOldPasskey("");
        showToast("Chat Lock turned off. Locked chats are now visible.");
      } else {
        setErrorMsg(res.error || "Failed to disable chat lock.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error disabling chat lock.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0B1120]">
      {/* Top Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800">
        <button
          type="button"
          onClick={onBack}
          className="p-1 rounded-xl text-[#2563EB] dark:text-[#14B8A6] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-sm font-semibold transition-colors cursor-pointer"
        >
          <Icon name="arrow_back_ios" size="xs" />
          <span>Privacy</span>
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1 text-center pr-12">
          Lock Chat
        </h2>
      </div>

      {/* Floating Success Toast */}
      {successToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <Icon name="check_circle" size="xs" />
          <span>{successToast}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-5 pb-20">
        {/* Hero Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 dark:border-emerald-500/30 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <Icon name="lock" size="md" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Keep Chats Hidden & Secure
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              Lock sensitive conversations with a personal passkey. Locked chats are hidden from your main chat list and only revealed when you type your passkey into the search bar.
            </p>
          </div>
        </div>

        {/* Feature Toggle Card */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Lock Chat Feature
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isEnabled
                  ? "Chat Lock is active and protecting your hidden chats."
                  : "Turn on to set a passkey and start locking chats."}
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              onClick={handleToggleEnable}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isEnabled
                  ? "bg-[#00A884] dark:bg-[#14B8A6]"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {isEnabled && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                Locked chats:{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {currentUser.lockedConversationIds?.length || 0}
                </strong>
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                <Icon name="check" size="xs" /> Active
              </span>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <Icon name="error" size="xs" />
            <span className="flex-1">{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* SETUP FORM: When enabling Chat Lock for the first time */}
        {isSettingUp && !isEnabled && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-5 shadow-xs space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Icon name="key" size="xs" className="text-emerald-600" />
                <span>Create Passkey</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Your passkey can include numbers, letters, symbols, or emojis (e.g. 1234, secret#9, 🔐mychat).
              </p>
            </div>

            <form onSubmit={handleSaveInitialPasskey} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enter Passkey
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPasskey}
                    onChange={(e) => setNewPasskey(e.target.value)}
                    placeholder="Enter passkey"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title={showPassword ? "Hide passkey" : "Show passkey"}
                  >
                    <Icon name={showPassword ? "visibility_off" : "visibility"} size="xs" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Passkey
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPasskey}
                  onChange={(e) => setConfirmPasskey(e.target.value)}
                  placeholder="Re-enter passkey"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Setting Passkey..." : "Turn On Lock Chat"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* CHANGE PASSKEY FORM */}
        {isEnabled && isChangingPasskey && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] p-5 shadow-xs space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Icon name="key" size="xs" className="text-[#2563EB]" />
                <span>Change Passkey</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsChangingPasskey(false);
                  setErrorMsg(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleChangePasskeySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Passkey
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={oldPasskey}
                  onChange={(e) => setOldPasskey(e.target.value)}
                  placeholder="Enter current passkey"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Passkey
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPasskey}
                  onChange={(e) => setNewPasskey(e.target.value)}
                  placeholder="Enter new passkey"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Passkey
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPasskey}
                  onChange={(e) => setConfirmPasskey(e.target.value)}
                  placeholder="Re-enter new passkey"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                >
                  <Icon name={showPassword ? "visibility_off" : "visibility"} size="xs" />
                  <span>{showPassword ? "Hide passkeys" : "Show passkeys"}</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="py-2 px-4 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Updating..." : "Save New Passkey"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* DISABLE CONFIRMATION FORM */}
        {isEnabled && isDisabling && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#0F172A] p-5 shadow-xs space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <Icon name="lock_open" size="xs" />
                <span>Turn Off Chat Lock</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsDisabling(false);
                  setErrorMsg(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Turning off Chat Lock will reveal any previously hidden locked chats in your regular chat list. Enter your passkey to confirm.
            </p>

            <form onSubmit={handleConfirmDisable} className="space-y-3">
              <input
                type="password"
                value={oldPasskey}
                onChange={(e) => setOldPasskey(e.target.value)}
                placeholder="Enter current passkey"
                required
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Turning Off..." : "Confirm & Turn Off Chat Lock"}
              </button>
            </form>
          </div>
        )}

        {/* MANAGEMENT ACTIONS (When enabled and forms not active) */}
        {isEnabled && !isChangingPasskey && !isDisabling && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0F172A] overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsChangingPasskey(true);
                setErrorMsg(null);
              }}
              className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#2563EB] flex items-center justify-center">
                  <Icon name="key" size="xs" />
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Change Passkey
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Update your secret passkey
                  </p>
                </div>
              </div>
              <Icon name="chevron_right" size="sm" className="text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsDisabling(true);
                setErrorMsg(null);
              }}
              className="w-full flex items-center justify-between p-3.5 px-4 text-left hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                  <Icon name="lock_open" size="xs" />
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                    Turn Off Chat Lock
                  </h5>
                  <p className="text-[11px] text-slate-400">
                    Unlock all hidden chats and remove passkey
                  </p>
                </div>
              </div>
              <Icon name="chevron_right" size="sm" className="text-rose-400" />
            </button>
          </div>
        )}

        {/* Instructions / How It Works Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase tracking-wider">
            <Icon name="help_outline" size="xs" className="text-[#2563EB]" />
            <span>How to Use Locked Chats</span>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
                1
              </span>
              <p>
                <strong>Lock any chat:</strong> In your chats list, long-press or right-click any conversation, choose <strong>Lock chat</strong>, and enter your passkey.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
                2
              </span>
              <p>
                <strong>Find locked chats:</strong> Type your secret passkey into the search bar. A special <strong>Locked Chats</strong> folder will appear at the top of the search results.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center flex-shrink-0 text-[10px]">
                3
              </span>
              <p>
                <strong>Unlock a chat:</strong> Open the Locked Chats folder, right-click the chat, and select <strong>Unlock chat</strong> to return it to your regular chats.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
