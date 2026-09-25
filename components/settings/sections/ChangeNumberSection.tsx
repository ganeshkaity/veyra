"use client";

import React, { useState } from "react";
import { UserProfile } from "@/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateUserProfile } from "@/lib/firestore/userService";
import { useAuth } from "@/components/providers/AuthProvider";

interface ChangeNumberSectionProps {
  currentUser: UserProfile;
  onBack: () => void;
}

export const ChangeNumberSection: React.FC<ChangeNumberSectionProps> = ({
  currentUser,
  onBack,
}) => {
  const { refreshProfile } = useAuth();
  const currentPhone = currentUser.mobileNumber || currentUser.phoneNumber || "";
  const [phoneInput, setPhoneInput] = useState(currentPhone);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) {
      setErrorMsg("Please enter a valid phone number.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      const res = await updateUserProfile(currentUser.uid, {
        mobileNumber: phoneInput.trim(),
        phoneNumber: phoneInput.trim(),
      });
      if (!res.success) {
        setErrorMsg(res.error || "Failed to update phone number.");
        return;
      }
      await refreshProfile();
      setSuccessMsg("Phone number changed successfully!");
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving phone number";
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] dark:bg-[#0B1120]">
      {/* Top Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-[#0F172A] border-b border-slate-200/80 dark:border-slate-800">
        <button
          onClick={onBack}
          className="p-1 rounded-xl text-[#2563EB] dark:text-[#14B8A6] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 text-sm font-semibold transition-colors"
        >
          <Icon name="arrow_back_ios" size="xs" />
          <span>Account</span>
        </button>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex-1 text-center pr-12">
          Change Number
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-6">
        {/* Visual Hero Banner */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#2563EB]/10 dark:bg-[#2563EB]/20 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center">
            <Icon name="phone_iphone" size="lg" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Change your phone number
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
            Changing your phone number will migrate your account info, groups, and settings to the new number.
          </p>
        </div>

        {/* Change Phone Form */}
        <form onSubmit={handleSavePhone} className="p-5 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold">
              {successMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Current Phone Number
            </label>
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-sm font-mono border border-slate-200 dark:border-slate-700/60">
              {currentPhone || "Not set"}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              New Phone Number
            </label>
            <Input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+91 98765 43210"
              leftIcon={<Icon name="call" size="xs" />}
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onBack}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="md"
              isLoading={isSaving}
              leftIcon={<Icon name="check" size="xs" />}
            >
              Update Number
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
